#!/usr/bin/env bash
# Runs the phone APK on a Pixel-sized emulator and saves screenshots to phone-shots/:
# the picker, Anikku, Back to the picker, and Cinejoy.
set -uo pipefail
OUT=phone-shots
mkdir -p "$OUT"
APP=com.ad3333m.ciname.android
adb install -r out/Ciname-Android.apk || { echo "install failed"; exit 0; }
shot() { sleep "$2"; adb exec-out screencap -p > "$OUT/$1.png"; }
start() { adb shell am force-stop $APP; adb shell "am start -n $APP/com.ad3333m.ciname.MainActivity $*"; }

start;                          shot 1-picker 25
start --es open anikku;         shot 2-anikku 25
adb shell input keyevent KEYCODE_BACK; shot 3-back-to-picker 4
start --es open cinejoy;        shot 4-cinejoy 30
start --es open anikku --es path "'#/watch/97940/1'"; shot 5-anikku-watch 40
adb logcat -d | grep -iE "ciname|AndroidRuntime|FATAL" | tail -200 > "$OUT/logcat.txt"
ls -la "$OUT"
