#!/usr/bin/env bash
# Runs the simulator build on an iPhone 17 Pro Max and a 12.9" iPad Pro and saves screenshots of the
# picker, Anikku (home and an episode) and Cinejoy to sim-shots/.
set -uo pipefail
cd "$(dirname "$0")"
OUT="$(pwd)/../sim-shots"
mkdir -p "$OUT"
APP=build/Build/Products/Release-iphonesimulator/Ciname.app
BUNDLE=com.ad3333m.ciname

shoot() {
    local id="$1" tag="$2" wait="$3"; shift 3
    xcrun simctl launch --terminate-running-process "$id" "$BUNDLE" "$@" > /dev/null
    sleep "$wait"
    xcrun simctl io "$id" screenshot "$OUT/$tag.png" > /dev/null
}

run_on() {
    local tag="$1" type="$2" id
    id=$(xcrun simctl create "ciname-$tag" "$type") || { echo "no simulator type $type"; return; }
    xcrun simctl boot "$id"
    xcrun simctl bootstatus "$id" -b > /dev/null
    xcrun simctl install "$id" "$APP" || { echo "install failed on $type"; return; }
    shoot "$id" "$tag-1-picker" 25
    shoot "$id" "$tag-2-anikku" 25 -cinameOpen anikku
    shoot "$id" "$tag-3-anikku-watch" 35 -cinameOpen anikku -startPath "#/watch/97940/1"
    shoot "$id" "$tag-4-cinejoy" 30 -cinameOpen cinejoy
    xcrun simctl spawn "$id" log show --last 5m --style compact --predicate 'process == "Ciname"' > "$OUT/$tag-log.txt" 2>&1
    xcrun simctl shutdown "$id"
}

run_on phone "iPhone 17 Pro Max"
run_on ipad "iPad Pro (12.9-inch) (5th generation)"
find ~/Library/Logs/DiagnosticReports -iname "*Ciname*" -exec cp {} "$OUT/" \; 2>/dev/null
ls -la "$OUT"
