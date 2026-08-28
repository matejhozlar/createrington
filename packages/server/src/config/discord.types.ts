interface MemberRolesConfig {
  readonly owner: string;
  readonly bot: string;
  readonly admin: string;
  readonly developer: string;
  readonly theSleepless: string;
  readonly capitalist: string;
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
  readonly supporter: string;
  readonly verified: string;
  readonly cogsAndSteamnotifications: string;
  readonly railsnsailsnotifications: string;
  readonly cryptonotifications: string;
  readonly unverified: string;
}

interface ChannelConfig {
  readonly cogsAndSteam: {
    readonly expiredBases: string;
    readonly notifications: string;
    readonly serverPics: string;
    readonly modSuggestions3: string;
    readonly modSuggestions: string;
    readonly projects: string;
    readonly chat: string;
    readonly minecraftChat: string;
    readonly publicTesting: string;
    readonly modSuggestions2: string;
    readonly modSuggestions4: string;
  };

  readonly administration: {
    readonly mcCommandLogs: string;
    readonly chat: string;
    readonly test: string;
    readonly communityUpdates: string;
    readonly transcripts: string;
    readonly notifications: string;
  };

  readonly general: {
    readonly schematics: string;
    readonly hallOfFame: string;
    readonly commands: string;
    readonly leaderboards: string;
    readonly questions: string;
    readonly botSpam: string;
  };

  readonly createringtonOfficial: {
    readonly screenshotContest: string;
    readonly download: string;
    readonly support: string;
    readonly donate: string;
    readonly announcements: string;
    readonly roles: string;
    readonly rules: string;
    readonly welcome: string;
  };

  readonly serverStats: {
    readonly bots: string;
    readonly members: string;
    readonly allMembers: string;
  };

  readonly railsNSails: {
    readonly notifications: string;
    readonly changelog: string;
    readonly minecraftChat: string;
  };

  readonly verification: {
    readonly verify18: string;
  };

  readonly uncategorized: {
    readonly feedbackBugs: string;
    readonly chat: string;
    readonly startHere: string;
    readonly minecraftChat: string;
  };

  readonly dev: {
    readonly features: string;
    readonly chat: string;
    readonly createringtonKubejs: string;
    readonly createrington: string;
    readonly createringtonCurrency: string;
  };

  readonly crypto: {
    readonly discussion: string;
    readonly news: string;
  };
}

interface CategoriesConfig {
  readonly crypto: string;
  readonly createringtonOfficial: string;
  readonly administration: string;
  readonly verification: string;
  readonly dev: string;
  readonly railsNSails: string;
  readonly serverStats: string;
  readonly general: string;
  readonly tickets: string;
  readonly cogsAndSteam: string;
}

export type { MemberRolesConfig, ChannelConfig, CategoriesConfig };
