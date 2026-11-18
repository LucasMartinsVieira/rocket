# IGDB game lookup

- Docs: https://api-docs.igdb.com/ ; agreement: https://www.twitch.tv/p/legal/developer-agreement/ . Reviewed November 17, 2026.
- User-selected authentication mode: each user supplies their own Twitch developer application Client ID and Client Secret. Never bundle shared developer secrets. This is a personal-use flow, not a substitute for a backend in a broadly distributed app.
- Create a Twitch developer application with 2FA enabled and Client Type Confidential, as described by IGDB. Store both values together in Expo SecureStore under the `igdb` record. They are separate fields in the settings UI, not values in the app bundle or SQLite.
- Exchange credentials via HTTPS POST form body to `https://id.twitch.tv/oauth2/token` with `grant_type=client_credentials`. IGDB requests receive only Client ID and Bearer token. No credentials in URLs, logs, source links, or user-facing errors.
- Cache the short-lived app access token only in process memory, refreshing before expiry or once after an IGDB 401. Editing/removing/purging credentials clears cached authentication and invalidates pending work. No background refresh or automatic quota retries.
- POST to `https://api.igdb.com/v4/games` with APICalypse queries. Escape user queries using JSON string quoting; validate numeric IDs. Search uses a one-record lookahead for pagination, not a claimed exact total.
- Requests are serialized with at least 300 ms between IGDB calls, below 4 requests/sec and 8 concurrent calls. Respect rate limiting and leave manual entry available after network/authentication failures.
- Import title, developer names (not publishers), year, cover and synopsis. Do not import aggregate scores as personal ratings or invent game duration.
- Permanent attribution: Settings → Credits links to IGDB.com. Commercial/monetized distribution requires contacting IGDB about partnership and confirming attribution placement. Credits alone does not grant approval or third-party artwork rights.
- Tests: `node --test tests/igdb.test.cjs`. A real personal Twitch application is needed for live end-to-end testing.
