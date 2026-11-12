# Archipiélago del cuerpo

Once islas, once sistemas: un viaje 3D por el cuerpo humano para estudiantes.
En el islote central está el cuerpo completo; cada isla guarda un sistema (piel, músculos,
esqueleto, nervioso, cardiovascular, respiratorio, digestivo, urinario, reproductor, endocrino
y linfático) dentro de una silueta translúcida. Toca cualquier estructura para ver su ficha y
supera el reto de cada isla colocando piezas reales en su nombre.

**En línea:** https://pedri77.github.io/archipielago-cuerpo/

Hecho con [three.js](https://threejs.org) (escena y mallas), [GSAP](https://gsap.com) (vuelos de
cámara y fundidos de sonido), [Matter.js](https://brm.io/matter-js/) (retos con física),
[Rough.js](https://roughjs.com) (rótulos, mapa y marcos a mano) y música generada con
[YuE2](https://github.com/multimodal-art-projection/YuE).

## Uso local

```
npm ci
npm run dev        # http://localhost:5173
npm run build      # dist/
```

Enlaces directos a una isla: `#/isla/esq`, `#/isla/car`… Idioma: `?lang=en`.
Teclado: ← y → cambian de isla, Esc vuelve al mapa. Con «reducir movimiento» activo no hay
vuelos ni física: el reto se resuelve con listas desplegables.

## Datos

Las mallas y fichas vienen de [«Anatomía en capas»](https://github.com/niuxito/human-body)
(Alexis Parrón), derivadas de BodyParts3D (DBCLS). Para regenerarlas:

```
git clone https://github.com/niuxito/human-body.git vendor/human-body
git -C vendor/human-body checkout a0cbc6f154673ad15c9c64d5449bac46962f8fb6
npm run datos      # escribe public/models/*.glb y public/data/anatomia.{es,en}.json
```

## Música (YuE2)

`scripts/yue/pistas.json` tiene una pista por isla más la de mar abierto (estilo y letra
propios). Se generan fuera de línea en una GPU NVIDIA de 24 GB con `scripts/yue/generar.py` y
se convierten a MP3 con `scripts/yue/postproceso.sh`, que escribe `public/audio/pistas.json`.
Sin pistas, la web funciona en silencio. El sonido nunca arranca solo.

## Licencias

- Código: MIT (`LICENSE`). Partes de `src/cuerpo.ts` adaptan el visor original (MIT).
- Mallas, fichas y miniaturas: CC BY-SA 4.0 (`LICENSE-contenido.md`).
- three.js y meshoptimizer: MIT (`LICENSE-three.js.txt`, `LICENSE-meshoptimizer.txt`).

## Limitaciones

Un único modelo de varón adulto, sin médula espinal, nervios periféricos ni la mayoría de los
vasos de las extremidades. **Uso educativo, no clínico.** Las fichas no han sido revisadas por
especialistas: conviene que un docente las revise antes de usarlas en clase.
