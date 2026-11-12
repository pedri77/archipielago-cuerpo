"""Genera las 12 pistas con YuE2 en una máquina con GPU NVIDIA de 24 GB (BF16).

Uso en la máquina alquilada:
    git clone https://github.com/multimodal-art-projection/YuE.git && cd YuE
    python3.12 -m venv .venv && . .venv/bin/activate && pip install .
    python /ruta/a/generar.py /ruta/a/pistas.json salida/

Deja salida/<id>/audio.flac más la partitura y los ajustes de cada pista.
Solo usa textos propios (sin datos personales). Pesos: m-a-p/YuE2-3B
(licencia de pesos CC BY-NC 4.0 con permiso adicional para creadores; ver MODEL_LICENSE).
"""
import json
import sys
from pathlib import Path

from yue2 import YuE2Pipeline


def main() -> None:
    pistas = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    salida = Path(sys.argv[2])
    solo = set(sys.argv[3:])  # opcional: ids concretos para repetir
    with YuE2Pipeline.from_pretrained("m-a-p/YuE2-3B", device="cuda") as pipe:
        for p in pistas:
            if solo and p["id"] not in solo:
                continue
            destino = salida / p["id"]
            if (destino / "audio.flac").exists():
                print("ya existe", p["id"])
                continue
            req = {"style": p["style"], "lyrics": p["lyrics"], "cot": "full", "seed": p["seed"]}
            print("generando", p["id"], flush=True)
            cancion = pipe(**req)
            cancion.save_artifacts(str(destino))
            print("  truncada:", cancion.truncated, flush=True)


if __name__ == "__main__":
    main()
