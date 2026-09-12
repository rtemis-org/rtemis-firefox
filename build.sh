#!/bin/sh
# Package the extension as an .xpi, excluding macOS junk and dev files.
set -e
cd "$(dirname "$0")"
VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
OUT="rtemis-${VERSION}.xpi"
rm -f "$OUT"
zip -r -X "$OUT" manifest.json styles.js icons/icon-48.png icons/icon-96.png icons/favicon.svg newtab popup \
  -x '*.DS_Store' '__MACOSX/*' '*/.*'
echo "Built $OUT"
unzip -l "$OUT"
