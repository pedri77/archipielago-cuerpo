#!/usr/bin/env bash
# Convierte salida/<id>/audio.flac en public/audio/<id>.mp3 (60 s, fundidos, -14 LUFS, 128 kbps; MP3 por compatibilidad con Safari)
# y escribe public/audio/pistas.json con las pistas disponibles.
# Uso: scripts/yue/postproceso.sh salida/
set -euo pipefail
ORIGEN="${1:?carpeta con las salidas de YuE2}"
DESTINO="$(cd "$(dirname "$0")/../.." && pwd)/public/audio"
mkdir -p "$DESTINO"
ids=()
for d in "$ORIGEN"/*/; do
  id="$(basename "$d")"
  f="$d/audio.flac"
  [ -f "$f" ] || continue
  ffmpeg -hide_banner -loglevel error -y -i "$f" -t 60 \
    -af "afade=t=in:d=1.5,afade=t=out:st=57:d=3,loudnorm=I=-14:TP=-1.5:LRA=11" \
    -ac 2 -ar 48000 -c:a libmp3lame -b:a 128k "$DESTINO/$id.mp3"
  ids+=("\"$id\"")
  echo "ok $id"
done
( IFS=,; echo "[${ids[*]}]" ) > "$DESTINO/pistas.json"
echo "manifiesto: $DESTINO/pistas.json"
