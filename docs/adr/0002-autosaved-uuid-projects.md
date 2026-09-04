# Projects are autosaved UUID-addressed workspaces

Projects are stored and edited directly under an immutable UUID instead of using `projects/latest/` as a mutable working copy with manually saved named snapshots. Project Labels are non-unique display metadata, and every user change is persisted automatically; this removes save/load divergence, makes project identity stable across renames, and allows multiple projects to be addressed safely.

## Consequences

- The app always has an active Project: it honors a valid Project UUID in the URL, otherwise opens the most recently updated Project, or creates one when none exist.
- The Project dropdown owns creation, switching, renaming, and deletion. Renaming changes only the Project Label.
- Debounced draft writes and immediate artifact writes expose explicit saving, saved, and retry states. Revision-aware narrow updates protect concurrent tabs from silently overwriting one another.
- Legacy named snapshots and a divergent `latest/` working copy are migrated to UUID Projects. Legacy storage is removed only after the whole migration succeeds.
