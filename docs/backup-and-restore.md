---
title: Backup and restore
---

[Documentation home](index.md)

# Backup and restore

Rocket can export a readable JSON copy of your library. Use it before changing devices or reinstalling the app. **Backups are unencrypted and can contain private notes and journals. Keep them somewhere private.**

## Export a backup

1. Open **Settings → Backup & Restore**.
2. Tap **Export backup file**.
3. Choose **Save backup file** if available, or open the device's share sheet with **Share file** (sometimes labeled **Save or share file**).

Backups include titles, personal dates, ratings, notes, journal entries, list memberships and order, and cover URLs. They don't include provider credentials, access tokens, app settings, or image files. Remote covers may still need an internet connection after restore.

## Restore a backup

1. Open **Settings → Backup & Restore → Select backup file…** and choose the JSON file.
2. Check the preview. If you already have a library on this device, choose **Back up current library first** to save a recovery copy.
3. Tap **Continue to restore**, confirm, and wait for the success screen.

**Restore replaces the current library rather than merging it.** Rocket validates the file before making changes. See the [JSON backup format](backup-format.md) for compatibility and technical details.
