## v1.42.0 (2026-08-25)

### @createrington/server (1.42.0 → 1.43.0)
- [add] Add automated release changelog posting to Discord as Components V2 messages, each saved as a linked embed preset so admins can edit and re-push from the builder
- [add] Add `modpack_release_announcement` table tracking each message part of a changelog post, with preset linkage, channel/message IDs, and retry-safe idempotent delivery
- [add] Add `ModpackChangelogComponentPresets.release` renderer that diffs two releases into grouped entries (added/updated/removed) with thumbnails, version labels, and download buttons, splitting long diffs across multiple messages within Discord's component and text ceilings
- [add] Add `modpack_changelog` feature flag gating changelog announcements independently of the workshop flag
- [add] Expose announcement status (parts sent, linked preset names) on `listReleases` so the admin UI can show post progress per release
- [refactor] Extract `measureComponentsV2` from `validateComponentsV2` so preset renderers can probe message size before committing to a split
- [remove] Remove manual changelog tRPC endpoints (`sendChangelog`, `searchMods`, `getModFiles`) and the legacy `modpackUpdate` embed preset, replaced by the automated flow
- [chore] Add unit tests for the changelog component preset and integration tests for the end-to-end announce/resume/edit/feature-flag flows
- [chore] Update Discord entity config with new channel and category entries (railsNSails changelog, mod suggestions 2/3/4, verification, uncategorized)

### @createrington/client (0.2.55 → 0.2.56)
- [add] Add announcement badge on the releases tab showing whether a changelog has been posted, with part progress for multi-message posts
- [add] Add `modpack_changelog` feature flag toggle to the workshop admin page alongside the existing workshop toggle
- [remove] Remove the manual modpack changelog form and its components (ModpackChangelog, ModSection, HighlightSection), replaced by automated server-side posting
- [refactor] Simplify the announcements page to maintenance-only now that changelogs are automated

### @createrington/shared (1.8.0 → 1.9.0)
- [add] Export `httpUrlSchema` from the embed API module for server-side URL validation in changelog rendering

## v1.41.0 (2026-08-25)

### @createrington/server (1.41.0 → 1.42.0)
- [add] Add `setFile` sandbox endpoint and `setModFile` service method letting the sandbox choose which CurseForge file a `next_update` mod ships in the next pack export, with ownership validation, dependency re-resolution, and optimistic concurrency guards
- [add] Add `file_chosen` boolean column to `workshop_mod` that marks an explicit file pick; unchosen mods fall back to the newest matching file at build time
- [add] Clear `fileChosen` automatically whenever a mod moves out of `next_update` (via review, rejection, or modpack reconcile)
- [add] Add `logModFile` audit entry for file choice and reset actions
- [chore] Bump `@createrington/api-types` to 0.9.0
- [chore] Add integration tests for file choice, reset, ownership rejection, status guards, and choice clearing on review

## v1.40.0 (2026-08-23)

### @createrington/server (1.40.0 → 1.41.0)
- [add] Add `modpack_publish` table and `recordPublish` sandbox endpoint for the sandbox server to report published releases (client file + server pack pair), validated against CurseForge and reconciled immediately
- [add] Add `sandboxServiceProcedure` auth level gated on a shared `SANDBOX_SERVICE_TOKEN`, letting the sandbox server call without a user JWT
- [add] Guard modpack reconcile against client-only reads when the pack ships a server pack, refusing the read instead of dropping every server-side member
- [add] Re-freeze releases recorded from the client file alone once the server pack is read alongside, upgrading the membership snapshot without creating a duplicate release
- [add] Resolve the newest modpack release from both the CurseForge listing and sandbox publish reports, preferring whichever is newer and already served
- [add] Expose `shipsServerPack` flag on modpacks and `serverPackFileId` on releases to the sandbox workshops listing
- [refactor] Extract release-row building into a reusable `buildReleaseRows` helper and add a `force` option to `getModpackManifest` that bypasses the cache and waits out stale in-flight reads
- [chore] Add integration and unit tests for publish reporting, client-only read guard, release upgrade, and release resolution

### @createrington/client (0.2.54 → 0.2.55)
- [add] Add "Ships a server pack" toggle to the modpack settings dialog, letting admins see and override the auto-detected flag

## v1.39.0 (2026-08-22)

### @createrington/server (1.39.0 → 1.40.0)
- [add] Close workshop suggestion threads after a mod leaves review (approved, testing, next_update, in_pack, or rejected), with audit reasons on each archive action
- [add] Re-close suggestion threads that replies reopened after review during the workshop thread healing pass
- [add] Reconcile modpack membership from both the client pack file and server pack, downloading and merging both manifests to track which side(s) each mod ships on
- [add] Promote CurseForge environment hints to `manifest` source when the published server pack confirms the side(s) a mod ships to
- [fix] Keep unflagged pack members as `unspecified` instead of deriving a side, so they continue surfacing for admin review
- [fix] Prevent CurseForge ingest from overwriting manifest-confirmed environment values with lower-trust author hints
- [refactor] Extract zip download and manifest parsing into a reusable `downloadPackManifest` helper shared by the client file and server pack fetch paths

### @createrington/client (0.2.53 → 0.2.54)
- [fix] Display the correct environment source label for manifest-confirmed mods ("From CurseForge, confirmed by the published pack") instead of grouping them with author-assigned flags

### @createrington/shared (1.7.0 → 1.8.0)
- [add] Add `manifest` to the `MOD_ENVIRONMENT_SOURCES` enum, representing a CurseForge environment hint confirmed by the published pack's manifests

## v1.38.0 (2026-08-22)

### @createrington/server (1.38.1 → 1.39.0)
- [add] Add `required` flag to modpack members and release mods, mirroring the CurseForge manifest entry that marks whether a mod ships enabled or disabled in the pack
- [add] Detect disabled mods during manifest parsing by collecting projects whose every entry carries `required: false`, and propagate the flag through reconcile, seed, and release-diff flows
- [add] Add `setRequired` sandbox endpoint letting the sandbox toggle whether a next_update mod will ship enabled or disabled in the next pack export, with status guard, optimistic locking, and audit logging
- [fix] Treat a required-flag-only change (same file, different enabled state) as a release diff entry so flag flips appear in the release changelog

### @createrington/client (0.2.52 → 0.2.53)
- [add] Show a "Disabled" badge on pack members, release mods, and workshop mod cells whose manifest `required` flag is false
- [add] Display flag-only changes in the releases tab as "Enabled"/"Disabled" transitions instead of repeating the unchanged file name

### @createrington/shared (1.6.1 → 1.7.0)
- [add] Add `required` field (defaults to true) to the modpack manifest upload schema so seed imports and sandbox exports carry the per-entry enabled/disabled flag

## v1.37.1 (2026-08-21)

### @createrington/server (1.38.0 → 1.38.1)
- [fix] Surface non-mod manifest entries (shaders, resource packs, data packs) by their CurseForge class ID, exposing `classId` through modpack and workshop project summaries, release mod queries, and sandbox consumer endpoints instead of silently treating every manifest entry as a regular mod
- [fix] Auto-classify shaders and resource packs as client-side during CurseForge ingest based on their class, overriding any conflicting file-level environment tags so environment detection no longer relies solely on per-file metadata

### @createrington/client (0.2.51 → 0.2.52)
- [fix] Badge non-mod dependencies and pack members with their CurseForge class label (Shader, Resource pack, Data pack) in the workshop admin detail tabs, and include class labels in the search filter so non-mod entries are discoverable by type

### @createrington/shared (1.6.0 → 1.6.1)
- [add] Add `CURSEFORGE_CLASSES` constant, `CURSEFORGE_CLASS_LABELS` map, and `curseforgeClassLabel()` helper so server ingest and client UI share a single definition of CurseForge project class IDs and their display names

## v1.37.0 (2026-08-21)

### @createrington/server (1.37.0 → 1.38.0)
- [add] Expose the workshop testing queue and review actions to the sandbox consumer, with mods and modpacks sub-routers that list approved/testing/next_update mods and current pack members, perform reviews restricted to the testing stages, and flag project environments, all with source-tagged audit logging
- [add] Block moving a mod into testing when a required dependency has been ruled out for the workshop, with a re-resolution fallback when the local dependency cache is empty
- [refactor] Extract workshop audit logging into a dedicated module shared by the admin tRPC router and the new sandbox consumer, removing inline log calls from both surfaces
- [refactor] Collapse waitlist `getStats` from nine separate count queries into a single aggregate SQL query with windowed signup counts, removing ~50 lines of repository-level orchestration
- [refactor] Split dependency resolution into a throwing variant and a fire-and-forget wrapper, so callers that need to gate on resolution results can catch failures while background callers stay silent
- [fix] Restore dependency edges when a mod is un-rejected, since the daily sweep skips closed workshops and would never bring them back on its own
- [fix] Expand dependency gap detection to surface rejected dependencies of mods still in approved or testing status, not just those already shipping in the pack

### @createrington/client (0.2.50 → 0.2.51)
- [add] Disable the "Start Testing" action button when a mod has a ruled-out required dependency, showing "Dependencies ruled out" instead
- [fix] Invalidate the mod list on a failed review mutation so stale rows that the server refused are brought up to date
- [fix] Update the issues tab to display all mods that require a gapped dependency instead of only one, joining their names with commas

### @createrington/shared (1.5.1 → 1.6.0)
- [add] Add `DependencyCoverage` type and `hasRuledOutRequiredDependency` helper so both server gate and client grid share a single definition of "blocked from testing"

## v1.36.0 (2026-08-20)

### @createrington/server (1.36.2 → 1.37.0)
- [refactor] Rework the apply flow into a Discord-first waitlist with queue-based statuses (queued, promoted, registered, expired), replacing the old email-driven pipeline (pending, accepted, completed, declined) and removing email collection, invite codes, and boolean milestone flags from the waitlist schema
- [add] Add WaitlistService (~770 LOC) orchestrating queue joins, auto-promotion into free slots, 7-day registration expiry, and serialized maintenance passes that prevent race conditions during concurrent slot claims
- [add] Add `app_setting` table and SettingsService for runtime configuration of player limit and intake mode (auto or closed), with cached reads, immediate cache invalidation on writes, and environment-variable fallbacks
- [add] Add admin settings tRPC endpoints for reading and updating player limit and intake mode, with audit logging and an automatic promotion pass when capacity changes
- [add] Add verification channels for in-Discord registration, with progress cards rendered as Components V2 containers showing step completion and a close button for cleanup
- [add] Add waitlist Discord component presets (waiting card, promotion card, queue confirmation) using the Components V2 API with containers, separators, and text displays
- [add] Expose workshops to the sandbox consumer router with list and get endpoints that resolve each workshop's modpack and latest release, batching lookups to avoid N+1 queries
- [fix] Fix registration close card rendering by migrating from legacy embed fields to Components V2, clearing the old content/embeds fields so Discord does not show a blank card
- [fix] Fix waitlist signup stats to count first-time signups by `created_at` instead of re-queues by `queued_at`, so a member who expired and rejoined is not double-counted
- [fix] Guard verification-channel buttons against clicks from other members by checking the channel's assigned Discord ID before processing
- [fix] Expire departed members quietly during auto-promotion instead of logging a noisy error, and handle failed progress embed edits gracefully
- [refactor] Replace WaitlistRepository flow orchestration (~280 LOC) with thin persistence methods, delegating all queue logic to WaitlistService
- [refactor] Rework waitlist cleanup service from a 24-hour orphan sweep into an hourly maintenance cycle that expires stale promotions and auto-promotes queued members
- [chore] Sync the `claude_readonly` grants from the deploy workflows after every migration via a new transactional shell script, covering both dev and prod environments
- [chore] Bump @createrington/api-types from 0.2.0 to 0.3.0 for the sandbox workshops contract

### @createrington/client (0.2.49 → 0.2.50)
- [refactor] Rewrite the Apply to Join page from a multi-field web form (email, Discord username, referral, terms) into a Discord-first flow that shows step-by-step instructions for joining the guild and using in-Discord commands, with distinct copy for open mode vs waitlist mode
- [add] Add IntakeSettingsCard to the admin waitlists page for controlling player limit and intake mode (auto/closed), showing current capacity, reserved slots, and real-time open/waitlist status
- [refactor] Rework the admin waitlists table to match the new queue statuses (queued, promoted, registered, expired), removing email/verified columns, replacing the Invite modal with a Promote modal, and updating search to filter by Discord username or ID
- [refactor] Update admin dashboard stats cards to use new waitlist terminology (Queue, Promoted, Registered, In-Game) and merge the old accepted/auto_accepted counts into a single Promoted metric
- [refactor] Update the privacy policy to reflect Discord-only data collection, removing email references and documenting that only Discord ID, username, and queue timestamps are stored

### @createrington/shared (1.5.0 → 1.5.1)
- [remove] Remove the waitlist form schemas (waitlistCreateInputSchema, buildWaitlistFormSchema, email/Discord validation) now that intake is handled entirely through Discord interactions

## v1.35.4 (2026-08-19)

### @createrington/server (1.36.1 → 1.36.2)
- [remove] Remove the Nomads server integration, including the RCON whitelist sync service, env config, Discord role/channel/category entries, and the server-selection menu entry
- [refactor] Remove the post-deletion hook registry from PlayerDeletionService now that its only consumer (Nomads whitelist removal) is gone
- [fix] Fix typos in the server-selection error reply ("wrog" and "yur" corrected to "wrong" and "your")

## v1.35.3 (2026-08-17)

### @createrington/client (0.2.48 → 0.2.49)
- [add] Add Sensitive component that redacts on-screen IPs and emails behind a reveal-on-click overlay with deterministic decoy text, stable layout width, and a hover icon affordance
- [add] Add loading prop to Button that shows a centered spinner and disables interaction while a mutation is pending, replacing scattered inline pending-state wiring across admin pages
- [add] Add ConfirmDialog component that wraps AlertDialog with built-in pending state, auto-close on success, and locked dismissal during async operations
- [add] Add Spinner UI primitive wrapping Lucide Loader2 with consistent spin animation and accessibility attributes
- [add] Add AdminPageTitle component for responsive admin page headers that wrap action buttons below the heading on narrow viewports instead of squeezing them
- [refactor] Sweep all admin confirmation dialogs onto the shared ConfirmDialog, removing duplicated pending-state management and manual close logic across ~30 admin pages
- [refactor] Sweep admin mutation buttons onto Button's new loading prop, eliminating per-button spinner and disabled-state wiring
- [chore] Remove unused SCSS/CSS module type declarations
- [chore] Add xs (440px) Tailwind breakpoint for narrow-screen admin layouts

### @createrington/server (1.36.0 → 1.36.1)
- [chore] Bump createrington-skin-api from 2.8.0 to 2.9.0, updating the widest-pose headroom measurement for the new mojavatar pose
- [chore] Remove unused utility scripts (env-find, import-playtime-from-stats) and dead barrel-export index files

## v1.35.2 (2026-08-16)

### @createrington/server (1.35.0 → 1.36.0)
- [add] Add CurseForge website URL to workshop attention items so the Issues tab can link each mod directly to its CurseForge page
- [refactor] Extract shared attention-item fields into an `AttentionSubject` interface and a local `attentionSubject()` helper, removing repeated property assignments across all item types

### @createrington/client (0.2.47 → 0.2.48)
- [add] Link mod names in the workshop Issues tab to their CurseForge page, showing an external-link icon and opening in a new tab when a URL is available

## v1.35.1 (2026-08-16)

### @createrington/client (0.2.46 → 0.2.47)
- [fix] Fix workshop tab strip scrolling the entire page when switching tabs by replacing `scrollIntoView` with a manual `scrollLeft` adjustment scoped to the strip container
- [refactor] Extract wheel-scroll interception into a reusable `useStripRef` hook that properly clears refs on detach and measures the scrollport for precise tab reveal

## v1.35.0 (2026-08-16)

### @createrington/server (1.34.0 → 1.35.0)
- [add] Add client/server environment classification for CurseForge projects, with `environment` and `environment_source` columns on `curseforge_project` storing whether a mod runs client-side, server-side, or both
- [add] Derive environment hints from CurseForge file gameVersions tags during project ingest and refresh, storing them as low-trust `cf_flag` values that follow author changes but never overwrite manual admin flags
- [add] Add `setProjectEnvironment` admin tRPC mutation for manually flagging which side a mod runs on, with audit logging
- [add] Gate testing-to-next_update approval on a classified environment, requiring admins to flag client/server before a mod can ship
- [add] Surface `environment_unspecified` and `duplicate_manifest_entry` attention items in modpack attention checks so admins see unclassified mods and repeated manifest entries
- [fix] Deduplicate repeated CurseForge project entries during manifest seed instead of failing the import, reporting the duplicates in the seed result
- [remove] Remove `missing_dependency` attention item type, skipping unresolved dependency gaps that have no workshop suggestion

### @createrington/client (0.2.45 → 0.2.46)
- [add] Add inline environment badge with dropdown editor across testing, next-update, in-pack, and all-mods tabs, showing client/server/both status with instant optimistic switching
- [add] Show environment_unspecified and duplicate_manifest_entry issues in the Issues tab with direct links to the affected mod or CurseForge project
- [add] Keep resolved environment issues visible as "fixed" until the admin leaves the tab, so recently classified mods stay in view during a review session

### @createrington/shared (1.4.0 → 1.5.0)
- [add] Add `MOD_ENVIRONMENTS`, `MOD_ENVIRONMENT_SOURCES`, and `MOD_ENVIRONMENT_LABELS` constants and types for the client/server environment classification system
- [fix] Allow duplicate project entries in `modpackManifestUploadSchema` since CurseForge exports repeat a project when it ships more than one file, deferring deduplication to the import layer

## v1.34.0 (2026-08-16)

### @createrington/server (1.33.0 → 1.34.0)
- [add] Add admin endpoint to delete player prompts, removing the prompt, all its responses, and its Discord announcement message in one operation with full audit logging
- [add] Render all skins at the skin-api maximum resolution (1366x2048) across the /skin command, render routes, welcome card, and OG card scripts, replacing the previous lower-resolution per-caller dimensions
- [refactor] Consolidate OG card figure caches into a single shared `assets/figures/` directory keyed by username and pose, replacing the per-card directories (team/, packs/, workshop/)
- [refactor] Draw welcome card poses from the SDK's `randomPose()` catalogue instead of a hardcoded subset
- [fix] Set `imageSmoothingQuality = "high"` on the welcome card and OG card supersample downscale, fixing aliased figure edges that the default "low" filter left jagged
- [fix] Request mc-heads body renders at their 600px ceiling instead of the unsized 180px default, so fallback images are no longer blurry when upscaled
- [refactor] Optimize `computeBBox` by hoisting width/height reads and walking the alpha channel with a running index (156ms to 5ms on a typical figure)
- [chore] Bump createrington-skin-api from 2.7.0 to 2.8.0

### @createrington/client (0.2.44 → 0.2.45)
- [add] Add delete prompt modal with confirmation dialog accessible from both the prompts list (row action) and prompt detail page, showing entry count and active-status warning
- [fix] Request mc-heads body renders at the 600px maximum instead of the unsized default, matching the server-side fix for blurry fallback skins
- [fix] Remove `[image-rendering:pixelated]` from skin render pages (profile, compare, top) since the higher-resolution source no longer needs nearest-neighbor upscaling

## v1.33.0 (2026-08-16)

### @createrington/server (1.32.0 → 1.33.0)
- [add] Add single and multi entry modes to player prompts, letting admins choose between one editable answer per player or multiple stacked entries with optional per-player caps and cooldowns enforced atomically in the database
- [add] Extract Discord prompt card rendering into a `PlayerPromptComponentPresets` class using Components V2 containers with banner imagery, entry-rule descriptions, and mode-aware button labels
- [add] Allow editing a workshop slug after creation with unique-slug validation, conflict error handling, and the admin settings dialog wired to navigate to the new URL on rename
- [fix] Refuse all review actions on mods that are live in the published pack (status `in_pack`), requiring a release drop first instead of allowing reject, which previously left the pack contradicting its manifest
- [fix] Ship workshop suggestions from any active status on reconcile (pending, approved, testing, next_update) instead of only from next_update, so suggestions that were approved but not yet queued still get claimed when the manifest ships them
- [fix] Enforce prompt cooldown atomically in the append-entry SQL statement so a modal left open past the cooldown window cannot bypass the gate the button check saw

### @createrington/client (0.2.43 → 0.2.44)
- [add] Add loading skeleton support to the DataTable component with per-column custom skeleton renderers, shared skeleton cells (badge, two-line, avatar), and a `loadingRowCount` helper that sizes skeleton rows to match the expected remaining page count
- [add] Roll out table loading skeletons and shared Paginator across all admin tables: players, logs, donations, waitlists, FAQs, inactivity (ghosts and unlinked members), prompts, structure packs, workshops, modpacks, chat history, stat search, parties, trade history, and player-detail sessions/transactions tabs
- [add] Add entry mode picker (single/multi) with max-entries and cooldown fields to the create-prompt modal, and show mode badge and per-responder entry counts on the prompt list and detail pages
- [add] Add slug editing field to the workshop settings dialog with client-side validation and automatic URL navigation on successful rename
- [fix] Hide review action buttons entirely for in-pack mods instead of showing them disabled, driven by the shared `WORKSHOP_MOD_REVIEW_TARGETS` map so the UI stays in sync with the server's refusal rules

### @createrington/shared (1.3.0 → 1.4.0)
- [add] Add player prompt entry mode constants and bounds (entry modes, min/max entries, max cooldown) shared between the server validator, the database enum, and the admin UI
- [fix] Remove the reject action from the `in_pack` review targets so mods live in the published pack have no review transitions available

## v1.32.0 (2026-08-15)

### @createrington/server (1.31.0 → 1.32.0)
- [add] Add workshop suggestion bans with `workshop_ban` table, per-workshop or global scope, temporary/permanent types, and CHECK constraints enforcing field consistency; ban service with issue, lift, and active-ban lookup; admin tRPC endpoints for managing bans per user; user-facing `mySuggestBan` query for pre-flight checks
- [add] Enforce suggestion bans in the Discord `/suggest` command, rejecting banned users with a human-readable notice and filtering banned workshops out of the multi-workshop picker
- [add] Add admin endpoints for deleting archived workshops (with all suggestions, votes, polls, and history) and unused modpacks (with members and releases), guarded by foreign-key and status checks
- [add] Add structure packs and workshop OG card render scripts using `@napi-rs/canvas` to generate 1200x630 social sharing cards with player figures and portal imagery; shared render plumbing extracted into `og-shared.ts`
- [add] Generate per-route og-html variants at build time: `build-dist.js` reads card images under `assets/og/`, validates dimensions, and emits route-specific `index.html` copies with swapped `og:*` and `twitter:*` meta tags
- [refactor] Extract shared OG card render plumbing into `og-shared.ts` for reuse across card scripts
- [chore] Remove Starlight Skin API references from the README, replaced with the in-house Createrington skin API

### @createrington/client (0.2.42 → 0.2.43)
- [add] Add confirmation modals to workshop admin review actions: stage transitions (approve, start testing, send back, rule out) now require explicit confirmation with context-specific copy explaining each action's effect, including a "confirm mod name" checkbox for destructive actions
- [add] Add modpack management card to the workshop admin panel listing all modpacks with mod counts, attached workshops, and publish state; supports creating, editing settings, and deleting unused modpacks with confirmation dialogs
- [add] Add workshop bans section to the player detail admin tab displaying active and historical suggestion bans with issue/lift modals scoped per-workshop or globally
- [add] Add archived workshop deletion button on the workshop list (restricted to archived status) with a confirmation dialog warning about permanent data loss
- [add] Surface active suggestion bans on the workshop suggest page, showing scope, duration, and reason instead of the mod search form
- [add] Add OG card images for the structure packs and workshop pages
- [refactor] Split workshop admin tabs into two levels with top-level groups (Mods, Dependencies, Issues, Releases) and mod stages as a second row; stage counts shown as pills; restored mouse-wheel horizontal scrolling with proper line-height delta handling
- [fix] Drop workshop name from suggestion history rows to prevent text overflow on narrow viewports
- [fix] Show only the version number in pack publish state labels for cleaner presentation
- [fix] Improve stage pill label and count badge contrast for better readability

## v1.31.0 (2026-08-15)

### @createrington/server (1.30.3 → 1.31.0)
- [add] Add the modpack workshop system: community members suggest CurseForge mods, upvote favorites within a per-user budget, and admins curate through a staged review pipeline (pending, approved, testing, next update, in pack, rejected) with per-workshop Discord forum threads, dependency auto-detection, and rejection reason tags
- [add] Add modpack release tracking: each published CurseForge modpack file is recorded with a frozen member snapshot, enabling release-to-release diffs that show exactly which mods were added, updated, or removed
- [add] Add modpack manifest seeding: admins can upload a CurseForge manifest.json to bulk-import unpublished pack members, with shared Zod validation and re-seed confirmation
- [add] Add feature flag service with runtime toggles backed by a database table and a 10-second in-process cache, used to gate the workshop feature behind a kill switch
- [add] Add `/suggest` Discord slash command: players suggest mods to open workshops via a modal with CurseForge link validation, pitch text, and multi-workshop picker when several are open
- [add] Send a personalized welcome card after registration completes, randomly selecting from seven WebP background images and rendering the player's skin via @napi-rs/canvas
- [add] Add admin tRPC routers for feature flags, modpacks, and workshops with 34 new endpoints covering workshop lifecycle, mod review, dependency reports, release history, manifest seeding, and CurseForge project search
- [add] Add user tRPC router for workshops with feature-gated endpoints for browsing, suggesting, upvoting, and viewing pack contents
- [add] Add workshop project refresh service: a 24-hour sweep that refreshes CurseForge snapshots, re-resolves dependencies, heals Discord threads, reconciles pack state, and auto-promotes required dependencies
- [add] Add CurseForge project ingest module for batch upserting project snapshots with INT4 overflow protection on download counts
- [add] Add mod-url parser for extracting and validating CurseForge mod page URLs from user input
- [add] Add database error translation utility that surfaces unique-violation pg errors as typed ConstraintViolationError with the original error code
- [add] Add JSONB column serialization utility that auto-detects schema JSONB columns and JSON.stringifies array values on write, preventing the pg driver from misinterpreting arrays
- [add] Add workshop mod timeline events: an append-only audit log recording every status transition, upvote, and reconcile action per mod
- [add] Add integration tests for the workshop service, modpack service, workshop dependency resolution, base query serialization, database error translation, and CurseForge mod-url parsing
- [fix] Accept null author avatar URLs in CurseForge API responses instead of failing validation
- [fix] Move welcome card generation from guild-member-add to post-registration so the card reflects the player's actual skin and member number
- [refactor] Replace the post-build path-rewriting script with tsc-alias `resolveFullPaths`, removing ~120 lines of custom build tooling
- [refactor] Run dev type watchers via concurrently so tsc-alias works correctly on Windows
- [chore] Switch canvas runtime from node-canvas to @napi-rs/canvas (Rust-based, no native build step)
- [chore] Bump puppeteer-core from v24 to v25 to drop the vulnerable extract-zip transitive dependency
- [chore] Add sanitize-html for processing user-generated workshop content
- [chore] Restructure server README to focus on practical commands and architecture notes

### @createrington/client (0.2.41 → 0.2.42)
- [add] Add the workshop hub, detail, suggest, and pack pages: players browse open workshops, view a leaderboard of suggested mods with animated vote reordering, suggest mods via CurseForge search, and explore the full modpack contents
- [add] Add admin workshop management pages with a tabbed detail view covering all mods, in-pack members, issues, dependencies, releases, and staging, plus create and settings dialogs
- [add] Add a generic DataTable component that owns fixed column layout, row actions, sortable headers, expandable rows, row click navigation, and keyboard accessibility, replacing manual table composition across all admin pages
- [add] Add CellText and CellDate primitives for consistent table cell rendering with automatic truncation, hover tooltips, and copy-to-clipboard
- [add] Add CardState components (loading, error, empty) and a FilterBar component with keyboard shortcut for consistent admin page patterns
- [add] Add workshop URL-synced filters, debounced search, view mode persistence (list/grid), and lazy pagination hooks
- [add] Add mod detail dialog with full CurseForge project info, author, categories, social links, and deep-linked URL history entries
- [add] Add animated leaderboard reordering on upvote using @formkit/auto-animate with cubic-bezier transitions
- [refactor] Rebuild all admin tables (dashboard, logs, players, servers, structure packs, crypto, waitlists, owner pages, chat history, FAQ, inactivity, parties, prompts, stat search) onto the shared DataTable component
- [refactor] Rename "Packs" to "Dimensions" in user-facing sidebar navigation and page copy
- [refactor] Pin the admin page header while pages scroll and collapse it to a back link on small screens
- [fix] Keep carousel navigation buttons above slides on iOS by adding z-10
- [fix] Keep the mobile sidebar sheet in its expanded presentation instead of collapsing
- [fix] Prevent tooltips from blocking pointer events on underlying elements
- [fix] Pluralize paginator labels ending in consonant-y correctly
- [chore] Migrate from react-router-dom v7 to react-router v8 and remove the audit ignore for the RSC-mode CSRF advisory
- [chore] Bump React from 19.2.4 to 19.2.7 and add @formkit/auto-animate for vote animations
- [remove] Remove the useCopyToClipboard hook, replaced by built-in copy in CellText

### @createrington/shared (1.2.1 → 1.3.0)
- [add] Add workshop domain types, status enums, review action labels, reject reason labels, status transition table, and the modpack manifest upload Zod schema
- [chore] Restructure shared README to document all exported modules (api, auth, socket, db, workshop)
- [chore] Add nanoid and js-yaml security overrides in workspace config

## v1.30.3 (2026-08-04)

### @createrington/server (1.30.2 → 1.30.3)
- [remove] Remove unused trpc-ui dev panel: the `/panel` route and `trpc-ui` dev dependency are deleted, as the interactive tRPC testing UI was no longer in use
- [chore] Bump createrington-skin-api from ^2.1.0 to ^2.7.0
- [chore] Bump audit overrides for undici, brace-expansion, postcss, ip-address, and tar to clear pnpm audit advisories; add auditConfig ignore for the react-router RSC-mode CSRF advisory (unused in this project, fix requires react-router 8 + React 19)

### @createrington/client (0.2.40 → 0.2.41)
- [chore] Bump createrington-skin-api from ^2.1.0 to ^2.7.0

## v1.30.2 (2026-07-19)

### @createrington/server (1.30.1 → 1.30.2)
- [security] Strip sensitive fields from public player endpoints: Discord ID and logout coordinates are no longer exposed through public tRPC queries, and position, health, and IP address are removed from server status player info as a defensive guard (these fields were never populated by the backend but are now explicitly excluded to prevent future leakage)
- [security] Deliver crypto order fills and price alerts via per-user websocket rooms instead of broadcasting to the shared market room, preventing players from observing other players' order events
- [security] Bind OAuth state parameter to the initiating browser via an httpOnly cookie, preventing cross-browser CSRF replay on the OAuth callback
- [security] Restrict ticket delete and reopen Discord buttons to staff-only, preventing non-staff ticket creators from deleting or reopening tickets
- [security] Restrict registration close button to channels in the verification category, preventing misuse in unrelated channels
- [security] Add global rate limit (60/min per IP) to public player lookup endpoints and a global invite cap to waitlist open-mode signups
- [fix] Close crypto trade cooldown race by arming the cooldown on request entry instead of after the transaction commits, with automatic rollback on failure so a failed trade does not lock the player out
- [fix] Return uniform "not found" from order cancel when the order belongs to a different player, preventing order-existence enumeration
- [fix] Run account deletion ticket cascade inside the deletion transaction so ticket cleanup is atomic; rely on FK cascade for ticket actions instead of manual per-row deletion
- [fix] Treat composite unique columns as grouped identifiers in the Q system: partial composite keys are now rejected with an explicit error instead of silently matching multiple rows
- [chore] Drop duplicate database indexes on player, player_balance, player_session, ticket, reward_claim, crypto_holding, and waitlist_entry tables; add a filtered index on crypto_transaction.order_id
- [chore] Add unit tests for extractIdentifier with composite identifier groups
- [chore] Migrate to pnpm 11 and Node.js 22 in CI

### @createrington/client (0.2.39 → 0.2.40)
- [refactor] Fix react-hooks v7.1 lint errors across providers and components: replace async useCallback/useEffect patterns with promise chains, eliminate stale closure refs with proper state, and use useSyncExternalStore for carousel scroll state

### @createrington/shared (1.2.0 → 1.2.1)
- [add] Add per-user websocket room type and typed CryptoPriceAlertPayload for private crypto event delivery

## v1.30.1 (2026-06-30)

### @createrington/server (1.30.0 → 1.30.1)
- [fix] Fix crypto order lifecycle races by locking order rows with `SELECT FOR UPDATE` during fill, cancel, and expire operations, preventing concurrent mutations from double-spending reserved balances or tokens
- [fix] Fix sell-side double-spend on triggered orders by checking holding amount under the transaction lock before executing, rejecting fills when holdings are insufficient
- [fix] Fix crypto order placement reserving balance before validating supply and price constraints, causing leaked balance deductions on rejected orders; validation now runs first and the reservation is wrapped in the order-creation transaction
- [fix] Fix market sell allowing tokens reserved by pending sell orders to be sold again by subtracting reserved amounts from the available-to-sell total
- [fix] Fix `BalanceUtils.formatWithCommas` using `maximumSignificantDigits` instead of `minimumFractionDigits`, which produced inconsistent decimal precision in formatted currency values
- [fix] Fix balance history ordering by `created_at` (non-unique) instead of the serial `id` column, causing indeterminate row order for transactions written in the same tick
- [fix] Fix admin `bulkAdjust` bypassing the `adminGrant`/`adminDeduct` balance repository methods with inline raw transaction logic, so bulk operations now follow the same code path as single adjustments
- [fix] Fix admin `bulkAdjust` reporting "Unknown" as the player username on failure rows by resolving the username before the try/catch that performs the balance mutation
- [fix] Fix admin `bulkAdjust` accepting zero as a valid amount by adding an explicit zero-amount guard in the tRPC route
- [fix] Fix trade cooldown arming on failed trades by splitting `checkRateLimit` into a read-only check and a separate `recordTradeCooldown` called only after the transaction commits
- [refactor] Extract `updateTreasury`, `getLifetimeTradeCount`, and `getReservedTokens` from the order manager and trade executor into dedicated modules (`treasury.ts`, `lifetime-trades.ts`, `reservations.ts`), deduplicating the two copies of each function
- [refactor] Extract `pickWeightedWinner` from `LotteryService` into a pure standalone module for testability
- [refactor] Break `db/utils` circular import by moving `isAdminDb` to a dedicated `db/utils/admin.ts` file with its own import of `Q`
- [chore] Add money-critical test coverage: integration tests for the balance repository (`adminGrant`, `adminDeduct`, `transfer`, concurrent `FOR UPDATE` locking) and player balance queries (`bulkAdjust` deltas, zero-amount rejection, failure-row usernames), plus unit tests for `BalanceUtils.formatWithCommas` precision and `pickWeightedWinner` distribution
- [chore] Add CI integration test job definition (currently commented out) with a Postgres service container for running DB-backed tests
- [chore] Clear pnpm audit advisories via dependency overrides (`undici` ^6.27.0, `dompurify` ^3.4.11) and direct bumps (`multer` ^2.2.0)

### @createrington/client (0.2.38 → 0.2.39)
- [fix] Fix admin chat widget overlapping page content on mobile by making the chat panel full-screen on small viewports and hiding the toggle button while the drawer is open
- [fix] Fix admin chat expand/collapse button showing on mobile where the panel is already full-screen by hiding it below the `sm` breakpoint
- [fix] Fix inactivity management page header overflowing on mobile by stacking the title and action buttons vertically on small screens
- [fix] Fix iOS Safari auto-zooming on form input focus by enforcing a 16px minimum font size on inputs, textareas, and selects for touch devices

## v1.30.0 (2026-06-05)

### @createrington/server (1.29.0 → 1.30.0)
- [add] Add in-code Components V2 builder and preset system for constructing Discord's new component-based messages: a typed builder converts a data-first `ComponentsData` tree into discord.js builders, with validation enforcing Discord's 40-component and 4000-character aggregate limits; reusable presets cover common patterns (success, error, info, loading, plain) and domain-specific layouts (maintenance announcements, feature spotlights), all stripeless by default with opt-in accent colors
- [add] Render leaderboards as Components V2 messages with per-player head thumbnails, title banner images, subtitle lines (session count, last seen, balance/crypto split), and an inline refresh button, replacing the previous flat-text embed format
- [add] Rework net worth leaderboard to combine in-game balance with crypto holding value per player, replacing the crypto-only ranking; new `getAllBalances` balance query and `rankNetWorth` function merge both sources and display the breakdown in a subtitle
- [add] Add `discord_embed_preset_kind` enum and `kind` column to `discord_embed_preset`, allowing presets to store either classic embeds or Components V2 layouts
- [refactor] Refactor embed admin tRPC routes (send, edit, presets, linked messages) to accept a discriminated `messagePayloadSchema` union that handles both classic embeds and Components V2 transparently, replacing the embed-only input shapes
- [refactor] Widen message service `components` and `flags` types to accept top-level Components V2 builders alongside classic action rows, and forward the `IS_COMPONENTS_V2` flag on edit so Discord interprets the payload correctly
- [remove] Remove legacy `LeaderboardEmbedPresets` classic embed preset, replaced by the Components V2 leaderboard renderer

### @createrington/client (0.2.37 → 0.2.38)
- [add] Add Components V2 mode to the embed builder with a toggle between classic embed and Components V2, a full tree editor for containers, text displays, sections, separators, media galleries, and action rows, and a live preview panel; presets load in the correct mode and dirty-tracking works across both formats
- [add] Support Components V2 insertion from admin chat: new `insert_components` action type stashes a validated component tree in session storage and switches the embed builder into components mode on apply, with a compact `ComponentsActionPreview` card in the chat
- [fix] Forward `IS_COMPONENTS_V2` flag when editing V2 messages so Discord does not reject the top-level containers as invalid classic components
- [add] Add `numberToHex` utility for formatting Discord color integers as hex strings

### @createrington/shared (1.1.8 → 1.2.0)
- [add] Add Components V2 Zod schemas and TypeScript types: `componentContainerSchema`, `componentTextDisplaySchema`, `componentSectionSchema`, `componentSeparatorSchema`, `componentMediaGallerySchema`, `componentActionRowSchema`, `componentButtonSchema`, `componentThumbnailSchema`, and the top-level `componentsDataSchema` with Discord's aggregate limits as constants
- [add] Add `messagePayloadSchema` discriminated union (`embed` or `components`) and `presetKindSchema` enum, enabling the server to accept either message format in a single input shape
- [fix] Increase emoji field max length from 32 to 64 characters on embed link and action button schemas to accommodate longer Unicode emoji sequences

## v1.29.0 (2026-06-04)

### @createrington/server (1.28.0 → 1.29.0)
- [add] Add Open Graph link-preview card generator script using @napi-rs/canvas, rendering a branded 1200x630 social card with supersampled browser window mockups, team member skin figures, and the vendored Outfit webfont; outputs to the client's public assets for use in OG meta tags
- [fix] Prevent uncaught exception when a Discord slash command error reply fails by wrapping the ephemeral error response in a try/catch, logging both the original command error and the reply failure
- [chore] Bump vitest from ^4.0.16 to ^4.1.0 to resolve a dependency audit advisory

### @createrington/client (0.2.36 → 0.2.37)
- [add] Add full Open Graph and Twitter Card meta tags to index.html with proper image dimensions, type, and alt text for the new og-card.png, replacing the previous logo-only og:image
- [chore] Bump react-router-dom from ^7.13.0 to ^7.16.0 to resolve audit advisories

### Repository
- [chore] Add pnpm audit CI job that fails on high-severity advisories
- [remove] Remove unused GitHub social preview banner image

## v1.28.0 (2026-06-03)

### @createrington/server (1.27.0 → 1.28.0)
- [add] Add Nomads server whitelist sync: registering a player now adds them to the Nomads Minecraft server whitelist over RCON, and deleting a player removes them; the integration self-disables outside the real production deployment or when any RCON env var is missing, opens a short-lived connection per call, and never blocks the triggering flow; failures are logged and surfaced to the admin notifications channel via a Discord embed

## v1.27.0 (2026-06-02)

### @createrington/server (1.26.1 → 1.27.0)
- [add] Add unlinked member detection service and admin tRPC router: new `UnlinkedMemberService` identifies verified Discord members with no matching player record (the inverse of the ghost member tool), with an in-memory cache populated on demand via admin refresh; new `admin.inactivity.unlinked` sub-router exposes paginated list and refresh procedures with audit logging
- [security] Add per-IP rate limit to the internal SSO code-exchange endpoint as a brute-force backstop in case the shared secret leaks, capped at 60 requests per minute per IP

### @createrington/client (0.2.35 → 0.2.36)
- [add] Add "Members Missing from Database" card to the admin inactivity page with paginated table, search, on-demand cache refresh, and copy-to-clipboard on member names and IDs
- [fix] Remove emoji badge prefix from translated waypoint links in chat, displaying clean coordinate links instead of dimension-colored emoji markers
- [fix] Switch CreatePromptModal cancel button from ghost to outline variant for better visual distinction

## v1.26.1 (2026-05-31)

### @createrington/server (1.26.0 → 1.26.1)
- [fix] Hide owner status from the SSO consent screen scope list, keeping the flag in the actual SSO payload but no longer surfacing it as a visible data category to the user

### @createrington/client (0.2.34 → 0.2.35)
- [fix] Remove owner status label from the SSO consent card and fix horizontal centering by adding full-width styling to the card container

## v1.26.0 (2026-05-31)

### @createrington/server (1.25.1 → 1.26.0)
- [add] Add SSO consent screen flow for cross-subdomain login: logged-in users now authorize SSO requests directly from a consent screen instead of being redirected through a full Discord OAuth round-trip; new `GET /api/auth/sso/consent` returns the requesting app name and shared data categories, and `POST /api/auth/sso/authorize` completes or denies the flow using the active session
- [refactor] Extract SSO state management into a dedicated `state-store.ts` module with issue/peek/consume semantics and a 15-minute TTL (up from 5 minutes), replacing the inline Map in the auth controller and better accommodating the login-then-consent round-trip for logged-out users
- [refactor] Extract SSO consumer classification (`isCodeExchangeReturnTo`, `resolveConsumerName`) into `consumer.ts`, moving origin-matching and friendly app name resolution out of the auth controller
- [chore] Add unit tests for SSO state-store (issue, peek, consume, expiry) and consumer name resolution (known subdomains, unknown labels, unparseable URLs)

### @createrington/client (0.2.33 → 0.2.34)
- [add] Add `/authorize` consent page for SSO: standalone screen showing the requesting app name, origin, and the categories of account data being shared, with approve and deny buttons that complete the flow without leaving the main app
- [fix] Fix OAuth redirect losing query parameters: the post-login redirect now preserves the full path and query string, so deep links like `/authorize?state=...` survive the Discord login round-trip

## v1.25.1 (2026-05-31)

### @createrington/server (1.25.0 → 1.25.1)
- [fix] Fix web sessions not being revoked when issuing a temporary ban, allowing banned players to continue accessing the site until their JWT expired naturally
- [fix] Fix FAQ list count query silently dropping filters (enabled status, search text) because the `.where()` result was not reassigned to the builder variable
- [refactor] Split six oversized admin tRPC routers into focused sub-files: crypto (tokens, events, market), embeds (CRUD, linked messages, presets, preset categories, preset links), structure packs (CRUD, mods, rotation), servers (stats, maintenance, whitelist), parties (parties, chunks), and inactivity (ghosts)
- [refactor] Extract shared admin router helpers to deduplicate repeated logic: `auditActor()` for audit log actor objects, `resolveTokenOrThrow()` for crypto token lookups, and embed builder helpers (`buildDiscordEmbed`, `buildButtons`, `getMessageService`, `hasEmbedContent`)
- [refactor] Add `cryptoSymbol` Zod schema with auto-uppercase transform, replacing ad-hoc `.transform(s => s.toUpperCase())` across crypto inputs
- [refactor] Add `runQuery()` base method to `BaseQueries`, centralizing the try/catch and logger.error boilerplate in custom query methods
- [refactor] Add `toUnixSeconds()` and `discordTimestamp()` format helpers, replacing repeated inline timestamp arithmetic and Discord markup construction
- [refactor] Replace hardcoded `http://localhost:3000` dev client origin with `config.app.devClientOrigin`, sourced from a new `DEV_CLIENT_ORIGIN` env variable
- [refactor] Simplify ~20 query call sites to use `getAll()`/`count()` instead of `.where({}).all()`/`.where({}).count()`, and `find()` instead of `.where().first()` for crypto token lookups
- [refactor] Normalize all `catch (err)` bindings to `catch (error)` for consistency
- [chore] Bump `createrington-skin-api` to ^2.1.0 and adopt the library's `randomPose()` export, replacing the locally inlined helper

### @createrington/client (0.2.32 → 0.2.33)
- [fix] Fix flashlight overlay double-removal by coordinating the `transitionend` listener and fallback timeout with an `AbortController`, so whichever fires first cancels the other
- [refactor] Extract `AdminPageHeader` component to replace ~20 inline breadcrumb header blocks across all admin pages, accepting a `trail` array of crumbs and optional action children
- [refactor] Extract `useCopyToClipboard` hook and normalize all copy toasts to a generic "Copied to clipboard" message, replacing context-specific messages across admin pages
- [refactor] Replace hand-rolled pagination in four admin table tabs (TicketsTab, TransactionsTab, SessionsTab, RotationHistory) with the shared `Paginator` component, removing ~200 lines of duplicated code
- [refactor] Extract shared crypto format helpers (`changeColor`, `formatChangePercent`) into `format.ts`, replacing duplicated inline ternary chains across TokenList, Watchlist, and TokenDetail
- [refactor] Move waitlist form validation schema from `ApplyToJoin.tsx` to `@createrington/shared/api`, enabling server-side reuse
- [refactor] Normalize all `catch (err)` bindings to `catch (error)` for consistency
- [chore] Bump `createrington-skin-api` to ^2.1.0 and replace local `pickRandomPose()` with the library's `randomPose()` export
- [chore] Add bundle-size analysis via `rollup-plugin-visualizer` behind an `ANALYZE=1` flag, with chunk size warning limit set to 600 kB

### @createrington/shared (1.1.7 → 1.1.8)
- [refactor] Add waitlist form validation schemas (`buildWaitlistFormSchema`, `waitlistCreateInputSchema`, and field-level schemas), moved from the client's `ApplyToJoin` page to enable server-side reuse

## v1.25.0 (2026-05-29)

### @createrington/server (1.24.0 → 1.25.0)
- [add] Add skin-api SSO code-exchange bridge: skin-api can now complete Discord OAuth via a one-time code flow instead of shared cookies; the auth callback issues a short-lived code (60s TTL, single-use) for configured `SSO_CODE_EXCHANGE_ORIGINS`, and a new `/api/internal/sso-exchange` endpoint lets skin-api redeem it for the player identity payload, authenticated via a dedicated `X-Internal-Secret` header with timing-safe comparison
- [add] Centralize player deletion into `PlayerDeletionService`: a single service now owns the DB delete, audit log row, RCON whitelist removal, and a post-deletion hook registry, replacing six independent deletion paths (admin manual, permanent ban, user self-delete, ghost cleanup, inactivity removal, member-leave cleanup) that each had their own inline logic
- [add] Add admin whitelist resync server action: new `admin.servers.resyncWhitelist` tRPC mutation regenerates a server's whitelist.json from non-banned registered players and reloads it via RCON, with a new `getWhitelistEntries` player query backing it
- [refactor] Remove dead code across queries, repositories, services, and utilities: deleted unused query classes (player/ban, player/strike, server/ally, server/forceload), repository methods (balance, playtime, ticket, waitlist, player/core), services (curseforge, pool-monitor), Discord utilities (rate-limiter, cooldown-manager, confirmation flows, message-helpers), typed-response middleware, format utils, and their associated tests
- [refactor] Switch admin chat Opus opt-up model from 4.7 to 4.8
- [chore] Remove unused `uuid` dependency

### @createrington/client (0.2.31 → 0.2.32)
- [add] Add server Management tab with whitelist resync action card: the admin server detail page now has a Management tab with a confirmation dialog that regenerates the server whitelist from the database
- [refactor] Align online players panel header with chat header: panel header now uses matching border, padding, and min-height
- [refactor] Reuse shared `DiscordIcon` component in login prompt and nav Discord login, removing two inline SVG duplicates
- [refactor] Remove orphaned components and dead utility code: deleted MentionPicker, PartyExpandedRow, OrderBook, CopyBlock, PackCard, ComingSoon page, contexts barrel export, and unused utils
- [refactor] Switch admin chat Opus opt-up model from 4.7 to 4.8
- [chore] Remove unused `@trpc/client` and `motion` dependencies

### @createrington/shared (1.1.6 → 1.1.7)
- [remove] Remove dead exported types: `MessageErrorResponse` from message types, `DateToString` from shared types, and the entire `api/utils.ts` module (Serialize, Deserialize, ApiContract, etc.)

### Root
- [refactor] Consolidate `db/` and new `mc/` compose directories under `docker/`: all database Docker scripts now reference `docker/db/` instead of `db/`
- [add] Add local NeoForge Minecraft server for development: `docker/mc/` provides a pre-configured NeoForge 1.21.1 server with auto-installed dev mods and backend connectivity; new npm scripts (`mc:start`, `mc:up`, `mc:console`, `mc:down`, `mc:reset`, `mc:destroy`, `docker:up/down/logs/reset/destroy`) manage the server lifecycle with an interactive RCON console
- [chore] Add CONTRIBUTING guide with license and contribution terms section
- [chore] Add post-release script for merging main back into dev

## v1.24.0 (2026-05-27)

### @createrington/server (1.23.2 → 1.24.0)
- [add] Add pose option to the `/skin` slash command: users can pick from all known skin-api poses via autocomplete, which renders the skin server-side and attaches the PNG directly to the reply; unknown pose input is rejected with an explicit error embed
- [refactor] Move the "Thanks for your patience!" text in the maintenance-ended announcement embed from the description body to the footer

### @createrington/client (0.2.30 → 0.2.31)
- [fix] Replace the loading spinner in the server-status sidebar widget with a skeleton placeholder that matches the final layout, eliminating the content shift when server data loads

## v1.23.2 (2026-05-27)

### @createrington/server (1.23.1 → 1.23.2)
- [security] Split mod JWT signing secret from the web access token: mod-facing endpoints now verify against a dedicated `MOD_JWT_SECRET` env variable so a compromised Minecraft host can no longer forge web session JWTs; startup validation rejects configs where the two secrets match

### Root
- [chore] Add social preview banner for repository metadata

## v1.23.1 (2026-05-27)

### @createrington/server (1.23.0 → 1.23.1)
- [chore] Migrate skin-api SDK from the internal `@createrington/skin-api-client` v0.2.1 to the public `createrington-skin-api` v1.0.0: `SkinApiClient` is replaced by `SkinApi`, `renderPose()` becomes `render()` with a simplified source parameter, and the return type changes from `Buffer` to `Uint8Array`; `pickRandomPose` is inlined locally since it was dropped from the v1 SDK

### @createrington/client (0.2.29 → 0.2.30)
- [chore] Migrate skin-api SDK from `@createrington/skin-api-client` to the public `createrington-skin-api` v1.0.0: `pickRandomPose` is inlined in `skin-utils.ts` since the v1 SDK no longer exports it

## v1.23.0 (2026-05-27)

### @createrington/server (1.22.0 → 1.23.0)
- [add] Add `/api/render/skin` endpoint that proxies skin renders through the internal skin-api SDK, returning PNG images with 24-hour caching; falls back to a 302 redirect to mc-heads.net on any skin-api error so render pages never show broken images
- [fix] Fix server stats voice channels sourcing member count from the Discord guild cache instead of the database: member count now uses `Q.player.count()` for linked MC accounts, bot count is a static config value, and updates run on a periodic interval with an in-flight guard instead of event-driven guild member events
- [refactor] Move `/health` to `/api/health` and expand the health check: the endpoint now pings the database with latency measurement, reads Discord bot WebSocket state, checks the WebSocket service and playtime manager, and derives a three-level rollup (healthy/degraded/down) returning 503 when down
- [refactor] Re-add terse JSDoc on service and repository classes: all service files and repository classes receive single-line class headers and public method docstrings following the project commenting convention; verbose multi-paragraph blocks removed
- [chore] Bump `@createrington/skin-api-client` to ^0.2.1 and remove the starlightskins CSP host
- [chore] Add `render-profile-poses` dev script for screenshotting `/profile` with every skin pose via Puppeteer
- [chore] Replace em dashes with hyphens in non-UI source strings (Discord embed presets, slash command messages)
- [chore] Normalize TypeScript config casing across workspaces

### @createrington/client (0.2.28 → 0.2.29)
- [refactor] Reorganize admin chat from `components/` into `features/admin-chat/` and `contexts/admin-chat/`, splitting the monolithic `AdminChat.tsx` into composable hooks (`use-admin-chat-session`, `use-model-selection`, `use-unread-tracker`)
- [refactor] Extract `AdminActionModal` shared dialog shell and refactor all seven player action modals (BalanceAdjust, DeletePlayer, EditPlayer, IssueBan, IssueStrike, RemoveStrike, Unban) to use it instead of duplicated Dialog boilerplate
- [refactor] Switch skin rendering from the external starlightskins service to the internal skin-api SDK: `skin-utils.ts` now re-exports poses from `@createrington/skin-api-client` and generates URLs via the local `/api/render/skin` endpoint
- [chore] Rename `use-debounced-value.tsx` to `.ts` (no JSX in the file)
- [chore] Enable `verbatimModuleSyntax` in `tsconfig.app.json`
- [chore] Bump `@createrington/skin-api-client` to ^0.2.1 and `zod` to ^4.4.3

### @createrington/shared (1.1.5 → 1.1.6)
- [refactor] Complete barrel exports from the package root: `src/index.ts` now re-exports `./api`, `./auth`, `./db`, and `./socket` alongside the existing `./types`
- [chore] Add `zod` as a direct production dependency
- [chore] Enable `isolatedModules` in tsconfig

### Root
- [chore] Pin `qs >=6.15.2` via pnpm override to resolve audit vulnerability
- [chore] Declare `zod` as an optional peer dependency of `@hookform/resolvers` via `packageExtensions`

## v1.22.0 (2026-05-25)

### @createrington/server (1.21.0 → 1.22.0)
- [add] Add HTTP request logging for REST and tRPC: a new Express middleware logs method, URL, status code, and response time for all non-static REST requests, while a tRPC logging middleware logs procedure type, path, outcome, and duration for every procedure call; both include the authenticated user's Discord ID when available and write to a dedicated `http` rotating log file
- [fix] Fix MemberCleanupService failing when a player row is already deleted: the cleanup loop now catches `NotFoundError` from `Q.player.delete()` and treats it as a successful removal, preventing one missing row from aborting the entire batch
- [chore] Bump @createrington/logger from ^0.1.2 to ^0.2.0

### @createrington/client (0.2.27 → 0.2.28)
- [add] Make identifiers copyable in the ghosts table: Minecraft username, UUID, and Discord ID cells are now clickable buttons that copy the value to clipboard, with a hover-revealed copy icon and toast confirmation
- [refactor] Lazy-load AdminChatProvider behind an admin gate: the provider and its dependencies are code-split via `lazy()` and only loaded for admin users; non-admin users receive a no-op default from `useAdminChat`, reducing the initial bundle for regular visitors
- [fix] Fix model chip tooltip overlapping the chat input by placing it on the bottom side
- [fix] Unify canMutate tooltip copy on the inactivity admin page to "Only available on the production deployment"

## v1.21.0 (2026-05-24)

### @createrington/server (1.20.0 → 1.21.0)
- [add] Add admin notification embed when a ghost member is removed: the ghosts router now posts a Discord embed to the admin notifications channel with the removed player, removal timestamp, and the admin who triggered the action

## v1.20.0 (2026-05-24)

### @createrington/server (1.19.2 → 1.20.0)
- [add] Add ghost member admin tool: a new `GhostMemberService` detects registered players who have left the Discord guild by comparing the player table against the live guild member list, with an in-memory cache populated on demand via admin refresh
- [add] Add `admin.inactivity.ghosts` tRPC sub-router with `capabilities`, `list`, `refresh`, `verify`, and `remove` procedures, gated to production for destructive actions
- [refactor] Route ghost service errors through `rethrowTrpc` so `ConflictError` and `NotFoundError` map to proper tRPC error codes instead of surfacing as internal errors

### @createrington/client (0.2.26 → 0.2.27)
- [add] Add "Members Missing from Discord" card to the admin inactivity page with paginated ghost list, search, on-demand cache refresh, and a confirmation modal that re-verifies Discord membership before allowing removal

## v1.19.2 (2026-05-24)

### @createrington/server (1.19.1 → 1.19.2)
- [fix] Fix MemberCleanupService deleting the wrong player: the cleanup query passed the full member object to `Q.player.delete()` instead of the `minecraftUuid` identifier, potentially matching on unintended fields
- [fix] Surface unverified login attempts with a typed error code: the OAuth service now throws a dedicated `UnverifiedUserError` that the auth controller catches and returns as a 401 with `code: "UNVERIFIED"`, letting the client distinguish "not registered" from generic auth failures; the SSO callback preserves this reason instead of falling through to a generic redirect
- [add] Add `TooManyRequestsError` (429) to the error hierarchy and propagate an optional `code` field through `AppError` and the JSON error response
- [refactor] Map crypto trade errors to typed AppError subclasses: all generic `throw new Error()` in the order manager and trade executor are replaced with `ConflictError`, `BadRequestError`, `ForbiddenError`, and `TooManyRequestsError`, so tRPC routes return accurate HTTP status codes instead of masking every failure as 400
- [refactor] Migrate all inline `new TRPCError()` calls to the `trpcError` helper: auth middleware, rate-limit middleware, and six routers now use the shorthand factories; new `preconditionFailed` and `tooManyRequests` helpers added, plus a `rethrowTrpc()` utility that maps `AppError` status codes to the corresponding tRPC error code

### @createrington/client (0.2.25 → 0.2.26)
- [fix] Surface auth errors as toast notifications: login failures, state mismatches, and unverified-user rejections now display toasts instead of failing silently; unverified users see a persistent toast with an "Apply to join" action button that navigates to the application page
- [fix] Style toast action buttons with the primary gold color to match the site palette
- [fix] Shorten token combobox search placeholder from "Search tokens..." to "Search"

### Root
- [fix] Fix `db:shell` script container name from `createrington-db` to `createrington_db` to match the actual Docker container

## v1.19.1 (2026-05-22)

### @createrington/client (0.2.24 → 0.2.25)
- [add] Add Minecraft-style button component with pixelated typeface, 3D depth shadow, press animation, and variants (default, destructive, outline, secondary, success, warning, discord) replacing the previous flat button styling site-wide
- [add] Add searchable token dropdown (combobox) for price alerts with keyboard navigation and ARIA roles, replacing the free-text symbol input
- [fix] Prevent demote dialog layout shift by moving the preview query to use the sticky value and replacing the "Loading..." text with skeleton placeholders that match the final layout
- [fix] Align admin chat send button vertically with the message input field
- [fix] Switch embed builder topbar to the shared Breadcrumb component with matching header height and background color, and remove the unused mobile presets sheet sidebar
- [refactor] Replace inline color overrides on maintenance toggle and trade panel buttons with semantic button variants (warning, success, destructive)

### @createrington/server (1.19.0 → 1.19.1)
- [fix] Normalize IPv6-mapped addresses in the mod currency rate limiter by using the library's `ipKeyGenerator` instead of raw `req.ip`, preventing duplicate rate-limit buckets for the same client behind IPv4/IPv6 dual-stack

### Root
- [chore] Extract a reusable CI setup composite action that caches the pnpm store and retries `pnpm install` up to 3 times, fixing flaky CI failures caused by transient canvas binary downloads
- [chore] Bump brace-expansion to 5.0.6 and ws to 8.20.1 via dependency overrides to resolve pnpm audit vulnerabilities

## v1.19.0 (2026-05-21)

### @createrington/server (1.18.4 → 1.19.0)
- [add] Add sandbox consumer router at `/trpc/consumers/sandbox` with a `players.resolve` procedure that batch-resolves Minecraft UUIDs to registered player names and online status, consumed by the sandbox admin panel's inventory manager
- [add] Export `SandboxRouter` type from `@createrington/server/trpc/sandbox` so external consumers can import the typed tRPC client

### @createrington/api-types (0.1.1 → 0.2.0)
- [add] Export `SandboxRouter` type alongside `PanelRouter`, giving the sandbox panel a semver-stable typed contract for its tRPC client

### @createrington/shared (1.1.4 → 1.1.5)
- [chore] Enable `noUncheckedIndexedAccess` in tsconfig to catch unsafe indexed-access patterns at compile time

## v1.18.6 (2026-05-18)

### @createrington/server (1.18.3 → 1.18.4)
- [fix] Keep legacy unsuffixed cookie names (`crt_access`, `crt_refresh`) on production so external SSO consumers that hardcode those names keep working; only the dev deployment now receives the `_dev` suffix

## v1.18.5 (2026-05-18)

### @createrington/server (1.18.2 → 1.18.3)
- [fix] Wait for fonts and images before puppeteer screenshot: the screenshot service now awaits `document.fonts.ready` and all `<img>` element load/error events (with a 10s ceiling) before capturing, replacing the fixed `settleDelay` on most slash commands and eliminating blank-skin or missing-font renders
- [fix] Move puppeteer render secret from URL query parameter to `x-render-secret` HTTP header: the secret no longer appears in browser history, server access logs, or the DOM; all five slash commands now pass it via the new `extraHeaders` screenshot option
- [fix] Allow skin image hosts in CSP `img-src`: add `starlightskins.lunareclipse.studio` and `mc-heads.net` to the Content Security Policy so render pages can load Minecraft skin images without being blocked

### @createrington/client (0.2.23 → 0.2.24)
- [fix] Remove `crossOrigin="anonymous"` from all render page skin images and `Image()` constructors: the attribute was unnecessary since skins are now loaded through CSP-allowed hosts, and it caused CORS preflight failures on some skin APIs
- [fix] Remove render secret from client-side fetch URLs: render pages no longer read or send the puppeteer secret as a query parameter, since the server now injects it via HTTP header during the puppeteer navigation

## v1.18.4 (2026-05-18)

### @createrington/client (0.2.22 → 0.2.23)
- [fix] Poll BlueMap iframe hash on a 400ms interval instead of relying solely on hashchange, since BlueMap uses history.replaceState which doesn't fire the event; the hashchange listener is kept as a no-cost fallback

## v1.18.3 (2026-05-18)

### @createrington/client (0.2.21 → 0.2.22)
- [add] Sync BlueMap iframe hash to the parent URL so map coordinates become shareable via direct link: navigating inside the embedded map updates the browser address bar in real time, and opening a shared URL restores the exact map position
- [fix] Detach BlueMap hashchange listener on iframe reload and component unmount to prevent leaked event handlers and stale parent-URL writes

## v1.18.2 (2026-05-18)

### @createrington/server (1.18.1 → 1.18.2)
- [security] Harden BaseQueries against arbitrary column injection: `extractIdentifier` now filters through `VALID_IDENTIFIER_FIELDS` before building WHERE clauses, `getColumnName` validates resolved names match `[a-z_][a-z0-9_]*`, and the `raw()` method is downgraded from public to protected
- [security] Restrict `/api/render/*` to loopback callers: new `requireLoopback` middleware rejects any request with a non-loopback TCP peer or an `X-Forwarded-For` header, preventing PII exfiltration even if the Puppeteer secret leaks
- [security] HMAC-sign the dev-set-refresh token to block CSRF pin attacks: the `/api/auth/dev-set-refresh` endpoint now requires a timestamped HMAC signature, replacing the unsigned bare-token URL
- [security] Require trusted origin on `/api/auth/logout-all` to prevent cross-origin session revocation via CSRF
- [security] Bound mod currency amounts and rate-limit mutations: all mod-side money inputs are validated against a 1-trillion cap with finite/positive checks, withdraw count capped at 1M, and deposit/withdraw/pay routes rate-limited at 30 req/min per player UUID
- [security] Bound admin balance and crypto amount inputs: admin balance adjust capped at +/-1B, bulk adjust array limited to 100 players (down from 1000), and crypto buy/sell/order amounts capped at 1B
- [security] Constrain admin player CRUD input shapes: search filters gain max-length constraints, player update validates Minecraft username format (`^[a-zA-Z0-9_]{3,16}$`) and Discord snowflake format (`^\d{17,20}$`)
- [security] Rate-limit hot tRPC procedures: new in-memory per-key tRPC rate-limit middleware applied to `admin.ai.assist` (30/hr), `admin.embeds.send` (60/hr), and `public.waitlists.create` (5/hr per IP)
- [fix] Re-check admin status against DB so demote takes effect within 30s: new `AdminStatusService` with 30s TTL-cached DB lookups replaces relying solely on the JWT `isAdmin` flag; both Express `requireAdmin` and tRPC `isAdmin` middleware now verify live admin status, and promote/demote actions invalidate the cache immediately
- [fix] Lock `player_balance` row for update to prevent lost-update race: balance add, deduct, set, and transfer now acquire `SELECT ... FOR UPDATE` before the read-modify-write sequence; transfers lock both rows in UUID-sorted order to prevent deadlocks
- [fix] Close daily reward TOCTOU with period-keyed unique index: new `claim_period_key` column and unique index on `(player, reward_type, claim_period_key)` prevents double claims from concurrent requests; the claim insert runs before crediting balance inside a single transaction, and a unique-violation retry returns a friendly "already claimed" response
- [fix] Enforce single active session per (uuid, server) at DB level: the `idx_player_session_active` index upgraded from non-unique to a unique partial index; session creation retries once on unique violation after closing orphans
- [fix] Add DB pool statement/query/idle-transaction timeouts: 30s statement and query timeouts prevent runaway queries from exhausting the connection pool, and a 60s idle-in-transaction timeout releases row locks from abandoned transactions
- [fix] Wrap lottery start/join balance deduct in a shared transaction: deducting the entry fee and inserting the participant row now happen atomically, preventing phantom participants when the balance deduct succeeds but the insert fails
- [fix] Suffix refresh/access cookie names with deployment env: cookie names now include a `_dev` or `_prod` suffix when `COOKIE_DOMAIN` is set, preventing cross-deployment cookie collisions that triggered token-theft revocation storms on shared parent domains
- [fix] Tighten dev-set-refresh redirect sanitizer: replaced the manual regex guard with a URL-parsing `safeLocalPath` that strips the origin and falls back to `/`, closing remaining open-redirect variants
- [fix] Reject web messages exceeding 2000 chars after sender prefix: server-side length check added alongside the shared Zod schema constraint
- [fix] Guard Stripe webhook replay: donation processing now checks for an existing record by session ID before creating a duplicate, preventing double-credited donations on webhook retries
- [refactor] Centralize Puppeteer base URL in config with a loopback default: five slash commands that duplicated the base-URL derivation now read from `config.puppeteer.baseUrl`; dev defaults to `localhost:3000`, prod defaults to `127.0.0.1:{PORT}`
- [chore] Low-tier security audit cleanup: restrict CSP `ws:` directive to dev only, move BigInt type parser registration before pool initialization, simplify sync-secret middleware, and remove unused `JWTService.decode()` and `requireOwnerOrAdmin` middleware

### @createrington/client (0.2.20 → 0.2.21)
- [add] Add `@` and `#` autocomplete to embed builder text fields: typing `@` or `#` in any mention-enabled text field opens a dropdown with matching Discord roles or channels, navigable via keyboard (arrow keys, Tab/Enter to confirm, Escape to dismiss); powered by a new `MentionAutocomplete` component wired into the embed builder's `TextField` primitive
- [fix] Block embed send when fields have empty name or value: all send, save, update, and update-link paths now validate for incomplete fields before submission and show an error toast naming the offending field numbers

### @createrington/shared (1.1.3 → 1.1.4)
- [fix] Add max-length constraint to web message content schema: `SendMessageBodySchema.content` now enforces a 2000-character limit at the Zod validation layer

## v1.18.1 (2026-05-16)

### @createrington/server (1.18.0 → 1.18.1)
- [fix] Fix crypto trade ESM directory-import crash: the `requireCryptoEnabled` middleware used a bare directory dynamic import (`@/services`) that Node ESM cannot resolve at runtime; changed to an explicit `@/services/index.js` path and extended the post-build script to rewrite dynamic `import()` string-literal paths the same way it already rewrites static `import ... from` statements

## v1.18.0 (2026-05-16)

### @createrington/server (1.17.3 → 1.18.0)
- [add] Add runtime-tweakable crypto settings system: new `CryptoSettingsService` backed by a `crypto_setting` table stores per-key overrides with Zod validation, pairwise invariant checks (min/max pairs), and a `setting:changed` event emitter; all crypto subsystems (tickers, trading, fees, generation, events, alerts, watchlist) now read config through a synchronous `cryptoSetting()` accessor that falls back to compiled defaults when no override exists
- [add] Add admin crypto settings tRPC router (`admin.crypto.settings`): list, update, reset, and reset-all procedures let admins view and modify every runtime config key with audit logging; interval-bound settings automatically restart the affected ticker on change
- [add] Add `cryptoUserProcedure` tRPC middleware: trade-side mutations (buy, sell, place order) are gated behind the crypto master toggle so reads still work while the market is paused
- [add] Add public `crypto.status` endpoint returning the current master toggle state for client-side gating
- [add] Add `mint-session` dev script for testing as any registered player: mints a real refresh-token session row and either copies a DevTools snippet or opens the browser at a dev-only auto-login URL (`/api/auth/dev-set-refresh`)
- [fix] Fix logout logging "Unknown" instead of the actual username: the handler now falls back to the session row when no Bearer token is present on the request
- [security] Reject backslash open-redirect bypass in `devSetRefresh`: the `return_to` parameter now rejects paths where the second character is a slash or backslash, preventing browsers from normalising `/\evil.com` into `//evil.com`

### @createrington/client (0.2.19 → 0.2.20)
- [add] Add crypto settings admin panel: new tabbed "Settings" section in the admin crypto page with grouped controls for every runtime-tweakable key, per-setting reset, bulk reset-all confirmation, and real-time optimistic updates
- [add] Add `CryptoDisabledScreen` shown to non-admin users when the master toggle is off, with a polling query that re-enables the UI automatically once the market is turned back on
- [fix] Fix dialog content disappearing during exit animation: new `useStickyValue` hook preserves the last non-null value so Radix dialogs keep their content rendered through the close transition; applied to `DemoteDialog`, `TeamMemberDialog`, `AdminStructurePacks` delete dialog, `RemoveModDialog`, `PresetSidebar`, and `PartiesFiltersBar`
- [add] Add reusable `LabeledSwitch` component combining a Switch and Label in a bordered container

## v1.17.3 (2026-05-16)

### @createrington/server (1.17.2 → 1.17.3)
- [refactor] Strip em dashes from all non-UI code (comments, log messages, config annotations) and replace with colons, commas, or semicolons per the project style convention
- [refactor] Remove dead commented-out code across the codebase: pool monitor export and startup call, database health-check component in `/health`, and stale import of pool monitor in the app setup

### @createrington/client (0.2.18 → 0.2.19)
- [refactor] Strip em dashes from all non-UI code (comments, JSDoc annotations) and replace with colons, commas, or semicolons per the project style convention
- [refactor] Remove dead commented-out code: order mode selector block in the crypto trade panel and placeholder "Getting Started" guide entry

### @createrington/shared (1.1.2 → 1.1.3)
- [refactor] Strip em dashes from JSDoc comments in embed and message type schemas

## v1.17.2 (2026-05-11)

### @createrington/server (1.17.1 → 1.17.2)
- [fix] Fix Infisical environment slug in production deploy workflow - the `--env` flag was set to `production` instead of `prod`, causing secret fetching, database migration, and runtime .env export steps to target a non-existent Infisical environment

## v1.17.1 (2026-05-11)

### @createrington/server (1.17.0 → 1.17.1)
- [chore] Migrate CI deployment secrets from dotenv files to Infisical - both dev and prod workflows now authenticate via universal-auth, pull secrets at build/migrate time with `infisical run`, and sync the runtime `.env` from Infisical on each deploy instead of reading a static file on the host
- [chore] Separate deploy-time database host from runtime database host - CI steps use `DEPLOY_DB_HOST`/`DEPLOY_DB_PORT` environment variables so the migration runner can reach the database from the CI network without hardcoding the internal Docker hostname
- [chore] Add CI concurrency groups per PR to cancel superseded workflow runs, reducing wasted runner time on rapid pushes
- [chore] Wire local dev server through Infisical - the `pnpm dev` script now runs via `infisical run --env=dev` so developers no longer need a local `.env` file for server secrets

## v1.17.0 (2026-05-09)

### @createrington/server (1.16.1 → 1.17.0)
- [refactor] Rework discord bot presences - the rotating status service now runs on the main bot instead of the web bot, with live-data statuses (top crypto gainer/loser from the market service, today's top grinder from playtime data) replacing the previous pool of hardcoded static strings; statuses are injected via constructor for reusability and each status defines a static fallback text used when the dynamic resolver fails
- [add] Add status length clamping at 120 characters to prevent exceeding Discord's 128-character custom-status cap, truncating with an ellipsis when a dynamic resolver returns oversized text
- [refactor] Set web bot to a static "createrington.com" presence in production, removing it from the rotating status pool
- [remove] Remove unused StatusCategory enum, addStatus, filterCategory, resetStatuses, and getStats methods from the rotating status service

## v1.16.1 (2026-05-09)

### @createrington/server (1.16.0 → 1.16.1)
- [chore] Bump axios from v1.15.0 to v1.15.2 and add pnpm dependency overrides for postcss and ip-address to resolve audit vulnerabilities

## v1.16.0 (2026-05-06)

### @createrington/server (1.15.0 → 1.16.0)
- [add] Add AI text assist endpoint for the embed builder - new `admin.ai.assist` tRPC mutation lets admins run editing actions (rewrite, shorten, punchier, grammar fix, translate to English) on embed copy via the OpenAI chat completion service, with per-action system prompts and temperature tuning
- [fix] Fix embed category create returning only a success message - the `createCategory` mutation now uses `createAndReturn` and responds with the new category's `id` and `name`, so the client can update its state without refetching

### @createrington/client (0.2.17 → 0.2.18)
- [refactor] Redesign embed builder with a new two-panel layout - replaces the previous multi-component editor (EmbedForm, EditorPanel, EditorToolbar, ButtonEditor, ColorPicker, EmbedFieldEditor) with a unified FormPanel, Topbar, and reusable form-primitives system; the preset sidebar is reworked with a cleaner category/preset hierarchy and a "Save as new" modal
- [add] Add drag-and-drop field reordering in the embed builder via @dnd-kit, with sortable grip handles and keyboard sensor support
- [add] Add AI assist button to text fields in the embed builder - each textarea exposes a sparkle button that calls the server AI assist endpoint to rewrite, shorten, fix grammar, make punchier, or translate the field content
- [add] Add click-to-focus from embed preview to form fields - clicking a section in the live preview scrolls and highlights the corresponding form input
- [refactor] Refactor InsertMenu from a Popover to a Dialog with tabbed mentions/timestamp sections, removing the multi-page navigation pattern
- [refactor] Refactor embed builder hook to fix React rules-of-hooks violations - replace mutable ref draft reads during render with a `useState` initializer, and memoize external data conversion to avoid redundant serialization in the dirty check

## v1.15.0 (2026-05-05)

### @createrington/server (1.14.1 → 1.15.0)
- [add] Add `/ticket add` subcommand to grant a user or OPAC party access to a ticket channel, with autocomplete party search and batched permission overwrites
- [fix] Fix stats import dropping orphan rows by joining on the player table during batchUpsert, so rows referencing non-existent players are silently excluded instead of violating the foreign key constraint
- [refactor] Drop `EmbedColors.Moderation` and use `EmbedColors.Error` for inactivity removal embeds, removing the unused `DARK_RED` config import
- [chore] Restrict deploy workflows to trigger only on PR merge events instead of all pushes

### @createrington/client (0.2.16 → 0.2.17)
- [refactor] Redesign admin changelog page with categorized sections, collapsible package entries, version diffs, and improved visual hierarchy
- [fix] Center version link in the nav-user dropdown so it aligns with other menu items
- [fix] Fix ModelChip layout shift by replacing the Select component with a Popover and adding disabled state styling

## v1.14.1 (2026-05-05)

### @createrington/server (1.14.0 → 1.14.1)
- [fix] Fix announcement embeds failing when a mod list exceeds Discord's 1024-character field limit by splitting long lists into multiple continuation fields

## v1.14.0 (2026-05-05)

### @createrington/server (1.13.0 → 1.14.0)
- [add] Add chunk sync endpoint and `server_chunk` table: new `/api/chunks/sync` mod endpoint receives full-state chunk snapshots (claimed, unclaimed, forceloaded) per dimension, storing them in a new `server_chunk` table with advisory-lock-guarded batched upserts
- [add] Add unified parties admin tRPC router: replaces the separate `admin.allies` and `admin.forceloads` routers with a single `admin.parties` router that exposes party lists, solo players, chunk data, KPI aggregates, and dimension filters with server-side pagination and sorting
- [add] Add player search by Discord ID and UUID: the admin players list endpoint now accepts Discord snowflakes (17-20 digits) and Minecraft UUIDs as search terms, routing them to the appropriate query
- [add] Add Mojang UUID resolution endpoint: new public `players.resolveUuid` tRPC procedure fetches a username from the Mojang API for unresolved UUIDs, with result caching
- [fix] Fix SSO access cookie premature logout: the access cookie `maxAge` was being set in seconds instead of milliseconds, causing the cookie to expire almost immediately after issuance
- [fix] Fix chunk sync advisory lock overflow: the lock namespace hash was exceeding PostgreSQL's int4 range, causing lock acquisition failures
- [fix] Fix lottery start announcement: use `/join` command mention instead of plain text in the lottery start embed
- [fix] Fix parties admin aggregates ignoring dimension filter: KPI card queries now filter by the selected dimension
- [fix] Fix expired chunk attribution: chunks with expired claims are now attributed to their original owner in the admin parties view
- [refactor] Move donations router under owner scope: donations management routes relocated from admin to the owner-only namespace
- [refactor] Minimize required env vars in dev: non-critical service configs (email, Stripe, etc.) are now optional when running locally, with extracted `isDevHostname` helper for validation

### @createrington/client (0.2.15 → 0.2.16)
- [add] Add unified parties admin page: replaces the separate Allies and Forceloads tools with a single Parties page featuring tabbed party/solo-player tables, chunk detail tables, KPI cards, dimension filter populated from live DB values, and multi-state allied/opted-in filter selects
- [add] Add party tab to player detail: collapsible blinds show the player's party membership, allied parties, and chunk claims with deep-linking from the parties admin page
- [add] Add sortable column headers: party tables, solo player tables, and chunk tables all support click-to-sort with visual indicators
- [add] Add split click areas on player blinds: left side navigates to player detail, right side expands/collapses the blind
- [add] Add sticky expanded row: when expanding a party row, it pins to the viewport so chunk details stay visible while scrolling
- [add] Add paginated chunk tables with server-side filtering: chunk parties section now supports pagination and search
- [add] Add admin chat model picker: admins can opt into Opus for deeper investigations via a model chip selector (moved from header to chat panel)
- [add] Add PlayerLabel UUID resolution: clicking an unresolved UUID in a PlayerLabel fetches the username from Mojang and updates inline
- [add] Add reusable Paginator component for consistent table pagination across admin pages
- [fix] Fix player search to recognize Discord IDs (17-20 digit strings) and route them appropriately
- [fix] Fix FE convention violations: file naming, component structure, and hook patterns aligned with project conventions
- [chore] Deploy workflow updated to skip server restart and migration on client-only production pushes

## v1.13.0 (2026-04-28)

### @createrington/server (1.12.0 → 1.13.0)
- [add] Add ally sync system for opac-fakeplayer: new `/api/allies/sync` mod endpoint receives full-state snapshots of the fake-player party, allied real-player parties, and qualified/pending players; the server replaces ally state per server in a single transaction with four new tables (`server_ally_fake_party`, `server_ally_fake_party_member`, `server_ally_party`, `server_ally_qualified_player`)
- [add] Add admin tRPC procedures for ally data: `admin.allies.fakeParty`, `admin.allies.alliedParties`, `admin.allies.qualifiedPlayers`, and `admin.allies.playerStatus` let the admin panel read the synced ally state
- [fix] Fix forceload dimension and active-only filters: the party and player forceload queries now aggregate chunks per dimension via a lateral join and return `chunksByDimension`, so the UI filters by dimension and active status actually filter the top-level table rows instead of only the expanded detail
- [remove] Drop FK on `player_playtime_summary.player_minecraft_uuid`: playtime summary rows now outlive player deletion so all-time aggregates (homepage total hours, per-server totals) remain intact when a player is removed
- [add] Add stats-file playtime backfill script: new `import-playtime-from-stats` script reads Minecraft `stats/*.json` files and backfills `player_playtime_summary` rows for historical playtime data

### @createrington/client (0.2.14 → 0.2.15)
- [add] Add admin allies page: new Tools → Allies page shows the synced fake-player party, allied parties with member badges, and qualified players split into active/pending sections
- [add] Add ally status section to player detail: the admin player overview tab now shows the player's ally qualification state (active, pending, or not qualified) with their allied party info
- [fix] Fix forceload active-only and dimension filters on top-level tables: party and player tables now hide rows that have zero chunks matching the selected dimension or active-only toggle, instead of only filtering the expanded chunk list
- [fix] Fix auto-focus on team member dialog: prevent Radix auto-focus from stealing focus when the dialog opens, avoiding scroll jumps on mobile

## v1.12.0 (2026-04-26)

### @createrington/server (1.11.0 → 1.12.0)
- [add] Add Nomads to the Discord server selection panel: users can now pick the "Nomads" test server (Create: Aeronautics proving phase) from the server selection menu, which assigns the new Nomads role
- [add] Register Nomads Discord entities: new role, channels (feedback-bugs, chat, start-here, minecraft-chat), and category added to the Discord configuration

### @createrington/client (0.2.13 → 0.2.14)
- [add] Animated sidebar icons on hover: all sidebar navigation icons now use stroke-draw and motion-based animations from `@createrington/icons` that play on hover, replacing the static Lucide icons
- [add] Add `useAnimatedHover` hook integration across all nav components (main, admin, crypto, owner, user menu) for consistent hover-triggered icon animation
- [add] Add sidebar trigger animation and polish collapsed-sidebar icon hover states

## v1.11.1 (2026-04-24)

### @createrington/client (0.2.12 → 0.2.13)
- [chore] Swap team members on the team page: replace Stratos65 and imahomen with diablothe2nd and Tetsuoken, updating player UUIDs, skin viewer animations, and credits

## v1.11.0 (2026-04-24)

### @createrington/server (1.10.1 → 1.11.0)
- [refactor] Unify mod authentication on self-signed JWTs with audience claim: all mod-facing endpoints (`/api/currency`, `/api/trains`, `/api/presence`) now authenticate via a single `modJwt` middleware that verifies a self-signed JWT with an `aud: "createrington-mod"` claim, replacing the previous shared-secret and mixed-auth schemes; server-level tokens (no player UUID/name) are accepted for endpoints that don't require player context
- [remove] Remove legacy currency and trains routes: the `/api/legacy/currency` and `/api/legacy/trains` endpoints (flat-response compatibility shims for pre-envelope mod clients) are deleted now that all mod clients have migrated to the current API
- [add] Add owner-only admin management panel: new `owner` tRPC router with procedures to list admins, view the admin audit log, promote users to admin, and demote existing admins; promotion and demotion are logged with an audit trail and optionally notify a Discord channel
- [add] Add admin-chat history page: new tRPC procedures and REST routes let admins browse, search, and view past assistant chat sessions with full message history and metadata
- [add] Add inactivity notification on removal: when the cleanup service removes a player for inactivity, an admin notification embed is now sent to the configured Discord channel summarising the removal
- [add] Add process-overdue action to the inactivity panel: admins can trigger processing of all overdue warnings in bulk from the inactivity management UI
- [refactor] Deduplicate inactivity panel rows and exclude admins from the sweep: the warning query now deduplicates by player and the cleanup service skips players with admin privileges
- [add] Add freeform highlights to the modpack changelog tool: the announcement builder now supports user-defined highlight blocks (title + description) that render above mod lists in the changelog embed
- [refactor] Cache player existence in `requireKnownPlayer`: the middleware now caches verified player IDs in memory, avoiding a DB query on every authenticated request for returning players
- [security] Harden mod API IP gate: the server-IP middleware now validates against a strict allowlist and rejects requests from unrecognised origins; the `fromUuid` shortcut route is removed
- [security] Security hardening batch: strict Bearer prefix parsing on Authorization headers, exact-origin allowlist for SSO return-to URLs (replacing regex), timing-safe comparison for shared secrets, admin-input sanitisation on embed/FAQ mutations, savepoint name escaping in transactions, and ticket transcript path traversal guard
- [refactor] Logging and error hygiene: suppress stack traces for expected 4xx errors, redact sensitive fields from request logs, and guard against unhandled promise rejections in Discord event handlers
- [security] Patch audit vulnerabilities via pnpm overrides for transitive dependencies
- [security] Reject nil-UUID fakeplayers in the playtime pipeline: the playtime service now validates incoming UUIDs and drops events from non-player entities (e.g. fake-player automation) before they reach the database

### @createrington/client (0.2.11 → 0.2.12)
- [add] Add owner-only admin management panel: new sidebar section and pages for owners to view, promote, and demote admins with confirmation dialogs and an audit feed
- [add] Add admin-chat history page: browsable list of past assistant sessions with search, pagination, and a detail view showing the full conversation
- [add] Add copy button to admin-chat code blocks: fenced code blocks in assistant responses now have a one-click copy button
- [add] Add freeform highlights to the modpack changelog tool: the changelog builder UI now includes a highlights section where users can add titled description blocks that appear above the mod list
- [fix] Fix owner demote dialog close button and admin chat hover interaction issues
- [fix] Fix owner panel UI follow-ups: spacing, alignment, and responsive layout refinements

### @createrington/shared (1.1.1 → 1.1.2)
- [security] Restrict embed URL fields to HTTP(S) schemes: all URL fields in the embed data schema now reject `javascript:`, `data:`, and `file:` URIs, accepting only `http://` and `https://` URLs

## v1.10.1 (2026-04-23)

### @createrington/server (1.10.0 → 1.10.1)
- [refactor] Migrate transactional email from nodemailer to Resend: the email service now uses the Resend HTTP API instead of SMTP, simplifying config (single API key replaces host/port/user/pass), handling local file attachments by reading them into buffers, and mapping inline `cid` references to Resend's `contentId` field so existing templates work unchanged
- [refactor] Replace the inline Winston logger with the shared `@createrington/logger` package: the 276-line `DailyFolderLogger` class is removed in favour of a `createLogger()` call from the extracted library, keeping the same daily-folder rotation and global `logger` registration behaviour
- [refactor] Make the server-writable storage directory configurable via `STORAGE_PATH` env var: ticket transcript paths now resolve from `config.storage.path` instead of walking up from `import.meta.url`, and the env schema tolerates a missing value when validation is skipped (generate scripts, unit tests)

### @createrington/client (0.2.10 → 0.2.11)
- [refactor] Make mod names in the active structure pack clickable: each mod with a URL now links directly to its CurseForge/Modrinth page, and the separate "Inspect" dialog button is removed in favour of inline links
- [fix] Fix contact email across legal pages: privacy policy and terms of service now use the canonical `createrington.com` domain instead of the old `create-rington.com`

### @createrington/api-types (0.1.0 → 0.1.1)
- [chore] Switch package registry from public npm to the internal Gitea npm registry: `publishConfig.registry` now points to `gitea.matejhoz.com` and the README documents the `.npmrc` setup for consumers

## v1.10.0 (2026-04-22)

### @createrington/server (1.9.1 → 1.10.0)
- [add] Add auto-message follow-ups: each auto-message can now have up to 5 follow-up messages that fire sequentially after configurable delays; follow-ups are stored in a new `discord_auto_message_followup` table with cascade delete, and the service schedules them via in-memory timeouts with additive delays along the chain
- [add] Admin CRUD for follow-ups: the `createMessage` and `updateMessage` tRPC mutations accept an inline `followups` array; updates replace all existing follow-ups in a transaction, and the `getConfig` query now returns follow-ups nested under each message
- [refactor] Move structure pack read endpoints to the public router: `current`, `pool`, and `rotationInfo` queries no longer require authentication, enabling the packs page to load for logged-out visitors

### @createrington/client (0.2.9 → 0.2.10)
- [add] Add Parallel Worlds portal hero to `/packs`: animated Nether portal canvas rendered from a sprite sheet with idle shimmer, hover glow, and reduced-motion support; the hero section uses `svh` units for stable mobile viewport sizing and pauses the canvas when offscreen for performance
- [add] Add portal zoom overlay for pack voting: clicking the portal triggers a cinematic zoom sequence that reveals voting cards inside the portal frame, with staged open/close transitions, brightness ramping, and subtle blur effects
- [refactor] Redesign active pack panel with cinematic styling: the currently active pack is displayed with floating dust particles, a glow backdrop, and a call-to-action that opens the portal overlay when no pack is active
- [add] Add inline enable/disable and delete actions to the admin packs list, replacing the need to navigate into each pack to toggle state
- [add] Add Assistant sidebar trigger: the admin chat widget can now be opened from a sidebar menu item instead of only the floating bubble
- [refactor] Open the structure packs page to logged-out visitors by switching data queries from the authenticated user router to the new public endpoints
- [add] Add follow-up message editing UI to auto-messages: the message dialog now includes a follow-ups section where admins can add, reorder, and remove timed follow-up messages
- [fix] Fix mobile chat viewport height: use `dvh` (dynamic viewport height) for the chat container so the input stays visible when the mobile keyboard opens
- [refactor] Clean up sidebar collapsible chevrons: standardize rotation direction and transition timing across all collapsible nav sections
- [fix] Fix stuck maintenance cancel dialog caused by stale WebSocket status: the dialog now resets correctly when the server status changes while it is open
- [chore] Update site logo with an enhanced version and remove the unused webp variant

## v1.9.2 (2026-04-20)

### @createrington/client (0.2.8 → 0.2.9)
- [refactor] Polish guides UI with smoother step transitions: replace opacity toggle with a new `AutoHeight` wrapper that animates content height changes via ResizeObserver, add a progress bar indicator for mobile, and only scroll when the content anchor is above the viewport
- [refactor] Restyle guide cards with hover effects, gradient overlays, estimated reading time badges, and image zoom on hover
- [refactor] Refine step sidebar and navigation: widen sidebar, add hover states to non-active steps, use a top border separator on the nav footer, and show a checkmark icon on the Finish button
- [add] Add new hero images (metro, space-station, royal-albert-hall) and update the site logo

### Other
- [add] Add Remotion marketing video package (`marketing/`): multi-scene promotional video with procedural animations, Minecraft build showcases, crypto terminal mockup, player card renders, stats counters, credits sequence, and optional soundtrack support
- [chore] Remove the startup delay script and simplify the root `dev` command to run all services concurrently without artificial delays
- [add] Add player render screenshots to the repository and update README with render examples

## v1.9.1 (2026-04-18)

### @createrington/server (1.9.0 → 1.9.1)
- [security] Fix SSO open-redirect vulnerability: all `res.redirect` calls in the SSO callback now re-validate the target URL against the SSO whitelist before redirecting, adding defense-in-depth against CWE-601 (closes #532, #533, #534)
- [chore] Remove redundant and AI-generated comments across services, routes, controllers, repositories, middleware, and utilities

### @createrington/client (0.2.7 → 0.2.8)
- [chore] Remove redundant and AI-generated comments across contexts, features, pages, and services

### @createrington/shared (1.1.0 → 1.1.1)
- [chore] Mark package as UNLICENSED with proprietary license

## v1.9.0 (2026-04-18)

### @createrington/server (1.8.1 → 1.9.0)
- [add] Add consumer tRPC router system: new `consumers` namespace in the root router provides stable, versioned API contracts for external first-party apps (admin panel, bots)
- [add] Add panel consumer router with `presence.onlineByServer` procedure: returns currently online players for a given server, consumed by the admin panel to render per-server player lists
- [add] Mount panel router at dedicated `/trpc/consumers/panel` endpoint so external consumers can use natural procedure paths without knowing the internal router nesting
- [add] Export `PanelRouter` type via new `./trpc/panel` package export for use by `@createrington/api-types`

### @createrington/api-types (new: 0.1.0)
- [add] New workspace package published to public npm: ships a single bundled `.d.ts` with typed tRPC router contracts for first-party consumer projects
- [add] Exports `PanelRouter` type for the admin panel to use with `@trpc/client`
- [chore] CI auto-publishes to npm on deploy when the version is bumped, with idempotent skip-if-already-published guard

## v1.8.1 (2026-04-18)

### @createrington/server (1.8.0 → 1.8.1)
- [refactor] Migrate all URLs, config defaults, comments, and tests from `create-rington.com` to `createrington.com` (domain consolidation)
- [refactor] Consolidate welcome image URL to the `assets.createrington.com` subdomain
- [refactor] Extract `QueryBuilder` class from `base.queries.ts` into its own `query-builder.ts` module for better separation of concerns; no behaviour change

### @createrington/client (0.2.6 → 0.2.7)
- [refactor] Use dedicated bot logo (`createrington-bot.webp`) across all admin chat components: chat header, toggle button, empty state, message rows, and typing indicator now display the bot avatar instead of the generic site logo
- [refactor] Migrate all URLs, env files, CSP directives, Open Graph meta tags, and render watermarks from `create-rington.com` to `createrington.com`
- [fix] Fix admin chat message spacing and avatar alignment: adjust group margins, add bottom padding to messages without meta, and align bot avatar with the bubble bottom
- [refactor] Float admin chat message meta (timestamp and copy button) on hover using opacity transition instead of the previous grid-row height animation, reducing layout shift
- [refactor] Make mobile header sticky so the sidebar trigger and logo remain visible when scrolling

## v1.8.0 (2026-04-17)

### @createrington/shared (1.0.0 → 1.1.0)
- [add] Add `content` field to `embedDataSchema`: plain message content (up to 2000 chars) is now a first-class field alongside embed title/description, enabling Discord messages that contain text without a rich embed

### @createrington/server (1.7.2 → 1.8.0)
- [add] Add plain text content support to embed builder: all send/edit/preview embed mutations now accept and forward a `content` field; validation accepts content-only messages (previously required at least a title, description, or field); edit operations explicitly null out content/embeds/components when absent so stale values are cleared on update
- [refactor] Modularize structure pack rotation service: `rotation.ts` (~600 LOC) split into focused files: `scheduling.ts`, `weights.ts`, `mod-cache.ts`, `timezone.ts`, `constants.ts`, `types.ts`, and an `index.ts` orchestrator; no behaviour change
- [refactor] Modularize crypto market service: `crypto-market.service.ts` (~550 LOC) split into `aggregation.ts`, `market-caches.ts`, `lifecycle/ipo.ts`, and `lifecycle/seasonal.ts`; no behaviour change
- [refactor] Modularize RCON utility: monolithic `rcon/index.ts` (~1000 LOC) split into `connection.ts`, `manager.ts`, `enums.ts`, `errors.ts`, and `types.ts`; error classes are re-exported from the barrel so existing imports remain unchanged

### @createrington/client (0.2.5 → 0.2.6)
- [add] Add plain text content field to embed builder UI: new "Content" textarea appears above the embed form; the normalizer now propagates `insert_embed` content through to the embed data so it survives round-trips through the editor
- [refactor] Modularize web chat component: monolithic `chat.tsx` (1777 lines) split into `server-chat.tsx`, `message-row.tsx`, `message-group.tsx`, `message-images.tsx`, `player-list-panel.tsx`, `chat-markdown.tsx`, `avatar.tsx`, `source-badge.tsx`, plus shared `hooks.ts`, `constants.ts`, `types.ts`, and `utils.ts`; no behaviour change
- [refactor] Modularize StructurePackDetail admin page: monolithic page component (~970 lines) decomposed into `AddModDialog`, `EditPackDialog`, `ModsList`, `PackHeader`, and `RemoveModDialog` components with a shared `types.ts`; no behaviour change
- [fix] Fix typing indicator spacing and animation: entrance animation and spacing for the typing indicator are corrected
- [fix] Fix copy and timestamp visibility: copy button and timestamp are now shown on every chat message, not just on hover of grouped messages

## v1.7.2 (2026-04-16)

### @createrington/server (1.7.1 → 1.7.2)
- [security] Tighten Content Security Policy to allow Cloudflare Insights: `helmet` CSP directives now explicitly permit `https://static.cloudflareinsights.com` in `script-src` and `https://cloudflareinsights.com` in `connect-src`, fixing blocked analytics requests without weakening the policy elsewhere

### @createrington/client (0.2.4 → 0.2.5)
- [fix] Fix admin chat markdown list rendering: unordered and ordered lists in AI assistant responses now render with visible bullets/numbers (`list-disc`/`list-decimal` + `list-outside`) instead of appearing as unstyled flat text
- [fix] Fix admin chat "End session" button styling: the button now renders in destructive red with a matching hover state, making it visually distinct from neutral actions
- [fix] Fix CSP compatibility with Zod v4: Zod's JIT compiler is disabled at app entry (`z.config({ jitless: true })`) so the app no longer requires `unsafe-eval` in the Content Security Policy
- [fix] Fix CSP meta tag in `index.html`: client-side CSP now mirrors the server helmet policy, permitting Cloudflare Insights scripts and connections
- [fix] Fix React Hook Form devtools warnings on `ApplyToJoin`: `Select` and `Checkbox` inputs now receive the `name` prop from their field controller, eliminating uncontrolled-component console warnings

## v1.7.1 (2026-04-16)

### @createrington/server (1.7.0 → 1.7.1)
- [fix] Fix cookie collision when a browser holds both a legacy host-only cookie and the newer domain-scoped cookie under the same name: `AccessCookieService` and `RefreshTokenService` now defensively clear the host-only variant before setting or clearing the domain-scoped one; without this the browser could silently deliver the stale host-only value, causing JWT verification failures (access cookie) or false token-theft revocations (refresh cookie)

## v1.7.0 (2026-04-16)

### @createrington/server (1.6.2 → 1.7.0)
- [add] Add cross-subdomain SSO flow with access token cookie: new auth controller issues a short-lived `access_token` cookie on `/auth/sso/token` so the production app and dev subdomain can share a session without re-authenticating; the entire surface is gated on the presence of a `COOKIE_DOMAIN` env var and falls through to the existing JWT flow when absent
- [add] Add player prompts system: admins can create Discord-modal-based prompts (questions, surveys, acknowledgements) and send them to players; responses are captured via a new Discord button/modal interaction flow, stored in the DB, and browsable in the admin UI with a dedicated Prompts management page including role/channel pickers and per-response detail views
- [refactor] Split `db/schema.ts` into per-domain files: the monolithic 1 750-line schema file is broken out into `schema/player.ts`, `schema/discord.ts`, `schema/crypto.ts`, `schema/auth.ts`, etc.; no behaviour change, purely an organisational refactor
- [chore] Add CI test job and bootstrap server unit test suite: Gitea Actions workflow runs `pnpm test:unit` on every push; 30+ unit test files cover format/id helpers, DB error classes, query helpers, embed builders, Discord utilities, crypto services, JWT, SSO, access-cookie service, and more

### @createrington/client (0.2.3 → 0.2.4)
- [add] Add Admin Prompts management pages: new `AdminPrompts` list page and `PromptDetail` page let admins create, view, and delete prompts; `CreatePromptModal` supports configuring question text, response type (modal/reaction), target role/channel, and scheduling; response rows show per-player answers inline
- [refactor] Redesign admin chat UI and split into focused components: `AdminChat.tsx` is decomposed into `ChatPanel`, `MessageList`, `MessageRow`, `MessageInput`, `ChatHeader`, `ChatToggle`, `EmptyState`, `TypingIndicator`, `MentionMenu`, and `AssistantMarkdown`; message grouping for consecutive same-author messages reduces visual noise; tooltips, avatar display, and copy-focus behaviour are improved
- [add] Add lazy route loading with per-feature error boundaries: all admin route components are now code-split via a `lazyWithBoundary` helper, reducing initial bundle size and containing render crashes to individual feature panels; `ApplyToJoin` is migrated to React Hook Form + Zod validation
- [refactor] Polish nav-user dropdown: refined layout, spacing, and avatar presentation in the sidebar user menu
- [refactor] Polish base Button component: add press scale animation, destructive-variant icon wiggle, and consistent cursor styling; remove redundant `cursor-pointer` from consuming components
- [fix] Fix input dark color-scheme: base `Input` now explicitly sets `color-scheme: dark` so browser-native controls (date pickers, number spinners) respect the dark theme
- [fix] Fix web chat accents: chat UI accent colors updated from blue to gold to match the site palette
- [fix] Fix web chat entry flicker and loading chrome: prevent flash of unstyled content on initial chat load by showing the chrome skeleton while data is in flight
- [fix] Fix player list cache invalidation after deletion: deleting a player now correctly busts the admin players list query so the removed entry disappears without a manual refresh

## v1.6.2 (2026-04-14)

### @createrington/server (1.6.1 → 1.6.2)
- [add] Add legacy trains crash route (`POST /api/legacy/trains/crash`) for pre-mod-JWT mod clients: mirrors the secured `/api/trains/crash` endpoint but requires only server IP verification, allowing older mod builds to keep reporting train crashes without a code update; returns the same flat `{ success: true }` response the mod expects

## v1.6.1 (2026-04-14)

### @createrington/server (1.6.0 → 1.6.1)
- [add] Add legacy currency routes (`/api/legacy/currency`) mirroring all `/api/currency` endpoints but returning flat response payloads (no `ApiResponse` envelope): allows pre-envelope mod clients to keep working by pointing at the legacy base URL via config, without needing a code update

## v1.6.0 (2026-04-14)

### @createrington/server (1.5.0 → 1.6.0)
- [add] Add Createrington Assistant (admin chat) backend proxy: new `/api/admin-chat` routes forward admin requests to the claude-automation upstream over SSE, keeping the shared secret server-side and deriving identity from the authenticated JWT so browsers never see credentials
- [add] Add forceloads sync endpoint (`POST /api/forceloads/sync`) for the opac-teams Minecraft mod: accepts a full-state payload of player and party chunk data (secured with mod JWT + server IP) and replaces the stored forceload state for the originating server; backed by new DB tables and query classes for forceload parties, members, and chunks
- [refactor] Replace waitlist invitation tokens with per-applicant Discord invites: each accepted applicant now receives a unique, expiring Discord invite link (1 hour for auto-accepted, 7 days for manual invites) rather than a one-time token; the bot seeds an invite-use cache on startup and diffs guild invite counts on member-join to identify which invite was consumed and auto-trigger registration
- [add] Add button + modal registration flow: new Discord interaction handlers allow applicants to self-register via a button in their invite DM, eliminating the need to run a slash command
- [refactor] Standardise `/api/currency` endpoints on a shared response envelope: all currency mod endpoints now return `{ success, message, playerMessage?, data? }` via a new `respondSuccess` helper, providing a consistent shape for the Java client to parse
- [add] Add mod JWT authentication to `POST /api/trains/crash`: the endpoint now requires a valid mod JWT token, bringing it in line with other secured mod endpoints
- [refactor] Make `name` optional on `POST /api/currency/login`: the field is now a no-op (username is always taken from the JWT); making it optional prevents breaking existing mod clients that still send it
- [add] Add forceloads tRPC admin router: new `admin.forceloads` procedures expose per-player and per-party chunk lists and stats for the admin dashboard
- [add] Add waitlist cleanup service: a scheduled job purges orphaned waitlist entries (applicants who never joined after receiving an invite) and resets their status so the slot is freed
- [chore] Replace Node.js `--watch` with a chokidar-based dev watcher (`scripts/dev-watch.mjs`): eliminates spurious self-restarts on Windows caused by the native file watcher
- [security] Fix regex metacharacter injection in CLI scripts: user-supplied strings passed to `RegExp` constructors are now escaped, preventing accidental pattern breakage
- [security] Move render page secret from query parameter to request header: avoids the secret appearing in server logs or browser history
- [refactor] Unify mod-api Maven artifact publishing under `createrington-api` and trigger publication on any version bump to `gradle.properties`

### @createrington/client (0.2.2 → 0.2.3)
- [add] Add Forceloads admin tool: new admin page displays forceloaded chunks per player and per party, with sortable tables, stats cards, and an empty state; data is fetched from the new `admin.forceloads` tRPC procedures
- [add] Add Createrington Assistant chat widget: floating chat bubble in the admin area that streams replies from the claude-automation backend via SSE, supports action envelopes (`highlight`, `insert_embed`) to interact with the embed builder, renders markdown replies, persists action cards across sessions, and offers `@-mention` autocomplete for Createrington repos
- [add] Add footer with social links: site footer now includes Discord and CurseForge icon links
- [security] Validate Stripe checkout URL hostname strictly: the client now rejects redirect URLs that don't match the expected Stripe hostname, preventing open-redirect abuse
- [chore] Remove stale sidebar components and market entry that were no longer used

## v1.5.0 (2026-04-11)

### @createrington/server (1.4.0 → 1.5.0)
- [add] Add `/profile`, `/activity`, and `/top` Discord slash commands that generate and post rendered player stat cards (profile summary, playtime heatmap, and leaderboard podium respectively)
- [add] Add server-side render API endpoints (`/api/render/profile`, `/api/render/activity`, `/api/render/top`, `/api/render/compare`) that serve headless-rendered card pages for Discord embeds
- [add] Add mod API Java library generator (`generate-mod-api`) that produces typed Java records and endpoint constants from structured spec files; initial spec files cover the `currency`, `presence`, and `trains` modules
- [add] Add API documentation generator script (`generate-api-docs`) that produces `docs/api-reference.md` from spec files and JSDoc source parsing
- [add] Add `/command-docs-panel` owner slash command that posts a persistent Discord embed listing all available commands, organised by group
- [refactor] Replace hardcoded Discord command docs in the guides with dynamically fetched command data via a new `public.discordCommands` tRPC router, keeping the client always in sync with the actual command registry
- [refactor] Improve `command-docs-panel` embed layout and design
- [chore] Guard rotating status service and structure pack rotation service so they are skipped in the dev environment, avoiding unintended Discord/server side effects during local development
- [chore] Set up CI workflow for automated mod API library publishing to Maven when spec files change

### @createrington/client (0.2.1 → 0.2.2)
- [add] Add `ActivityRender`, `ProfileRender`, and `TopRender` headless pages used by the Discord slash commands to render player stat cards as images
- [refactor] Switch profile and compare render pages to use the starlightskins API for Minecraft skin rendering, replacing the previous skinview3d library
- [add] Add `skin-utils.ts` with a curated pool of verified skin poses for render card variety
- [refactor] Replace hardcoded Discord commands guide content with dynamically loaded command data fetched from the server, so the guide always reflects the current command list
- [fix] Fix command docs tool to show an inline loading spinner while commands are being fetched

## v1.4.0 (2026-04-10)

### @createrington/server (1.3.0 → 1.4.0)
- [add] Add `admin.changelog.get` tRPC endpoint: reads `CHANGELOG.md` from the project root and returns its raw content to authenticated admin clients; logs a warning on read failure instead of crashing

### @createrington/client (0.2.0 → 0.2.1)
- [add] Add Changelog page to admin area: collapsible timeline UI that parses and renders all release entries from the project CHANGELOG.md, with expandable version sections and a "Latest" badge on the most recent release
- [add] Show app version badge in sidebar footer: admins see the current version number (injected from root `package.json` at build time via Vite `define`) as a clickable link to the Changelog page; hidden when the sidebar is collapsed
- [add] Add Changelog shortcut to user dropdown: admins can navigate directly to the changelog from the nav-user dropdown alongside the existing Admin Panel link
- [chore] Remove deprecated `baseUrl` from TypeScript config: aligns tsconfig with Vite 6 path-alias recommendations and eliminates compiler warnings
- [chore] Copy `CHANGELOG.md` to dist during production build: ensures the server can locate and read the changelog file at the expected path in deployed environments

## v1.3.0 (2026-04-10)

### @createrington/server (1.2.0 → 1.3.0)
- [add] Add crypto net worth Discord leaderboard: a new `CRYPTO_NETWORTH` leaderboard type displays players ranked by their total crypto portfolio value, posted to the leaderboards channel and refreshed on the same hourly schedule as the playtime leaderboard
- [refactor] Make `serverId` optional in leaderboard config: non-server leaderboards (like crypto) don't require a Minecraft server ID; the config type now reflects this and call sites default to `0` when unset
- [fix] Fix stale leaderboard message handling: when a Discord message has been deleted externally, editing it now returns a structured error instead of throwing; the service detects "not found" errors, deletes the stale DB record, and re-creates the message cleanly rather than crashing the refresh cycle

## v1.2.0 (2026-04-09)

### @createrington/server (1.1.1 → 1.2.0)
- [add] Add admin inactivity management tRPC router: new `admin.inactivity` procedures expose paginated warning lists (filterable by status and username), summary stats, manual resolve/remove actions, and a force-trigger for the cleanup cycle
- [refactor] Extract shared `removeInactiveWarning` helper: consolidates the full removal sequence (Discord guild kick → RCON whitelist removal → player DB delete → warning marked removed) into a single reusable function used by both the scheduled cleanup and the new manual-remove endpoint
- [add] Add owner-only `/force-inactivity-cleanup` Discord slash command to trigger the cleanup cycle on demand without waiting for the next scheduled run
- [fix] Enable inactivity cleanup service on real production only: the guard now checks both `isProd` and `!isDevDeployment` so the dev deployment (dev.createrington.com, which runs with `NODE_ENV=production`) is excluded
- [chore] Fix tsconfig `rootDir` and `baseUrl` deprecation errors: set explicit `rootDir: ".."`, remove deprecated `baseUrl`, and normalize `@/*` path alias to `./src/*`

### @createrington/client (0.1.2 → 0.2.0)
- [add] Add Inactivity Management admin tool: full-page UI with status-tab navigation (active / expired / resolved / removed), paginated warning table, stats summary cards, and modal dialogs to manually resolve or remove individual warnings; destructive actions are gated to the production environment
- [add] Add player-facing Structure Packs voting page: players can browse available packs, see which is currently active, boost packs with votes, and inspect the full mod list for each pack via an inline dialog
- [add] Add pack mod list inspect dialog: pack cards in the admin and player views now include an "Inspect" button that opens a scrollable dialog listing all mods in the pack
- [refactor] Rework admin tools page into a grouped compact list: tools are now organised under collapsible category headers with a compact row layout, replacing the previous icon-grid
- [refactor] Overhaul chat new-message highlight animation: simplify to a single CSS `highlight-bg` keyframe animation per message group, removing the previous group-border-stitching logic (`prevHighlighted`/`nextHighlighted` props) that caused visual glitches
- [fix] Fix number input spinner arrows: hide browser-default increment/decrement arrows on `<input type="number">` elements via global CSS
- [fix] Fix chat highlight layout shift: prevent the highlight animation from causing content reflow by adjusting positioning and transition approach

## v1.1.2 (2026-04-07)

### @createrington/server (1.1.0 → 1.1.1)
- [refactor] Suppress notifications for FAQ auto-reply embeds: both inline replies in the questions channel and standalone FAQ welcome messages now use the `SuppressNotifications` flag so they no longer ping users
- [add] Add `flags` support to the shared Discord message service so any caller can pass message flags (e.g. silent sends)

### @createrington/client (0.1.1 → 0.1.2)
- [refactor] Rework new-message highlighting in server chat: highlights now apply at the message-group level with a bordered container that visually connects consecutive highlighted groups, replacing the old per-row left-bar indicator
- [refactor] Use CSS `animationEnd` event to clean up highlights after the fade-out completes, removing the previous `setTimeout`-based cleanup that could leave stale highlights or clear them too early

### Tooling
- [chore] Set up pre-commit hook with Husky + lint-staged to auto-format staged files with Prettier
- [chore] Disable Husky in CI to avoid hook failures in workflows
- [chore] Update pnpm from 10.29.3 to 10.33.0

## v1.1.1 (2026-04-05)

### @createrington/client (0.1.0 → 0.1.1)
- [fix] Fix teleport command in admin player detail: remove the player username from the `/tp` command so it copies as `/tp x y z` instead of `/tp username x y z`, matching the expected in-game format

## v1.1.0 (2026-04-05)

### @createrington/server (1.0.1 → 1.1.0)
- [add] Add stat search tool with cross-category comparison: new `searchItems` and `compareItem` query methods let admins search for any Minecraft item key and compare counts across categories (e.g. picked up vs crafted) for all players, exposed via two new tRPC admin procedures
- [add] Store player logout position (x/y/z coordinates and dimension): when a player disconnects, their last position is persisted to the `player` table and used to display location info in the admin panel
- [fix] Validate mod position payload fields and preserve logout position during graceful server shutdown

### @createrington/client (0.0.1 → 0.1.0)
- [add] Add Stat Search admin tool page: full-featured UI with item autocomplete, multi-category toggle, sortable comparison table, and suspicious-pattern highlighting (e.g. high pickup but zero crafted)
- [add] Display player logout position in the admin player header: shows last known coordinates and dimension with a one-click `/tp` command copy button (only visible for offline players)
- [add] Add Stat Search entry to the admin tools grid

## v1.0.1 (2026-04-04)

### @createrington/server (1.0.0 → 1.0.1)
- [security] Tighten metadata validation across bans, strikes, and waitlist endpoints: replace permissive `z.any()` with a strict primitive union (`string | number | boolean | null`) to prevent arbitrary object injection
- [refactor] Return human-readable relative time (e.g. "2 hours 15 minutes") in daily reward cooldown error responses instead of raw error strings
- [refactor] Balance memecoin price engine to prevent upward drift: tighten mean reversion thresholds, increase correction strength, and neutralize upward bias in low/micro price tiers
- [chore] Skip AI article generation on dev deployments to avoid unnecessary OpenAI API costs
- [security] Bump nodemailer from v7 to v8 and add dependency overrides to resolve all pnpm audit vulnerabilities

### @createrington/client (0.0.0 → 0.0.1)
- [fix] Fix vertical scroll bleed on player tabs mobile menu by adding `overflow-y-hidden`
- [refactor] Replace broken `SignalZero` icon with `WifiOff` on the online players page offline state
