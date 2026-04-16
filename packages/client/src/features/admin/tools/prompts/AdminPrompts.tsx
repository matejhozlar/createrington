import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Loading } from "@/components/loading-spinner";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MessageSquare, Plus, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { CreatePromptModal } from "./components/CreatePromptModal";

type StatusFilter = "all" | "active" | "closed";

function formatEndsAt(date: Date | string): string {
  const d = new Date(date);
  const diffMs = d.getTime() - Date.now();
  if (diffMs <= 0) return "Ended";
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `in ${hours}h`;
  const days = Math.round(hours / 24);
  return `in ${days}d`;
}

export function AdminPrompts() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  const listQuery = trpc.admin.prompts.list.useQuery({
    page,
    limit: 20,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <NavLink to="/admin/dashboard">Admin</NavLink>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <NavLink to="/admin/tools">Tools</NavLink>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Player Prompts</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-5 text-primary" />
            <CardTitle>Player Prompts</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as StatusFilter);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => void listQuery.refetch()}
              disabled={listQuery.isFetching}
              title="Refresh"
            >
              <RefreshCw
                className={
                  listQuery.isFetching ? "size-4 animate-spin" : "size-4"
                }
              />
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> New Prompt
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loading mode="inline" size="medium" />
            </div>
          ) : !listQuery.data || listQuery.data.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <MessageSquare className="size-10 text-muted-foreground" />
              <p className="text-muted-foreground">No prompts yet.</p>
              <p className="text-sm text-muted-foreground/80">
                Create one to ask players a question in Discord.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-24 text-right">Responses</TableHead>
                  <TableHead className="w-40">Ends</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.data.items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <NavLink
                        to={`/admin/tools/prompts/${row.id}`}
                        className="font-medium hover:text-primary"
                      >
                        {row.question}
                      </NavLink>
                      {row.description && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {row.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.status === "active" ? "default" : "secondary"
                        }
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.responseCount}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.status === "closed" ? "—" : formatEndsAt(row.endsAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreatePromptModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          setCreateOpen(false);
          void listQuery.refetch();
        }}
      />
    </div>
  );
}
