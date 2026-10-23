# New Features

## SVG/STL import + simulation + laser/fan control + park

### New features

**1. Import SVG/STL straight to laser G-code**
- Import **SVG** (vectors: path/rect/circle/etc.) and **STL** (sliced at a given Z) from the Workspace (button or drag-and-drop); both are converted to laser G-code (`G21/G90`, `M3/M4`, `G0/G1`).
- Options: feed rate, travel rate, power, laser mode (M3/M4), engraving mode, passes, focus Z, scale, invert Y, X/Y offsets, slice Z (STL) and fan.
- **Engraving mode**: **Line** (outline only, the previous behaviour), **Fill** (parallel hatch lines) or **Line + Fill**. Fill has configurable spacing and angle, uses the even-odd rule so holes stay empty, and fills overlapping shapes as a union.
- The import dialog remembers the last used values in `localStorage`.
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

**7. Laser profiles (per material, bound to a Machine Profile)**
- New **Laser Profiles** section in Settings (add/edit/duplicate/delete/favorite) and a profile selector inside the SVG/STL import dialog.
- A profile stores the laser process parameters: power (%), M3/M4, feed, travel, passes, engraving mode, fill spacing/angle and fan/air assist. Job setup values (scale, invert Y, offsets, slice Z) stay per job and are not saved in the profile.
- Profiles are **bound to the selected Machine Profile** and are persisted on the server in `~/.cncrc` (`jobProfiles`), using the same `configstore` as Machine Profiles.
- The import dialog lets you **select, edit, save (update) and save as** a profile without leaving the dialog; the last profile used per machine is remembered.
- The import dialog is organized in **tabs** (Laser, Engraving, Placement) with fields laid out horizontally, so the STL/SVG form stays compact.
- Settings columns show machine, material/thickness, operation, power, feed and passes. Material metadata (`paper`, `cardboard`, `adhesive`, `wood`, `acrylic`, `leather`, `fabric`, `glass`, `metal`, `PLA`, `ABS`, `PETG`, `other`) plus a free description help identify profiles.
- The Run (PLAY) dialog is a wide **tabbed** dialog (Laser, Engraving, Placement) that exposes the full profile parameters, not only power/speed/fan. The profile panel offers Apply, Save and Save as…, and the footer offers **Preview** and **Start**.
- With **Regenerate G-code from source before starting** checked (default when an SVG/STL was imported), Start rebuilds the G-code from the last import using passes, fill, engraving mode and placement, then starts the job. Unchecked, only power, speed and fan are applied to the loaded G-code. Preview rebuilds the path without starting.
- In the import dialog both Z fields (**Slice Z** and **Focus Z**) are grouped at the end of the Laser tab, and Feed Rate / Travel Rate / Scale have short inline explanations.
- New API: `GET/POST /api/profiles`, `GET/PUT/DELETE /api/profiles/:id`, with server-side validation and normalization.
- Settings has an **Add recommended profiles** action for the Mecpow M1 (3.5 W) with starting values for paper, cardboard, vinyl, MDF, hardwood, acrylic, leather, metal marking, PLA and ABS.
- Tests: `api.profiles` (9 tests) covering create, validation, normalization, filtering by machine, update, read and delete. Full suite: **614 tests passing**; webpack compiles.

### Fixes
- The bounding box and the simulations **ignore the final park / return-to-origin move**.
- **"Trace work area"** computes the corners from the G-code itself (honoring the import offset) instead of the visualizer state.


### Dev/Infra
- Development environment with **Docker Compose** and incremental builds (backend ~1.5 s via babel-watch + nodemon; frontend with HMR).
- Serial device access through `/dev` + `device_cgroup_rules`.
- The CNCjs config file (Machine Profiles, **Laser Profiles**, macros, commands) is now stored in the **`cncjs-config` volume** at `/data/.cncrc`, so it survives `docker compose down/up`.
  - To migrate an existing `/root/.cncrc` before recreating the container:
    ```bash
    docker cp cncjs-cncjs-1:/root/.cncrc .cncrc
    docker compose up -d --force-recreate
    docker cp .cncrc cncjs-cncjs-1:/data/.cncrc
    ```

### Verification
- `jest`: 614 tests passing.
- eslint: clean.
- webpack bundle: compiles.
