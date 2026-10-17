#!/bin/sh
set -e

# Install dependencies into the node_modules volume on first run.
if [ ! -x node_modules/.bin/concurrently ]; then
  echo "[entrypoint] Installing dependencies..."
  yarn install --immutable
fi

# Register the simulator's virtual serial port with cncjs.
if [ -n "${GRBL_SIM_HOST}" ]; then
  echo "[entrypoint] Configuring cncjs to use ${GRBL_SIM_SERIAL_PATH:-/tmp/ttyGRBL}..."
  cat > "${HOME}/.cncrc" <<EOF
{
  "ports": [
    { "path": "${GRBL_SIM_SERIAL_PATH:-/tmp/ttyGRBL}", "manufacturer": "Grbl Simulator" }
  ]
}
EOF

  if command -v socat >/dev/null 2>&1; then
    echo "[entrypoint] Bridging ${GRBL_SIM_SERIAL_PATH:-/tmp/ttyGRBL} to tcp:${GRBL_SIM_HOST}:${GRBL_SIM_PORT:-5000}..."
    socat pty,raw,echo=0,link="${GRBL_SIM_SERIAL_PATH:-/tmp/ttyGRBL}" "tcp:${GRBL_SIM_HOST}:${GRBL_SIM_PORT:-5000}" &
  fi
fi

exec "$@"
