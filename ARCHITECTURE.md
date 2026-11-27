# Rocket architecture

Rocket is an offline-first Android media library built with React Native and Expo. The local SQLite database is the source of truth for the library. Catalog lookup and remote cover images can use the network, but neither is required to add, edit, or organize titles.

## Where changes belong

| Layer | Responsibility |
| --- | --- |
| [`App.tsx`](App.tsx) | Coordinates app state, navigation, modals, and repository calls. Loads the library and passes data and callbacks to screens. |
| [`src/screens/`](src/screens/) and [`src/components/`](src/components/) | Render the UI and handle interactions. Screen state such as search or layout is not the persisted library. Shared visual tokens live in [`src/theme.ts`](src/theme.ts). |
| [`src/model.ts`](src/model.ts) | Defines shared media, draft, list, and journal types and domain helpers. |
| [`src/repositories/`](src/repositories/) | Owns SQL reads and writes, row mapping, and transactions for entries, lists, journals, and backups. UI code does not issue SQL. |
| [`src/database.ts`](src/database.ts) | Opens `rocket.db`, runs schema setup and migrations, and shares the resulting connection across repositories. If initialization fails, a later call can retry. |

## Example: saving a title

1. The [entry form](src/screens/EntryModals/) edits a draft, not the saved entry directly.
2. `App.tsx` validates the submission and calls [`entryRepository.save`](src/repositories/entryRepository.ts). The repository writes the entry and its membership changes in one transaction. An optional new journal entry is saved separately through the [journal repository](src/repositories/journalRepository.ts).
3. `App.tsx` reloads entries, lists, and list order from the repositories after a successful save. Library search and filters run over the loaded collection; `FlatList` only limits which cards and rows are rendered, not which titles can be found.

## Data rules to preserve

- **Lists group titles; they do not own them.** `entry_lists` links media entries to lists and stores each list's order. Removing a membership or deleting a list must leave the title, note, and journal intact. Deleting a title removes its note, journal entries, and memberships.
- **Lists have a fixed media type.** SQLite triggers enforce compatible membership. A title's type can change after its incompatible memberships are removed. Retained memberships keep their order; new memberships append.
- **Schema changes must preserve existing user data.** Update the migration and row mapping as needed, and check whether the change affects backup export or older backup imports. Test upgrades from an existing database, not only creation of an empty one.

## Catalog lookup and backups

- **Catalog lookup:** [`src/catalogSearch.ts`](src/catalogSearch.ts) coordinates search, pagination, and preview through the adapters in [`src/providers/`](src/providers/). Import fills a draft for review; it does not save a title by itself. Provider credentials live separately in SecureStore through [`src/providerCredentials.ts`](src/providerCredentials.ts).
- **Backup and restore:** [`src/backupFiles.ts`](src/backupFiles.ts) handles file access, [`src/backup.ts`](src/backup.ts) defines and validates the JSON format, and the [backup repository](src/repositories/backupRepository.ts) takes a consistent snapshot or replaces the local library in a single transaction. Restore does not merge libraries. Backups exclude credentials and image files. See the [backup format](docs/backup-format.md) for compatibility details.

## Related guides

- [Development](docs/development.md) — run, test, and build Rocket.
- [Code style](CODE_STYLE.md) — file organization and coding conventions.
- [Design brief](DESIGN.md) — product scope, visual direction, and interaction rules.
- [Agent guide](AGENTS.md) — repository instructions and validation requirements.
