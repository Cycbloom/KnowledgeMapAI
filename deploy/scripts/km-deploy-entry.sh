#!/usr/bin/env bash
# Restricted deploy entry for lighthouse (invoked only via authorized_keys command=).
# Receives a base64-encoded tarball on stdin, deploys web/apk/manifest.
# Safe envelope: ONLY writes /opt/km/web (and temp dirs under /tmp).
set -euo pipefail
shopt -s nocasematch

# Explicitly reject scp/sftp/arbitrary commands: this channel only accepts a
# stdin base64 payload, never remote command execution.
cmd="${SSH_ORIGINAL_COMMAND:-}"
if [[ -n "$cmd" ]]; then
  case "$cmd" in
    *scp*|*sftp*|*ssh*|*bash*|*base64*|*sh\ *)
      echo "arbitrary/against-command rejected: stdin payload channel only" >&2
      exit 1
      ;;
  esac
fi

TMP=$(mktemp -d /tmp/km-deploy.XXXXXX)
trap 'rm -rf "$TMP"' EXIT

# Decode base64 tarball from stdin.
base64 -d > "$TMP/bundle.tar.gz"
if [ ! -s "$TMP/bundle.tar.gz" ]; then
  echo "no bundle payload" >&2
  exit 1
fi
tar -xzf "$TMP/bundle.tar.gz" -C "$TMP"

# Deploy web bundle, preserving /opt/km/web/downloads.
if [ -f "$TMP/web-dist.tgz" ]; then
  cd /opt/km/web
  find . -mindepth 1 -maxdepth 1 ! -name downloads -exec rm -rf {} +
  tar -xzf "$TMP/web-dist.tgz" -C /opt/km/web
fi
if [ -f "$TMP/knowledgemap.apk" ]; then
  cp -f "$TMP/knowledgemap.apk" /opt/km/web/downloads/knowledgemap.apk
fi
if [ -f "$TMP/latest.json" ]; then
  cp -f "$TMP/latest.json" /opt/km/web/downloads/latest.json
fi
echo "deploy OK"
cat /opt/km/web/downloads/latest.json