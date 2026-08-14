#!/usr/bin/env bash
# Wipes ALL lesson playgrounds. Lessons themselves are untouched. Always safe.
cd "$(dirname "$0")"
rm -rf playground
echo "Playground wiped. Run any lesson's setup.sh to begin again."
