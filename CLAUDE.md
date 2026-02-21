# CLAUDE.md — WichtelnApp

This file provides guidance for AI assistants working on the WichtelnApp codebase.

---

## Project Overview

**WichtelnApp** is a Secret Santa (Wichteln) gift-exchange organizer. It is a German-language,
fully client-side, single-page application. There is no backend, no build step, and no package
manager — the entire application lives in one file: `index.html`.

---

## Repository Structure

```
WichtelnApp/
└── index.html        # The complete application (HTML + CSS + JS in one file)
```

All HTML markup, inline CSS, and JavaScript (React + JSX transpiled at runtime by Babel) are
contained in `index.html`. Do not split this into separate files without explicit instruction.

---

## Technology Stack

| Layer         | Technology                              |
|---------------|-----------------------------------------|
| UI framework  | React 18.2.0 (loaded from CDN)          |
| JSX transform | Babel Standalone 7.23.5 (CDN, runtime)  |
| Styling       | Inline `<style>` block (plain CSS)      |
| Fonts         | Google Fonts (Cormorant Garamond, DM Sans) |
| Storage       | Browser `localStorage`                  |
| Backend       | None — fully client-side                |
| Build system  | None — no compilation step required     |
| Package manager | None — no npm/yarn/pnpm               |

---

## Running the Application

Open `index.html` directly in a browser. No installation, build, or server is required.

```bash
# Quick local serve (any of these work):
python3 -m http.server 8080
npx serve .
```

Then navigate to `http://localhost:8080`.

> **Note**: `file://` protocol may restrict localStorage in some browsers. Use a local HTTP server
> during development.

---

## Architecture & Data Flow

### Client-Side Routing

The app uses URL query parameters for routing (no router library):

| URL pattern          | View shown                                   |
|----------------------|----------------------------------------------|
| (no params)          | Create event or load existing organizer view |
| `?event=[eventId]`   | Join-event page for new participants         |
| `?p=[token]`         | Participant view (reveals assigned person)   |

### Application States (React state machine)

```
loading → create-event → organizer
                              ↕
                       join (via link)
                              ↓
                   participant-waiting → participant-assigned
```

Additional state: `error` (event not found).

### Data Persistence

All data is stored in `localStorage` under the key `wichteln-event` as a single JSON object:

```js
{
  id: "ev-[timestamp]",
  name: "string",
  drawDate: "ISO-8601 datetime",
  status: "pending" | "completed",
  createdAt: "ISO-8601 datetime",
  drawnAt: "ISO-8601 datetime | null",
  participants: [
    {
      id: "p-[timestamp]",
      name: "string",
      phone: "string",
      token: "tk-[random]",       // used in ?p= URLs
      assignedTo: "participant_id | null",
      joinedAt: "ISO-8601 datetime"
    }
  ]
}
```

**Lifecycle rules**:
- Event data auto-deletes 24 hours after the draw completes.
- Participants and the organizer can manually delete data at any time.

---

## Key Functions & Logic

| Function / Area         | Description                                                    |
|-------------------------|----------------------------------------------------------------|
| `performDraw()`         | Fisher-Yates shuffle ensuring no self-assignments              |
| Automatic draw trigger  | Checks `drawDate` on component mount and via `setInterval`     |
| Token generation        | `"tk-" + Math.random().toString(36).substr(2, 9)` (not crypto)|
| Share link              | `window.location.origin + window.location.pathname + ?event=` |
| Participant link        | Same base URL + `?p=[token]`                                   |

---

## Styling Conventions

All styles live in a single `<style>` block in `index.html`. Use the following CSS custom
properties (variables) for all new UI work:

```css
--primary:        #8B4513   /* brown */
--primary-light:  #A0522D
--accent:         #D4AF37   /* gold */
--bg-cream:       #FFF8F0
--bg-white:       #FFFFFF
--success:        #2D5016   /* green */
--danger:         #8B2635   /* red */
--text-dark:      #2C1810
--text-medium:    #5C3D2E
--text-light:     #8B6F5E
```

**Typography**:
- Headings: `Cormorant Garamond` (serif)
- Body / UI: `DM Sans` (sans-serif)

**Responsive breakpoint**: `max-width: 600px`

**Animations defined**: `fadeInDown`, `fadeInUp`, `slideIn`, `bounce`

---

## Language & Locale

The UI is entirely in **German**. All user-facing strings, labels, button text, and error
messages must be written in German. Do not introduce English strings into the UI.

---

## Testing

There is no test suite. The application has no test configuration and no test files.

When verifying changes:
1. Open `index.html` in a browser.
2. Manually exercise the create-event → add participants → draw flow.
3. Test the join link by opening it in a second browser tab/window.
4. Test the participant token URL.
5. Verify localStorage contents in browser DevTools → Application → Local Storage.

---

## Linting & Formatting

No linters or formatters are configured. Follow the existing code style in `index.html`:
- 2-space indentation throughout
- Single quotes for JavaScript strings
- `const` / `let` (no `var`)
- Arrow functions for React event handlers and hooks
- No trailing commas in function argument lists (match existing style)

---

## Security & Privacy Notes

- All data stays in the user's browser — no data is sent to any server.
- Tokens (`tk-*`) use `Math.random()`, which is **not** cryptographically secure. They provide
  obscurity, not real security.
- React's default JSX escaping prevents XSS from user-entered names/text.
- No HTTPS is enforced by the app itself; deploy behind HTTPS in production.

---

## Common Development Tasks

### Adding a new UI view
1. Add a new `currentView` state value to the state machine in `WichtelnApp`.
2. Add a corresponding render branch in the JSX return.
3. Add styles in the `<style>` block using existing CSS variables.

### Changing stored data shape
1. Update the localStorage read/write logic (search for `localStorage.setItem`).
2. Update any auto-deletion logic if new time-sensitive fields are added.
3. Document the new shape in this file under **Data Persistence**.

### Modifying the draw algorithm
The draw is performed in the `performDraw` function. It uses Fisher-Yates shuffle and retries
if a self-assignment occurs. Changes must still guarantee:
- Every participant is assigned exactly one other participant.
- No participant is assigned themselves.

---

## Git Workflow

- Default branch: `master`
- Feature / AI-assistant branches follow the pattern: `claude/<session-id>`
- Write clear, imperative commit messages (e.g., `Add participant deletion confirmation dialog`).
- Push to the designated feature branch; do not push directly to `master`.

---

## Out of Scope (Do Not Do Without Explicit Instruction)

- Do not introduce a build system (Webpack, Vite, Parcel, etc.).
- Do not split `index.html` into multiple files.
- Do not add a backend or database.
- Do not replace CDN dependencies with npm packages.
- Do not translate the UI to English.
- Do not add a test framework unless explicitly requested.
