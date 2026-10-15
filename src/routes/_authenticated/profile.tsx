import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Camera, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { profileQuery, useProfile } from "@/hooks/use-saveflow";

const BUCKET = "saveflow-avatars";
const MAX_SIZE = 2 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — SaveFlow" },
      {
        name: "description",
        content: "Your SaveFlow profile.",
      },
    ],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(profileQuery),
  component: Profile,
});

function errorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    return String(error.message);
  }

  return "Something went wrong. Please try again.";
}

function Profile() {
  const p = useProfile();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(p.full_name);
  const [phone, setPhone] = useState(p.phone);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const avatarPath = p.avatar_path ?? null;
  const busy = saving || photoBusy;

  const photo = useQuery({
    queryKey: ["profile-photo", p.id, avatarPath],
    enabled: Boolean(avatarPath),
    queryFn: async () => {
      if (!avatarPath) return null;

      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(avatarPath, 3600);

      if (error) throw error;
      return data.signedUrl;
    },
    staleTime: 10 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  async function setAvatarPath(path: string | null) {
    const { data, error } = await supabase
      .from("profiles")
      .update({ avatar_path: path })
      .eq("id", p.id)
      .select("id")
      .single();

    if (error) throw error;
    if (!data) throw new Error("Profile could not be updated");
  }

  async function uploadPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file || busy) return;

    const extension = EXTENSIONS[file.type];

    if (!extension) {
      toast.error("Choose a JPG, PNG or WebP image");
      return;
    }

    if (file.size === 0 || file.size > MAX_SIZE) {
      toast.error("Choose an image smaller than 2 MB");
      return;
    }

    setPhotoBusy(true);

    const newPath =
      `${p.id}/${crypto.randomUUID()}.${extension}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(newPath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      try {
        await setAvatarPath(newPath);
      } catch (error) {
        await supabase.storage.from(BUCKET).remove([newPath]);
        throw error;
      }

      await qc.invalidateQueries({ queryKey: ["profile"] });

      toast.success("Profile picture updated");

      if (avatarPath) {
        const { error } = await supabase.storage
          .from(BUCKET)
          .remove([avatarPath]);

        if (error) {
          toast.warning(
            "New picture saved, but the old file could not be removed"
          );
        }
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    if (!avatarPath || busy) return;

    if (!window.confirm("Remove your profile picture?")) return;

    setPhotoBusy(true);

    try {
      await setAvatarPath(null);
      await qc.invalidateQueries({ queryKey: ["profile"] });

      const { error } = await supabase.storage
        .from(BUCKET)
        .remove([avatarPath]);

      if (error) {
        toast.warning(
          "Picture removed from your profile, but file cleanup failed"
        );
      } else {
        toast.success("Profile picture removed");
      }

      qc.removeQueries({
        queryKey: ["profile-photo", p.id, avatarPath],
        exact: true,
      });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;

    if (!name.trim()) {
      toast.error("Enter your full name");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: name.trim(),
          phone: phone.trim(),
        })
        .eq("id", p.id)
        .select("id")
        .single();

      if (error) throw error;

      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile saved");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold md:text-3xl">
        Profile
      </h1>

      <section className="mt-6 rounded-3xl border bg-card p-6 shadow-soft">
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <div className="flex size-28 items-center justify-center overflow-hidden rounded-full border bg-muted">
              {photo.data ? (
                <img
                  src={photo.data}
                  alt="Your profile"
                  className="size-full object-cover"
                />
              ) : (
                <UserRound
                  className="size-12 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
            </div>

            <button
              type="button"
              aria-label="Upload profile picture"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
              className="absolute bottom-0 right-0 flex size-10 items-center justify-center rounded-full border-4 border-card bg-primary text-primary-foreground disabled:opacity-50"
            >
              <Camera className="size-4" />
            </button>
          </div>

          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={busy}
            onChange={uploadPhoto}
          />

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              {photoBusy
                ? "Updating…"
                : avatarPath
                  ? "Change photo"
                  : "Upload photo"}
            </Button>

            {avatarPath && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={removePhoto}
              >
                Remove
              </Button>
            )}
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            JPG, PNG or WebP. Maximum 2 MB.
          </p>

          {photo.isError && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              Could not load your picture.
              <button
                type="button"
                className="ml-1 underline"
                onClick={() => void photo.refetch()}
              >
                Retry
              </button>
            </p>
          )}
        </div>

        <form onSubmit={save} className="mt-6 space-y-4 border-t pt-6">
          <div className="space-y-1.5">
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              value={p.email}
              disabled
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Full name</Label>
            <Input
              id="profile-name"
              value={name}
              maxLength={80}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-phone">Phone</Label>
            <Input
              id="profile-phone"
              type="tel"
              value={phone}
              maxLength={20}
              disabled={busy}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <Button type="submit" disabled={busy}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </form>
      </section>
    </div>
  );
}