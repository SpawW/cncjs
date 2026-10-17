---
"cncjs": patch
---

feat(laser): import SVG files and generate laser G-code

Dropping a `.svg` file onto the workspace now opens a parameter dialog (feed rate, travel rate, power, laser mode, passes, focus Z, scale, offset and Y inversion) and generates GRBL-compatible laser G-code on the server. Vector geometry only — `path`, `line`, `polyline`, `polygon`, `rect`, `circle` and `ellipse` — including nested `transform` and `viewBox` handling, with curves flattened to within the configured tolerance. The generated program is loaded through the existing `gcode:load` flow and can be previewed in the Visualizer. A new `POST /api/svg` endpoint exposes the conversion to the API.

feat(laser): import STL files and generate laser G-code

Dropping a `.stl` file (binary or ASCII) opens the same parameter dialog with an extra optional `Slice Z (mm)` field and slices the mesh with a horizontal plane — defaulting to the vertical middle of the model — then chains the resulting segments into closed contours and generates laser G-code through the same emitter used for SVG. A new `POST /api/stl` endpoint exposes the conversion to the API.

Also: import failures are now surfaced in the dialog (the reasoning is no longer swallowed), and the import button accepts both SVG and STL.
