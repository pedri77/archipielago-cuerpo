// Banda sonora: una pista por isla (generadas con YuE, ver scripts/yue/) y una de mar abierto.
// Nunca suena sin que la persona lo active. Fundido cruzado con GSAP sobre nodos de ganancia.
import gsap from 'gsap';
import { almacen } from './datos';

interface Pista { el: HTMLAudioElement; gain: GainNode }

export function crearSonido() {
  let ctx: AudioContext | null = null;
  let maestro: GainNode | null = null;
  let disponibles: Set<string> | null = null;
  const pistas = new Map<string, Pista>();
  let actual: string | null = null;
  let deseada = 'inicio';
  let activo = false;

  async function manifiesto() {
    if (disponibles) return disponibles;
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}audio/pistas.json`);
      disponibles = new Set(r.ok ? ((await r.json()) as string[]) : []);
    } catch { disponibles = new Set(); }
    return disponibles;
  }

  function pista(k: string): Pista | null {
    if (!ctx || !maestro) return null;
    const hit = pistas.get(k);
    if (hit) return hit;
    const el = new Audio(`${import.meta.env.BASE_URL}audio/${k}.mp3`);
    el.loop = true;
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    const gain = ctx.createGain();
    gain.gain.value = 0;
    ctx.createMediaElementSource(el).connect(gain).connect(maestro);
    const p = { el, gain };
    pistas.set(k, p);
    return p;
  }

  async function cambiar(k: string) {
    deseada = k;
    if (!activo) return;
    const lista = await manifiesto();
    const destino = lista.has(k) ? k : lista.has('inicio') ? 'inicio' : null;
    if (destino === actual) return;
    const saleK = actual;
    const sale = saleK ? pistas.get(saleK) : null;
    if (sale) {
      gsap.to(sale.gain.gain, { value: 0, duration: 1.6, ease: 'sine.inOut', onComplete: () => { if (actual !== saleK) sale.el.pause(); } });
    }
    actual = destino;
    if (!destino) return;
    const entra = pista(destino);
    if (!entra) return;
    entra.el.currentTime = 0;
    entra.el.play().catch(() => {});
    gsap.to(entra.gain.gain, { value: 1, duration: 2.2, ease: 'sine.inOut' });
  }

  async function alternar() {
    activo = !activo;
    almacen.guardar('arch.sonido', activo);
    if (activo) {
      ctx ??= new AudioContext();
      if (!maestro) { maestro = ctx.createGain(); maestro.gain.value = 0.7; maestro.connect(ctx.destination); }
      await ctx.resume();
      actual = null;
      await cambiar(deseada);
    } else {
      pistas.forEach(p => gsap.to(p.gain.gain, { value: 0, duration: 0.6, onComplete: () => p.el.pause() }));
      actual = null;
    }
    return activo;
  }

  return { cambiar, alternar, activo: () => activo };
}
