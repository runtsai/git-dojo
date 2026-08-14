#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
rm -rf playground/lesson-04
mkdir -p playground/lesson-04
cd playground/lesson-04
git init -q
git config user.name "Previous Operator"
git config user.email "ops@example.com"
cat > index.html <<'HTML'
<html>
  <head><title>RTS Freight</title></head>
  <body>
    <h1>RTS Freight</h1>
    <p class="tagline">We haul it right.</p>
  </body>
</html>
HTML
git add . && git commit -qm "Publish first website"
echo "Sandbox ready: playground/lesson-04 (a one-page website on main)."
echo "Now:  cd ../playground/lesson-04   and follow the README."
