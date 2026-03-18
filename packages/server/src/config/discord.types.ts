interface MemberRolesConfig {
  readonly owner: string;
  readonly bot: string;
  readonly admin: string;
  readonly developer: string;
  readonly theSleepless: string;
  readonly cryptoBaron: string;
  readonly clockworkArchitect: string;
  readonly masterAutomaton: string;
  readonly factoryOverseer: string;
  readonly steamEngineer: string;
  readonly brassTechnician: string;
  readonly mechanicalAssembler: string;
  readonly kineticOperator: string;
  readonly cogCarrier: string;
  readonly shaftScraper: string;
  readonly starforged: string;
  readonly netherite: string;
  readonly emerald: string;
  readonly diamond: string;
  readonly gold: string;
  readonly iron: string;
  readonly copper: string;
  readonly stone: string;
  readonly wood: string;
  readonly legend: string;
  readonly veteran: string;
  readonly regular: string;
  readonly adventurer: string;
  readonly newcomer: string;
  readonly tester: string;
  readonly cogsAndSteam: string;
  readonly verified: string;
  readonly cogsAndSteamnotifications: string;
  readonly cryptonotifications: string;
  readonly unverified: string;
}

interface ChannelConfig {
  readonly administration: {
    readonly chat: string;
    readonly test: string;
    readonly communityUpdates: string;
    readonly transcripts: string;
    readonly notifications: string;
  };

  readonly general: {
    readonly hallOfFame: string;
    readonly commands: string;
    readonly leaderboards: string;
    readonly questions: string;
    readonly botSpam: string;
  };

  readonly serverStats: {
    readonly bots: string;
    readonly members: string;
    readonly allMembers: string;
  };

  readonly cogsAndSteam: {
    readonly notifications: string;
    readonly serverPics: string;
    readonly chat: string;
    readonly minecraftChat: string;
  };

  readonly createringtonOfficial: {
    readonly download: string;
    readonly support: string;
    readonly announcements: string;
    readonly roles: string;
    readonly rules: string;
    readonly welcome: string;
  };

  readonly crypto: {
    readonly discussion: string;
    readonly news: string;
  };

  readonly dev: {
    readonly chat: string;
    readonly createringtonKubejs: string;
    readonly createrington: string;
    readonly createringtonCurrency: string;
  };

}

interface CategoriesConfig {
  readonly crypto: string;
  readonly createringtonOfficial: string;
  readonly administration: string;
  readonly verification: string;
  readonly dev: string;
  readonly serverStats: string;
  readonly general: string;
  readonly tickets: string;
  readonly cogsAndSteam: string;
}

export type { MemberRolesConfig, ChannelConfig, CategoriesConfig };