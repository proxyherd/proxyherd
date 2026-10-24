#!/usr/bin/env sh
# Publish the npm package in the current directory unless this exact version is
# already on the registry. Used by .github/workflows/build.yml so that re-running
# the npm job after a partial failure does not fail on the packages that went out.
# Extra arguments (for example --dry-run) are passed to npm publish.
set -eu

name="$(node -p "require('./package.json').name")"
version="$(node -p "require('./package.json').version")"

if npm view "${name}@${version}" version >/dev/null 2>&1; then
    echo "${name}@${version} is already on the registry, nothing to publish"
    exit 0
fi

echo "publishing ${name}@${version}"
exec npm publish --access public --provenance "$@"
