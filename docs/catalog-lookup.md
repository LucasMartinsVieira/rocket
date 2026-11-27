---
title: Catalog lookup
---

[Documentation home](index.md)

# Catalog lookup

In **Add title**, open **Lookup & Import**. Enter a query, choose a provider filter if needed, and tap **Query**. Select a result to preview it, then choose **Fill “Add Title” Form**. The import fills the draft; nothing goes into your library until you tap **Save**.

## Providers and credentials

Add optional credentials in **Settings → Provider Integrations**.

| Media | Provider | What you need |
| --- | --- | --- |
| Movies and TV Shows | [OMDb](https://www.omdbapi.com/) | Your own OMDb API key, shared across both filters. Search by title or IMDb ID. Each TV show is one series-level entry, with a season count when available. |
| Books | [Open Library](https://openlibrary.org/) | No key. Search by title, author, or ISBN. |
| Anime and manga | [Tenrai](https://tenrai.org/) | No key. Metadata comes from the MyAnimeList catalog via Tenrai. |
| Games | [IGDB](https://www.igdb.com/) | Your own Twitch developer application Client ID and Client Secret. See the [IGDB setup notes](IGDB.md). |

Catalog lookup is optional and requires internet access. If a provider is unavailable or doesn't have a match, enter the title manually. Catalogs do not supply your rating, status, note, or personal dates. Use a result's **Source** link or **Settings → Credits** to see where its metadata comes from.

Saved provider credentials are stored separately from your library and aren't included in [backups](backup-and-restore.md). Don't include credentials in screenshots, bug reports, or support requests.

Rocket’s source code license does not cover catalog results or artwork. See [licenses and data sources](licenses-and-data.md) for the provider terms.
