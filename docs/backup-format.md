# Rocket backup format v1

An unencrypted UTF-8 JSON document with `format: "rocket-backup"`, `version: 1`, `exportedAt` (UTC ISO timestamp with milliseconds), and three arrays:

- `entries`: `id`, `type`, `title`, `alternateTitles`, `coverUri`, `summary`, `creator`, `creatorRole`, `releaseYear`, `rating`, `duration`, `sourceUrl`, `status`, `note`, `updatedAt`. Optional numeric values are `null`; absent text uses `""`. Duration is an integer in the app's units for the media type; games have no duration.
- `lists`: `id`, `name`, `type`, `createdAt`, `description`, `accent`, `icon`, `entryIds`. The order of `entryIds` is the display order; it is the only source of membership in the file.
- `journals`: `id`, `mediaId`, `body`, `createdAt`.

IDs are unique per collection. List names must be unique under SQLite's `NOCASE` collation. Memberships must reference existing titles of the list's type and may not repeat within a list. Journal entries must reference an existing title. Enum values match `src/model.ts`. Rocket rejects unknown versions and files larger than 16 MiB. This validation is structural, not cryptographic authentication.

Rocket reads and writes only library records; it does not export or restore provider credentials, access tokens, image files, or app settings. Import is replace-only, validated before confirmation, and committed atomically. You can inspect or process the file with any JSON tool.
