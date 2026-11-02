import { useState } from "react";
import { Plus, Terminal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { trpc, type RouterOutput } from "@/lib/trpc";

type Commands = RouterOutput["admin"]["votes"]["rewardCommands"];
type ListKey = keyof Commands;

const MAX_COMMANDS = 10;
const MAX_LENGTH = 256;

const LISTS: {
  key: ListKey;
  label: string;
  hint: string;
  min: number;
}[] = [
  {
    key: "perVote",
    label: "For each vote",
    hint: 'Runs once per paid vote. The first command decides whether a vote counts as paid: if the server answers with an unknown command, "No player was found", "No entity was found", "No targets" or an unknown item, the vote is retried on the next join. Put a command first that gives one of those answers when it cannot do its job, such as give.',
    min: 1,
  },
  {
    key: "afterPayout",
    label: "After the payout",
    hint: "Runs once after a player's pending votes were paid, for example a thank-you message.",
    min: 0,
  },
];

const COPY = {
  title: "Reward commands",
  description:
    "Console commands sent over RCON when a voter is next online on the server. {player} is the voter's name everywhere. {count}, the number of votes just paid, only works after the payout.",
  ownerOnly: "Only the owner can change these commands.",
  add: "Add command",
  save: "Save commands",
  reset: "Discard changes",
} as const;

function isValid(commands: Commands): boolean {
  return (
    LISTS.every(({ key, min }) => {
      const list = commands[key];
      return (
        list.length >= min &&
        list.length <= MAX_COMMANDS &&
        list.every((command) => command.trim().length > 0)
      );
    }) && commands.perVote.every((command) => !command.includes("{count}"))
  );
}

export function RewardCommandsCard() {
  const utils = trpc.useUtils();
  const query = trpc.admin.votes.rewardCommands.useQuery();
  const accountQuery = trpc.user.account.me.useQuery();
  const isOwner = accountQuery.data?.isOwner ?? false;
  const [draft, setDraft] = useState<Commands | null>(null);

  const saveMutation = trpc.owner.voteRewards.update.useMutation(
    useMutationToast({
      success: "Reward commands saved",
      onSuccess: (saved) => {
        utils.admin.votes.rewardCommands.setData(undefined, saved);
        setDraft(null);
      },
    }),
  );

  const shown = draft ?? query.data;

  const update = (key: ListKey, next: string[]) => {
    if (!shown) return;
    setDraft({ ...shown, [key]: next });
  };

  return (
    <Card className="gap-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Terminal className="size-4 text-muted-foreground" />
          {COPY.title}
        </CardTitle>
        <CardDescription>{COPY.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {query.isError ? (
          <p className="text-sm text-destructive">
            Failed to load the reward commands: {query.error.message}
          </p>
        ) : !shown ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : (
          LISTS.map(({ key, label, hint, min }) => {
            const list = shown[key];
            return (
              <section key={key} className="flex flex-col gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {label}
                  </p>
                  <p className="text-xs text-muted-foreground">{hint}</p>
                </div>
                {list.map((command, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={command}
                      maxLength={MAX_LENGTH}
                      disabled={!isOwner || saveMutation.isPending}
                      onChange={(event) =>
                        update(
                          key,
                          list.map((entry, i) =>
                            i === index ? event.target.value : entry,
                          ),
                        )
                      }
                      className="font-mono text-xs"
                      aria-label={`${label} command ${index + 1}`}
                    />
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove command"
                        disabled={list.length <= min || saveMutation.isPending}
                        onClick={() =>
                          update(
                            key,
                            list.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {isOwner && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="self-start"
                    disabled={
                      list.length >= MAX_COMMANDS || saveMutation.isPending
                    }
                    onClick={() => update(key, [...list, ""])}
                  >
                    <Plus className="size-4" />
                    {COPY.add}
                  </Button>
                )}
              </section>
            );
          })
        )}
        {!isOwner && shown && (
          <p className="text-xs text-muted-foreground">{COPY.ownerOnly}</p>
        )}
      </CardContent>
      {isOwner && draft && (
        <CardFooter className="flex flex-wrap justify-end gap-2 border-t">
          <Button
            variant="outline"
            size="sm"
            disabled={saveMutation.isPending}
            onClick={() => setDraft(null)}
          >
            {COPY.reset}
          </Button>
          <Button
            size="sm"
            disabled={!isValid(draft) || saveMutation.isPending}
            onClick={() =>
              saveMutation.mutate({
                perVote: draft.perVote.map((command) => command.trim()),
                afterPayout: draft.afterPayout.map((command) => command.trim()),
              })
            }
          >
            {COPY.save}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
