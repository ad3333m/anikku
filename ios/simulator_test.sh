#!/usr/bin/env bash
# Runs the simulator build on an iPhone 17 Pro Max and a 12.9" iPad Pro and saves screenshots
# of the home, series and watch screens to sim-shots/.
set -uo pipefail
cd "$(dirname "$0")"
OUT="$(pwd)/../sim-shots"
mkdir -p "$OUT"
APP=build/Build/Products/Release-iphonesimulator/Anikku.app
BUNDLE=com.ad3333m.anikku

shoot() {
    local id="$1" tag="$2" path="$3" wait="$4"
    if [ -n "$path" ]; then
        xcrun simctl launch --terminate-running-process "$id" "$BUNDLE" -startPath "$path" > /dev/null
    else
        xcrun simctl launch --terminate-running-process "$id" "$BUNDLE" > /dev/null
    fi
    sleep "$wait"
    xcrun simctl io "$id" screenshot "$OUT/$tag.png" > /dev/null
}

run_on() {
    local tag="$1" type="$2" id
    id=$(xcrun simctl create "anikku-$tag" "$type") || { echo "no simulator type $type"; return; }
    xcrun simctl boot "$id"
    xcrun simctl bootstatus "$id" -b > /dev/null
    xcrun simctl install "$id" "$APP" || { echo "install failed on $type"; return; }
    shoot "$id" "$tag-1-home" "" 30
    shoot "$id" "$tag-2-series" "#/anime/97940" 20
    shoot "$id" "$tag-3-watch" "#/watch/97940/1" 35
    xcrun simctl spawn "$id" log show --last 4m --style compact --predicate 'process == "Anikku"' > "$OUT/$tag-log.txt" 2>&1
    xcrun simctl shutdown "$id"
}

run_on phone "iPhone 17 Pro Max"
run_on ipad "iPad Pro (12.9-inch) (5th generation)"
find ~/Library/Logs/DiagnosticReports -iname "*Anikku*" -exec cp {} "$OUT/" \; 2>/dev/null
ls -la "$OUT"
