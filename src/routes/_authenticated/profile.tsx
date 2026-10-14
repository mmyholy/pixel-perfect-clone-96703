import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { profileQuery, useProfile } from "@/hooks/use-saveflow";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — SaveFlow" }, { name: "description", content: "Your SaveFlow profile." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQuery),
  component: Profile,
});

function Profile() {
  const p = useProfile();
  const qc = useQueryClient();
  const [name, setName] = useState(p.full_name);
  const [phone, setPhone] = useState(p.phone);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("profiles").update({ full_name: name.trim(), phone: phone.trim() }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold md:text-3xl">Profile</h1>
      <form onSubmit={save} className="mt-6 space-y-4 rounded-3xl border bg-card p-6 shadow-soft">
        <div className="space-y-1.5"><Label>Email</Label><Input value={p.email} disabled /></div>
        <div className="space-y-1.5"><Label>Full name</Label><Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Phone</Label><Input type="tel" value={phone} maxLength={20} onChange={(e) => setPhone(e.target.value)} /></div>
        <Button>Save</Button>
      </form>
    </div>
  );
}
