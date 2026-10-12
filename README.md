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
