#!/bin/bash
# Frontend prerequisites for `yarn dev`.
#
# Runs concurrently with start-server-dev, so it must not clean output/ (that
# would race with the running backend). favicon/images/assets are already
# staged by build-dev-server.sh; this only refreshes the app i18n resources
# that webpack bundles. The bundle and index.hbs are produced by
# `webpack serve` (start-app-dev).
set -e

export PATH="$PWD/node_modules/.bin:$PATH"

i18next-scanner --config i18next-scanner.app.config.js \"src/app/**/*.{html,js,jsx}\" \"!src/app/i18n/**\" \"!**/node_modules/**\"

mkdir -p output/cncjs/app
cp -af src/app/i18n output/cncjs/app/
