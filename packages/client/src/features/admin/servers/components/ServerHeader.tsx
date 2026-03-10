import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Server } from "lucide-react";
import { cn } from "@/lib/utils";

interface ServerHeaderProps {
  serverName: string;
  ip: string;
  port: number;
  isOnline: boolean;
  onNavigateBack: () => void;
}

export function ServerHeader({
  serverName,
  ip,
  port,
  isOnline,
  onNavigateBack,
}: ServerHeaderProps) {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/dashboard">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/servers">Servers</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{serverName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="px-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onNavigateBack}
          className="cursor-pointer"
        >
          <ArrowLeft className="size-4" />
          Back to Servers
        </Button>
      </div>

      <div className="mx-4 rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex size-14 items-center justify-center rounded-lg",
              isOnline ? "bg-green-500/10" : "bg-muted-foreground/10",
            )}
          >
            <Server
              className={cn(
                "size-7",
                isOnline ? "text-green-500" : "text-muted-foreground",
              )}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{serverName}</h1>
              <Badge
                variant={isOnline ? "default" : "outline"}
                className={cn(
                  isOnline &&
                    "bg-green-500/20 text-green-500 hover:bg-green-500/30",
                )}
              >
                {isOnline ? "Online" : "Offline"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {ip}:{port}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
