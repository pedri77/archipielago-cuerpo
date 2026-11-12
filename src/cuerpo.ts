// Carga de las mallas del atlas (GLB + meshopt) y montaje: cuerpo central completo
// y, en cada isla, su sistema aislado dentro de una silueta de piel translúcida.
// Adaptado de niuxito/human-body src/visor.js (MIT).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { Atlas, Parte } from './datos';
import { ORDEN } from './datos';
import type { Escena, Isla } from './escena';

// Desplazamiento original del atlas: pies en y=0 y cuerpo centrado.
const OFFSET = new THREE.Vector3(-0.0006, 0.0135, -0.0965);

function vidrio(mat: THREE.MeshPhysicalMaterial) {
  const u = { value: 1 };
  mat.onBeforeCompile = sh => {
    sh.uniforms.uGlass = u;
    sh.fragmentShader =
      'uniform float uGlass;\n' +
      sh.fragmentShader.replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
         float fres = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.2);
         gl_FragColor.a = mix(gl_FragColor.a, clamp(gl_FragColor.a * 0.55 + fres * 0.75 * sqrt(gl_FragColor.a), 0.0, 1.0), uGlass);
         gl_FragColor.rgb += uGlass * fres * 0.16 * vec3(1.0, 0.92, 0.86);`,
      );
  };
}

const cacheMat = new Map<string, THREE.MeshPhysicalMaterial>();
function material(sk: string, col: string, opacidad = 1) {
  const clave = `${sk}|${col}|${opacidad}`;
  const hit = cacheMat.get(clave);
  if (hit) return hit;
  const rough = ({ esq: 0.62, teg: 0.55, mus: 0.48, car: 0.38, dig: 0.42, ner: 0.55, res: 0.5 } as Record<string, number>)[sk] ?? 0.45;
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(col),
    roughness: rough,
    metalness: 0,
    clearcoat: ['car', 'dig', 'uri', 'res', 'lin', 'end', 'rep'].includes(sk) ? 0.35 : sk === 'mus' ? 0.15 : 0,
    clearcoatRoughness: 0.4,
    sheen: sk === 'mus' ? 0.4 : 0,
    sheenColor: new THREE.Color('#ff9a8a'),
    sheenRoughness: 0.6,
  });
  if (opacidad < 1) {
    m.transparent = true;
    m.opacity = opacidad;
    m.depthWrite = false;
    vidrio(m);
  }
  cacheMat.set(clave, m);
  return m;
}
export const matResalte = new THREE.MeshPhysicalMaterial({
  color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.45, roughness: 0.35, clearcoat: 0.5,
});

export interface Pieza { id: string; parte: Parte; malla: THREE.Mesh; matBase: THREE.Material }

export function crearCuerpo(esc: Escena, atlas: () => Atlas) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const partes = new Map(atlas().parts.map(p => [p.id, p]));

  const central = new THREE.Group();
  central.position.copy(OFFSET);
  esc.soporteCentral.add(central);

  // Por sistema: mallas del cuerpo central y de su isla.
  const escenas: Record<string, THREE.Group> = {};
  const piezasIsla: Record<string, Pieza[]> = {};
  const piezasCentral: Record<string, Pieza[]> = {};
  const promesas: Partial<Record<string, Promise<void>>> = {};
  const siluetas: THREE.Group[] = [];
  const islaDe = (k: string) => esc.islas.find(i => i.k === k)!;

  async function bajar(sk: string, alProgreso: (n: number) => void) {
    const url = `${import.meta.env.BASE_URL}models/${sk}.glb`;
    const r = await fetch(url);
    if (!r.ok || !r.body) throw new Error(`${sk}: ${r.status}`);
    const total = atlas().files[sk]?.bytes ?? 0;
    const lector = r.body.getReader();
    const trozos: Uint8Array[] = [];
    let n = 0;
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      trozos.push(value);
      n += value.length;
      alProgreso(total ? Math.min(1, n / total) : 0);
    }
    const buf = new Uint8Array(n);
    let o = 0;
    for (const t of trozos) { buf.set(t, o); o += t.length; }
    return buf.buffer;
  }

  function montar(sk: string, gltf: THREE.Group) {
    const piezas: Pieza[] = [];
    gltf.traverse(o => {
      if (!(o as THREE.Mesh).isMesh) return;
      const m = o as THREE.Mesh;
      const id = partes.has(m.name) ? m.name : m.parent && partes.has(m.parent.name) ? m.parent.name : null;
      if (!id) return;
      if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals();
      const p = partes.get(id)!;
      m.userData.id = id;
      m.userData.sk = sk;
      piezas.push({ id, parte: p, malla: m, matBase: m.material as THREE.Material });
    });
    return piezas;
  }

  function cargar(sk: string, alProgreso: (n: number) => void = () => {}) {
    const previa = promesas[sk];
    if (previa) return previa;
    const nueva = (async () => {
      const buf = await bajar(sk, alProgreso);
      const gltf = await loader.parseAsync(buf, '');
      const base = gltf.scene;
      // cuerpo central: piel como vidrio, el resto opaco
      const enCentro = base.clone(true);
      piezasCentral[sk] = montar(sk, enCentro).map(pz => {
        const mat = material(sk, pz.parte.col, sk === 'teg' ? 0.22 : sk === 'mus' ? 0.4 : 1);
        pz.malla.material = mat;
        pz.matBase = mat;
        return pz;
      });
      central.add(enCentro);
      // isla: el sistema aislado, opaco (comparte geometría con el central)
      const isla = islaDe(sk);
      const enIsla = base;
      piezasIsla[sk] = montar(sk, enIsla).map(pz => {
        const mat = material(sk, pz.parte.col, 1);
        pz.malla.material = mat;
        pz.matBase = mat;
        return pz;
      });
      const g = new THREE.Group();
      g.position.copy(OFFSET);
      g.add(enIsla);
      isla.soporte.add(g);
      escenas[sk] = g;
      // la piel también sirve de silueta translúcida para las islas de órganos
      if (sk === 'teg') añadirSiluetas(enIsla);
    })();
    promesas[sk] = nueva;
    return nueva;
  }

  function añadirSiluetas(piel: THREE.Object3D) {
    const mat = material('teg', '#f2ece1', 0.07);
    for (const isla of esc.islas) {
      if (isla.k === 'teg') continue;
      const s = piel.clone(true);
      s.traverse(o => {
        if ((o as THREE.Mesh).isMesh) {
          (o as THREE.Mesh).material = mat;
          o.userData.silueta = true;
          o.raycast = () => {}; // no se puede seleccionar
        }
      });
      const g = new THREE.Group();
      g.position.copy(OFFSET);
      g.add(s);
      isla.soporte.add(g);
      siluetas.push(g);
    }
  }

  // Caja del sistema en coordenadas de mundo (para encuadrar la cámara).
  function caja(sk: string) {
    const g = escenas[sk];
    return g ? new THREE.Box3().setFromObject(g) : null;
  }

  // Selección por rayo sobre lo visible en la isla activa (o el cuerpo central).
  const ray = new THREE.Raycaster();
  function tocar(ndc: THREE.Vector2, sk: string | null): Pieza | null {
    ray.setFromCamera(ndc, esc.camera);
    const lista = sk ? piezasIsla[sk] ?? [] : Object.entries(piezasCentral).filter(([k]) => k !== 'teg').flatMap(([, v]) => v);
    const hits = ray.intersectObjects(lista.map(p => p.malla), false);
    const h = hits.find(x => x.object.visible);
    if (!h) return null;
    return lista.find(p => p.malla === h.object) ?? null;
  }

  let resaltadas: Pieza[] = [];
  function resaltar(pz: Pieza[]) {
    resaltadas.forEach(p => (p.malla.material = p.matBase));
    resaltadas = pz;
    resaltadas.forEach(p => (p.malla.material = matResalte));
  }

  function cargarTodo(prioridad: string[], alProgreso: (sk: string, n: number) => void) {
    const orden = [...prioridad, ...ORDEN.filter(k => !prioridad.includes(k))];
    // secuencial por pares: no saturar la red ni la GPU
    let i = 0;
    const siguiente = async (): Promise<void> => {
      const sk = orden[i++];
      if (!sk) return;
      await cargar(sk, n => alProgreso(sk, n)).catch(e => console.error(e));
      alProgreso(sk, 1);
      return siguiente();
    };
    return Promise.all([siguiente(), siguiente()]);
  }

  return {
    central, cargar, cargarTodo, caja, tocar, resaltar,
    piezasIsla: (sk: string) => piezasIsla[sk] ?? [],
    listo: (sk: string) => !!escenas[sk],
    isla: (sk: string): Isla => islaDe(sk),
  };
}
export type Cuerpo = ReturnType<typeof crearCuerpo>;
