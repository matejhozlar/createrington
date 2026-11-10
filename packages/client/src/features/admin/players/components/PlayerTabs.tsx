import {
  Eye,
  Clock,
  BarChart3,
  Ticket,
  Shield,
  Ban,
  ArrowLeftRight,
  FileText,
  Users,
  type LucideIcon,
} from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

export type PlayerTabType =
  | "overview"
  | "party"
  | "sessions"
  | "stats"
  | "tickets"
  | "strikes"
  | "bans"
  | "transactions"
  | "audit";

const TABS: Array<{ id: PlayerTabType; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Overview", icon: Eye },
  { id: "party", label: "Party", icon: Users },
  { id: "sessions", label: "Sessions", icon: Clock },
  { id: "stats", label: "Stats", icon: BarChart3 },
  { id: "tickets", label: "Tickets", icon: Ticket },
  { id: "strikes", label: "Strikes", icon: Shield },
  { id: "bans", label: "Bans", icon: Ban },
  { id: "transactions", label: "Transactions", icon: ArrowLeftRight },
  { id: "audit", label: "Audit Log", icon: FileText },
];

export function PlayerTabs() {
  return (
    <TabsList variant="underline">
      {TABS.map(({ id, label, icon: Icon }) => (
        <TabsTrigger key={id} value={id}>
          <Icon />
          {label}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
