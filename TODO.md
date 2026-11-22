# Rocket TODO

Ordered build checklist for the first usable release and later phases. Keep [PLAN.md](./PLAN.md) as the product scope and [DESIGN.md](./DESIGN.md) as the visual and interaction brief.

## Foundation already in place

- [x] Create the app with `create-expo-app` using React Native and TypeScript.
- [x] Set the app name to Rocket and configure Expo SQLite.
- [x] Define media types, statuses, creator roles, and local models.
- [x] Implement local entry CRUD, custom lists, list membership, notes, and dated journal storage.
- [x] Build an initial Library/Lists interface with search, filters, cover cards, compact rows, and add/edit flows.
- [x] Document product scope and the intended UI direction.
- [x] Export Google Stitch mockups for the covers library, table library, title details, add-title form, and collections, with a shared `DESIGN.md` (`stitch_rocket_media_shelf/`).

## Phase 1: Make the local library dependable

- [x] Keep app orchestration, screens, modals, reusable controls, theme tokens, and styles in focused modules under `src/`.
- [x] Review `stitch_rocket_media_shelf/rocket_void_ui/DESIGN.md` and its screen mockups alongside `DESIGN.md`; use the Stitch screens as visual references, not runnable app screens.
- [x] Port the selected Stitch visual language into native React Native components. Do not copy the exported HTML/Tailwind implementation directly into the Expo app.
- [x] Reconcile the Stitch screens with product scope before porting: remove episode/chapter/page/runtime/playthrough progress, ratings, catalog counts, barcode/provider lookup, profile/account UI, cloud/sync claims, and any discovery controls. Use only the agreed six statuses and current entry fields.
- [x] Treat titles, cover art, journal text, dates, counts, and list names shown in mockups as illustrative only; do not seed the actual library with mock content.
- [x] Keep notes enduring and journal items date-stamped as specified in `DESIGN.md`.
- [x] Replace the current compact row toggle with the specified **Covers / Table** views. Use aligned columns on wide screens and readable thumbnail rows on phones.
- [x] Implement the entry detail screen: cover and title, alternate titles, status, media facts, summary, note, and journal in the specified hierarchy.
- [x] Make status changes available from details without reopening the full form. Keep the six statuses consistent everywhere: Planned, In Progress, Completed, Paused, Dropped, Revisiting.
- [x] Complete journal flow: add a dated entry from details, persist it, refresh the displayed journal immediately, and keep it distinct from the enduring note.
- [x] Improve add/edit form behavior: clear validation for title and year, preserve values on errors, update creator-role label on type changes, and keep the focused field and Save action visible above the keyboard.
- [x] Improve cover handling: validate usable image URLs, show previews, and show a designed type-aware fallback on missing or failed images.
- [x] Complete empty, no-results, loading, and database-error states with direct user actions and actionable copy.
- [x] Implement Lists navigation, dedicated creation and per-list detail pages, unique names, optional descriptions, accent selection, library membership selection, real membership previews, and direct membership edits.
- [x] Add accessible names and selected states, maintain at least 44 dp touch targets.
- [x] Check text contrast and screen-reader order on device.
- [x] Confirm local data remains available after app restarts and schema changes preserve existing entries.

### Phase 1 acceptance

- [x] Add, edit, search, filter, change status, and remove entries for all five media types without a network connection.
- [x] Verify cards and table/phone-row views show title, cover, type, year, and status clearly.
- [x] Confirm no screen implies account sign-in, sync availability, discovery, catalog lookup, ratings, or progress tracking in the local-first release.
- [x] Create lists with unique names, descriptions, accents, and optional initial titles; add/remove memberships and delete lists without deleting library entries, notes, or journal entries.
- [x] Drag titles to reorder within a list; verify order persists after restart, entry edits preserve order, and new memberships append.
- [x] Save a note and multiple dated journal entries, restart the app, and confirm all content remains.
- [x] Check the experience on a small Android phone and a wider screen; confirm keyboard, touch, and screen-reader behavior.

## Phase 2: Add optional catalog lookup

### Requested personal metadata additions

- [x] Persist optional user-owned 1–5-star ratings with add/edit and quick detail controls; never import provider scores.
- [x] Offer 16 Lucide list icons during creation and from list details; retain existing memberships and ordering.
- [x] Persist optional total pages, chapters, movie minutes, or episodes; show duration after creator in the fact rail and import known provider totals. Games have no duration field yet.
- [x] Verify rating, duration, and list-icon controls and persistence on device.

### Catalog providers

- [x] Add the native Lookup & Import screen with query input, provider filters, an empty results state, and an import tray; keep manual entry available. UI only: no API requests or metadata import yet.
- [x] Define a provider adapter and normalized catalog result model, separate from the user-owned library entry. Provider metadata must never silently overwrite user edits.
- [x] Choose Tenrai's public MyAnimeList catalog API for anime and manga; review its documented limits and terms. Implement keyless title search, pagination, previews, source links, caching, paced requests, and form import without importing ratings or consumption progress.
- [x] Add movie lookup with OMDb: saved user key, movie title/IMDb ID search, pagination, full-detail preview, and confirmed form import without automatic saving.
- [x] Add book lookup with Open Library first and Google Books as a fallback: title/author/ISBN search, pagination, previews, source links, and confirmed form import. Open Library needs no key; Google Books uses the saved Books key.
- [x] Add game lookup with IGDB using each user's personal Twitch developer credentials in SecureStore, memory-only access tokens, title search, pagination, previews, and confirmed metadata import. Leave game duration blank and ratings user-owned.
- [x] Add a permanent Settings → Credits page with an IGDB backlink.
- [x] Make lists single-media-type collections: fixed type at creation, compatible title/membership pickers, and SQLite enforcement. Entry type changes detach incompatible memberships without deleting library data.
- [x] Add long-press action sheets for titles and lists, outside-tap dismissal, real status/membership controls, independent list duplication, and existing deletion confirmations that return to the original view on Cancel. Keep drag ordering in an explicit Reorder titles mode and label list-detail removal.
- [x] Verify context sheets, outside taps, deletion cancellation, status/list updates, duplication, and reorder mode on device in cover and table layouts.
- [x] Verify IGDB search, token refresh, credential removal, Credits, and form import on device with real personal Twitch credentials.
- [x] Design an optional “Find a title” flow that returns selected metadata to the existing add form. Keep manual entry and cover URL input available at every point.
- [x] Handle no results, provider errors, rate limits, missing covers, and offline mode without blocking local saves.
- [x] Decide how API credentials are supplied; do not embed private provider secrets in the mobile bundle. Add a small backend/proxy only if a provider requires protected credentials.
- [x] Preserve source attribution or provider links where required by provider terms.

Phase 2 acceptance is complete. The user confirmed live provider testing, failure/offline behavior, and attribution review.

## Phase 3: Local backup and restore

- [x] Implement local Backup & Restore with portable unencrypted JSON, a validated preview, optional recovery export, and transactional replacement.
- [ ] Verify offline round-trip export/restore with the Android file picker and share sheet on a device, including restore into a fresh install and persistence after restart.

## Deferred: Cross-device sync

- [ ] Compare sync options, account requirements, recurring cost, privacy, and Android support before selecting a service.
- [ ] Specify account sign-in, device enrollment, offline edits, conflict resolution, deletion propagation, and recovery behavior.
- [ ] Add stable sync metadata and schema migrations without making network access necessary for reading or editing the local library.
- [ ] Implement sync only after the data and recovery rules are documented; show sync state and errors without blocking local use.

## Later, only if requested

- [ ] Revisit discovery, recommendations, ratings, social features, and consumption progress only if product scope changes.
- [x] Add Husky Git hooks: Biome on staged files before commit; tests, type checking, and local Android bundle export before push.
- [x] Add the [EAS APK build profile](https://docs.expo.dev/build-reference/apk/) and document `npm run build:apk`.
- [x] Split SQLite persistence into repositories for entries, lists, journals, and backup/restore.
- [x] Change styling structure, so everything doesn't stay on a single styles.ts
- [x] Standard interface for providers
  - [x] Migrate OMDb to a class implementing the shared contract, with provider-owned pagination and adapter ID routing.
  - [x] Migrate IGDB to a registry-owned adapter class with private session, queue, and rate-limit state.
  - [x] Migrate Tenrai Anime and Manga to separate adapters backed by one shared client.
  - [x] Migrate Books to one adapter that owns source selection, fallback, and pagination.
  - [x] Move multi-provider search out of the lookup screen.
- [ ] Different themes
- [ ] Verify SHA-256 for backup file
- [ ] Create documentation
