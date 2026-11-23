import { PresenceBadge } from "@/components/presence-badge";
import { Server } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AdminPageTitle } from "@/features/admin/components/AdminPageTitle";
import { cn } from "@/lib/utils";

interface ServerHeaderProps {
  serverName: string;
  ip: string;
  port: number;
  isOnline: boolean;
  isMaintenance: boolean;
}

export function ServerHeader({
  serverName,
  ip,
  port,
  isOnline,
  isMaintenance,
}: ServerHeaderProps) {
  const presence = isMaintenance
    ? "maintenance"
    : isOnline
      ? "online"
      : "offline";

  return (
    <Card className="p-6">
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "flex size-14 shrink-0 items-center justify-center rounded-lg",
            isMaintenance
              ? "bg-amber-500/10"
              : isOnline
                ? "bg-green-500/10"
                : "bg-muted-foreground/10",
          )}
        >
          <Server
            className={cn(
              "size-7",
              isMaintenance
                ? "text-amber-500"
                : isOnline
                  ? "text-green-500"
                  : "text-muted-foreground",
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <AdminPageTitle
            title={serverName}
            badges={<PresenceBadge status={presence} />}
            description={
              <p>
                {ip}:{port}
              </p>
            }
          />
        </div>
      </div>
    </Card>
  );
}
