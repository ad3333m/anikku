#!/usr/bin/env bash
# Runs the APK on an Android TV emulator (1080p) and drives it with remote key presses, saving a
# screenshot after each step to tv-shots/.
set -uo pipefail
OUT=tv-shots
mkdir -p "$OUT"
adb install -r out/Ciname-TV.apk || { echo "install failed"; exit 0; }
shot() { sleep "$2"; adb exec-out screencap -p > "$OUT/$1.png"; }
key() { adb shell input keyevent "$1"; sleep 1.2; }

adb shell am start -n com.ad3333m.ciname/.MainActivity
shot 1-picker 25
key KEYCODE_DPAD_CENTER;                 shot 2-anikku-home 25
key KEYCODE_DPAD_DOWN; key KEYCODE_DPAD_DOWN; key KEYCODE_DPAD_RIGHT
                                         shot 3-anikku-remote 3
key KEYCODE_BACK;                        shot 4-back-to-picker 4
key KEYCODE_DPAD_RIGHT; key KEYCODE_DPAD_CENTER
                                         shot 5-cinejoy 30
key KEYCODE_BACK;                        shot 6-picker-again 4
adb shell "am start -n com.ad3333m.ciname/.MainActivity --es open anikku --es path '#/watch/97940/1'"
                                         shot 7-anikku-watch 40
key KEYCODE_DPAD_UP;                     shot 8-player-subtitles 3
adb logcat -d | grep -iE "chromium|ciname|AndroidRuntime|FATAL" | tail -300 > "$OUT/logcat.txt"
ls -la "$OUT"
