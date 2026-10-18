# New Features

## SVG/STL import + simulation + laser/fan control + park

### New features

**1. Import SVG/STL straight to laser G-code**
- Import **SVG** (vectors: path/rect/circle/etc.) and **STL** (sliced at a given Z) from the Workspace (button or drag-and-drop); both are converted to laser G-code (`G21/G90`, `M3/M4`, `G0/G1`).
- Options: feed rate, travel rate, power, laser mode (M3/M4), passes, focus Z, scale, invert Y, X/Y offsets, slice Z (STL) and fan.
- New API endpoints (`api.svg`, `api.stl`) and conversion libraries (`svg-to-gcode`, `stl-to-gcode`).

**2. Simulation (menu next to the Run button)**
- **Trace engraving path**: follows the toolpath with the laser at minimum power (keeps the original on/off pattern).
- **Trace work area**: pulses the laser at the four corners of the object.
- Confirmation dialog (power % and max S value) and a "Simulation running" banner with a Stop button.
- Supported on Grbl, Marlin, Smoothie and TinyG.

**3. Fan control (M8)**
- **"Fan (M8)"** option in the import dialog: emits `M8` at the start and `M9` at the end of the generated G-code.

**4. Run (PLAY) dialog**
- When starting a job, it asks for **Laser Power (%)**, **Cutting Speed (mm/min)** and **Fan (M8)** (default on).
- The last configuration is remembered (localStorage).
- On confirm it applies to the loaded G-code: rewrites the `S` word on `M3/M4` lines and the `F` word on `G1` lines, injects/removes the fan, reloads and starts.

**5. Power as a percentage**
- Power is shown in **%** and converted to the real `S` word using the controller maximum (**`$30`** on Grbl, 255 on Marlin; fallback 1000), with a hint such as `= Sxxx · Maximum value Syyy`.

**6. End-of-job park**
- When the job finishes, the head moves to the **corner opposite the home**, using the limits of the selected **Machine Profile** (avoids relying on the firmware `$130/$131`). This frees the part for removal.

### Fixes
- The bounding box and the simulations **ignore the final park / return-to-origin move**.
- **"Trace work area"** computes the corners from the G-code itself (honoring the import offset) instead of the visualizer state.

### Dev/Infra
- Development environment with **Docker Compose** and incremental builds (backend ~1.5 s via babel-watch + nodemon; frontend with HMR).
- Serial device access through `/dev` + `device_cgroup_rules`.

### Verification
- `jest`: 595 tests passing.
- eslint: clean.
- webpack bundle: compiles.
