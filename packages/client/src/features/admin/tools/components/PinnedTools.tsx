import { Pin, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PinnedTools({
  tools,
  onOpen,
}: {
  tools: { title: string; href: string; icon: LucideIcon }[];
  onOpen: (href: string) => void;
}) {
  return (
    <Card className="gap-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Pin className="size-4 text-muted-foreground" />
          Pinned
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {tools.map(({ title, href, icon: Icon }) => (
          <Button
            key={href}
            variant="outline"
            size="sm"
            onClick={() => onOpen(href)}
          >
            <Icon className="text-primary" />
            {title}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
