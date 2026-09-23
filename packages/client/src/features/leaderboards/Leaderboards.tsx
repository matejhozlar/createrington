import { TopRoleHero } from "./components/TopRoleHero";
import { LeaderboardTable } from "./components/LeaderboardTable";

export function Leaderboards() {
  return (
    <div className="relative overflow-x-clip">
      <TopRoleHero />
      <div className="relative z-10 rounded-t-3xl border-t border-white/10 bg-background shadow-[0_-40px_120px_rgba(0,0,0,0.7)]">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/40 to-transparent"
        />
        <LeaderboardTable />
      </div>
    </div>
  );
}
