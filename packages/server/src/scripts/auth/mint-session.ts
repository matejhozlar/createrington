/**
 * Mint a synthetic refresh-token session for any registered player, so we
 * can test the site logged in as someone else (e.g. a non-admin) without
 * going through Discord OAuth.
 *
 * Usage:
 *   pnpm tsx packages/server/src/scripts/auth/mint-session.ts
 *   pnpm tsx packages/server/src/scripts/auth/mint-session.ts --username someone
 *   pnpm tsx packages/server/src/scripts/auth/mint-session.ts -u someone --origin http://localhost:3000
 *
 * Prints a one-liner you paste in the browser DevTools console; reload the
 * page and the AuthProvider's silent refresh logs you in as that user.
 *
 * NOTE: This bypasses Discord OAuth entirely. The minted session is a real
 * row in `auth_session` and respects rotation / revocation. Use the printed
 * `revoke` command (or log out in the browser) when you are done.
 */
import "@/logger.global";
import { execSync } from "node:child_process";
import { Q } from "@/db";
import { sessionService } from "@/services/auth/session/session.service";
import config from "@/config";

function copyToClipboard(text: string): boolean {
  let cmd: string;
  switch (process.platform) {
    case "win32":
      cmd = "clip.exe";
      break;
    case "darwin":
      cmd = "pbcopy";
      break;
    default:
      cmd = "xclip -selection clipboard";
  }
  try {
    execSync(cmd, { input: text, stdio: ["pipe", "ignore", "ignore"] });
    return true;
  } catch {
    return false;
  }
}

function openInBrowser(url: string): boolean {
  let cmd: string;
  switch (process.platform) {
    case "win32":
      cmd = `start "" "${url}"`;
      break;
    case "darwin":
      cmd = `open "${url}"`;
      break;
    default:
      cmd = `xdg-open "${url}"`;
  }
  try {
    execSync(cmd, { stdio: "ignore", shell: true } as never);
    return true;
  } catch {
    return false;
  }
}

interface CliArgs {
  username: string;
  origin: string;
  returnTo: string;
  copy: boolean;
  open: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let username = "saunhardy";
  let origin = "http://localhost:3000";
  let returnTo = "/";
  let copy = true;
  let open = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--username" || a === "-u") {
      username = args[++i] ?? username;
    } else if (a === "--origin" || a === "-o") {
      origin = args[++i] ?? origin;
    } else if (a === "--return-to" || a === "-r") {
      returnTo = args[++i] ?? returnTo;
    } else if (a === "--open") {
      open = true;
    } else if (a === "--no-copy") {
      copy = false;
    } else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}`);
      printHelp();
      process.exit(1);
    }
  }

  return {
    username,
    origin,
    returnTo: normalizeReturnTo(returnTo),
    copy,
    open,
  };
}

// Git Bash on Windows (MSYS) rewrites leading-slash paths into Windows file
// paths, so `--return-to /crypto` arrives as `C:/Program Files/Git/crypto`.
// Recover the original path by stripping any drive-letter prefix and the
// known Git install bits; otherwise accept bare paths like `crypto`.
function normalizeReturnTo(value: string): string {
  // Already a clean absolute path
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  // MSYS-converted: take the last path segment chain after the install dir
  const msys = value.match(/^[A-Za-z]:[\\/]Program Files[\\/]Git[\\/](.*)$/);
  if (msys) return "/" + msys[1].replace(/\\/g, "/");
  // Bare path (`crypto` -> `/crypto`)
  if (!value.startsWith("/")) return "/" + value;
  return "/";
}

function printHelp(): void {
  console.log(`
Mint a synthetic refresh-token session for testing.

Options:
  -u, --username <mc>   Minecraft username to log in as (default: saunhardy)
  -o, --origin <url>    Site origin (default: http://localhost:3000)
  -r, --return-to <p>   Path to land on after login (default: /)
      --open            Open the browser at a dev-only auto-login URL
      --no-copy         Skip copying the DevTools snippet to clipboard
  -h, --help            Show this help
`);
}

async function main(): Promise<void> {
  const { username, origin, returnTo, copy, open } = parseArgs();

  const player = await Q.player.find({ minecraftUsername: username });
  if (!player) {
    console.error(`✗ No player found with minecraftUsername = "${username}"`);
    process.exit(1);
  }

  const isAdmin = await Q.admin.exists({ discordId: player.discordId });

  const rawToken = await sessionService.createSession({
    discordId: player.discordId,
    username: player.minecraftUsername,
    avatar: undefined,
    ip: "127.0.0.1",
    userAgent: "mint-session.ts",
  });

  const cookieName = config.app.auth.cookie.name;
  const snippet = `document.cookie = ${JSON.stringify(`${cookieName}=${rawToken}; path=/api/auth; samesite=lax`)}; location.reload();`;

  const autoLoginUrl = `${origin.replace(/\/$/, "")}/api/auth/dev-set-refresh?token=${encodeURIComponent(rawToken)}&return_to=${encodeURIComponent(returnTo)}`;

  console.log("");
  console.log("=== Session minted ===");
  console.log(
    `  player:        ${player.minecraftUsername} (${player.minecraftUuid})`,
  );
  console.log(`  discord id:    ${player.discordId}`);
  console.log(`  is admin:      ${isAdmin}`);
  console.log(`  cookie name:   ${cookieName}`);
  console.log(`  origin:        ${origin}`);
  console.log(`  return to:     ${returnTo}`);
  console.log("");

  if (open) {
    const opened = openInBrowser(autoLoginUrl);
    if (opened) {
      console.log(`✓ Opened ${autoLoginUrl}`);
      console.log(
        `  Browser logs in as ${player.minecraftUsername}${isAdmin ? " (admin)" : " (non-admin)"} and lands on ${returnTo}.`,
      );
    } else {
      console.log("Failed to spawn browser. Visit this URL manually:");
      console.log(`  ${autoLoginUrl}`);
    }
  } else {
    const copied = copy && copyToClipboard(snippet);
    if (copied) {
      console.log(
        `✓ DevTools snippet copied to clipboard. Paste it in the console at ${origin}.`,
      );
    } else {
      console.log(
        "Paste this in the browser DevTools console at the site origin:",
      );
      console.log("");
      console.log(snippet);
    }
    console.log("");
    console.log(
      `Logged in as ${player.minecraftUsername}${isAdmin ? " (admin)" : " (non-admin)"} after reload.`,
    );
    console.log("");
    console.log(
      `Tip: pass --open to skip DevTools and have the script open your browser at the auto-login URL.`,
    );
  }
  console.log("");
  console.log("To log out, click Logout in the UI or paste:");
  console.log(
    `  document.cookie = "${cookieName}=; path=/api/auth; expires=Thu, 01 Jan 1970 00:00:00 GMT"; location.reload();`,
  );
  console.log("");

  process.exit(0);
}

main().catch((err) => {
  console.error("✗ mint-session failed:", err);
  process.exit(1);
});
