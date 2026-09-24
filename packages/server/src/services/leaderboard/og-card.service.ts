import { loadImage, type Image } from "@napi-rs/canvas";
import {
  topRoleHolderService,
  type TopRoleView,
} from "@/services/discord/role/top-role-holder.service";
import { registerBrandFonts, renderCard } from "@/utils/og-card";
import {
  paintLeaderboardsCard,
  SLOT_ORDER,
  type CardSlot,
} from "./og-card.paint";

const MC_HEADS_BODY_URL = "https://mc-heads.net/body";
const FETCH_TIMEOUT_MS = 5000;
const DEGRADED_RETRY_MS = 5 * 60 * 1000;

export interface LeaderboardOgCard {
  png: Buffer;
  degraded: boolean;
}

interface CachedCard {
  signature: string;
  card: Promise<LeaderboardOgCard>;
  retryAt: number | null;
}

interface PaintedSlot {
  slot: CardSlot;
  degraded: boolean;
}

/**
 * Paints the /leaderboards social card (1200x630 PNG) from the live top-role
 * holders: each holder's stored hero figure in their title's pose, their
 * name, and the metric that earned it. The card is memoised against the
 * holders it was drawn from, so it is repainted only when a title changes
 * hands, a figure is re-rendered or a metric moves (in practice once per
 * daily reconcile); concurrent requests share one paint and a failed paint is
 * dropped so the next request retries. A holder whose figure cannot be
 * fetched falls back to a plain mc-heads body, then to no figure; such a card
 * is flagged `degraded` and repainted on the first request after a few
 * minutes instead of living until the holders change.
 */
export class LeaderboardOgCardService {
  private cached: CachedCard | null = null;

  /** The current card, repainted when the top-role holders changed or the cached one is degraded and due a retry. */
  async render(): Promise<LeaderboardOgCard> {
    const roles = await topRoleHolderService.list();
    const signature = JSON.stringify(
      roles.map((role) => [
        role.roleKey,
        role.holder?.minecraftUuid,
        role.holder?.minecraftUsername,
        role.holder?.value,
        role.holder?.outlineImageUrl ?? role.holder?.imageUrl,
      ]),
    );
    const cached = this.cached;
    if (
      cached?.signature === signature &&
      (cached.retryAt === null || Date.now() < cached.retryAt)
    ) {
      return cached.card;
    }

    const entry: CachedCard = {
      signature,
      card: this.paint(roles),
      retryAt: null,
    };
    this.cached = entry;
    return entry.card.then(
      (card) => {
        if (card.degraded) entry.retryAt = Date.now() + DEGRADED_RETRY_MS;
        return card;
      },
      (error: unknown) => {
        if (this.cached === entry) this.cached = null;
        throw error;
      },
    );
  }

  private async paint(roles: TopRoleView[]): Promise<LeaderboardOgCard> {
    registerBrandFonts();
    const byKey = new Map(roles.map((role) => [role.roleKey, role]));
    const painted = await Promise.all(
      SLOT_ORDER.map((key) => {
        const role = byKey.get(key);
        return role ? this.slot(role) : null;
      }),
    );
    const png = await renderCard((ctx) =>
      paintLeaderboardsCard(
        ctx,
        painted.map((entry) => entry?.slot ?? null),
      ),
    );
    return { png, degraded: painted.some((entry) => entry?.degraded) };
  }

  private async slot(role: TopRoleView): Promise<PaintedSlot> {
    const base = {
      roleKey: role.roleKey,
      label: role.label,
      metric: role.metric,
    };
    const { holder } = role;
    if (!holder) return { slot: { ...base, holder: null }, degraded: false };

    const storedUrl = holder.outlineImageUrl ?? holder.imageUrl;
    const figure = await this.figure(storedUrl, holder.minecraftUuid);
    return {
      slot: {
        ...base,
        holder: {
          username: holder.minecraftUsername,
          value: holder.value,
          figure: figure?.image ?? null,
        },
      },
      degraded: !figure || (!!storedUrl && figure.url !== storedUrl),
    };
  }

  private async figure(
    storedUrl: string | null,
    minecraftUuid: string,
  ): Promise<{ image: Image; url: string } | null> {
    const sources = [
      storedUrl,
      `${MC_HEADS_BODY_URL}/${minecraftUuid}/600`,
    ].filter((url): url is string => !!url);

    for (const url of sources) {
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return {
          image: await loadImage(Buffer.from(await res.arrayBuffer())),
          url,
        };
      } catch (error) {
        logger.warn(
          `Leaderboards OG card could not load figure ${url} for ${minecraftUuid}:`,
          error,
        );
      }
    }
    return null;
  }
}

export const leaderboardOgCardService = new LeaderboardOgCardService();
