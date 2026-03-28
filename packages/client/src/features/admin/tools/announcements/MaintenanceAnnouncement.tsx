import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";

type MaintenanceType = "maintenance" | "modpack_update";

const TYPE_CONFIG: Record<
  MaintenanceType,
  { label: string; title: string; description: string }
> = {
  maintenance: {
    label: "Server Maintenance",
    title: "Server Maintenance",
    description:
      "The server will be going offline for scheduled maintenance to improve stability and performance.",
  },
  modpack_update: {
    label: "Modpack & Server Update",
    title: "Modpack & Server Update",
    description:
      "We're rolling out a modpack and server update to improve stability, performance, and add new content.",
  },
};

function formatPreviewTime(date: Date): string {
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativePreview(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);

  if (Math.abs(diffMins) < 1) return "now";
  if (diffMins > 0) {
    if (diffMins < 60) return `in ${diffMins} minutes`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hours < 24)
      return mins > 0 ? `in ${hours}h ${mins}m` : `in ${hours} hours`;
    const days = Math.floor(hours / 24);
    return `in ${days} day${days > 1 ? "s" : ""}`;
  }
  const absMins = Math.abs(diffMins);
  if (absMins < 60) return `${absMins} minutes ago`;
  const hours = Math.floor(absMins / 60);
  return `${hours} hour${hours > 1 ? "s" : ""} ago`;
}

export function MaintenanceAnnouncement() {
  const toast = useToastActions();

  const [type, setType] = useState<MaintenanceType>("maintenance");
  const [startsAt, setStartsAt] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [estimatedMinutes, setEstimatedMinutes] = useState("");

  const sendMutation = trpc.admin.announcements.sendMaintenance.useMutation({
    onSuccess: () => {
      toast.success("Maintenance announcement sent to Discord");
      setStartsAt("");
      setEstimatedMinutes("");
    },
    onError: (err: { message: string }) => {
      toast.error(err.message);
    },
  });

  const minutes = parseInt(estimatedMinutes, 10);
  const canSend = startsAt.length > 0 && minutes > 0;

  const startDate = startsAt ? new Date(startsAt) : null;
  const endDate =
    startDate && minutes > 0
      ? new Date(startDate.getTime() + minutes * 60000)
      : null;

  function handleSend() {
    if (!canSend || !startDate) return;
    sendMutation.mutate({
      type,
      startsAt: startDate.toISOString(),
      estimatedMinutes: minutes,
    });
  }

  const cfg = TYPE_CONFIG[type];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Form */}
      <div className="space-y-6">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Type</Label>
          <Select
            value={type}
            onValueChange={(v) => setType(v as MaintenanceType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="maintenance">Server Maintenance</SelectItem>
              <SelectItem value="modpack_update">
                Modpack & Server Update
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium" htmlFor="startsAt">
            Start Date & Time
          </Label>
          <Input
            id="startsAt"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium" htmlFor="estimatedMinutes">
            Estimated Duration (minutes)
          </Label>
          <Input
            id="estimatedMinutes"
            type="number"
            min={1}
            max={10080}
            placeholder="e.g. 120"
            value={estimatedMinutes}
            onChange={(e) => setEstimatedMinutes(e.target.value)}
          />
        </div>

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
          <div className="border-l-4 border-orange-500 pl-4">
            <h3 className="text-base font-semibold text-white">
              🔧 {cfg.title}
            </h3>
            <p className="mt-1 text-sm text-gray-300">{cfg.description}</p>

            <div className="mt-3 space-y-3">
              <div>
                <p className="text-xs font-semibold text-white">🕒 Starts</p>
                <p className="text-xs text-gray-300">
                  {startDate
                    ? `${formatPreviewTime(startDate)} (${formatRelativePreview(startDate)})`
                    : "..."}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-white">
                  ⏳ Estimated Duration
                </p>
                <p className="text-xs text-gray-300">
                  {minutes > 0 ? `${minutes} minutes` : "..."}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-white">
                  🔚 Expected End
                </p>
                <p className="text-xs text-gray-300">
                  {endDate
                    ? `${formatPreviewTime(endDate)} (${formatRelativePreview(endDate)})`
                    : "..."}
                </p>
              </div>
            </div>

            <div className="mt-3 border-t border-gray-600 pt-2">
              <p className="text-xs text-gray-400">Thanks for your patience!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
