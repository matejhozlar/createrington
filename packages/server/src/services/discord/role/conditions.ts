import type { AnyRoleRule, RoleEligibilityResult } from "./types";
import { RoleConditionType } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RoleConditionContext {
  discordId: string;
  createdAt: Date;
  playtimeByServer: Map<number, number>;
}

export function requiredValueOf(rule: AnyRoleRule): number {
  switch (rule.conditionType) {
    case RoleConditionType.PLAYTIME:
      return rule.requiredSeconds;
    case RoleConditionType.SERVER_AGE:
      return rule.requiredDays;
    default:
      return 0;
  }
}

function currentValueOf(
  rule: AnyRoleRule,
  context: RoleConditionContext,
): number {
  switch (rule.conditionType) {
    case RoleConditionType.PLAYTIME: {
      if (rule.serverId !== undefined) {
        return context.playtimeByServer.get(rule.serverId) ?? 0;
      }
      let total = 0;
      for (const seconds of context.playtimeByServer.values()) total += seconds;
      return total;
    }
    case RoleConditionType.SERVER_AGE:
      return Math.floor((Date.now() - context.createdAt.getTime()) / DAY_MS);
    default:
      throw new Error(`Unknown condition type: ${rule.conditionType}`);
  }
}

export function evaluateRule(
  rule: AnyRoleRule,
  context: RoleConditionContext,
): RoleEligibilityResult {
  const currentValue = currentValueOf(rule, context);
  const requiredValue = requiredValueOf(rule);

  return {
    rule,
    qualifies: currentValue >= requiredValue,
    currentValue,
    requiredValue,
    discordId: context.discordId,
  };
}
