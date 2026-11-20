# Rocket

Rocket is a personal media library for anime, manga, movies, books, and games. It is built with React Native and Expo, and stores library data on the device with SQLite.

## Run locally

```sh
npm install
npx expo start
```

Use Expo Go to open the development server on a device, or press `a` in the terminal to launch an Android emulator. The `npm run android` script starts Expo and targets Android directly.

## Git hooks

Use Node.js 22.13 or newer. `npm install` installs the Husky hooks; run
`npm run prepare` to reinstall them if needed.

- **Pre-commit:** `npm run check -- --staged --no-errors-on-unmatched` runs Biome on staged file paths without auto-fixing.
- **Pre-push:** `npm test`, `npm run typecheck`, and `npm run build` run the tests, check TypeScript, and export a production Android bundle locally. This does not need an Expo account or build an APK.

## Build an Android APK

Sign in to your Expo account on the first run, then start the cloud build:

```sh
npx --yes eas-cli@27.10.0 login
npm run build:apk
```

If prompted, link or create the EAS project and let EAS generate or select an
Android signing key. Keep the same key for future updates. The `preview` profile
in `eas.json` builds a standalone APK for direct installation, not a Play Store
bundle. Download the APK from the build link and open it on your Android device,
or install it with `adb install path/to/rocket.apk`.

See Expo’s [APK build guide](https://docs.expo.dev/build-reference/apk/).

## Current features

- Add and edit titles with alternate titles, cover image URL, summary, creator, and release year.
- Track Planned, In Progress, Completed, Paused, Dropped, or Revisiting status.
- Keep a private note and dated journal entries for each title.
- Organize titles into custom lists; browse as cards or rows and filter by type, status, or list.

All entries are stored locally in `rocket.db`. Catalog lookup is optional; no account or network connection is required for the local library. Cross-device sync is not implemented.

## Back up your library

Open **Settings → Backup & Restore**. Export a readable `.json` file and save it to a folder or use the system share sheet. Backups are **not encrypted**: keep them private. They preserve the library, list order, notes, journals, ratings, and cover URLs, but not artwork files or provider credentials.

Restore previews a selected backup before making changes. Confirming replaces the current library rather than merging it. Consider exporting a recovery copy first. See [the backup format](docs/backup-format.md) for interoperability.
