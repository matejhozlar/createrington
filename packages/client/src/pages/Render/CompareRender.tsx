import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "./compare-render.css";

interface PlayerData {
  username: string;
  uuid: string;
  balance: string;
  playtime: string;
  playtimeSeconds: number;
  sessions: number;
  memberSince: string;
}

interface CompareData {
  player1: PlayerData;
  player2: PlayerData;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Returns 1 if a > b, 2 if b > a, 0 if equal */
function winner(a: number, b: number): 0 | 1 | 2 {
  if (a > b) return 1;
  if (b > a) return 2;
  return 0;
}

function StatRow({
  label,
  value1,
  value2,
  win,
}: {
  label: string;
  value1: string;
  value2: string;
  win: 0 | 1 | 2;
}) {
  return (
    <div className="stat-row">
      <div className={`stat-value left ${win === 1 ? "winning" : ""}`}>
        {value1}
        {win === 1 && <span className="crown">&#9670;</span>}
      </div>
      <div className="stat-label">{label}</div>
      <div className={`stat-value right ${win === 2 ? "winning" : ""}`}>
        {win === 2 && <span className="crown">&#9670;</span>}
        {value2}
      </div>
    </div>
  );
}

export function CompareRender() {
  const [params] = useSearchParams();
  const [data, setData] = useState<CompareData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const secret = params.get("secret");
  const p1 = params.get("player1");
  const p2 = params.get("player2");
  const hasMissingParams = !secret || !p1 || !p2;

  useEffect(() => {
    if (hasMissingParams) return;

    const url = new URL("/api/render/compare", window.location.origin);
    url.searchParams.set("secret", secret);
    url.searchParams.set("player1", p1);
    url.searchParams.set("player2", p2);

    fetch(url.toString())
      .then((res) => {
        if (!res.ok) throw new Error("Bad response");
        return res.json() as Promise<CompareData>;
      })
      .then(setData)
      .catch(() => setFetchError("Failed to load comparison data"));
  }, [hasMissingParams, secret, p1, p2]);

  const error = hasMissingParams ? "Missing parameters" : fetchError;

  if (error) {
    return (
      <div className="compare-root">
        <div className="compare-error">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="compare-root">
        <div className="compare-loading">Loading...</div>
      </div>
    );
  }

  const left = data.player1;
  const right = data.player2;

  const balanceWin = winner(
    parseFloat(left.balance.replace(/,/g, "")),
    parseFloat(right.balance.replace(/,/g, "")),
  );
  const playtimeWin = winner(left.playtimeSeconds, right.playtimeSeconds);
  const sessionsWin = winner(left.sessions, right.sessions);
  // Earlier join date is "better"
  const memberWin = winner(
    new Date(right.memberSince).getTime(),
    new Date(left.memberSince).getTime(),
  );

  return (
    <div className="compare-root" id="compare-container">
      {/* Decorative grid background */}
      <div className="bg-grid" />
      <div className="bg-glow left" />
      <div className="bg-glow right" />

      {/* Header */}
      <div className="compare-header">
        <div className="header-line" />
        <h1 className="header-title">PLAYER COMPARISON</h1>
        <div className="header-line" />
      </div>

      {/* Player cards + stats center */}
      <div className="compare-body">
        {/* Player 1 */}
        <div className="player-card left">
          <div className="skin-wrapper">
            <div className="skin-glow left" />
            <img
              src={`https://mc-heads.net/body/${left.uuid}`}
              alt={left.username}
              className="player-skin"
              crossOrigin="anonymous"
            />
          </div>
          <div className="player-name left">{left.username}</div>
        </div>

        {/* VS + Stats */}
        <div className="stats-center">
          <div className="vs-badge">VS</div>
          <div className="stats-list">
            <StatRow
              label="BALANCE"
              value1={`$${left.balance}`}
              value2={`$${right.balance}`}
              win={balanceWin}
            />
            <StatRow
              label="PLAYTIME"
              value1={left.playtime}
              value2={right.playtime}
              win={playtimeWin}
            />
            <StatRow
              label="SESSIONS"
              value1={left.sessions.toLocaleString()}
              value2={right.sessions.toLocaleString()}
              win={sessionsWin}
            />
            <StatRow
              label="MEMBER SINCE"
              value1={formatDate(left.memberSince)}
              value2={formatDate(right.memberSince)}
              win={memberWin}
            />
          </div>
        </div>

        {/* Player 2 */}
        <div className="player-card right">
          <div className="skin-wrapper">
            <div className="skin-glow right" />
            <img
              src={`https://mc-heads.net/body/${right.uuid}`}
              alt={right.username}
              className="player-skin"
              crossOrigin="anonymous"
            />
          </div>
          <div className="player-name right">{right.username}</div>
        </div>
      </div>

      {/* Footer */}
      <div className="compare-footer">
        <span>create-rington.com</span>
      </div>
    </div>
  );
}
