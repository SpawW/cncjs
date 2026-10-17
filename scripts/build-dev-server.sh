#!/bin/bash
# Backend prerequisites for `yarn dev`. Runs concurrently with
# build-dev-app.sh, so it must not clean output/ -- babel overwrites its own
# outputs and `webpack serve` cleans the app directory, so a clean here would
# only race with the frontend branch.
#
# Stages the static assets the backend needs at boot: serve-favicon stat()s
# favicon.ico while the Express app is being wired up, so it must exist before
# bin/cncjs starts.
set -e

# Invoked directly by concurrently (not via `yarn run`), so put the local
# binaries on PATH ourselves and avoid a Yarn bootstrap just to run package-sync.
export PATH="$PWD/node_modules/.bin:$PATH"

node scripts/package-sync.js

pushd src
mkdir -p ../output/cncjs/
cp -af package.json ../output/cncjs/
cross-env NODE_ENV=development babel "*.js" \
    --config-file ../babel.config.js \
    --out-dir ../output/cncjs
cross-env NODE_ENV=development babel "electron-app/**/*.js" \
    --config-file ../babel.config.js \
    --out-dir ../output/cncjs/electron-app
popd

babel -d output/cncjs/server src/server
i18next-scanner --config i18next-scanner.server.config.js \"src/server/**/*.{html,js,jsx}\" \"!src/server/i18n/**\" \"!**/node_modules/**\"

mkdir -p output/cncjs/server
cp -af src/server/{i18n,views} output/cncjs/server/

mkdir -p output/cncjs/app
cp -af src/app/{favicon.ico,images,assets} output/cncjs/app/
