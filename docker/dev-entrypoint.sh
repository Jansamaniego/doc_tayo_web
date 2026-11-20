#!/bin/sh
# Keeps the node_modules volume in step with package-lock.json, then runs the command.
set -eu
hash=$(sha256sum package-lock.json | cut -d' ' -f1)
if [ ! -f node_modules/.lock-hash ] || [ "$(cat node_modules/.lock-hash)" != "$hash" ]; then
  echo "package-lock.json changed: installing dependencies..."
  # node_modules is a mount point: empty it instead of removing the directory.
  find node_modules -mindepth 1 -delete 2>/dev/null || true
  npm ci
  echo "$hash" > node_modules/.lock-hash
fi
exec "$@"
