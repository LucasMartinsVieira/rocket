# Rocket code style

[Biome](biome.json) is the source of truth for formatting, lint rules, and import ordering. Use `npm run check` to check code and `npm run format` to format it. TypeScript uses strict mode. This guide covers conventions the tools can't enforce.

## Files and boundaries

- Give screens and components their own folders. Use a named export and an `index.ts` entry point, with a local `styles.ts` when needed. Put styles reused across components or screens in their respective `shared/` folders.
- Keep rendering and interaction in the UI. Use repository methods for SQLite access, and put shared domain rules and types in `src/model.ts`. See [Architecture](ARCHITECTURE.md) for where persistence, catalog, and backup changes belong.
- Keep state local when only one screen needs it. Derive filtered or sorted views from their source data rather than maintaining a second copy in state. Don't mutate source arrays when sorting.

## UI code

- Use the spacing, color, typography, and radius tokens in [`src/theme.ts`](src/theme.ts). Keep control dimensions and responsive calculations close to the component that uses them. Use [`DESIGN.md`](DESIGN.md) for layout, copy, and interaction decisions.
- Give icon-only controls an accessibility label. Expose selected, expanded, or disabled states where applicable; keep touch targets at least 44 × 44 dp. Don't use color as the only status indicator. Respect reduced-motion settings when adding animation.

## Data and tests

- Validate external data at the boundary before treating it as a domain type. Don't cast an unchecked provider response or backup file into a model type to satisfy TypeScript.
- For changes to persisted data, test the repository behavior and any affected migration or backup round trip. For interaction changes, cover observable behavior such as preserving drafts on save failure, not implementation details. Tests live in [`tests/`](tests/); see the [development guide](docs/development.md#checks) for validation commands.

## Code patterns

These excerpts show the main control flow; follow the linked implementations for the surrounding state and validation.

### Save a draft without losing edits

Validate before saving. Persist through the repository, refresh the displayed data, and close the editor only after success. On failure, leave the draft in place and show a retryable error. See `saveCurrentEntry` in [`App.tsx`](App.tsx).

```ts
setFormError("");
try {
  await entryRepository.save(draft);
  await refresh();
  setEditorVisible(false);
} catch {
  setFormError("Could not save entry. Your edits are still here; try again.");
}
```

### Filter first, then render a large collection

Search and filter the full collection before passing matching entries to `FlatList`. Use entry IDs as keys, not array positions. Virtualization limits rendering, not which titles can be found. See `shownEntries` in [`App.tsx`](App.tsx) and the [`LibraryScreen`](src/screens/LibraryScreen/LibraryScreen.tsx).

```tsx
const shownEntries = entries.filter(
  (entry) => statusFilter === "All" || entry.status === statusFilter,
);

return (
  <FlatList
    data={shownEntries}
    keyExtractor={(entry) => entry.id}
    renderItem={({ item }) => (
      <MediaRow entry={item} onPress={() => onOpen(item)} />
    )}
  />
);
```

### Guard async actions against repeat taps

Use a ref to block a second call immediately and state to disable the control and show progress. Dismiss on success; on failure, keep the error visible and let the user retry. See [`DeleteConfirmationDialog`](src/components/DeleteConfirmationDialog/DeleteConfirmationDialog.tsx), which also blocks dismissal during the delete.

```ts
if (pending.current) return;
pending.current = true;
setDeleting(true);
setError("");
try {
  await onConfirm();
  onCancel();
} catch {
  setError("Could not finish deleting. Please try again.");
} finally {
  pending.current = false;
  setDeleting(false);
}
```
