import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { formatRelativeDate } from "@/lib/format";
import { queryClient, trpc } from "@/lib/trpc";
import { PLANNING_COMMENT_MAX_LENGTH } from "@createrington/shared/planning";
import { PersonChip } from "../../components/PersonChip";
import { PlanMarkdown } from "../../components/PlanMarkdown";
import { SourceLink } from "../../components/SourceLink";
import type { PlanningComment } from "../../types";

interface PlanCommentsProps {
  itemId: number;
  comments: PlanningComment[];
}

export function PlanComments({ itemId, comments }: PlanCommentsProps) {
  const [body, setBody] = useState("");

  const addComment = useMutation(
    trpc.admin.planning.items.comments.create.mutationOptions(
      useMutationToast({
        onSuccess: () => {
          void queryClient.invalidateQueries(trpc.admin.planning.pathFilter());
          setBody("");
        },
      }),
    ),
  );

  const submit = () => {
    if (!body.trim() || addComment.isPending) return;
    addComment.mutate({ id: itemId, body });
  };

  return (
    <div className="flex flex-col gap-5">
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="flex flex-col gap-5">
          {comments.map((comment) => (
            <li key={comment.id} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <PersonChip person={comment.author} />
                <span className="text-xs text-muted-foreground">
                  {formatRelativeDate(comment.createdAt)}
                </span>
                {comment.sourceUrl && (
                  <SourceLink
                    url={comment.sourceUrl}
                    label="Summary of a Discord discussion"
                  />
                )}
              </div>
              <PlanMarkdown text={comment.body} />
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              submit();
            }
          }}
          placeholder="Add a comment. Markdown is supported."
          aria-label="Add a comment"
          rows={3}
          maxLength={PLANNING_COMMENT_MAX_LENGTH}
        />
        <Button
          type="button"
          size="sm"
          className="self-end"
          onClick={submit}
          disabled={!body.trim()}
          loading={addComment.isPending}
        >
          Comment
        </Button>
      </div>
    </div>
  );
}
