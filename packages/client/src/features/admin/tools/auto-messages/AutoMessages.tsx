import { useCallback, useState } from "react";
import { Loading } from "@/components/loading-spinner";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Pencil,
  Trash2,
  Timer,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  ArrowDown,
} from "lucide-react";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { UpsertConfigDialog } from "./components/UpsertConfigDialog";
import { MessageDialog } from "./components/MessageDialog";

type Config = RouterOutput["admin"]["autoMessages"]["configs"]["list"][number];
type ConfigDetail = RouterOutput["admin"]["autoMessages"]["configs"]["get"];
type Message = ConfigDetail["messages"][number];

export function AutoMessages() {
  const toast = useToastActions();

  const [configDialog, setConfigDialog] = useState<{
    open: boolean;
    config: Config | null;
  }>({ open: false, config: null });

  const [messageDialog, setMessageDialog] = useState<{
    open: boolean;
    configId: number;
    message: Message | null;
  }>({ open: false, configId: 0, message: null });

  const [deleteConfigConfirm, setDeleteConfigConfirm] = useState<{
    open: boolean;
    config: Config | null;
  }>({ open: false, config: null });
  const [deleteMessageConfirm, setDeleteMessageConfirm] = useState<{
    open: boolean;
    id: number | null;
  }>({ open: false, id: null });

  const [expandedId, setExpandedId] = useState<number | null>(null);

  const configsQuery = trpc.admin.autoMessages.configs.list.useQuery();
  const channelsQuery = trpc.admin.autoMessages.channels.useQuery();
  const detailQuery = trpc.admin.autoMessages.configs.get.useQuery(
    { id: expandedId! },
    { enabled: expandedId !== null },
  );
  const deleteMutation = trpc.admin.autoMessages.configs.delete.useMutation();
  const deleteMessageMutation =
    trpc.admin.autoMessages.messages.delete.useMutation();

  const configs = configsQuery.data ?? [];
  const channels = channelsQuery.data ?? [];

  const channelMap = new Map(
    channels.flatMap((g) =>
      g.channels.map((c) => [c.id, { name: c.name, category: g.category }]),
    ),
  );

  const handleConfigSuccess = useCallback(() => {
    setConfigDialog({ open: false, config: null });
    configsQuery.refetch();
    if (expandedId !== null) detailQuery.refetch();
  }, [configsQuery, detailQuery, expandedId]);

  const handleMessageSuccess = useCallback(() => {
    setMessageDialog({ open: false, configId: 0, message: null });
    detailQuery.refetch();
    configsQuery.refetch();
  }, [detailQuery, configsQuery]);

  const handleDeleteConfig = useCallback(async () => {
    const id = deleteConfigConfirm.config?.id;
    if (!id) return;
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("Config deleted");
      if (expandedId === id) setExpandedId(null);
      setDeleteConfigConfirm({ open: false, config: null });
      configsQuery.refetch();
    } catch {
      toast.error("Failed to delete config");
    }
  }, [deleteMutation, toast, configsQuery, expandedId, deleteConfigConfirm]);

  const handleDeleteMessage = useCallback(async () => {
    const id = deleteMessageConfirm.id;
    if (!id) return;
    try {
      await deleteMessageMutation.mutateAsync({ id });
      toast.success("Message deleted");
      setDeleteMessageConfirm({ open: false, id: null });
      detailQuery.refetch();
      configsQuery.refetch();
    } catch {
      toast.error("Failed to delete message");
    }
  }, [
    deleteMessageMutation,
    toast,
    detailQuery,
    configsQuery,
    deleteMessageConfirm,
  ]);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/dashboard">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/tools">Tools</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Auto Messages</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="mx-auto w-full max-w-[1400px] flex flex-1 flex-col gap-4 px-4 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Auto Messages</h1>
          <Button onClick={() => setConfigDialog({ open: true, config: null })}>
            <Plus className="mr-2 size-4" />
            New Config
          </Button>
        </div>

        {configsQuery.isLoading ? (
          <div className="flex flex-1 items-center justify-center py-12">
            <Loading size="medium" text="Loading configs..." />
          </div>
        ) : configs.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-12">
            <div className="text-center">
              <Timer className="mx-auto size-12 text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">
                No auto-message configs yet
              </p>
              <Button
                onClick={() => setConfigDialog({ open: true, config: null })}
                className="mt-4"
              >
                <Plus className="mr-2 size-4" />
                Create First Config
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {configs.map((config) => {
              const isExpanded = expandedId === config.id;
              const ch = channelMap.get(config.channelId);

              return (
                <div
                  key={config.id}
                  className="rounded-lg border border-border bg-card"
                >
                  {/* Config header */}
                  <div
                    className="flex cursor-pointer items-center gap-3 p-4 transition-colors hover:bg-sidebar-accent/30"
                    onClick={() => setExpandedId(isExpanded ? null : config.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground" />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">
                          {config.name}
                        </h3>
                        <Badge
                          variant="outline"
                          className={
                            config.enabled
                              ? "border-success bg-success/10 text-success"
                              : "border-muted-foreground bg-muted-foreground/10 text-muted-foreground"
                          }
                        >
                          {config.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span>
                          #{ch?.name ?? config.channelId}
                          {ch && ` (${ch.category})`}
                        </span>
                        <span>Every {config.intervalMinutes}m</span>
                        <span className="capitalize">
                          {config.rotationMode}
                        </span>
                        <span>
                          {config.messageCount} message
                          {config.messageCount !== 1 && "s"}
                        </span>
                      </div>
                    </div>

                    <div
                      className="flex gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfigDialog({ open: true, config })}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          setDeleteConfigConfirm({ open: true, config })
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Expanded messages list */}
                  {isExpanded && (
                    <div className="border-t border-border">
                      <div className="flex items-center justify-between p-4 pb-2">
                        <h4 className="text-sm font-semibold">Messages</h4>
                        <Button
                          size="sm"
                          onClick={() =>
                            setMessageDialog({
                              open: true,
                              configId: config.id,
                              message: null,
                            })
                          }
                        >
                          <Plus className="mr-1 size-3" />
                          Add Message
                        </Button>
                      </div>

                      {detailQuery.isLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loading size="small" text="Loading messages..." />
                        </div>
                      ) : (detailQuery.data?.messages.length ?? 0) === 0 ? (
                        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                          <MessageSquare className="mr-2 size-4" />
                          No messages yet — add one to get started
                        </div>
                      ) : (
                        <div className="divide-y divide-border">
                          {detailQuery.data?.messages.map((msg) => (
                            <div
                              key={msg.id}
                              className="flex items-start gap-3 px-4 py-3"
                            >
                              <span className="mt-0.5 font-mono text-xs text-muted-foreground">
                                #{msg.sortOrder}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm whitespace-pre-wrap break-words">
                                  {msg.content}
                                </p>
                                {!msg.enabled && (
                                  <Badge
                                    variant="outline"
                                    className="mt-1 border-muted-foreground bg-muted-foreground/10 text-muted-foreground"
                                  >
                                    Disabled
                                  </Badge>
                                )}
                                {msg.followups.length > 0 && (
                                  <div className="mt-2 space-y-1 border-l-2 border-border/60 pl-3">
                                    {msg.followups.map((f) => (
                                      <div
                                        key={f.id}
                                        className="flex items-start gap-2 text-xs"
                                      >
                                        <ArrowDown className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                                        <div className="min-w-0 flex-1">
                                          <span className="text-muted-foreground">
                                            +{f.delaySeconds}s:
                                          </span>{" "}
                                          <span className="whitespace-pre-wrap break-words">
                                            {f.content}
                                          </span>
                                          {!f.enabled && (
                                            <Badge
                                              variant="outline"
                                              className="ml-2 border-muted-foreground bg-muted-foreground/10 text-muted-foreground text-[10px]"
                                            >
                                              Disabled
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="size-8 p-0"
                                  onClick={() =>
                                    setMessageDialog({
                                      open: true,
                                      configId: config.id,
                                      message: msg,
                                    })
                                  }
                                >
                                  <Pencil className="size-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="size-8 p-0 text-destructive hover:text-destructive"
                                  onClick={() =>
                                    setDeleteMessageConfirm({
                                      open: true,
                                      id: msg.id,
                                    })
                                  }
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <UpsertConfigDialog
        key={configDialog.config?.id ?? "new"}
        open={configDialog.open}
        onClose={() => setConfigDialog({ open: false, config: null })}
        onSuccess={handleConfigSuccess}
        config={configDialog.config}
        channels={channels}
      />

      <MessageDialog
        key={messageDialog.message?.id ?? `new-${messageDialog.configId}`}
        open={messageDialog.open}
        onClose={() =>
          setMessageDialog({ open: false, configId: 0, message: null })
        }
        onSuccess={handleMessageSuccess}
        configId={messageDialog.configId}
        message={messageDialog.message}
      />

      <AlertDialog
        open={deleteConfigConfirm.open}
        onOpenChange={(isOpen) =>
          !isOpen && setDeleteConfigConfirm({ open: false, config: null })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Config</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this auto-message config? All
              associated messages will also be deleted. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() =>
                setDeleteConfigConfirm({ open: false, config: null })
              }
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteConfig}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteMessageConfirm.open}
        onOpenChange={(isOpen) =>
          !isOpen && setDeleteMessageConfirm({ open: false, id: null })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setDeleteMessageConfirm({ open: false, id: null })}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteMessage}
              disabled={deleteMessageMutation.isPending}
            >
              {deleteMessageMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
