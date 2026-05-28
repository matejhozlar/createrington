# Local Minecraft server

A NeoForge 1.21.1 Minecraft server for local development, so game-server-dependent
backend logic can be tested without touching production. Built on
[`itzg/minecraft-server`](https://github.com/itzg/docker-minecraft-server).

> **Status:** the server boots with the dev mods auto-installed and pre-pointed
> at the host backend (`http://host.docker.internal:5001`). The shared
> `MOD_JWT_SECRET` matches the mods' default, so no per-developer setup is
> needed once the backend is running.

## Modpack

`mc/modpack/` holds the CurseForge modpack for local development:

- `createrington-development-<version>.zip` — import this directly into the
  CurseForge app (Create Custom Profile -> Import) to get the dev client.
- `manifest.json` / `modlist.html` / `overrides/` — the extracted pack, checked
  in so the mod set is reviewable and diffable in git. `overrides/servers.dat`
  pre-adds the dev server to the client's multiplayer list on import.
- `curseforge-files.txt` — the `<slug>:<fileID>` list the server container uses
  to auto-download the mods (mirrors `manifest.json`).

The pack targets NeoForge 21.1.222 / MC 1.21.1 and includes CRNet, Create,
PresenceAPI, and Createrington Currency.

## Mod configuration

The server mods read their config from `mc/config/` (mounted into the
container's `/data/config`). The Createrington mod configs are pre-baked there
so the mods point at the host backend out of the box:

- `apiBaseUrl` / `apiUrl` -> `http://host.docker.internal:5001`
- `jwtSecret` -> matches the backend's dev `MOD_JWT_SECRET`

Only those two files are tracked; every other mod's config is generated into
this directory at runtime and git-ignored.

## Usage

`mc:up` runs under Infisical so the CurseForge API key is available to
auto-download the mods. Run it the same way as the backend (e.g. logged into
the Infisical CLI):

```bash
pnpm mc:up        # start the server + attach to the live console (downloads NeoForge + mods on first run)
pnpm mc:start     # start the server detached (no console attach)
pnpm mc:attach    # attach to the live server console of a running server
pnpm mc:logs      # follow the server logs (read-only)
pnpm mc:console   # open a one-off / interactive RCON console (e.g. type: list)
pnpm mc:cmd list  # run a single console command, e.g. pnpm mc:cmd "say hi"
pnpm mc:down      # stop and remove the container (world is kept)
pnpm mc:reset     # stop and delete the world/data for a fresh start
pnpm mc:destroy   # full teardown: remove container, image, and world/data
```

`mc:up` (and `mc:attach`) drop you into the **live server console**: logs stream
and you can type server commands directly (`list`, `op <name>`, ...). This is
plain `docker attach`, so it works the same on Windows, macOS, and Linux.

> **Detach with `Ctrl-P` then `Ctrl-Q`** to leave the server running. Pressing
> `Ctrl-C` while attached sends a stop signal and shuts the server down. Use
> `mc:start` if you just want it running in the background.

To manage the database and Minecraft server together:

```bash
pnpm docker:up     # start both the Postgres and Minecraft containers
pnpm docker:down   # stop both
pnpm docker:logs   # follow both sets of logs
pnpm docker:reset  # reset the database (migrate + seed) and the MC world
pnpm docker:destroy # full teardown of both (containers, images, volumes, data)
```

The server is reachable at `localhost:25565`. First boot takes a few minutes
while NeoForge and the server jar download.

## Persistence

World and server data live in `mc/data/` (bind-mounted into the container and
git-ignored), so they survive `pnpm mc:down` and container restarts. Use
`pnpm mc:reset` to wipe and regenerate from scratch.

## Configuration

All settings are environment variables read by `docker-compose.yml`, with safe
defaults (see `.env.example`). Secrets are injected via Infisical:

```bash
infisical run -- pnpm mc:up
```

| Variable              | Default     | Purpose                                    |
| --------------------- | ----------- | ------------------------------------------ |
| `MC_MEMORY`           | `4G`        | JVM heap allocated to the server           |
| `MC_NEOFORGE_VERSION` | `21.1.222`  | NeoForge build (matches the mods' target)  |
| `MC_RCON_PASSWORD`    | `dev-rcon`  | RCON password                              |
| `MC_RCON_PORT`        | `25575`     | Host port mapped to the container's RCON   |
| `MC_ONLINE_MODE`      | `TRUE`      | Online auth (mirrors prod); `FALSE` to skip |

To let the backend's file operations (maintenance mode, whitelist resync) target
this server locally, set `MC_SERVER_LOCAL_PATH=./mc/data` in your root `.env`.
