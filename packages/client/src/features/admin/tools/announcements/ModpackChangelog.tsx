import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { ModSection } from "./components/ModSection";

interface Mod {
  name: string;
  url: string;
}

export function ModpackChangelog() {
  const toast = useToastActions();

  const [version, setVersion] = useState("");
  const [added, setAdded] = useState<Mod[]>([]);
  const [removed, setRemoved] = useState<Mod[]>([]);
  const [updated, setUpdated] = useState<Mod[]>([]);

  const sendMutation = trpc.admin.announcements.sendChangelog.useMutation({
    onSuccess: () => {
      toast.success("Changelog sent to Discord");
      setVersion("");
      setAdded([]);
      setRemoved([]);
      setUpdated([]);
    },
    onError: (err: { message: string }) => {
      toast.error(err.message);
    },
  });

  const canSend =
    version.trim().length > 0 &&
    (added.length > 0 || removed.length > 0 || updated.length > 0);

  function handleSend() {
    if (!canSend) return;
    sendMutation.mutate({ version: version.trim(), added, removed, updated });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Form */}
      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="version">
            Version
          </label>
          <Input
            id="version"
            placeholder="e.g. v0.3.0"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          />
        </div>

        <ModSection
          title="New Mods"
          icon="🆕"
          mods={added}
          onAdd={(mod) => setAdded((prev) => [...prev, mod])}
          onRemove={(i) => setAdded((prev) => prev.filter((_, j) => j !== i))}
        />

        <ModSection
          title="Removed Mods"
          icon="🗑️"
          mods={removed}
          onAdd={(mod) => setRemoved((prev) => [...prev, mod])}
          onRemove={(i) => setRemoved((prev) => prev.filter((_, j) => j !== i))}
        />

        <ModSection
          title="Updated Mods"
          icon="⬆️"
          mods={updated}
          onAdd={(mod) => setUpdated((prev) => [...prev, mod])}
          onRemove={(i) => setUpdated((prev) => prev.filter((_, j) => j !== i))}
        />

        <Button
          onClick={handleSend}
          disabled={!canSend || sendMutation.isPending}
          className="w-full"
        >
          <Send className="mr-2 h-4 w-4" />
          {sendMutation.isPending ? "Sending..." : "Send to Discord"}
        </Button>
      </div>

      {/* Preview */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium">Preview</h2>
        <div className="rounded-md border border-border bg-[#2b2d31] p-4">
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="text-base font-semibold text-white">
              Createrington: Cogs & Steam {version || "..."} Modpack Update
            </h3>
            <p className="mt-1 text-sm text-gray-300">
              A new version of the modpack is now available! Please update to{" "}
              <strong>{version || "..."}</strong> to receive the latest
              improvements and fixes.
            </p>

            <div className="mt-3 space-y-3">
              {added.length > 0 && (
                <PreviewField title="🆕 New Mods" mods={added} />
              )}
              {removed.length > 0 && (
                <PreviewField title="🗑️ Removed Mods" mods={removed} />
              )}
              {updated.length > 0 && (
                <PreviewField title="⬆️ Updated Mods" mods={updated} />
              )}

              <div>
                <p className="text-xs font-semibold text-white">📢 Reminder</p>
                <p className="text-xs text-gray-300">
                  Please update the modpack to the latest version.
                  <br />
                  If you encounter any issues or bugs, let the team know!
                </p>
              </div>
            </div>

            <div className="mt-3 border-t border-gray-600 pt-2">
              <p className="text-xs text-gray-400">
                Thanks for playing on Createrington!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewField({ title, mods }: { title: string; mods: Mod[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-white">{title}</p>
      <div className="text-xs text-gray-300">
        {mods.map((mod, i) => (
          <div key={`${mod.name}-${i}`}>
            -{" "}
            <a
              href={mod.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              {mod.name}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
