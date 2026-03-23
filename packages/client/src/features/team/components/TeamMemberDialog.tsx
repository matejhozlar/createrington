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
}

export function TeamMemberDialog({
  member,
  open,
  onOpenChange,
}: TeamMemberDialogProps) {
  if (!member) return null;

  const config = TIER_CONFIG[member.tier];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <MinecraftAvatar
              username={member.username}
              uuid={member.uuid}
              size={64}
            />

            <div className="flex flex-col gap-1.5">
              <DialogTitle>{member.username}</DialogTitle>

              <Badge
                variant="outline"
                className={cn("text-xs", config.badgeClass)}
              >
                {member.role}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {member.description && (
          <DialogDescription className="text-sm text-muted-foreground">
            {member.description}
          </DialogDescription>
        )}
      </DialogContent>
    </Dialog>
  );
}
