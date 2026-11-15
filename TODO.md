# Rocket TODO

Ordered build checklist for the first usable release and later phases. Keep [PLAN.md](./PLAN.md) as the product scope and [UI_DESIGN.md](./UI_DESIGN.md) as the visual and interaction brief.

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
- [x] Review `stitch_rocket_media_shelf/rocket_void_ui/DESIGN.md` and its screen mockups alongside `UI_DESIGN.md`; use the Stitch screens as visual references, not runnable app screens.
- [x] Port the selected Stitch visual language into native React Native components. Do not copy the exported HTML/Tailwind implementation directly into the Expo app.
- [x] Reconcile the Stitch screens with product scope before porting: remove episode/chapter/page/runtime/playthrough progress, ratings, catalog counts, barcode/provider lookup, profile/account UI, cloud/sync claims, and any discovery controls. Use only the agreed six statuses and current entry fields.
- [x] Treat titles, cover art, journal text, dates, counts, and list names shown in mockups as illustrative only; do not seed the actual library with mock content.
- [x] Keep notes enduring and journal items date-stamped as specified in `UI_DESIGN.md`.
- [x] Replace the current compact row toggle with the specified **Covers / Table** views. Use aligned columns on wide screens and readable thumbnail rows on phones.
- [x] Implement the entry detail screen: cover and title, alternate titles, status, media facts, summary, note, and journal in the specified hierarchy.
- [x] Make status changes available from details without reopening the full form. Keep the six statuses consistent everywhere: Planned, In Progress, Completed, Paused, Dropped, Revisiting.
- [x] Complete journal flow: add a dated entry from details, persist it, refresh the displayed journal immediately, and keep it distinct from the enduring note.
- [x] Improve add/edit form behavior: clear validation for title and year, preserve values on errors, update creator-role label on type changes, and keep the focused field and Save action visible above the keyboard.
- [x] Improve cover handling: validate usable image URLs, show previews, and show a designed type-aware fallback on missing or failed images.
- [x] Complete empty, no-results, loading, and database-error states with direct user actions and actionable copy.
- [x] Hide Lists navigation and list-membership editing until the feature is ready; preserve existing list records and entry memberships when entries are edited.
- [x] Add accessible names and selected states, maintain at least 44 dp touch targets.
- [ ] Check text contrast and screen-reader order on device.
- [ ] Confirm local data remains available after app restarts and schema changes preserve existing entries.

### Phase 1 acceptance

- [ ] Add, edit, search, filter, change status, and remove entries for all five media types without a network connection.
- [ ] Verify cards and table/phone-row views show title, cover, type, year, and status clearly.
- [x] Confirm no screen implies account sign-in, sync availability, discovery, catalog lookup, ratings, or progress tracking in the local-first release.
- [ ] Revisit Lists UI when the feature is ready; verify retained list records and memberships remain intact.
- [ ] Save a note and multiple dated journal entries, restart the app, and confirm all content remains.
- [ ] Check the experience on a small Android phone and a wider screen; confirm keyboard, touch, and screen-reader behavior.

## Phase 2: Add optional catalog lookup

- [ ] Define a provider adapter and normalized catalog result model, separate from the user-owned library entry. Provider metadata must never silently overwrite user edits.
- [ ] Investigate Tenrai and MyAnimeList API availability, access requirements, terms, and coverage; choose a provider for anime and manga.
- [ ] Add movie lookup with OMDb.
- [ ] Add book lookup with Open Library first and Google Books as a fallback.
- [ ] Add game lookup with RAWG. Do not use IGDB because it requires Twitch credentials the user does not want.
- [ ] Design an optional “Find a title” flow that returns selected metadata to the existing add form. Keep manual entry and cover URL input available at every point.
- [ ] Handle no results, provider errors, rate limits, missing covers, and offline mode without blocking local saves.
- [ ] Decide how API credentials are supplied; do not embed private provider secrets in the mobile bundle. Add a small backend/proxy only if a provider requires protected credentials.
- [ ] Preserve source attribution or provider links where required by provider terms.

## Phase 3: Plan sync and backup

- [ ] First define backup/export and restore so users can protect local data independently of sync.
- [ ] Compare sync options, account requirements, recurring cost, privacy, and Android support before selecting a service.
- [ ] Specify account sign-in, device enrollment, offline edits, conflict resolution, deletion propagation, and recovery behavior.
- [ ] Add stable sync metadata and schema migrations without making network access necessary for reading or editing the local library.
- [ ] Implement sync only after the data and recovery rules are documented; show sync state and errors without blocking local use.

## Later, only if requested

- [ ] Revisit discovery, recommendations, ratings, social features, and consumption progress only if product scope changes.
