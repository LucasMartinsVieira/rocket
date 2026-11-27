# Rocket UI Design Brief

> For the AI implementing Rocket’s interface: treat this file as the product and visual source of truth. Build a focused, polished Android media library using the existing Expo, React Native, SQLite, and model code. Keep the app usable offline. User-requested additions include personal 1–5-star ratings, total duration metadata, and selectable list icons. Discovery, social features, sync, and consumption-progress tracking remain out of scope.

## Personal metadata and list icons

- Rating is optional and user-owned: whole stars from 1–5, with an explicit Clear action. It is never populated from provider scores.
- Duration is optional total metadata, not progress: pages for books, chapters for manga, runtime in minutes for movies, and episodes for anime. Games have no duration field for now. Unknown provider totals stay blank and can be entered manually. Show the labeled total after the creator in the detail fact rail.
- Lists have one of 16 named Lucide icons. Choose it during creation or change it from the list detail page; display it in list previews and membership badges. Existing lists default to the List icon. The list header also lets you change the current accent using the same choices as list creation.

## Product and point of view

Rocket is a private shelf for things one person means to watch, read, or play. It covers anime, manga, movies, books, and games. The main job is to answer two questions quickly: “What’s in my library?” and “What status did I give it?” The UI should feel like a quiet, dark screening room where cover art supplies the color and each title remains easy to find.

Use the linked [xAI design analysis](https://getdesign.md/x.ai/design-md) as inspiration, not a template. Carry over its near-black canvas, sparse white-on-dark hierarchy, hairline dividers, outline pills, tight display typography, and rare sunset/dusk accents. The source is an independent interpretation of a web marketing system; Rocket is a touch-first, image-rich personal tool. Do not reproduce xAI logos, names, proprietary fonts, or marketing layouts. Let users’ cover art be the expressive centerpiece, not a giant product headline or decorative gradient.

## Visual tokens

### Core palette

| Token | Color | Use |
|---|---|---|
| Void | `#0A0A0A` | Main app canvas and full-screen surfaces |
| Panel | `#191919` | Inputs, selected rows, bottom navigation |
| White | `#FFFFFF` | Primary text, high-contrast icons, primary action fill |
| Silver | `#DADBDD` | Supporting descriptions and secondary content |
| Quiet | `#7D8187` | Hints, inactive controls, metadata |
| Seam | `#212327` | Hairline separators and quiet outlines |

Use two restrained accents from the reference: **Sunset** `#FF7A17` for a rare focal action or warm feedback, and **Dusk** `#7C3AED` for selection and the Revisiting status. Do not use both accents everywhere or paint media-type chips in a rainbow. Status meaning must also be readable in text, never color alone. Ensure text and controls have strong contrast on dark surfaces.

### Type

Use a clean geometric sans for titles, controls, and body copy. Prefer an available font already configured in the project; otherwise use the platform sans (Roboto on Android). Do not depend on proprietary Universal Sans. A mono face is optional and reserved for compact catalog metadata such as release year; never use uppercase tracked mono as a label above every heading.

Use these React Native logical-pixel starting sizes, adjusting for device font scaling:

| Role | Size / line height | Treatment |
|---|---:|---|
| Screen title | 28 / 34 | Regular, slightly tight tracking |
| Section title | 20 / 26 | Medium |
| Entry title | 16 / 21 | Medium; allow two lines in cards |
| Body and form value | 15–16 / 22–24 | Regular |
| Metadata and control label | 12–13 / 18 | Regular; quiet color |

Use sentence case. Favor regular and medium weights; reserve bold for a selected value or a genuinely important action. Left-align headings, labels, and prose. Center only compact loading or empty-state messages. Do not justify text.

### Shape, spacing, and depth

- Use 4 dp as the base rhythm for spacing. The shared scale includes 2, 6, and 10 dp steps for compact controls.
- Keep the surface system flat. No soft shadow on every control or card. Separate surfaces with tone and hairline seams.
- Use an 8 dp corner for fields, sheets, and image frames. Use capsule shapes for filters, status selectors, and secondary actions. Keep the primary add action circular or capsule-shaped and at least 48 dp high.
- Preserve the poster’s own silhouette. Use a 2:3 crop for portrait covers, with `cover` fitting and no stretching. If no image exists or loading fails, show a quiet type-aware fallback with the title; never show a broken-image icon.
- Keep spacing consistent, but do not put every content group in its own rounded card. Poster art, dividers, and whitespace should do most of the grouping.

Define spacing, text sizes, weights, and radii with `SPACING`, `FONT_SIZES`, `FONT_WEIGHTS`, and `BORDER_RADIUS` in `src/theme.ts`. Give each screen or component a folder with an `index.ts` entry point and a `styles.ts` for its own static rules when needed. Keep reused sheets in `shared/` folders, grouped by purpose (for example, form fields and actions). Keep values for touch targets, cover dimensions, deliberate line heights, and responsive calculations local; they are not spacing or font-size tokens.

## App structure and navigation

The first version has two top-level destinations: **Library** and **Lists**. Use a bottom navigation bar on phones with clear text labels and simple icons. The selected destination uses white text and a small dusk indicator; inactive items use Quiet. Keep the bar dark and separated by a single Seam line. A floating add button is available from Library and has the explicit label/accessibility name “Add title.”

On wider devices, retain the same navigation vocabulary and use the extra space for a two-column detail layout or a wider table. Do not invent extra destinations for settings, discovery, sync, or providers.

## Screen layouts

### Library: cover view

The Library opens directly to the collection, not a dashboard. Its order is: app/title bar, search, media-type filters, status filters, optional active-list indicator, then the scrollable collection. Keep controls compact enough that covers appear without excessive scrolling. Search matches title, alternate titles, and creator. Type and status filter rails scroll horizontally and preserve their selection while the user browses.

Use a two-column poster grid on a phone. Each item contains a large cover, title, and a quiet line for type and release year. Put the status in a small outlined or filled capsule below the title or at the cover’s lower edge only when legibility remains good over all artwork. Avoid metadata over busy artwork. Tapping any part of an item opens its details.

```text
┌──────────────────────────────┐
│ rocket                 [+]   │
│ My library                   │
│ [ Search titles…           ] │
│ [All] [Anime] [Manga]  →     │
│ [All] [Planned] [Done]  →    │
│                              │
│ ┌──────────┐ ┌──────────┐    │
│ │  cover   │ │  cover   │    │
│ └──────────┘ └──────────┘    │
│ Title      │ Title           │
│ Type / year│ Type / year     │
│ Planned    │ Completed       │
│                              │
│ Library             Lists    │
└──────────────────────────────┘
```

### Library: table view

Provide a clearly labeled toggle between **Covers** and **Table**; persist the user’s choice for the session or locally. The table is a compact, aligned list, not a spreadsheet squeezed onto a phone. On narrow screens show cover thumbnail, title, type/year, and status in a readable row. On tablets, align separate Title, Type, Year, and Status columns. Keep row height at least 64 dp and separators subtle. Do not make the table horizontally scroll by default.

### Entry details

Open a full-screen detail view on phones. Lead with the cover at a useful size and the title in plain text. Show alternate titles only when present, then status, type, release year, and creator with the appropriate role (director, author, developer, or studio/creator). Summary follows metadata. Keep the status easy to change without editing every field.

Place **Your note** and **Journal** in visibly separate sections: the note is one editable, enduring thought; journal items are dated entries appended over time. A journal composer should use “Add journal entry” and display the date for each saved item. Put Edit and Remove in a quiet overflow/action area; confirm destructive removal and say that the associated note, lists, and journal are removed too.

Use the native adaptation of `stitch_rocket_media_shelf/delete_item_confirmation_dialog/code.html` for title and list deletion: centered dark card over an 85% black scrim, Lucide trash icon, Permanent badge, real item preview, and stacked 48 dp Delete/Cancel buttons. Title deletion explicitly includes its note, journal, and memberships; list deletion explicitly preserves all library titles and their personal data. Cancel, backdrop, and Android Back dismiss without changes; block duplicate submission and dismissal during the actual database operation, and keep failures visible with retry. Keep the card scrollable for small screens and large text. No sample artwork, fake delay, or remote fonts.

### Add and edit

Start date and end date are optional personal calendar dates, separate from release year and status. Show their fields together after Status, and display only dates the user has set in entry details. Validate real calendar dates and chronological order when both are set. Status changes and catalog imports never set or overwrite them.

Use a full-screen form on Android rather than a tiny dialog. Group fields in this order: media type; title; alternate titles; cover image URL; creator and role; year; summary; status; note; custom lists. Labels sit above fields, use sentence case, and remain visible while typing. Use a numeric keyboard for year and multiline inputs for summary and note. Keep Save visible in the top bar or as a bottom action that clears the keyboard before saving. Do not let the keyboard cover the active field or Save.

When changing media type, update the creator label (`Studio or creator`, `Author`, `Director`, `Author`, `Developer`) while preserving the entered text. Alternate titles may be entered separately or comma-separated, but show each title clearly on detail. A cover URL is optional; show a small preview and a graceful failure fallback. Never require online catalog lookup to save an entry.

### Lists

Use the same horizontal media-type filter rail as Library: All, Anime, Manga, Movies, Books, Games. Keep its selection independent of Library and preserve it while navigating within the session. Filter by the list's declared type even when empty; show the visible count and offer Clear filters when nothing matches.

The Lists destination lets a user create and remove named collections. Each list has one fixed media type (Anime, Manga, Movie, Book, or Game), selected during creation, and can contain only entries of that type. Switching the type before creation clears selected titles. Show the type alongside the title count, including on empty lists. Title pickers and entry membership controls show only compatible items/lists; enforce the same rule in SQLite. Changing an entry's type removes incompatible memberships on Save without deleting the entry, note, or journal. Each row shows its name, number of titles, and a clear affordance to open the filtered library. Removing a list removes memberships only; confirm that library titles remain. Handle duplicate names with an inline message near the name field.

### Context actions

Touch and hold a media card/table row or a list card to open a bottom action sheet, inspired by the two Stitch context-sheet references but limited to Rocket's actions. Use the existing dark surface, restrained dusk accents, Lucide icons, readable metadata, and 48 dp actions. Tapping anywhere outside the sheet, Android Back, or Close dismisses it without navigating; keep the underlying view, filters, layout, and scroll position mounted.

Open context actions after a 200 ms hold. Animate sheet presentation with a short 140 ms ease-out fade and 24 dp rise, starting when the native modal is shown. Fade the scrim alongside the sheet; do not replay on status/membership updates. While pressed, media cards/rows and list cards show a subtle dusk wash and slight compression, without outlines or layout changes. Honor system reduced motion: show the sheet immediately and retain static press highlighting without compression. Press feedback clears on release/cancellation and must not interfere with reorder mode.

Media sheets show the real cover, title, creator/year/duration and brief synopsis, an explicit Open title details action, the same six-status selector as Details, Add to list with a live membership count and compatible-list checkboxes, and Remove title. List sheets show their icon/name/type/count/description, Open list details, Duplicate list, and Remove list. Duplication creates a uniquely named independent list with the same type, description, accent, icon, and membership order; it never clones media entries, notes, or journals. Destructive actions replace the sheet with the existing deletion confirmation; cancelling closes the entire context flow and returns to the pre-long-press view, not to details or the sheet. List details include a labeled Remove list button. Reorder titles opens a separate editor for all members, regardless of the active filter. Hold and drag a title to move it, or use the screen-reader actions to move it up or down. Save applies the full order; Cancel leaves it unchanged. Holding a title in the normal list always opens its context actions.

## States and interaction

**Backup & Restore:** Settings opens the local JSON backup flow. Follow the Stitch backup cards, export sheet, snapshot preview, and centered replacement dialog. Warn that JSON is unencrypted, includes notes and journals, and excludes provider credentials and image files. Show real validation and counts, not sample values or a checksum claim. Restore replaces rather than merges; offer a recovery backup first when there is existing data. Show only the actual operation state: indeterminate progress, success after commit, or a failure with a way to retry or select another file.

- **Empty library:** Explain that the personal archive starts by adding a title. Show one direct “Add your first title” action. Avoid fake sample titles that could be mistaken for saved data.
- **No filter results:** Say “No titles in this view” and offer a clear way to reset filters/search.
- **Empty list:** Explain how to add a list and then include titles from their details.
- **Loading:** While opening or retrying the local library, show a static skeleton matching the Library layout, with a screen-reader loading label and no interactive placeholders. Use restrained progress indicators and concise text elsewhere.
- **Save errors:** Identify what failed and keep the entered values intact. Use inline validation for missing title or invalid year.
- **Image errors:** Replace the image with the designed fallback and keep the title accessible.
- **Tap response:** Give pressed/selected feedback. Use brief transitions only when opening/closing a sheet, switching views, or confirming a saved change. Respect reduced-motion settings.
- **Touch/accessibility:** Controls should have at least 44 × 44 dp touch areas, text labels or accessibility labels, screen-reader selected states, and adequate contrast. Never rely on a glyph alone when its meaning is unclear.

Use direct, calm copy: “Save,” “Add title,” “Add journal entry,” “Remove title,” and “Clear filters.” Keep errors actionable and avoid marketing slogans, clever status names, and decorative all-caps eyebrows.

## Data and scope contract

Use the existing `MediaEntry`, `CustomList`, and `JournalEntry` concepts and the SQLite database. A media entry has title, alternate titles, cover URI, summary, creator/role, release year, one status, note, and list membership. Status options are **Planned**, **In Progress**, **Completed**, **Paused**, **Dropped**, and **Revisiting**. Revisiting covers rewatching, rereading, or replaying; do not split it into progress modes. Journal entries are date-stamped and separate from the note.

Catalog providers are OMDb for movies, keyless Open Library for books and ISBN lookup, Tenrai for anime and manga, and IGDB for games using personal Twitch developer credentials. Settings → Credits permanently links to IGDB. Phase 2 adds optional lookup without blocking manual entry; the first local-only UI excluded provider search and credential fields. Cross-device sync, user-account login, sync indicators, and discovery remain future work.

## Layout sketches to preserve

**Detail hierarchy:** one strong cover and title, followed by facts, summary, note, then journal. Do not turn the whole screen into a stack of identical cards.

```text
┌──────────────────────────────┐
│ ‹ Back              Edit  •••│
│       ┌────────────┐         │
│       │   cover    │         │
│       └────────────┘         │
│ Title                        │
│ [In Progress]                │
│ Movie     2024     Director  │
│ Summary                      │
│ …                            │
│ Your note                    │
│ …                            │
│ Journal            [+ entry] │
│ date                         │
│ …                            │
└──────────────────────────────┘
```

**Table on a wider screen:** keep the title column dominant and align metadata, rather than creating a dense spreadsheet aesthetic.

```text
┌────────────────────────────────────────────────────────────┐
│ Library    Search…                     Covers | Table      │
│ Type filters                          Status filters       │
│ Cover  Title                         Type       Year Status │
│        Title one                     Movie      2024 Planned│
│        Title two                     Book       1998 Done   │
└────────────────────────────────────────────────────────────┘
```

## Implementation and review checklist

Before coding, inspect the existing app components and data model. Reuse and improve working behavior rather than replacing SQLite or changing the product scope. Keep visual tokens centralized and components consistent. Use existing dependencies where possible; document any new dependency and why it is needed. Do not leave placeholder screens for required flows.

Review the finished UI on a small Android phone and a wider layout. Confirm that covers, search, filters, both library views, entry editing, note, journal, list creation/membership/removal, empty states, keyboard behavior, screen-reader labels, and offline use all work. Check that user copy matches action outcomes and that the visual system still feels like a media shelf rather than an xAI marketing page.
