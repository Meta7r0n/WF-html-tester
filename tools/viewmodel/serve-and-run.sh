#!/bin/bash
# The sandbox reaps background processes between tool calls, so the preview
# server has to live inside the same invocation as whatever uses it.
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
python3 -m http.server 9102 --bind 127.0.0.1 --directory "$ROOT" >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
for i in $(seq 1 20); do curl -s -o /dev/null -m 1 http://127.0.0.1:9102/preview.html && break; sleep 0.5; done
rc=1
for a in 1 2 3; do
  timeout 900 "$@" > /tmp/wpnrun.out 2>/tmp/wpnrun.err
  rc=$?
  [ $rc -eq 0 ] && break
  echo "attempt $a failed: $(head -1 /tmp/wpnrun.err)" >&2
  sleep 15
done
cat /tmp/wpnrun.out
exit $rc
