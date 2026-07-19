import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loading } from "@/components/loading-spinner";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { fetchChatMessages } from "@/features/admin-chat/api";
import { MessageRow } from "@/features/admin-chat/components/MessageRow";
import type { ChatMessage } from "@/features/admin-chat/types";

export function ChatHistoryDetail() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const numericId = sessionId ? parseInt(sessionId, 10) : NaN;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const invalidId = !Number.isFinite(numericId);

  const load = useCallback(() => {
    return fetchChatMessages(numericId)
      .then((data) => {
        setMessages(data.messages);
        setError(null);
      })
      .catch((error: unknown) => {
        setError(
          error instanceof Error ? error.message : "Failed to load transcript",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [numericId]);

  useEffect(() => {
    if (invalidId) return;
    void load();
  }, [invalidId, load]);

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
          <div className="flex items-center justify-center py-10">
            <Loading mode="inline" size="medium" />
          </div>
        ) : shownError ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card py-16 text-center">
            <p className="text-destructive">{shownError}</p>
            {!invalidId && (
              <Button
                variant="outline"
                onClick={() => {
                  setLoading(true);
                  void load();
                }}
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
