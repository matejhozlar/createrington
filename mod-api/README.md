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
4. Merge to `dev` — CI generates the Java files, builds the jar, and publishes `createrington-dev-api` to the Maven repo
5. Merge to `main` — CI publishes `createrington-api` (production artifact)

### Artifacts

| Branch | Artifact ID | Published when |
|--------|-------------|----------------|
| `dev` | `createrington-dev-api` | Spec files changed in the push |
| `main` | `createrington-api` | Spec files changed in the push |

Both publish to `https://github.com/matejhozlar/maven` via CI.

### Local development

```bash
# Generate the Java files locally
pnpm generate-mod-api

# Build the jar (requires Java 21 + Gradle)
cd mod-api && gradle build
```
