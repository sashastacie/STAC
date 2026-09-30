#!/bin/sh
# Copies only the public website into dist/, which is what the host publishes.
# Private working files (content/, tools/, drafts) stay in the private repo.
#
# Cloudflare Pages / Netlify settings:
#   Build command:     sh tools/build-public.sh
#   Output directory:  dist
set -e
rm -rf dist
mkdir -p dist
cp index.html financial-advisory.html ai-technology.html marketing-growth.html 404.html _headers dist/
cp -r assets images logo dist/
echo "Public site ready in dist/ ($(find dist -type f | wc -l) files)"
