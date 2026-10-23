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

# Keep the config file (Machine Profiles, Laser Profiles, macros, ...) outside
# the container filesystem. docker-compose sets CNCJS_CONFIG_FILE to a named
# volume; locally it defaults to ~/.cncrc, the same as the CLI default.
export CNCJS_CONFIG_FILE="${CNCJS_CONFIG_FILE:-$HOME/.cncrc}"

exec concurrently --kill-others-on-fail --names "babel-watch,server" \
  "babel --watch -d output/cncjs/server src/server" \
  "nodemon --watch output/cncjs/server --delay 400ms --signal SIGTERM --exec 'node ./bin/cncjs --port 8000 --config \"$CNCJS_CONFIG_FILE\" -m /widget:https://cncjs.github.io/cncjs-widget-boilerplate/v1/'"
