export interface MemecoinDefinition {
  name: string;
  symbol: string;
  description: string;
}

/**
 * Pool of memecoin definitions for random generation.
 * New memecoins are picked randomly from this catalog.
 */
export const MEMECOIN_CATALOG: MemecoinDefinition[] = [
  { name: "FluffCoin", symbol: "FLF", description: "Backed by the raw power of sheep wool. May crash during shearing season." },
  { name: "DiamondDoge", symbol: "DDG", description: "To the bedrock and beyond!" },
  { name: "CreeperCash", symbol: "CRP", description: "Explosive growth potential. Literally." },
  { name: "EnderToken", symbol: "END", description: "Teleports between price points with no warning." },
  { name: "RedstoneRuble", symbol: "RSR", description: "Powers the Minecraft economy, one tick at a time." },
  { name: "NetherNote", symbol: "NTN", description: "Forged in lava, traded in chaos." },
  { name: "SlimeCoin", symbol: "SLM", description: "Bounces between highs and lows unpredictably." },
  { name: "PiglinPeso", symbol: "PGP", description: "Bartering has never been this volatile." },
  { name: "PhantomPound", symbol: "PHM", description: "Only appears when you haven't slept." },
  { name: "WitchWon", symbol: "WCH", description: "Brewed from the finest market potions." },
  { name: "BlazeToken", symbol: "BLZ", description: "Hot commodity. Literally on fire." },
  { name: "SkeletonShekel", symbol: "SKL", description: "Rattles with every trade." },
  { name: "GhastGold", symbol: "GHG", description: "Cries when the price drops." },
  { name: "ZombieZloty", symbol: "ZMB", description: "Undead returns from the grave of crashed tokens." },
  { name: "VillagerVenture", symbol: "VLG", description: "Hmm. Hmmm. HMM!" },
  { name: "IronIngot", symbol: "IRN", description: "Solid as... well, iron." },
  { name: "CoalCoin", symbol: "COL", description: "The fuel of early-game economies." },
  { name: "EmeraldExchange", symbol: "EMR", description: "The original villager currency, now tokenized." },
  { name: "LapiLira", symbol: "LPL", description: "Enchantingly unpredictable." },
  { name: "GlowBerry", symbol: "GLW", description: "Lights up your portfolio. Sometimes." },
  { name: "CopperCent", symbol: "CPR", description: "Oxidizes over time. Value may vary." },
  { name: "AmethystAsset", symbol: "AMT", description: "Looks pretty, sounds nice, unstable investment." },
  { name: "DragonDinar", symbol: "DRG", description: "End-game investment for the bravest traders." },
  { name: "BeaconBuck", symbol: "BCN", description: "Empowers everything around it." },
  { name: "SculkCoin", symbol: "SCK", description: "Spreads through your portfolio like the deep dark." },
  { name: "WardenWei", symbol: "WRD", description: "Cannot be seen, only felt in your wallet." },
  { name: "FrogToken", symbol: "FRG", description: "Hops between price levels." },
  { name: "AllayAsset", symbol: "ALY", description: "Collects small gains and brings them to you." },
  { name: "GoatGuilder", symbol: "GOT", description: "Screams at random. Rams through resistance levels." },
  { name: "AxolotlAurar", symbol: "AXL", description: "Cute, regenerative, and surprisingly resilient." },
  { name: "PandaPound", symbol: "PND", description: "Lazily rolls between support and resistance." },
  { name: "BatBitcoin", symbol: "BAT", description: "Hangs upside down — inverted charts enthusiasts rejoice." },
  { name: "ParrotPeso", symbol: "PRT", description: "Copies whatever the last big token did." },
  { name: "MushroomMark", symbol: "MSH", description: "Grows in the dark. Prefers damp conditions." },
  { name: "CakeCoin", symbol: "CAK", description: "The cake is not a lie — but the gains might be." },
  { name: "TNToken", symbol: "TNT", description: "Handle with care. Explosive volatility guaranteed." },
  { name: "PistonPenny", symbol: "PST", description: "Pushes and pulls the market with every tick." },
  { name: "HoneyCoin", symbol: "HNY", description: "Sweet returns, sticky losses." },
  { name: "SpiderSilk", symbol: "SPD", description: "Weaves a web of complex market patterns." },
  { name: "EndermanEuro", symbol: "ENM", description: "Don't look at it directly or it might move." },
  { name: "CodCurrency", symbol: "COD", description: "Swims against the current." },
  { name: "SalmonStock", symbol: "SAL", description: "Always swimming upstream." },
  { name: "TurtleToken", symbol: "TRT", description: "Slow and steady. Shell protects against crashes." },
  { name: "DolphinDollar", symbol: "DLP", description: "Gracefully navigates turbulent markets." },
  { name: "SquidSol", symbol: "SQD", description: "Squirts ink to obscure its true value." },
  { name: "RabbitReal", symbol: "RBT", description: "Multiplies faster than you can track." },
  { name: "FoxFranc", symbol: "FOX", description: "Sly trades at night when nobody's watching." },
  { name: "WolfWon", symbol: "WLF", description: "Hunts in packs. Pack mentality drives the price." },
  { name: "OcelotObol", symbol: "OCL", description: "Rarely seen, highly valued when spotted." },
  { name: "LlamaCoin", symbol: "LMA", description: "Spits at bad investments." },
];
