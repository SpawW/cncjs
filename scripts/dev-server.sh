#!/bin/bash
# Backend dev loop.
#
# build-dev-server.sh has already produced output/cncjs/server once. After that
# this keeps it fresh and reloads bin/cncjs on every change:
#   - `babel --watch` recompiles incrementally (~0.3s per edit)
#   - `nodemon` restarts the server once the output tree settles (~0.9s)
# so a src/server edit is live in ~1.5s instead of the ~38s full container
# restart that used to be the only option.
#
# Only a full container restart is still needed for package.json/deps,
# docker-compose.yml, webpack config, or new server i18n keys.
set -e

export PATH="$PWD/node_modules/.bin:$PATH"
export NODE_ENV=development

exec concurrently --kill-others-on-fail --names "babel-watch,server" \
  "babel --watch -d output/cncjs/server src/server" \
  "nodemon --watch output/cncjs/server --delay 400ms --signal SIGTERM --exec 'node ./bin/cncjs --port 8000 -m /widget:https://cncjs.github.io/cncjs-widget-boilerplate/v1/'"
