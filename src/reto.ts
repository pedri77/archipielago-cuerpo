// Reto de cada isla con Matter.js: las piezas (miniaturas de mallas reales) caen a una bandeja
// y hay que arrastrar cada una hasta su nombre. Semilla fija para que la partida sea reproducible.
import Matter from 'matter-js';
import * as THREE from 'three';
import type { Pieza } from './cuerpo';
import type { Atlas } from './datos';
import { reducirMovimiento } from './datos';
import { semilla } from './escena';
import { ranura } from './rotulos';

const { Engine, Bodies, Body, Composite, Mouse, MouseConstraint, Events, Query } = Matter;

interface Opcion { c: number; nombre: string; piezas: Pieza[]; img: HTMLImageElement; url: string }

// ---------------------------------------------------------------- miniaturas
let rMini: THREE.WebGLRenderer | null = null;
function miniatura(piezas: Pieza[], soporte: THREE.Object3D, color: string) {
  const T = 192;
  rMini ??= new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  rMini.setSize(T, T, false);
  rMini.setClearColor(0x000000, 0);
  const esc = new THREE.Scene();
  esc.add(new THREE.HemisphereLight(0xffffff, 0x302020, 1.4));
  const luz = new THREE.DirectionalLight(0xffffff, 2.2);
  luz.position.set(1, 2, 3);
  esc.add(luz);
  soporte.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(soporte.matrixWorld).invert();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
  const grupo = new THREE.Group();
  for (const p of piezas) {
    const m = new THREE.Mesh(p.malla.geometry, mat);
    new THREE.Matrix4().multiplyMatrices(inv, p.malla.matrixWorld).decompose(m.position, m.quaternion, m.scale);
    grupo.add(m);
  }
  esc.add(grupo);
  grupo.updateMatrixWorld(true);
  const caja = new THREE.Box3().setFromObject(grupo);
  const c = caja.getCenter(new THREE.Vector3());
  const s = caja.getSize(new THREE.Vector3());
  const lado = Math.max(s.x, s.y) * 0.56 || 0.1;
  const cam = new THREE.OrthographicCamera(-lado, lado, lado, -lado, 0.01, 20);
  cam.position.set(c.x, c.y, c.z + 5);
  cam.lookAt(c);
  rMini.render(esc, cam);
  const url = rMini.domElement.toDataURL('image/png');
  mat.dispose();
  return url;
}

function elegir(piezas: Pieza[], atlas: Atlas, soporte: THREE.Object3D, color: string, n: number): Opcion[] {
  const porConcepto = new Map<number, Pieza[]>();
  for (const p of piezas) {
    const l = porConcepto.get(p.parte.c) ?? [];
    l.push(p);
    porConcepto.set(p.parte.c, l);
  }
  const tam = (l: Pieza[]) => {
    const b = new THREE.Box3();
    l.forEach(p => { p.malla.geometry.computeBoundingBox(); b.union(p.malla.geometry.boundingBox!.clone().applyMatrix4(p.malla.matrixWorld)); });
    const s = b.getSize(new THREE.Vector3());
    return s.x * s.y + s.y * s.z + s.x * s.z;
  };
  const nombres = new Set<string>();
  const candidatos = [...porConcepto.entries()]
    .map(([c, l]) => { const rep = [l.find(p => p.parte.sd !== 'D') ?? l[0]]; return { c, l, rep, t: tam(rep) }; })
    .sort((a, b) => b.t - a.t)
    // una pieza por grupo anatómico (no cinco costillas que no se distinguen) y nombres únicos
    .filter(x => {
      const cc = atlas.concepts[x.c];
      const g = `g:${cc.gk ?? cc.g}`;
      if (nombres.has(cc.n) || nombres.has(g)) return false;
      nombres.add(cc.n); nombres.add(g);
      return true;
    })
    .slice(0, 12);
  // barajado con semilla del día: cambia de un día a otro, estable dentro del mismo día
  const r = semilla(Math.floor(Date.now() / 864e5) + candidatos.length);
  for (let i = candidatos.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [candidatos[i], candidatos[j]] = [candidatos[j], candidatos[i]]; }
  return candidatos.slice(0, n).map(x => {
    const url = miniatura(x.rep, soporte, color);
    const img = new Image();
    img.src = url;
    return { c: x.c, nombre: atlas.concepts[x.c].n, piezas: x.l, img, url };
  });
}

// ---------------------------------------------------------------- partida
export interface TextosReto { titulo: string; ayuda: string; bien: string; mal: string; fin: string; cerrar: string }

export function abrirReto(o: {
  raiz: HTMLElement; piezas: Pieza[]; atlas: Atlas; soporte: THREE.Object3D; color: string;
  textos: TextosReto; alAcertar: (p: Pieza[]) => void; alTerminar: () => void; alCerrar: () => void;
}) {
  const opciones = elegir(o.piezas, o.atlas, o.soporte, o.color, 5);
  const raiz = o.raiz;
  raiz.hidden = false;
  raiz.innerHTML = `
    <div class="reto-caja" role="dialog" aria-modal="true" aria-labelledby="reto-tit">
      <header><h2 id="reto-tit"></h2><button class="boton cerrar" type="button"></button></header>
      <p class="reto-ayuda"></p>
      <div class="reto-lienzo"><canvas></canvas><p class="reto-aviso" aria-live="polite"></p></div>
      <ol class="reto-lista"></ol>
    </div>`;
  raiz.querySelector('h2')!.textContent = o.textos.titulo;
  raiz.querySelector('.reto-ayuda')!.textContent = o.textos.ayuda;
  const btnCerrar = raiz.querySelector<HTMLButtonElement>('.cerrar')!;
  btnCerrar.textContent = o.textos.cerrar;
  const aviso = raiz.querySelector<HTMLElement>('.reto-aviso')!;
  const caja = raiz.querySelector<HTMLElement>('.reto-lienzo')!;
  const canvas = caja.querySelector('canvas')!;
  const lista = raiz.querySelector<HTMLOListElement>('.reto-lista')!;

  const W = Math.max(300, caja.clientWidth);
  const H = Math.max(360, caja.clientHeight);
  const dpr = Math.min(devicePixelRatio, 2);
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
  const g = canvas.getContext('2d')!;

  // ranuras con el nombre: arriba, en una o dos filas
  const nombres = [...opciones].sort((a, b) => a.nombre.localeCompare(b.nombre));
  const porFila = W < 560 ? Math.ceil(nombres.length / 2) : nombres.length;
  const filas = Math.ceil(nombres.length / porFila);
  const ancho = (W - 24) / porFila - 10;
  const alto = Math.min(ancho, 128) * 0.95;
  const ranuras = nombres.map((op, i) => ({
    c: op.c, nombre: op.nombre, estado: 'libre' as 'libre' | 'bien' | 'mal',
    x: 12 + (i % porFila) * (ancho + 10) + 5, y: 12 + Math.floor(i / porFila) * (alto + 34),
    w: ancho, h: alto,
  }));
  const bandejaY = 12 + filas * (alto + 34) + 10;

  const lado = Math.min(96, ancho * 0.9, (H - bandejaY) * 0.6);
  const motor = Engine.create({ gravity: { x: 0, y: reducirMovimiento ? 0 : 1, scale: 0.0012 } });
  const r = semilla(42);
  const muros = [
    Bodies.rectangle(W / 2, H + 30, W * 2, 60, { isStatic: true }),
    Bodies.rectangle(-30, H / 2, 60, H * 2, { isStatic: true }),
    Bodies.rectangle(W + 30, H / 2, 60, H * 2, { isStatic: true }),
    Bodies.rectangle(W / 2, -30, W * 2, 60, { isStatic: true }),
    Bodies.rectangle(W / 2, bandejaY - 4, W, 8, { isStatic: true, collisionFilter: { category: 2 } }), // techo de la bandeja
  ];
  const cuerpos = opciones.map((op, i) => {
    const x = reducirMovimiento ? ((i + 0.5) / opciones.length) * W : 60 + r() * (W - 120);
    const y = reducirMovimiento ? H - lado * 0.7 : bandejaY + 20 + i * 10;
    const b = Bodies.rectangle(x, y, lado, lado, {
      restitution: 0.35, friction: 0.4, frictionAir: 0.02, chamfer: { radius: 10 },
      angle: reducirMovimiento ? 0 : (r() - 0.5) * 0.8,
      collisionFilter: { category: 1, mask: 1 | 2 | 4 },
    });
    b.plugin = { c: op.c, img: op.img, hecho: false };
    return b;
  });
  muros.forEach(m => (m.collisionFilter = { ...m.collisionFilter, category: m.collisionFilter.category === 2 ? 2 : 4 }));
  Composite.add(motor.world, [...muros, ...cuerpos]);

  const raton = Mouse.create(canvas);
  Mouse.setScale(raton, { x: 1 / dpr, y: 1 / dpr });
  const agarre = MouseConstraint.create(motor, { mouse: raton, constraint: { stiffness: 0.25, render: { visible: false } } });
  // al arrastrar, la pieza atraviesa el techo de la bandeja
  Events.on(agarre, 'startdrag', (e: any) => { e.body.collisionFilter.mask = 1 | 4; });
  Composite.add(motor.world, agarre);
  // El soltado se decide por el punto donde se levanta el puntero (también en arrastres muy rápidos).
  const punto = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  let cogida: Matter.Body | null = null;
  canvas.addEventListener('pointerdown', e => { cogida = Query.point(cuerpos, punto(e))[0] ?? null; });
  addEventListener('pointerup', alSoltar);
  function alSoltar(e: PointerEvent) {
    const b = cogida;
    cogida = null;
    if (!b) return;
    soltar(b, punto(e));
  }

  let aciertos = 0;
  function decir(t: string) { aviso.textContent = t; aviso.classList.remove('late'); void aviso.offsetWidth; aviso.classList.add('late'); }

  function acertar(b: Matter.Body, s: (typeof ranuras)[number]) {
    s.estado = 'bien';
    b.plugin.hecho = true;
    Body.setStatic(b, true);
    Body.setAngle(b, 0);
    Body.setPosition(b, { x: s.x + s.w / 2, y: s.y + s.h / 2 });
    Body.scale(b, Math.min(1, (s.h * 0.8) / lado), Math.min(1, (s.h * 0.8) / lado));
    aciertos++;
    const op = opciones.find(x => x.c === b.plugin.c)!;
    o.alAcertar(op.piezas);
    const fila = lista.querySelector<HTMLSelectElement>(`select[data-c="${op.c}"]`);
    if (fila) { fila.value = String(op.c); fila.disabled = true; }
    decir(o.textos.bien);
    if (aciertos === opciones.length) setTimeout(() => { decir(o.textos.fin); o.alTerminar(); setTimeout(() => vivo && cerrar(), 2200); }, 600);
  }

  function soltar(b: Matter.Body, p: { x: number; y: number }) {
    if (b.plugin.hecho) return;
    b.collisionFilter.mask = 1 | 2 | 4;
    const s = ranuras.find(s => p.x > s.x && p.x < s.x + s.w && p.y > s.y && p.y < s.y + s.h + 30);
    if (!s) {
      if (b.position.y < bandejaY) Body.setPosition(b, { x: b.position.x, y: bandejaY + lado });
      return;
    }
    if (s.estado === 'bien') { Body.setPosition(b, { x: b.position.x, y: bandejaY + lado }); return; }
    if (s.c === b.plugin.c) return acertar(b, s);
    s.estado = 'mal';
    setTimeout(() => { if (s.estado === 'mal') s.estado = 'libre'; }, 700);
    Body.setPosition(b, { x: b.position.x, y: bandejaY + lado });
    Body.setVelocity(b, { x: (r() - 0.5) * 8, y: -4 });
    decir(o.textos.mal);
  }

  // alternativa accesible con teclado (y la única interacción si se pide reducir movimiento)
  opciones.forEach((op, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<img alt="" width="56" height="56"><label><span></span><select data-c="${op.c}"><option value="">—</option></select></label>`;
    li.querySelector('img')!.src = op.url;
    li.querySelector('span')!.textContent = `${i + 1}`;
    const sel = li.querySelector('select')!;
    for (const n of nombres) sel.add(new Option(n.nombre, String(n.c)));
    sel.addEventListener('change', () => {
      if (sel.value === String(op.c)) {
        const b = cuerpos[i];
        acertar(b, ranuras.find(s => s.c === op.c)!);
      } else if (sel.value) decir(o.textos.mal);
    });
    lista.append(li);
  });

  // fondo con trazo a mano: se pinta una vez por cambio de estado
  const fondo = document.createElement('canvas');
  fondo.width = canvas.width; fondo.height = canvas.height;
  let firma = '';
  function pintarFondo() {
    const f = ranuras.map(s => s.estado).join();
    if (f === firma) return;
    firma = f;
    const fg = fondo.getContext('2d')!;
    fg.setTransform(1, 0, 0, 1, 0, 0);
    fg.clearRect(0, 0, fondo.width, fondo.height);
    fg.scale(dpr, dpr);
    ranuras.forEach((s, i) => {
      ranura(fondo, s.x, s.y, s.w, s.h, 100 + i, s.estado);
    });
    fg.fillStyle = '#f2ece1';
    fg.font = `700 ${Math.max(13, Math.min(17, ancho / 9))}px Kalam, cursive`;
    fg.textAlign = 'center';
    fg.textBaseline = 'top';
    ranuras.forEach(s => partirTexto(fg, s.nombre, s.x + s.w / 2, s.y + s.h + 4, s.w + 6));
    fg.strokeStyle = 'rgba(242,236,225,0.25)';
    fg.setLineDash([4, 6]);
    fg.beginPath(); fg.moveTo(8, bandejaY); fg.lineTo(W - 8, bandejaY); fg.stroke();
    fg.setLineDash([]);
  }

  let vivo = true;
  let ultimo = performance.now();
  function cuadro(t: number) {
    if (!vivo) return;
    Engine.update(motor, Math.min(32, t - ultimo));
    ultimo = t;
    pintarFondo();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.drawImage(fondo, 0, 0);
    g.scale(dpr, dpr);
    for (const b of cuerpos) {
      const w = b.bounds.max.x - b.bounds.min.x;
      const sz = b.plugin.hecho ? w : lado;
      g.save();
      g.translate(b.position.x, b.position.y);
      g.rotate(b.angle);
      g.fillStyle = b.plugin.hecho ? 'rgba(239,68,68,0.12)' : 'rgba(242,236,225,0.08)';
      g.strokeStyle = b.plugin.hecho ? '#ef4444' : 'rgba(242,236,225,0.5)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.roundRect(-sz / 2, -sz / 2, sz, sz, 10);
      g.fill(); g.stroke();
      if (b.plugin.img.complete) g.drawImage(b.plugin.img, -sz / 2 + 4, -sz / 2 + 4, sz - 8, sz - 8);
      g.restore();
    }
    requestAnimationFrame(cuadro);
  }
  requestAnimationFrame(cuadro);

  function cerrar() {
    vivo = false;
    Mouse.clearSourceEvents(raton);
    Engine.clear(motor);
    raiz.hidden = true;
    raiz.innerHTML = '';
    removeEventListener('keydown', tecla);
    removeEventListener('pointerup', alSoltar);
    o.alCerrar();
  }
  function tecla(e: KeyboardEvent) { if (e.key === 'Escape') cerrar(); }
  addEventListener('keydown', tecla);
  btnCerrar.addEventListener('click', cerrar);
  btnCerrar.focus();
  return { cerrar };
}

function partirTexto(g: CanvasRenderingContext2D, t: string, x: number, y: number, max: number) {
  const palabras = t.split(' ');
  let linea = '';
  let n = 0;
  const alto = parseInt(g.font.match(/(\d+)px/)?.[1] ?? '15') + 2;
  for (const p of palabras) {
    const prueba = linea ? `${linea} ${p}` : p;
    if (g.measureText(prueba).width > max && linea) {
      g.fillText(linea, x, y + n * alto);
      linea = p;
      if (++n >= 1) { // como mucho dos líneas
        const resto = palabras.slice(palabras.indexOf(p)).join(' ');
        let r = resto;
        while (g.measureText(r + '…').width > max && r.length > 3) r = r.slice(0, -1);
        g.fillText(r === resto ? r : r + '…', x, y + n * alto);
        return;
      }
    } else linea = prueba;
  }
  g.fillText(linea, x, y + n * alto);
}
