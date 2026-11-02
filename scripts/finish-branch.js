import { execFileSync } from "node:child_process";

const base = "dev";
const remote = `origin/${base}`;
const force = process.argv.includes("--force");

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);

const dirty = git(["status", "--porcelain", "--untracked-files=no"]);
if (dirty) fail(`Commit or stash your changes first:\n${dirty}`);

if (branch !== base) {
  try {
    git(["checkout", base]);
  } catch {
    fail(`Could not check out ${base}, see git's message above.`);
  }
}

try {
  git(["fetch", "--prune", "origin"]);
} catch {
  fail("Could not fetch, see git's message above.");
}

const unpushed = Number(git(["rev-list", "--count", `${remote}..${base}`]));
try {
  const output = git(["merge", unpushed ? "--no-edit" : "--ff-only", remote]);
  if (output) console.log(output);
} catch {
  fail(
    unpushed
      ? `Could not merge ${remote} into ${base}. Resolve the conflicts and commit, then run this again.`
      : `Could not fast-forward ${base}, see git's message above.`,
  );
}
if (unpushed) {
  console.log(
    `${base} has ${unpushed} commit(s) that are not on origin, so ${remote} was merged into it. Push when ready: git push origin ${base}`,
  );
}

if (branch === base || branch === "HEAD") {
  console.log(
    `Nothing to delete, you were ${branch === base ? `on ${base}` : "detached"}.`,
  );
  process.exit(0);
}

try {
  console.log(git(["branch", force ? "-D" : "-d", branch]));
} catch {
  fail(
    `Kept ${branch}: git does not see it as merged into ${base}. If it was squash merged, run: pnpm branch:done --force`,
  );
}
