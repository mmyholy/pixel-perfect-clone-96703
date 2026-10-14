CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  available_balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- prevent clients editing balance directly
CREATE OR REPLACE FUNCTION public.protect_balance() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_setting('saveflow.internal', true) IS DISTINCT FROM 'on' THEN
    NEW.available_balance := OLD.available_balance;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_protect_balance BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_balance();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), COALESCE(NEW.raw_user_meta_data->>'phone', ''));
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  percentage numeric NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  asset text NOT NULL CHECK (asset IN ('NGN','USD','BTC','USDT')),
  target_amount numeric,
  maturity_date date NOT NULL,
  interest_rate numeric NOT NULL DEFAULT 0,
  principal_ngn numeric NOT NULL DEFAULT 0,
  units numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own goals select" ON public.goals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own goals insert" ON public.goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own goals delete" ON public.goals FOR DELETE TO authenticated USING (auth.uid() = user_id AND principal_ngn = 0);

CREATE OR REPLACE FUNCTION public.validate_goal() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE total numeric;
BEGIN
  IF NEW.status = 'active' THEN
    SELECT COALESCE(SUM(percentage),0) INTO total FROM public.goals
      WHERE user_id = NEW.user_id AND status = 'active' AND id <> NEW.id;
    IF total + NEW.percentage > 100 THEN
      RAISE EXCEPTION 'Total percentage across goals cannot exceed 100%% (currently %%%)', total;
    END IF;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.maturity_date <= current_date THEN
    RAISE EXCEPTION 'Maturity date must be in the future';
  END IF;
  IF TG_OP = 'INSERT' THEN NEW.principal_ngn := 0; NEW.units := 0; NEW.status := 'active'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER goals_validate BEFORE INSERT OR UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.validate_goal();

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('inflow','allocation','withdrawal','penalty','interest')),
  amount_ngn numeric NOT NULL,
  units numeric,
  asset text,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tx select" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.asset_rate(_asset text) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _asset WHEN 'NGN' THEN 1 WHEN 'USD' THEN 1550 WHEN 'USDT' THEN 1550 WHEN 'BTC' THEN 95000000 END::numeric
$$;

CREATE OR REPLACE FUNCTION public.receive_inflow(_amount numeric, _description text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); g record; part numeric; allocated numeric := 0; result jsonb := '[]'::jsonb; inflow_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 1000000000 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  INSERT INTO transactions(user_id,type,amount_ngn,description) VALUES (uid,'inflow',_amount,COALESCE(_description,'')) RETURNING id INTO inflow_id;
  FOR g IN SELECT * FROM goals WHERE user_id = uid AND status = 'active' ORDER BY created_at LOOP
    part := round(_amount * g.percentage / 100, 2);
    allocated := allocated + part;
    UPDATE goals SET principal_ngn = principal_ngn + part, units = units + part / asset_rate(g.asset) WHERE id = g.id;
    INSERT INTO transactions(user_id,goal_id,type,amount_ngn,units,asset,description)
      VALUES (uid,g.id,'allocation',part,part/asset_rate(g.asset),g.asset,g.percentage || '% → ' || g.name);
    result := result || jsonb_build_object('goal',g.name,'percentage',g.percentage,'asset',g.asset,'amount_ngn',part,'units',part/asset_rate(g.asset));
  END LOOP;
  PERFORM set_config('saveflow.internal','on',true);
  UPDATE profiles SET available_balance = available_balance + (_amount - allocated) WHERE id = uid;
  PERFORM set_config('saveflow.internal','off',true);
  RETURN jsonb_build_object('amount',_amount,'allocations',result,'allocated',allocated,'remaining',_amount - allocated);
END $$;

CREATE OR REPLACE FUNCTION public.withdraw_goal(_goal_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); g record; days numeric; interest numeric := 0; penalty numeric := 0; payout numeric; early boolean;
BEGIN
  SELECT * INTO g FROM goals WHERE id = _goal_id AND user_id = uid AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Goal not found'; END IF;
  early := current_date < g.maturity_date;
  days := GREATEST(0, EXTRACT(EPOCH FROM (now() - g.created_at)) / 86400);
  IF early THEN
    penalty := round(g.principal_ngn * 0.07, 2);
  ELSE
    interest := round(g.principal_ngn * g.interest_rate / 100 * days / 365, 2);
  END IF;
  payout := g.principal_ngn + interest - penalty;
  IF interest > 0 THEN INSERT INTO transactions(user_id,goal_id,type,amount_ngn,asset,description) VALUES (uid,g.id,'interest',interest,g.asset,'Interest on ' || g.name); END IF;
  IF penalty > 0 THEN INSERT INTO transactions(user_id,goal_id,type,amount_ngn,asset,description) VALUES (uid,g.id,'penalty',penalty,g.asset,'7% early withdrawal penalty, interest forfeited · ' || g.name); END IF;
  INSERT INTO transactions(user_id,goal_id,type,amount_ngn,units,asset,description) VALUES (uid,g.id,'withdrawal',payout,g.units,g.asset,CASE WHEN early THEN 'Early withdrawal · ' ELSE 'Matured withdrawal · ' END || g.name);
  UPDATE goals SET status = 'withdrawn' WHERE id = g.id;
  PERFORM set_config('saveflow.internal','on',true);
  UPDATE profiles SET available_balance = available_balance + payout WHERE id = uid;
  PERFORM set_config('saveflow.internal','off',true);
  RETURN jsonb_build_object('payout',payout,'penalty',penalty,'interest',interest,'early',early);
END $$;

REVOKE EXECUTE ON FUNCTION public.receive_inflow(numeric,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.withdraw_goal(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.receive_inflow(numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_goal(uuid) TO authenticated;