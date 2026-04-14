# createrington-api

Typed Java records and endpoint constants for the Createrington mod-facing REST API. Bundled into [CRNet](https://gitea.matejhoz.com/Createrington/crnet) via `jarJar` — mods get the types automatically through their existing CRNet dependency.

## For mod developers

### Setup

No extra dependency needed. If your mod already depends on CRNet:

```groovy
implementation 'com.saunhardy:crnet:2.3.1'
```

The API types are included in CRNet's jar. Just import and use them.

### Usage

**Before (manual Gson):**

```java
String json = new Gson().toJson(Map.of("toUuid", uuid, "amount", 100));
client.postAsync("/api/currency/pay", json);
```

**After (typed):**

```java
import com.saunhardy.createrington.api.Endpoints;
import com.saunhardy.createrington.api.currency.PayRequest;
import com.saunhardy.createrington.api.currency.PayResponse;

PayRequest req = new PayRequest(targetUuid, 100.0, null);
client.post(Endpoints.CURRENCY_PAY, gson.toJson(req), PayResponse.class, playerUuid)
      .thenAccept(response -> {
          PayResponse data = response.getData();
          // data.success(), data.newSenderBalance() — IDE autocomplete, compile-time safe
      });
```

### Available classes

**Endpoint constants** — `com.saunhardy.createrington.api.Endpoints`

| Constant | Path |
|----------|------|
| `CURRENCY_LOGIN` | `/api/currency/login` |
| `CURRENCY_BALANCE` | `/api/currency/balance` |
| `CURRENCY_PAY` | `/api/currency/pay` |
| `CURRENCY_DEPOSIT` | `/api/currency/deposit` |
| `CURRENCY_WITHDRAW` | `/api/currency/withdraw` |
| `CURRENCY_TOP` | `/api/currency/top` |
| `CURRENCY_DAILY` | `/api/currency/daily` |
| `CURRENCY_HISTORY` | `/api/currency/history` |
| `CURRENCY_LOTTERY_START` | `/api/currency/lottery/start` |
| `CURRENCY_LOTTERY_JOIN` | `/api/currency/lottery/join` |
| `PRESENCE` | `/api/presence` |
| `PRESENCE_HEARTBEAT` | `/api/presence/heartbeat` |
| `TRAINS_CRASH` | `/api/trains/crash` |

**Currency** — `com.saunhardy.createrington.api.currency.*`

| Record | Fields |
|--------|--------|
| `LoginRequest` | `String uuid`, `String name` |
| `LoginResponse` | `String token` |
| `BalanceResponse` | `double balance` |
| `PayRequest` | `String toUuid`, `double amount`, `@Nullable String fromUuid` |
| `PayResponse` | `boolean success`, `double newSenderBalance` |
| `DepositRequest` | `double amount`, `@Nullable String reason` |
| `DepositResponse` | `boolean success`, `double newBalance` |
| `WithdrawRequest` | `double denomination`, `int count` |
| `WithdrawResponse` | `boolean success`, `double withdrawn`, `double newBalance`, `double denomination`, `int count` |
| `TopEntry` | `String name`, `double balance` |
| `DailyResponse` | `String message` |
| `HistoryResponse` | `List<Transaction> transactions`, `int page`, `boolean hasMore` |
| `Transaction` | `int id`, `String amount`, `String balanceBefore`, `String balanceAfter`, `String transactionType`, `@Nullable String description`, `String createdAt` |
| `LotteryStartRequest` | `double amount` |
| `LotteryStartResponse` | `boolean success`, `String message`, `double entryAmount`, `String endsAt` |
| `LotteryJoinRequest` | `double amount` |
| `LotteryJoinResponse` | `boolean success`, `String message`, `double entryAmount`, `double totalPot`, `int participantCount` |

**Presence** — `com.saunhardy.createrington.api.presence.*`

| Record | Fields |
|--------|--------|
| `PresenceRequest` | `String minecraftUsername`, `String uuid`, `String state`, `@Nullable Long timestamp`, `@Nullable Integer serverId`, `@Nullable Position position`, `@Nullable String dimension` |
| `PresenceResponse` | `boolean success`, `String message`, `PresenceData data` |
| `PresenceData` | `String minecraftUsername`, `String uuid`, `String state`, `int serverId`, `String receivedAt` |
| `HeartbeatRequest` | `List<HeartbeatPlayer> players`, `@Nullable Integer serverId`, `@Nullable Long timestamp` |
| `HeartbeatResponse` | `boolean success`, `String message`, `HeartbeatData data` |
| `HeartbeatData` | `int serverId`, `int playersReported`, `String receivedAt` |
| `HeartbeatPlayer` | `String uuid`, `String username` |
| `Position` | `double x`, `double y`, `double z` |

**Trains** — `com.saunhardy.createrington.api.trains.*`

| Record | Fields |
|--------|--------|
| `CrashRequest` | `String trainId`, `String trainName`, `@Nullable Double speed`, `@Nullable Integer carriageCount`, `@Nullable Position position`, `@Nullable String dimension`, `@Nullable Long timestamp`, `@Nullable String owner`, `@Nullable String driverUuid`, `@Nullable List<CrashPassenger> passengers`, `@Nullable BackwardsDriver backwardsDriver` |
| `CrashResponse` | `boolean success` |
| `CrashPassenger` | `String uuid`, `@Nullable String name`, `boolean isDriver` |
| `BackwardsDriver` | `String uuid`, `@Nullable String name` |
| `Position` | `double x`, `double y`, `double z` |

## For maintainers

### How it works

The Java source files are **auto-generated** from API spec files that live alongside each mod controller in the server codebase:

```
packages/server/src/app/features/mod/
  currency/currency.api-spec.ts    → currency/*.java
  presence/presence.api-spec.ts    → presence/*.java
  trains/trains.api-spec.ts        → trains/*.java
```

The generator script (`packages/server/src/scripts/api/generate-mod-api.ts`) reads these specs and writes Java records to `mod-api/src/` (gitignored — regenerated on every deploy).

### Updating the API

1. Modify the endpoint in the server controller
2. Update the corresponding `.api-spec.ts` file
3. Bump the version in `mod-api/gradle.properties`
4. Merge to `dev` — CI generates the Java files, builds the jar, and publishes `createrington-api` to the Maven repo
5. Merge to `main` — deploys the new API to production. No publish step; the artifact was already published when merging to `dev`.

### Artifacts

| Branch | Artifact ID | Published when |
|--------|-------------|----------------|
| `dev` | `createrington-api` | Spec files changed in the push to `dev` |
| `main` | — | Deploys the already-published version to prod |

Published to `https://github.com/matejhozlar/maven` via CI. A version is only ever published once, from the first branch (always `dev`) that bumps it.

### Version safety for mod releases

Since versions are published from `dev` before the matching server is live on `create-rington.com`, a version existing in Maven does not mean prod serves it yet. A mod bound for production users must pin a version that has **already been deployed to prod** (i.e. merged to `main` and the prod deploy has succeeded). Development mods targeting `dev.create-rington.com` can pin any published version.

### Change detection

CI triggers a publish when **either** of these is true between the previous branch tip and the new one:

- Any `*.api-spec.ts` file changed, or
- The `version=` line in `mod-api/gradle.properties` changed

This compares `${{ github.event.before }}..HEAD`, so it captures **all changes in a merged PR**, not just the last commit. A duplicate version check prevents overwriting an already-published version — if you change specs without bumping the version, CI will fail with a clear error. A pure version bump (no spec change) is a valid trigger, useful when the generator or build config changes and you want to republish under a fresh version.

### Local development

```bash
# Generate the Java files locally
pnpm generate-mod-api

# Build the jar (requires Java 21 + Gradle)
cd mod-api && gradle build
```

## Development & release workflow

This is the full flow for making API changes and shipping them to mods.

### Phase 1: API changes (Createrington app)

1. **Create a feature branch** off `dev` in this repo
2. **Make the server changes** — modify the controller, service, routes, etc.
3. **Update the spec file** — edit the corresponding `*.api-spec.ts` alongside the controller
4. **Bump the version** in `mod-api/gradle.properties` (e.g. `1.0.0` → `1.1.0`)
5. **PR to `dev`** — on merge, CI publishes `createrington-api:1.1.0` and deploys it to `dev.create-rington.com`

### Phase 2: Update CRNet (CRNet repo)

6. **Create a feature branch** off `neoforge-1.21.1` in CRNet
7. **Update the dependency version** in `build.gradle`:
   ```groovy
   api 'com.saunhardy:createrington-api:1.1.0'
   ```
   And the `jarJar` version range:
   ```groovy
   jarJar('com.saunhardy:createrington-api') {
       version {
           strictly '[1.1.0, 2.0.0)'
           prefer '1.1.0'
       }
   }
   ```
8. **Build and test** — `./gradlew build` to verify the new types resolve

### Phase 3: Update the mod (e.g. PresenceAPI)

9. **Create a feature branch** in the mod repo
10. **Use the new types** — replace manual Gson with the typed records, use `Endpoints` constants
11. **Test against the dev server** (`dev.create-rington.com`) to verify everything works end-to-end

### Phase 4: Ship to production

Once satisfied with the dev cycle:

12. **Createrington app** — PR from `dev` to `main`. On merge, CI deploys the server to `create-rington.com`. No new artifact is published — `createrington-api:1.1.0` was already published in Phase 1.
13. **CRNet** — already on `createrington-api:1.1.0` from Phase 2, so nothing to change here unless you want to bump CRNet itself. Publish CRNet if needed.
14. **Mod** — update CRNet version in the mod's `build.gradle` if it changed, build, and publish the mod.

> Only pin prod-bound mod releases to a `createrington-api` version once that version is live on `create-rington.com` (Phase 4 step 12 complete). Before that, the artifact exists in Maven but prod still serves the previous version.

### Quick reference

```
Spec change → dev merge → createrington-api published + dev server deployed
                ↓
          CRNet picks up artifact → mod develops against it on dev.create-rington.com
                ↓
       main merge → prod server deploys (same version, no re-publish)
                ↓
            Mod release → safe to publish once prod is live on this version
```
