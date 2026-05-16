import { useStickyValue } from "@/hooks/use-sticky-value";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { cn } from "@/lib/utils";
import type { TeamMember } from "../data";
import { TIER_CONFIG } from "../data";

type TeamMemberDialogProps = {
  member: TeamMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TeamMemberDialog({
  member,
  open,
  onOpenChange,
}: TeamMemberDialogProps) {
  const display = useStickyValue(member);
  if (!display) return null;

  const config = TIER_CONFIG[display.tier];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-4">
            <MinecraftAvatar
              username={display.username}
              uuid={display.uuid}
              size={64}
            />

            <div className="flex flex-col gap-1.5">
              <DialogTitle>{display.username}</DialogTitle>

              <Badge
                variant="outline"
                className={cn("text-xs", config.badgeClass)}
              >
                {display.role}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {display.description && (
          <DialogDescription className="text-sm text-muted-foreground">
            {display.description}
          </DialogDescription>
        )}
      </DialogContent>
    </Dialog>
  );
}
