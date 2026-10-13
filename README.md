# GymFlow — Stage 2.1: Workout Editors

A personal, dark-green, mobile-first workout planner built with React + Vite. This update adds a permanent master-plan editor and a separate temporary next-workout editor while preserving completion-controlled rotation and session snapshots. Data remains local in IndexedDB.

## Requirements

- Node.js 20 LTS or newer recommended
- npm
- A modern browser

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Build check

```bash
npm run build
npm run preview
```

## What's included

- Edit the name, focus, and estimated duration of each master plan.
- Permanently add, edit, delete, and reorder exercises in a master plan.
- Exercise types: strength/reps, timed activities, and distance-based activities.
- Optional activity notes, target sets/reps/weight, duration, distance, and distance unit.
- Customize the next workout without changing the master plan.
- Temporary edits are discarded when the session is completed or abandoned.
- Active sessions use a snapshot, so editing a master plan does not change a workout already in progress.
- Existing saved state is migrated to the new exercise format without intentionally resetting the rotation or saved sessions.
- Rotation advances only after explicit workout completion; abandoning does not advance it.

## Test on your Samsung phone

For a development check, run `npm run dev -- --host 0.0.0.0` and open the network URL printed by Vite while the phone and computer share Wi-Fi. PWA installation and offline behavior should be tested from a production build on a secure origin.

## Important

The app stores data locally on the current browser/device. Clearing browser site data can remove local workouts and plans. Backup/restore remains a future feature.

## Recommended editor/rotation checks

1. Edit a master plan, rename an activity, add one, move it up/down, delete one, and save. Leave and reopen the plan to verify the changes persist.
2. Customize the next workout with a timed activity and a distance-based activity. Verify the master plan still has its original activities.
3. Start the customized workout, mark some sets complete, refresh the browser, and resume. Verify the session snapshot and logs remain.
4. Complete the customized workout. Verify the rotation advances by exactly one slot and the temporary version is cleared.
5. Create another temporary workout, start it, then abandon it. Verify rotation stays on the same slot and temporary edits are discarded.
6. Start a normal workout, edit that plan in the master editor, then return to the active session. Verify its exercise list and logged sets did not change.
7. If testing with existing Stage 2 data, verify the active session, history, and rotation survive the schema migration.

The full Vite production build was not verified in the generation environment because dependency installation timed out. Run `npm install` and `npm run build` locally before relying on the update.

## Stage 3 — Local backup and restore

Open **Settings** to export a dated `.json` backup containing all five master plans, the next-plan rotation pointer, temporary next-workout edits, any active session (including logged sets), and completed/abandoned history. Keep this file private and store a copy outside the browser/device.

To restore, choose **Import backup**, select a GymFlow backup JSON file, review the summary and confirm. **Restore replaces all current local workout data**, not merges it. Export your current data first if you may need it. Unsupported or malformed files are rejected. Backup files have format `gymflow-backup`, backup version `1`, and app schema version `3`. The file size limit is 15 MB.

Backups are manual: no cloud synchronization, encryption, or scheduled export is provided. Browser storage can be cleared by the user or device, so keeping an external copy matters. This feature does not change workout rotation or editing behavior.

### Stage 3 verification checklist

1. Edit a master plan, log a set in an active session, and export.
2. Inspect the JSON to confirm `format`, `backupVersion`, and `state` fields exist.
3. Change a master plan, then import the backup. Confirm the restore summary and replacement warning, then restore; confirm the earlier master plan, rotation, and active session return.
4. Confirm completed/abandoned history returns when present.
5. Import an unrelated JSON file and verify it is rejected without changing the app.
6. Cancel a restore and verify nothing changes.
7. Complete or abandon a restored session and verify normal rotation behavior.
