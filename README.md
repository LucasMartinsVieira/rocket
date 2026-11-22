<img src="assets/icon.png" alt="" width="96" height="96">

# Rocket

**Your personal media library for Android.** Keep track of anime, manga, movies, books, and games in one place. Rocket stores your library on your device, so you can add titles, organize lists, and write notes offline without an account.

[Getting started](docs/getting-started.md) · [User guide](docs/index.md) · [GitHub Releases](https://github.com/LucasMartinsVieira/rocket/releases)

## What you can do

- **Track what you watch, read, and play.** Set a status, give a title a personal rating, and record optional start and end dates.
- **Keep notes and a journal.** Write a private note on a title and add dated journal entries as you go.
- **Organize your shelf.** Make custom lists, choose their icons and accents, and set your own title order. Browse covers or rows and filter to find what you want.
- **Look up metadata when you want it.** Search online catalogs to fill in details like cover art, creator, or release year. Manual entry is always available.
- **Keep a copy of your library.** Export or restore a readable JSON backup from **Settings → Backup & Restore**. Backups are unencrypted and don’t include provider credentials or artwork files.

## Install on Android

If a release includes a `.apk` under **Assets**, download it from [GitHub Releases](https://github.com/LucasMartinsVieira/rocket/releases) and open it on your phone. If no APK is available, follow the [Android build guide](docs/development.md#build-an-android-apk).

## Privacy and availability

Rocket does not sync your library across devices. Catalog lookup and loading remote cover art require internet access, but you can use the local library offline. To move your library to another device, [export a backup and restore it there](docs/backup-and-restore.md). Restore replaces the library on the destination; it does not merge the two.

## Development

[Run, test, and build Rocket](docs/development.md) · [Publish the documentation](docs/publishing.md) · [Report an issue](https://github.com/LucasMartinsVieira/rocket/issues)

## License

Rocket’s source code is [MIT-licensed](LICENSE). The MIT license does not cover third-party catalog data or artwork. See [licenses and data sources](docs/licenses-and-data.md) for provider terms and release considerations.
