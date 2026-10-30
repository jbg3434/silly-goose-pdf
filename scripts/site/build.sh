#!/usr/bin/env bash
# Assembles the GitHub Pages site: static pages from site/ plus Gus art and sounds from the web app.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
out="${1:-$root/_site}"
rm -rf "$out"
mkdir -p "$out"
cp -R "$root/site/." "$out/"
cp -R "$root/apps/web/public/brand" "$out/brand"
cp -R "$root/apps/web/public/sounds" "$out/sounds"
cp "$root/apps/web/src/app/icon.svg" "$out/favicon.svg"
touch "$out/.nojekyll"
echo "site assembled in $out"
