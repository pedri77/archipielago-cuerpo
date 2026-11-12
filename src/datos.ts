// Tipos y carga del atlas (derivado de niuxito/human-body, CC BY-SA 4.0).
export type Lang = 'es' | 'en';
export interface Sistema { k: string; n: string; c: string; layer: number; d: string }
export interface Concepto { n: string; s: string; g: string; d: string; f: [string, string][]; gk?: string }
export interface Parte { id: string; c: number; sd: 'D' | 'I' | ''; en: string; col: string }
export interface Atlas {
  systems: Sistema[];
  concepts: Concepto[];
  parts: Parte[];
  files: Record<string, { bytes: number }>;
}

// Orden de las islas alrededor del cuerpo (de fuera hacia dentro, como el atlas).
export const ORDEN = ['teg', 'mus', 'esq', 'ner', 'car', 'res', 'dig', 'uri', 'rep', 'end', 'lin'] as const;
export type ClaveSistema = (typeof ORDEN)[number];

const cache: Partial<Record<Lang, Atlas>> = {};
export async function cargarAtlas(lang: Lang): Promise<Atlas> {
  if (cache[lang]) return cache[lang]!;
  const r = await fetch(`${import.meta.env.BASE_URL}data/anatomia.${lang}.json`);
  if (!r.ok) throw new Error(`atlas ${lang}: ${r.status}`);
  const a = (await r.json()) as Atlas;
  cache[lang] = a;
  return a;
}

export function detectarLang(): Lang {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'en' || q === 'es') return q;
  return (navigator.language || 'es').toLowerCase().startsWith('es') ? 'es' : 'en';
}

export const reducirMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const esMovil = matchMedia('(pointer: coarse)').matches || innerWidth < 760;

// Almacenamiento local tolerante a fallos (modo privado, iframes, etc.).
export const almacen = {
  leer<T>(k: string, def: T): T {
    try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : def; } catch { return def; }
  },
  guardar(k: string, v: unknown) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ }
  },
};
