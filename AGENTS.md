# Rocket Agent Guide

## Before coding

- Read the exact Expo SDK 58 docs for any Expo API or dependency you change: https://docs.expo.dev/versions/v58.0.0/ . Read the relevant versioned page, not unversioned or older docs.
- Read `DESIGN.md` before changing product UI. It is the source of truth for visual direction, product scope, and interaction expectations.
- Inspect existing components and model before replacing behavior. Keep changes focused and preserve unrelated working-tree edits.

## Product constraints

- Rocket is an offline-first personal library for anime, manga, movies, books, and games.
- SQLite is the source of truth. Never add sample titles, mock collections, catalog/discovery UI, login, sync claims, ratings, or social features unless explicitly requested.
- A list is a grouping of library entries, not an owner of them. Removing a membership or deleting a list must never delete its media entry, note, or journal. Entry edits must preserve existing list order; new memberships append.
- Keep status labels explicit: Planned, In Progress, Completed, Paused, Dropped, Revisiting.
- Maintain accessible labels/states and touch targets of at least 44 dp. Do not communicate status by color alone.

## Project map

- `App.tsx`: app state, navigation, database orchestration, and modal wiring.
- `src/database.ts`: shared Expo SQLite connection, schema, and migrations. Preserve existing user data when changing schema.
- `src/repositories/`: persistence APIs for entries, lists, journals, and transactional library backup/restore. UI code uses these APIs instead of SQLite.
- `src/model.ts`: shared media, journal, list, accent, and status types.
- `src/screens/`: Library, Lists, list creation/detail, and entry forms/details.
- `src/components/MediaUI/`: shared media and navigation controls.
- `src/theme.ts`: shared visual tokens. Give screens and components their own folders with `index.ts` entry points and a local `styles.ts` when needed. Keep reused style sheets in `components/shared/` or `screens/shared/`.
- `DESIGN.md`: product/UI design brief.

Use `npx expo install <package>` for Expo-compatible native dependencies. Gesture handling is rooted at `GestureHandlerRootView`; Reanimated is Expo-configured. Avoid adding dependencies when platform or existing APIs suffice.

## Validation

- Run `npx tsc --noEmit` after TypeScript changes.
- Run `git diff --check` before finishing.
- Do not claim device-level visual or interaction testing unless actually performed.
