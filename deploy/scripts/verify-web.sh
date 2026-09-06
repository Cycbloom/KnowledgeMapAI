#!/usr/bin/env bash
set -uo pipefail
echo '--- files on server ---'
ls /opt/km/web | head -8
echo '--- app.cycbloom.cn / ---'
curl -sS -m 15 -o /dev/null -w 'code=%{http_code} size=%{size_download}\n' https://app.cycbloom.cn/
echo '--- index snippet ---'
curl -sS -m 15 https://app.cycbloom.cn/ | grep -oE '<title>[^<]*</title>' | head -2
echo '--- first js asset ---'
ASSET=$(curl -sS -m 15 https://app.cycbloom.cn/ | grep -oE 'assets/[a-zA-Z0-9._-]+\.js' | head -1)
echo "asset=$ASSET"
curl -sS -m 15 -o /dev/null -w 'asset_code=%{http_code} size=%{size_download}\n' "https://app.cycbloom.cn/$ASSET"
echo '--- sw ---'
curl -sS -m 15 -o /dev/null -w 'sw_code=%{http_code}\n' https://app.cycbloom.cn/pwa-sw.js
