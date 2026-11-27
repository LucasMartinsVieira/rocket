---
title: Development
---

[Documentation home](index.md)

# Development

Rocket uses React Native, Expo SDK 58, and SQLite. Use **Node.js 22.13 or newer**.

See [Architecture](https://github.com/LucasMartinsVieira/rocket/blob/main/ARCHITECTURE.md) for the source layout and how the app stores library data, and [Code style](https://github.com/LucasMartinsVieira/rocket/blob/main/CODE_STYLE.md) for coding conventions.

## Run locally

```sh
npm ci
npm run android
```

For a development server without launching Android right away, run `npm start`. Use a compatible Expo Go build or development build on your device, or press `a` to launch an Android emulator.

## Checks

```sh
npm test
npm run typecheck
npm run build
```

`npm run build` exports an Android bundle locally; it does not produce an APK or require an Expo account. Installing dependencies sets up Husky hooks. Pre-commit checks staged files with Biome, and pre-push runs the three commands above. Run `npm run prepare` if the hooks need reinstalling.

## Build an Android APK

```sh
npx --yes eas-cli@27.10.0 login
npm run build:apk
```

The command uses the `preview` profile in `eas.json` to build a standalone APK with EAS. You need permission to build on the linked EAS project, or an EAS project of your own if you're building a fork. Follow the prompts to configure signing if necessary. Use the same app package and signing key for updates that install over an existing copy.

Download the APK from the EAS build link and open it on Android, or install it from a computer:

```sh
adb install -r path/to/rocket.apk
```

See the [Expo APK build guide](https://docs.expo.dev/build-reference/apk/). To change or publish the guides rather than the app, see [Publishing the documentation](publishing.md).
