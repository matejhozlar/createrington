interface MemberRolesConfig {
  readonly owner: string;
  readonly bot: string;
  readonly admin: string;
  readonly developer: string;
  readonly theSleepless: string;
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
  readonly unverified: string;
}

interface ChannelConfig {
  readonly createringtonOfficial: {
    readonly welcome: string;
    readonly support: string;
    readonly rules: string;
    readonly download: string;
    readonly roles: string;
  };

  readonly administration: {
    readonly notifications: string;
    readonly transcripts: string;
    readonly communityUpdates: string;
    readonly test: string;
    readonly chat: string;
  };

  readonly serverStats: {
    readonly bots: string;
    readonly members: string;
    readonly allMembers: string;
  };

  readonly general: {
    readonly hallOfFame: string;
    readonly botSpam: string;
    readonly leaderboards: string;
    readonly commands: string;
    readonly questions: string;
  };

  readonly cogsAndSteam: {
    readonly chat: string;
    readonly minecraftChat: string;
  };

  readonly testServer: {
    readonly chat: string;
    readonly minecraftChat: string;
  };

  readonly dev: {
    readonly createringtonKubejs: string;
    readonly createrington: string;
    readonly chat: string;
    readonly createringtonCurrency: string;
  };

  readonly textChannels: {
    readonly general: string;
  };

  readonly crypto: {
    readonly news: string;
  };
}

interface CategoriesConfig {
  readonly createringtonOfficial: string;
  readonly general: string;
  readonly tickets: string;
  readonly verification: string;
  readonly serverStats: string;
  readonly textChannels: string;
  readonly cogsAndSteam: string;
  readonly testServer: string;
  readonly administration: string;
  readonly dev: string;
  readonly crypto: string;
}

export type { MemberRolesConfig, ChannelConfig, CategoriesConfig };
