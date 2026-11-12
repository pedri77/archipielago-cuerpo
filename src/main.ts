import './style.css';
import gsap from 'gsap';
import * as THREE from 'three';
import { crearCuerpo, type Pieza } from './cuerpo';
import { almacen, cargarAtlas, detectarLang, ORDEN, type Atlas, type Lang } from './datos';
import { crearEscena } from './escena';
import { STR } from './i18n';
import { abrirReto } from './reto';
import { dibujarMapa, marco, texturaRotulo } from './rotulos';
import { crearSonido } from './sonido';
import { crearViaje, dur } from './viaje';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;

// Contenido opcional de cierre (CTA). Solo se activa con permiso explícito para ese día.
const CTA: { activo: boolean; html: string } = { activo: false, html: '' };

function hayWebGL() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

async function iniciar() {
  let lang: Lang = detectarLang();
  let atlas: Atlas = await cargarAtlas(lang);
  const t = () => STR[lang];
  const hechos = new Set<string>(almacen.leer<string[]>('arch.hechos', []));
  let activa: string | null = null;
  let listaParaZarpar = false;

  if (!hayWebGL()) {
    $('#sin-webgl').hidden = false;
    traducir();
    return;
  }

  const esc = crearEscena($('#escena'));
  const viaje = crearViaje(esc);
  const cuerpo = crearCuerpo(esc, () => atlas);
  const sonido = crearSonido();
  const sis = (k: string) => atlas.systems.find(s => s.k === k)!;
  const cuenta = (k: string) => atlas.parts.filter(p => atlas.concepts[p.c].s === k).length;

  // ---------------------------------------------------------------- textos
  function traducir() {
    document.documentElement.lang = lang;
    document.querySelectorAll<HTMLElement>('[data-t]').forEach(el => {
      const v = (STR[lang] as Record<string, unknown>)[el.dataset.t!];
      if (typeof v === 'string') el.textContent = v;
    });
    document.title = STR[lang].titulo;
  }

  function rotulos() {
    for (const isla of esc.islas) {
      const s = sis(isla.k);
      const mat = isla.rotulo.material as THREE.SpriteMaterial;
      mat.map?.dispose();
      mat.map = texturaRotulo(s.n, hechos.has(isla.k) ? t().retoHecho : t().estructuras(cuenta(isla.k)), s.c, hechos.has(isla.k));
      mat.needsUpdate = true;
      isla.rotulo.scale.set(1.5, 0.59, 1);
      (isla.bandera.material as THREE.MeshStandardMaterial).color.set(s.c);
    }
  }

  function mapa() {
    dibujarMapa(
      $<HTMLElement>('#mapa-svg') as unknown as SVGSVGElement,
      esc.islas.map(i => ({ k: i.k, x: i.centro.x / 6, y: i.centro.z / 6, color: sis(i.k).c, nombre: sis(i.k).n, hecho: hechos.has(i.k) })),
      activa,
      k => irA(k),
    );
    const nav = $('#islas-nav');
    nav.replaceChildren(
      ...[null, ...ORDEN].map(k => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'boton';
        b.textContent = k ? sis(k).n : t().volver;
        b.addEventListener('click', () => irA(k));
        li.append(b);
        return li;
      }),
    );
    $('#progreso').textContent = t().progreso(hechos.size, ORDEN.length);
  }

  function botonesFijos() {
    $('#btn-sonido').textContent = sonido.activo() ? t().sonidoOn : t().sonidoOff;
    $('#btn-sonido').setAttribute('aria-pressed', String(sonido.activo()));
    $('#btn-idioma').textContent = t().idioma;
  }

  function panelIsla() {
    if (!activa) { $('#panel-isla').hidden = true; return; }
    const s = sis(activa);
    const i = ORDEN.indexOf(activa as (typeof ORDEN)[number]);
    $('#isla-num').textContent = `${i + 1} / ${ORDEN.length}`;
    $('#isla-nombre').textContent = s.n;
    $('#isla-desc').textContent = s.d;
    $('#btn-reto').textContent = hechos.has(activa) ? `${t().retoHecho} ✓` : t().reto;
    $('#panel-isla').hidden = false;
    gsap.fromTo('#panel-isla', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: dur(0.6), ease: 'power2.out' });
  }

  // ---------------------------------------------------------------- ficha
  let fichaPieza: Pieza | null = null;
  function ficha(pz: Pieza | null) {
    fichaPieza = pz;
    const el = $('#ficha');
    if (!pz) { el.hidden = true; cuerpo.resaltar([]); return; }
    const c = atlas.concepts[pz.parte.c];
    const lado = t().lado[pz.parte.sd] ?? '';
    const cont = el.querySelector('.ficha-cont')!;
    cont.replaceChildren();
    const btn = Object.assign(document.createElement('button'), { className: 'cerrar-ficha', type: 'button', textContent: '×' });
    btn.setAttribute('aria-label', t().cerrar);
    btn.addEventListener('click', () => ficha(null));
    const g = Object.assign(document.createElement('p'), { className: 'grupo', textContent: `${sis(c.s).n} · ${c.g}` });
    const h = Object.assign(document.createElement('h3'), { textContent: lado ? `${c.n} (${lado})` : c.n });
    const d = Object.assign(document.createElement('p'), { textContent: c.d });
    cont.append(btn, g, h, d);
    if (c.f?.length) {
      const dl = document.createElement('dl');
      for (const [k, v] of c.f) dl.append(Object.assign(document.createElement('dt'), { textContent: k }), Object.assign(document.createElement('dd'), { textContent: v }));
      cont.append(dl);
    }
    el.hidden = false;
    cuerpo.resaltar([pz]);
  }

  // ---------------------------------------------------------------- navegación
  let viajeId = 0;
  async function irA(k: string | null) {
    if (k === activa && k !== null) return;
    const id = ++viajeId;
    ficha(null);
    activa = k;
    location.hash = k ? `#/isla/${k}` : '#/';
    esc.islas.forEach(i => (i.rotulo.visible = i.k !== k));
    mapa();
    panelIsla();
    sonido.cambiar(k ?? 'inicio');
    if (!k) {
      const v = viaje.vistaGeneral();
      await viaje.volar(v.pos, v.objetivo, 2.2, 0.4);
      return;
    }
    const isla = cuerpo.isla(k);
    // primero vuela hacia la isla mientras termina de cargar su sistema
    const previa = viaje.vistaIsla(isla, null);
    const llegada = viaje.volar(previa.pos, previa.objetivo, 2.0, 0.6);
    await cuerpo.cargar(k).catch(() => {});
    await llegada;
    if (id !== viajeId) return;
    const v = viaje.vistaIsla(isla, cuerpo.caja(k));
    await viaje.volar(v.pos, v.objetivo, 0.8, 0);
  }

  function paso(d: number) {
    const i = activa ? ORDEN.indexOf(activa as (typeof ORDEN)[number]) : -1;
    irA(ORDEN[(i + d + ORDEN.length) % ORDEN.length]);
  }

  function desdeHash() {
    const m = location.hash.match(/^#\/isla\/(\w+)/);
    return m && (ORDEN as readonly string[]).includes(m[1]) ? m[1] : null;
  }

  // ---------------------------------------------------------------- reto
  function reto() {
    if (!activa || !cuerpo.listo(activa)) return;
    const k = activa;
    const s = sis(k);
    ficha(null);
    abrirReto({
      raiz: $('#reto'),
      piezas: cuerpo.piezasIsla(k),
      atlas,
      soporte: cuerpo.isla(k).soporte,
      color: s.c,
      textos: { titulo: t().retoTitulo(s.n), ayuda: t().retoAyuda, bien: t().retoBien, mal: t().retoMal, fin: t().retoFin, cerrar: t().cerrar },
      alAcertar: pz => cuerpo.resaltar(pz),
      alTerminar: () => {
        hechos.add(k);
        almacen.guardar('arch.hechos', [...hechos]);
        rotulos(); mapa(); panelIsla();
        if (hechos.size === ORDEN.length) setTimeout(final, 1200);
      },
      alCerrar: () => { cuerpo.resaltar([]); $('#btn-reto').focus(); },
    });
  }

  async function final() {
    $<HTMLElement & { close?: () => void }>('#reto').querySelector<HTMLButtonElement>('.cerrar')?.click();
    await irA(null);
    gsap.fromTo(cuerpo.central.scale, { x: 1, y: 1, z: 1 }, { x: 1.04, y: 1.04, z: 1.04, duration: dur(0.6), yoyo: true, repeat: 3, ease: 'sine.inOut' });
    if (CTA.activo) { $('#cta').innerHTML = CTA.html; $('#cta').hidden = false; }
    $('#final').hidden = false;
    $('#btn-final-cerrar').focus();
  }

  // ---------------------------------------------------------------- eventos
  $('#btn-reto').addEventListener('click', reto);
  $('#btn-ant').addEventListener('click', () => paso(-1));
  $('#btn-sig').addEventListener('click', () => paso(1));
  $('#btn-volver').addEventListener('click', () => irA(null));
  $('#btn-final-cerrar').addEventListener('click', () => ($('#final').hidden = true));
  $('#btn-creditos').addEventListener('click', () => $<HTMLDialogElement>('#creditos').showModal());
  $('#btn-sonido').addEventListener('click', async () => { await sonido.alternar(); botonesFijos(); });
  $('#btn-idioma').addEventListener('click', async () => {
    lang = lang === 'es' ? 'en' : 'es';
    atlas = await cargarAtlas(lang);
    traducir(); botonesFijos(); rotulos(); mapa(); panelIsla();
    if (fichaPieza) ficha(fichaPieza);
  });
  addEventListener('hashchange', () => { const k = desdeHash(); if (k !== activa && listaParaZarpar) irA(k); });
  addEventListener('keydown', e => {
    if (!$('#reto').hidden || !$('#portada').hidden || (e.target as HTMLElement).closest('input,select,textarea')) return;
    if (e.key === 'ArrowRight') paso(1);
    else if (e.key === 'ArrowLeft') paso(-1);
    else if (e.key === 'Escape') { if (fichaPieza) ficha(null); else irA(null); }
  });

  // clic sin arrastre: estructura (ficha) o isla (viajar)
  const lienzo = esc.renderer.domElement;
  let abajo: { x: number; y: number } | null = null;
  lienzo.addEventListener('pointerdown', e => (abajo = { x: e.clientX, y: e.clientY }));
  lienzo.addEventListener('pointerup', e => {
    if (!abajo || Math.hypot(e.clientX - abajo.x, e.clientY - abajo.y) > 6) return;
    const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    const pz = cuerpo.tocar(ndc, activa);
    if (pz) { ficha(pz); return; }
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, esc.camera);
    const golpe = ray.intersectObjects(esc.islas.map(i => i.grupo), true)[0];
    if (golpe) {
      const isla = esc.islas.find(i => i.grupo === golpe.object || i.grupo.getObjectById(golpe.object.id));
      if (isla && isla.k !== activa) { irA(isla.k); return; }
    }
    ficha(null);
  });
  addEventListener('resize', () => { esc.redimensionar(); });

  // ---------------------------------------------------------------- arranque
  traducir(); botonesFijos(); rotulos();
  marco($('#portada-caja'), { seed: 5 });
  marco($('#panel-isla'), { seed: 9 });
  marco($('#final-caja'), { seed: 13 });
  $('#ficha').append(Object.assign(document.createElement('div'), { className: 'ficha-cont' }));
  marco($('#ficha'), { seed: 31 });
  esc.camera.position.set(-14, 16, -10);
  esc.controls.update();

  // bucle de render
  const reloj = new THREE.Clock();
  let parado = false;
  document.addEventListener('visibilitychange', () => (parado = document.hidden));
  esc.renderer.setAnimationLoop(() => {
    if (parado) return;
    const tt = reloj.getElapsedTime();
    esc.animarMar(tt);
    esc.islas.forEach((i, n) => (i.rotulo.position.y = 0.32 + 2.1 + Math.sin(tt * 1.2 + n) * 0.04));
    esc.controls.update();
    esc.renderer.render(esc.scene, esc.camera);
  });

  // carga: piel y esqueleto primero (portada), el resto en segundo plano
  const progreso: Record<string, number> = {};
  const primeros = ['teg', 'esq'];
  const totalPrimeros = primeros.reduce((a, k) => a + (atlas.files[k]?.bytes ?? 0), 0);
  const destino = desdeHash();
  if (destino && !primeros.includes(destino)) primeros.push(destino);
  const actualizar = (sk: string, n: number) => {
    progreso[sk] = n;
    const hecho = ['teg', 'esq'].reduce((a, k) => a + (progreso[k] ?? 0) * (atlas.files[k]?.bytes ?? 0), 0);
    const pct = Math.round((hecho / totalPrimeros) * 100);
    $('#carga-barra').style.width = `${pct}%`;
    $('#carga').setAttribute('aria-valuenow', String(pct));
    if (n === 1) $('#carga-texto').textContent = t().sistemaListo(sis(sk).n);
  };
  const todo = cuerpo.cargarTodo(primeros, actualizar);
  await Promise.all(['teg', 'esq'].map(k => cuerpo.cargar(k)));
  const zarpar = $<HTMLButtonElement>('#btn-zarpar');
  zarpar.disabled = false;
  zarpar.focus();
  zarpar.addEventListener('click', async () => {
    listaParaZarpar = true;
    gsap.to('#portada', { opacity: 0, duration: dur(0.8), onComplete: () => { $('#portada').hidden = true; } });
    $('#mapa').hidden = false;
    mapa();
    await viaje.entrada();
    const k = desdeHash();
    if (k) irA(k);
  });
  await todo;
}

iniciar().catch(err => {
  console.error(err);
  $('#sin-webgl').hidden = false;
  $('#sin-webgl').textContent = String(err?.message ?? err);
});
