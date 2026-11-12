// Trazo a mano con Rough.js: rótulos de las islas (texturas), marcos de paneles y mapa.
// Semillas fijas: el dibujo no tiembla entre redibujados.
import rough from 'roughjs';
import * as THREE from 'three';

const TIZA = '#f2ece1';
const ROJO = '#ef4444';
const FUENTE = "'Kalam', cursive";

function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) % 2 ** 31 || 1;
}

// Rótulo flotante sobre cada isla: nombre del sistema en un cartel de tiza.
export function texturaRotulo(texto: string, sub: string, color: string, hecho: boolean) {
  const W = 512, H = 200;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const rc = rough.canvas(c);
  const seed = hash(texto);
  rc.rectangle(18, 22, W - 36, H - 60, {
    seed, roughness: 1.6, bowing: 1.4, stroke: TIZA, strokeWidth: 3,
    fill: 'rgba(11,11,11,0.82)', fillStyle: 'solid',
  });
  rc.line(W / 2 - 14, H - 38, W / 2, H - 6, { seed, stroke: TIZA, strokeWidth: 3 });
  rc.line(W / 2 + 14, H - 38, W / 2, H - 6, { seed: seed + 1, stroke: TIZA, strokeWidth: 3 });
  rc.circle(56, 72, 30, { seed, fill: color, fillStyle: 'solid', stroke: TIZA, strokeWidth: 2 });
  g.fillStyle = TIZA;
  g.font = `700 50px ${FUENTE}`;
  g.textBaseline = 'middle';
  let tam = 50;
  while (g.measureText(texto).width > W - 130 && tam > 26) { tam -= 2; g.font = `700 ${tam}px ${FUENTE}`; }
  g.fillText(texto, 86, 70);
  g.font = `400 28px ${FUENTE}`;
  g.fillStyle = hecho ? ROJO : 'rgba(242,236,225,0.7)';
  g.fillText(sub, 86, 116);
  if (hecho) {
    rc.path('M 440 64 L 456 84 L 486 44', { seed, stroke: ROJO, strokeWidth: 5, roughness: 1.2 });
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Marco dibujado a mano detrás de un panel HTML. Se redibuja si cambia de tamaño.
export function marco(el: HTMLElement, opciones: { seed?: number; relleno?: string; color?: string } = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('marco');
  svg.setAttribute('aria-hidden', 'true');
  el.prepend(svg);
  const seed = opciones.seed ?? hash(el.id || el.className || 'marco');
  const dibujar = () => {
    const { width: w, height: h } = el.getBoundingClientRect();
    if (!w || !h) return;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    svg.replaceChildren(
      rough.svg(svg).rectangle(4, 4, w - 8, h - 8, {
        seed, roughness: 1.3, bowing: 1.2, stroke: opciones.color ?? TIZA, strokeWidth: 2,
        fill: opciones.relleno ?? 'rgba(11,11,11,0.86)', fillStyle: 'solid',
      }),
    );
  };
  new ResizeObserver(dibujar).observe(el);
  dibujar();
}

export interface PuntoMapa { k: string; x: number; y: number; color: string; nombre: string; hecho: boolean }

// Mapa del archipiélago (vista cenital) para saltar entre islas.
export function dibujarMapa(svg: SVGSVGElement, puntos: PuntoMapa[], activa: string | null, alElegir: (k: string | null) => void) {
  const S = 180;
  svg.setAttribute('viewBox', `0 0 ${S} ${S}`);
  svg.replaceChildren();
  const rc = rough.svg(svg);
  svg.append(rc.circle(S / 2, S / 2, S - 12, { seed: 7, stroke: 'rgba(242,236,225,0.35)', strokeWidth: 1, roughness: 2 }));
  const centro = rc.circle(S / 2, S / 2, 26, {
    seed: 3, stroke: TIZA, strokeWidth: 1.5, fill: activa === null ? ROJO : 'rgba(242,236,225,0.12)', fillStyle: 'solid',
  });
  centro.classList.add('punto');
  centro.addEventListener('click', () => alElegir(null));
  svg.append(centro);
  for (const p of puntos) {
    const cx = S / 2 + p.x * (S / 2 - 22), cy = S / 2 + p.y * (S / 2 - 22);
    const n = rc.circle(cx, cy, activa === p.k ? 24 : 18, {
      seed: hash(p.k), stroke: activa === p.k ? ROJO : TIZA, strokeWidth: activa === p.k ? 2.5 : 1.5,
      fill: p.color, fillStyle: p.hecho ? 'solid' : 'hachure', hachureGap: 3, fillWeight: 1,
    });
    n.classList.add('punto');
    const tit = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    tit.textContent = p.nombre;
    n.append(tit);
    n.addEventListener('click', () => alElegir(p.k));
    svg.append(n);
  }
}

// Silueta a mano para las ranuras del reto (canvas 2D).
export function ranura(c: HTMLCanvasElement, x: number, y: number, w: number, h: number, seed: number, estado: 'libre' | 'bien' | 'mal') {
  const rc = rough.canvas(c);
  rc.rectangle(x, y, w, h, {
    seed, roughness: 1.4, stroke: estado === 'bien' ? ROJO : TIZA, strokeWidth: estado === 'libre' ? 1.8 : 3,
    strokeLineDash: estado === 'libre' ? [8, 6] : undefined,
    fill: estado === 'bien' ? 'rgba(239,68,68,0.14)' : undefined, fillStyle: 'solid',
  });
}
