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

interface CachedCard {
  signature: string;
  png: Promise<Buffer>;
}

/**
 * Paints the /leaderboards social card (1200x630 PNG) from the live top-role
 * holders: each holder's stored hero figure in their title's pose, their
 * name, and the metric that earned it. The card is memoised against the
 * holders it was drawn from, so it is repainted only when a title changes
 * hands, a figure is re-rendered or a metric moves (in practice once per
 * daily reconcile); concurrent requests share one paint and a failed paint is
 * dropped so the next request retries. A holder whose figure cannot be
 * fetched falls back to a plain mc-heads body, then to no figure.
 */
export class LeaderboardOgCardService {
  private cached: CachedCard | null = null;

  /** The current card PNG, repainted only when the top-role holders changed. */
  async render(): Promise<Buffer> {
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
    if (this.cached?.signature === signature) return this.cached.png;

    const png = this.paint(roles).catch((error: unknown) => {
      if (this.cached?.png === png) this.cached = null;
      throw error;
    });
    this.cached = { signature, png };
    return png;
  }

  private async paint(roles: TopRoleView[]): Promise<Buffer> {
    registerBrandFonts();
    const byKey = new Map(roles.map((role) => [role.roleKey, role]));
    const ordered = SLOT_ORDER.map((key) => byKey.get(key)).filter(
      (role): role is TopRoleView => !!role,
    );
    const slots = await Promise.all(ordered.map((role) => this.slot(role)));
    return renderCard((ctx) => paintLeaderboardsCard(ctx, slots));
  }

  private async slot(role: TopRoleView): Promise<CardSlot> {
    const { holder } = role;
    return {
      roleKey: role.roleKey,
      label: role.label,
      metric: role.metric,
      holder: holder
        ? {
            username: holder.minecraftUsername,
            value: holder.value,
            figure: await this.figure(
              holder.outlineImageUrl ?? holder.imageUrl,
              holder.minecraftUuid,
            ),
          }
        : null,
    };
  }

  private async figure(
    storedUrl: string | null,
    minecraftUuid: string,
  ): Promise<Image | null> {
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
        return await loadImage(Buffer.from(await res.arrayBuffer()));
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
