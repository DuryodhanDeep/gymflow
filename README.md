# GymFlow — Stage 1 Foundation

A personal, dark-green, mobile-first workout planner built with React + Vite. This stage establishes the PWA shell, navigation, initial local database and visual foundation. Workout rotation, editing, set logging, media library, backup and full offline verification are future stages.

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

## Test on your Samsung phone

For the initial visual check, your phone and development computer can be on the same Wi-Fi network. Run `npm run dev -- --host 0.0.0.0` and open the network URL printed by Vite.

PWA installation and offline behavior should be tested from a secure HTTPS origin or an appropriate local development environment. The development server intentionally does not enable the service worker; the production build configures PWA support.

## Stage 1 contents

- Mobile-first dark green UI
- Home, Plans, Progress and Settings navigation
- Starter metadata for five workout plans
- IndexedDB persistence foundation
- PWA manifest and service-worker build configuration
- Placeholder actions clearly labelled for later stages

## Known limitations in Stage 1

- Starting a workout is a placeholder and does not create a session.
- Plans are not editable yet.
- Rotation does not advance yet.
- Exercise guides, media, set logging and backup are not implemented yet.
- Offline installation needs production-build testing.

Do not treat the placeholder UI as a completed workout tracker.
