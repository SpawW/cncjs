#!/bin/bash
# Full development build (backend + frontend prerequisites).
#
# `yarn dev` runs build-dev-server.sh and build-dev-app.sh in parallel so the
# backend can boot while the frontend is still compiling. This entry point runs
# both sequentially for a standalone build.
set -e

bash "$(dirname "$0")/build-dev-server.sh"
bash "$(dirname "$0")/build-dev-app.sh"
