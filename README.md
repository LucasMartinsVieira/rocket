# Rocket

Rocket is a personal media library for anime, manga, movies, books, and games. It is built with React Native and Expo, and stores library data on the device with SQLite.

## Run locally

```sh
npm install
npx expo start
```

Use Expo Go to open the development server on a device, or press `a` in the terminal to launch an Android emulator. The `npm run android` script starts Expo and targets Android directly.

## Current features

- Add and edit titles with alternate titles, cover image URL, summary, creator, and release year.
- Track Planned, In Progress, Completed, Paused, Dropped, or Revisiting status.
- Keep a private note and dated journal entries for each title.
- Organize titles into custom lists; browse as cards or rows and filter by type, status, or list.

All entries are stored locally in `rocket.db`. Catalog provider integration and cross-device sync are future work; no account or network connection is required for the current library.
