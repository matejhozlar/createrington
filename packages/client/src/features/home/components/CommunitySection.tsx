import { Clock, TrendingUp, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerData } from "@/contexts/server-data";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { MAIN_SERVER_ID } from "@/lib/minecraft";
import { trpc } from "@/lib/trpc";
import { SectionHeading } from "./SectionHeading";

const UNAVAILABLE_DESCRIPTION = "Couldn't load right now";

export function CommunitySection() {
  const { servers } = useServerData();
  const server = servers.find((s) => s.serverId === MAIN_SERVER_ID);

  const {
    data: playerCount,
    isLoading: isLoadingPlayers,
    isError: playersFailed,
  } = useQuery(trpc.public.players.count.queryOptions({}));

  const {
    data: playtimeData,
    isLoading: isLoadingPlaytime,
    isError: playtimeFailed,
  } = useQuery(trpc.public.metrics.playtime.totalHours.queryOptions({}));

  const playersUnavailable = playersFailed && !playerCount;
  const playtimeUnavailable = playtimeFailed && !playtimeData;

  const serverMetrics = [
    {
      icon: Users,
      value: server?.playerCount ?? 0,
      title: "Players Online",
      description: "Active players right now",
    },
    {
      icon: TrendingUp,
      value: isLoadingPlayers
        ? "..."
        : playersUnavailable
          ? "–"
          : (playerCount?.count ?? "N/A"),
      title: "Total Players",
      description: playersUnavailable
        ? UNAVAILABLE_DESCRIPTION
        : "Registered community members",
    },
    {
      icon: Clock,
      value: isLoadingPlaytime ? (
        <Spinner className="mx-auto size-10 text-primary" />
      ) : playtimeUnavailable ? (
        "–"
      ) : (
        (playtimeData?.totalHours ?? "N/A")
      ),
      title: "Hours Played",
      description: playtimeUnavailable
        ? UNAVAILABLE_DESCRIPTION
        : "Total playtime across all seasons",
    },
  ];

  return (
    <section id="learn-more" className="py-16 px-5 md:px-8 bg-zinc-950">
      <div className="max-w-7xl mx-auto">
        <SectionHeading
          className="items-center mb-12"
          title="Join a Thriving Community"
          subtitle="Our server is home to a vibrant community of builders and creators"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {serverMetrics.map(({ icon: Icon, value, title, description }) => (
            <Card key={title} className="bg-background">
              <CardHeader className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon className="w-8 h-8 text-primary" />
                </div>

                <div>
                  <div className="text-5xl font-bold text-foreground mb-2">
                    {value}
                  </div>

                  <CardTitle className="text-xl text-foreground">
                    {title}
                  </CardTitle>

                  <CardDescription className="text-base mt-2">
                    {description}
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
