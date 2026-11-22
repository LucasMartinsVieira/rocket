---
title: Tenrai catalog lookup
---

[Documentation home](index.md)

# Tenrai integration

- API: https://api.tenrai.org/v1 ; docs: https://api.tenrai.org/documentation ; terms: https://tenrai.org/terms (reviewed November 15, 2026).
- Free public, read-only MyAnimeList catalog. No credentials required. Server keys are server-only and must never be embedded in Rocket or sent by the mobile app.
- Search `/anime` and `/manga` using `q`, `page`, `limit=10`, `sfw=true`. Preview the selected catalog ID using `/{kind}/{id}`. The public API is beta; manual entry remains available when it fails.
- Public limits: 4 requests/second, 120/minute per IP. Rocket serializes Tenrai requests, spaces starts by at least 550 ms, caches responses for five minutes (up to 100 URLs), and blocks further requests until `Retry-After` expires after a 429. Shared-IP traffic may still cause throttling.
- Anime creator maps to studios; manga creator maps to credited authors. Known total episodes/chapters map to optional duration metadata; missing or zero totals remain blank. Do not import publication/airing status as user status, scores as personal ratings, or consumption progress.
- Results link to their MyAnimeList source and identify Tenrai as the API provider. Tenrai's terms permit application use and caching, but third-party content rights still apply; Rocket must not imply endorsement or ownership.
- Test: `node --test tests/tenrai.test.cjs`. Device-level interaction testing remains separate from adapter tests.
