# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

GymFlow Tracker is a purely client-side (vanilla HTML/CSS/JS) workout logging and calendar app. There is no backend, no build step, no package manager, and no external dependencies beyond a Google Fonts CDN link. All data is stored in the browser's `localStorage`.

### Running the application

Serve the repository root with any static file server. For example:

```
python3 -m http.server 8080
```

Then open `http://localhost:8080/` in Chrome.

### Lint / Test / Build

There are no lint tools, test frameworks, or build steps configured in this repository. The app runs directly from `index.html`, `script.js`, and `styles.css`.

### Key notes

- No `package.json`, `requirements.txt`, or other dependency files exist. The update script is intentionally a no-op (`echo ok`).
- The app uses `localStorage` keys `gymflow_exercises` and `gymflow_calendar_logs`. Clearing browser storage resets all data.
