import { TopRoleHero } from "./components/TopRoleHero";
import { Boards } from "./components/Boards";

export function Leaderboards() {
  return (
    <div className="relative">
      <TopRoleHero />
      <div className="relative z-10 rounded-t-3xl border-t border-border/60 bg-background shadow-[0_-40px_120px_rgba(0,0,0,0.7)]">
        <Boards />
      </div>
    </div>
  );
}
