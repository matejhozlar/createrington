import { skipToken, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/query-states";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminPageTitle } from "@/features/admin/components/AdminPageTitle";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare } from "lucide-react";
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
      { staleTime: 0 },
    ),
  );
  const messages = transcriptQuery.data?.messages ?? [];
  const loading = transcriptQuery.isPending;
  const error = transcriptQuery.error?.message ?? null;

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
        <AdminPageTitle
          title={`Session #${invalidId ? "—" : numericId}`}
          actions={
            <Button
              variant="outline"
              onClick={() => navigate("/admin/tools/chat-history")}
            >
              <ArrowLeft className="size-4" />
              Back to history
            </Button>
          }
        />

        {loading && !invalidId ? (
          <LoadingState className="flex-none py-10" />
        ) : invalidId ? (
          <div className="rounded-lg border border-border bg-card">
            <EmptyState
              icon={MessageSquare}
              message="Invalid session id"
              className="py-16"
            />
          </div>
        ) : error ? (
          <ErrorState
            message={error}
            onRetry={() => void transcriptQuery.refetch()}
            bordered
          />
        ) : messages.length === 0 ? (
          <div className="rounded-lg border border-border bg-card">
            <EmptyState
              icon={MessageSquare}
              message="No messages in this session."
              className="py-16"
            />
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
