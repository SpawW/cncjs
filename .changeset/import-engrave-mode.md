---
"cncjs": patch
---

feat(laser): select line, fill or line+fill engraving mode on SVG/STL import

The import dialog now exposes an **Engraving Mode** selector:

- **Line (outline)** — traces the contours, matching the previous behaviour.
- **Fill (hatch)** — fills closed shapes with parallel hatch lines at a configurable spacing and angle; the even-odd rule keeps holes empty.
- **Line + Fill** — fills first and traces the outline afterwards.

The dialog also remembers the last submitted values in `localStorage` (`cncjs.import.lastValues`), so feed rate, power, mode, spacing, offsets, etc. are restored the next time a file is imported.
