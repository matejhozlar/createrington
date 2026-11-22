import { skipToken, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { LoadingState } from "@/components/query-states";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { MessageRow } from "@/features/admin-chat/components/MessageRow";

export function ChatHistoryDetail() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const numericId = sessionId ? parseInt(sessionId, 10) : NaN;

  const invalidId = !Number.isFinite(numericId);

  const transcriptQuery = useQuery(
    trpc.admin.chat.messages.list.queryOptions(
      invalidId ? skipToken : { sessionId: numericId },
    ),
  );
  const messages = transcriptQuery.data?.messages ?? [];
  const loading = transcriptQuery.isPending;
  const error = transcriptQuery.error?.message ?? null;

  const shownError = invalidId ? "Invalid session id" : error;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Tools", href: "/admin/tools" },
          { label: "Chat History", href: "/admin/tools/chat-history" },
          {
            label: `Session #${Number.isFinite(numericId) ? numericId : "—"}`,
          },
        ]}
      />

      <div className="mx-auto w-full max-w-[1000px] flex flex-1 flex-col gap-4 px-4 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/admin/tools/chat-history")}
              aria-label="Back to history"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <h1 className="text-2xl font-semibold">
              Session #{Number.isFinite(numericId) ? numericId : "—"}
            </h1>
          </div>
        </div>

        {loading && !invalidId ? (
          <LoadingState className="flex-none py-10" />
        ) : shownError ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card py-16 text-center">
            <p className="text-destructive">{shownError}</p>
            {!invalidId && (
              <Button
                variant="outline"
                onClick={() => void transcriptQuery.refetch()}
                className="mt-2"
              >
                Try Again
              </Button>
            )}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card py-16 text-center">
            <p className="text-muted-foreground">
              No messages in this session.
            </p>
          </div>
        ) : (
          <div className="flex flex-col rounded-lg border border-border bg-card px-3 py-3">
            {messages.map((msg, i) => {
              const prev = messages[i - 1];
              const next = messages[i + 1];
              const isGroupStart = !prev || prev.role !== msg.role;
              const showAvatar = !next || next.role !== msg.role;
              return (
                <MessageRow
                  key={msg.id}
                  message={msg}
                  navigate={navigate}
                  showAvatar={showAvatar}
                  isGroupStart={isGroupStart}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
