import { useState } from "react";
import { Package } from "lucide-react";
import {
  LAUNCHER_PACK_SLUG_MAX_LENGTH,
  LAUNCHER_PACK_SLUG_PATTERN,
  type LauncherPackSource,
} from "@createrington/shared/launcher";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { trpc, type RouterOutput } from "@/lib/trpc";

type Candidate =
  RouterOutput["owner"]["launcherPacks"]["candidates"]["modpacks"][number];

interface AddLauncherPackDialogProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

const SOURCE_OPTIONS: {
  value: LauncherPackSource;
  label: string;
  hint: string;
}[] = [
  {
    value: "curseforge",
    label: "CurseForge",
    hint: "Releases come from the modpack's published CurseForge project.",
  },
  {
    value: "sandbox",
    label: "Sandbox",
    hint: "Releases are snapshots the sandbox reports. Needs no CurseForge project.",
  },
];

const SLUG_HINT =
  "The key launchers store with an installed pack. Lower-case letters, digits and single hyphens. It cannot be changed later.";

function suggestSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LAUNCHER_PACK_SLUG_MAX_LENGTH);
}

function defaultSource(modpack: Candidate | null): LauncherPackSource {
  return modpack?.curseforgeProjectId ? "curseforge" : "sandbox";
}

export function AddLauncherPackDialog({
  open,
  onClose,
  onAdded,
}: AddLauncherPackDialogProps) {
  const [modpackId, setModpackId] = useState<string>("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [source, setSource] = useState<LauncherPackSource>("curseforge");

  const candidatesQuery = trpc.owner.launcherPacks.candidates.useQuery(
    undefined,
    { enabled: open, staleTime: 0 },
  );
  const candidates = candidatesQuery.data?.modpacks ?? [];
  const modpack =
    candidates.find((row) => String(row.id) === modpackId) ?? null;

  const close = () => {
    setModpackId("");
    setSlug("");
    setSlugTouched(false);
    setSource("curseforge");
    onClose();
  };

  const addMutation = trpc.owner.launcherPacks.add.useMutation(
    useMutationToast({
      success: (pack) => `Offering "${pack.slug}" to the launcher`,
      onSuccess: () => {
        onAdded();
        close();
      },
    }),
  );

  const pickModpack = (value: string) => {
    setModpackId(value);
    const picked = candidates.find((row) => String(row.id) === value) ?? null;
    if (!slugTouched) setSlug(picked ? suggestSlug(picked.name) : "");
    setSource(defaultSource(picked));
  };

  const slugValid = LAUNCHER_PACK_SLUG_PATTERN.test(slug);
  const sourceAllowed =
    source === "sandbox" || modpack?.curseforgeProjectId != null;
  const canAdd = modpack !== null && slugValid && sourceAllowed;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="size-5" />
            Offer a modpack to the launcher
          </DialogTitle>
          <DialogDescription>
            The pack shows up in every launcher's modpack list under this slug.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="launcher-pack-modpack">Modpack</FieldLabel>
            <Select value={modpackId} onValueChange={pickModpack}>
              <SelectTrigger id="launcher-pack-modpack" className="w-full">
                <SelectValue
                  placeholder={
                    candidatesQuery.isLoading
                      ? "Loading modpacks"
                      : candidates.length === 0
                        ? "Every modpack is already offered"
                        : "Pick a modpack"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((row) => (
                  <SelectItem key={row.id} value={String(row.id)}>
                    {row.name}
                    {row.curseforgeProjectId === null &&
                      " (no CurseForge project)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="launcher-pack-slug">Slug</FieldLabel>
            <Input
              id="launcher-pack-slug"
              value={slug}
              maxLength={LAUNCHER_PACK_SLUG_MAX_LENGTH}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(event.target.value.toLowerCase());
              }}
              placeholder="createrington-test"
              className="font-mono"
              aria-invalid={slug.length > 0 && !slugValid}
            />
            <p className="text-sm text-muted-foreground">{SLUG_HINT}</p>
          </Field>

          <Field>
            <FieldLabel htmlFor="launcher-pack-source">
              Releases from
            </FieldLabel>
            <Select
              value={source}
              onValueChange={(value) => setSource(value as LauncherPackSource)}
            >
              <SelectTrigger id="launcher-pack-source" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    disabled={
                      option.value === "curseforge" &&
                      modpack !== null &&
                      modpack.curseforgeProjectId === null
                    }
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {SOURCE_OPTIONS.find((option) => option.value === source)?.hint}
            </p>
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={!canAdd}
            loading={addMutation.isPending}
            onClick={() => {
              if (!modpack) return;
              addMutation.mutate({ slug, modpackId: modpack.id, source });
            }}
          >
            Offer pack
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
