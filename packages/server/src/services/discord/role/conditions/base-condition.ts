import type { AnyRoleRule, RoleEligibilityResult } from "../types";

/**
 * Abstract base class for role assignment conditions
 *
 * Each condition type (playtime, balance, etc.) implements their interface
 * to provide a consistent way to check player eligibility
 */
export abstract class BaseRoleCondition<T extends AnyRoleRule = AnyRoleRule> {
  constructor(protected rule: T) {}

  /**
   * Check if a player qualifies for this role based on the condition
   *
   * @param discordId - Discord user ID of the player to check
   * @returns Promise resolving to eligibility result
   */
  abstract checkEligibility(discordId: string): Promise<RoleEligibilityResult>;

  /**
   * Get the current value for this condition (e.g. current playtime)
   *
   * @param discordId - Discord user ID of the player
   * @returns Promise resolving to the current value
   */
  abstract getCurrentValue(discordId: string): Promise<number>;

  /**
   * Get the required value for this condition
   *
   * @returns Required value
   */
  abstract getRequiredValue(): number;
}
