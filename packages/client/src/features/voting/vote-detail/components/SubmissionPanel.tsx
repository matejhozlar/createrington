import { useState } from "react";
import { Loader2, PackagePlus, Pencil, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { MOD_STATUS_STYLES } from "../../format";
import { SubmissionBuilderDialog } from "./SubmissionBuilderDialog";

export function SubmissionPanel({
  vote,
}: {
  vote: { id: number; maxModsPerSubmission: number };
}) {
  const toast = useToastActions();
  const utils = trpc.useUtils();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  const submissionQuery = trpc.user.votes.mySubmission.useQuery({
    voteId: vote.id,
  });

  const withdrawMutation = trpc.user.votes.withdrawSubmission.useMutation({
    onSuccess: () => {
      toast.success("Submission withdrawn");
      utils.user.votes.mySubmission.invalidate({ voteId: vote.id });
      utils.user.votes.get.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (submissionQuery.isLoading) {
    return <Skeleton className="h-32 w-full rounded-xl" />;
  }

  const submission = submissionQuery.data ?? null;

  return (
    <>
      <Card className="border-blue-500/30 bg-blue-500/[0.03]">
        {submission ? (
          <>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Your submission</CardTitle>
                <CardDescription>
                  {submission.mods.length} of {vote.maxModsPerSubmission} mods,
                  editable until reviewed
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBuilderOpen(true)}
                >
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmWithdraw(true)}
                >
                  <Trash2 className="size-3.5" />
                  Withdraw
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {submission.mods.map((mod) => {
                const status = MOD_STATUS_STYLES[mod.status];
                return (
                  <div
                    key={mod.id}
                    className="flex items-center gap-3 rounded-lg border bg-background/50 p-2.5"
                  >
                    {mod.project.thumbnailUrl ? (
                      <img
                        src={mod.project.thumbnailUrl}
                        alt=""
                        className="size-8 rounded"
                      />
                    ) : (
                      <div className="size-8 rounded bg-accent" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {mod.project.name}
                      </div>
                      {mod.note && (
                        <div className="truncate text-xs text-muted-foreground">
                          {mod.note}
                        </div>
                      )}
                    </div>
                    {status && (
                      <Badge
                        variant="outline"
                        className={`shrink-0 text-xs ${status.className}`}
                      >
                        {status.label}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </>
        ) : (
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <h3 className="font-semibold">Got a mod in mind?</h3>
              <p className="text-sm text-muted-foreground">
                Suggest up to {vote.maxModsPerSubmission} mods for the pack.
                Approved mods carry your name.
              </p>
            </div>
            <Button onClick={() => setBuilderOpen(true)}>
              <PackagePlus className="size-4" />
              Suggest mods
            </Button>
          </CardContent>
        )}
      </Card>

      {builderOpen && (
        <SubmissionBuilderDialog
          open={builderOpen}
          onOpenChange={setBuilderOpen}
          vote={vote}
          submission={submission}
        />
      )}

      <AlertDialog open={confirmWithdraw} onOpenChange={setConfirmWithdraw}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw submission?</AlertDialogTitle>
            <AlertDialogDescription>
              Pending mods will be removed and other players will be able to
              suggest them. Already approved mods stay in the pack with your
              name.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => withdrawMutation.mutate({ voteId: vote.id })}
            >
              {withdrawMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Withdraw"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
