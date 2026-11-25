import { PresenceBadge } from "@/components/presence-badge";
import { PRESENCE_STYLES, type Presence } from "@/components/presence";
import { Server } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AdminPageTitle } from "@/features/admin/components/AdminPageTitle";
import { cn } from "@/lib/utils";
import { useOverlayMask } from "@/hooks/use-admin-overlay";

interface ServerHeaderProps {
  serverName: string;
  ip: string;
  port: number;
  presence: Presence;
}

export function ServerHeader({
  serverName,
  ip,
  port,
  presence,
}: ServerHeaderProps) {
  const mask = useOverlayMask();
  return (
    <Card className="p-6">
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "flex size-14 shrink-0 items-center justify-center rounded-lg",
            PRESENCE_STYLES[presence].tile,
          )}
        >
          <Server className="size-7" />
        </div>
        <div className="min-w-0 flex-1">
          <AdminPageTitle
            title={serverName}
            badges={<PresenceBadge status={presence} />}
            description={
              <p {...mask}>
                {ip}:{port}
              </p>
            }
          />
        </div>
      </div>
    </Card>
  );
}
