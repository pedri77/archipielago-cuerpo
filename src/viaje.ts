// Vuelos de cámara con GSAP entre la vista del archipiélago y cada isla.
import gsap from 'gsap';
import * as THREE from 'three';
import { reducirMovimiento } from './datos';
import { RADIO_ARCHIPIELAGO } from './escena';
import type { Escena, Isla } from './escena';

export const dur = (s: number) => (reducirMovimiento ? 0 : s);

export function crearViaje(esc: Escena) {
  const { camera, controls } = esc;
  let vuelo: gsap.core.Timeline | null = null;

  function volar(pos: THREE.Vector3, objetivo: THREE.Vector3, s = 1.8, arco = 0.6) {
    vuelo?.kill();
    controls.enabled = false;
    const desde = camera.position.clone();
    const tDesde = controls.target.clone();
    const p = { t: 0 };
    // curva con un poco de altura en medio: se siente como sobrevolar el mar
    const medio = desde.clone().lerp(pos, 0.5);
    medio.y += desde.distanceTo(pos) * arco * 0.35;
    const curva = new THREE.QuadraticBezierCurve3(desde, medio, pos);
    return new Promise<void>(ok => {
      vuelo = gsap.timeline({ onComplete: () => { controls.enabled = true; ok(); } });
      vuelo.to(p, {
        t: 1, duration: dur(s), ease: 'power2.inOut',
        onUpdate: () => {
          camera.position.copy(curva.getPoint(p.t));
          controls.target.lerpVectors(tDesde, objetivo, p.t);
          controls.update();
        },
      });
    });
  }

  // En pantallas estrechas el panel de la isla tapa la parte de abajo: se desplaza
  // la ventana de la cámara hacia abajo para que el modelo quede en la zona libre.
  const DESPLAZAMIENTO = 0.2;
  const estrecho = () => camera.aspect < 0.9;
  function encuadre(enIsla: boolean) {
    const w = innerWidth, h = innerHeight;
    if (enIsla && estrecho()) camera.setViewOffset(w, h, 0, h * DESPLAZAMIENTO, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  // La niebla escala con la distancia de la cámara para no apagar las islas lejanas.
  function niebla(dist: number) {
    const f = esc.scene.fog as THREE.Fog;
    f.near = Math.max(9, dist * 0.75);
    f.far = Math.max(26, dist * 1.6);
  }

  function vistaGeneral() {
    encuadre(false);
    if (!estrecho()) {
      niebla(0);
      controls.minDistance = 4;
      controls.maxDistance = 24;
      return { pos: new THREE.Vector3(0, 9, 13.5), objetivo: new THREE.Vector3(0, 0.4, 0) };
    }
    // cabe el anillo entero a lo ancho, mirando casi desde arriba
    const radio = RADIO_ARCHIPIELAGO + 1.5;
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect;
    const dist = (radio / tanH) * 1.05;
    const dir = new THREE.Vector3(0, 0.9, 0.44).normalize();
    niebla(dist);
    controls.minDistance = 4;
    controls.maxDistance = dist * 1.2;
    return { pos: dir.multiplyScalar(dist), objetivo: new THREE.Vector3(0, 0, 0.3) };
  }

  function vistaIsla(isla: Isla, caja: THREE.Box3 | null) {
    encuadre(true);
    niebla(0);
    const c = new THREE.Vector3();
    const tam = new THREE.Vector3(0.6, 1.7, 0.4);
    if (caja && !caja.isEmpty()) { caja.getCenter(c); caja.getSize(tam); }
    else c.copy(isla.centro).setY(0.9);
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    // con el encuadre desplazado solo queda libre la parte de arriba de la pantalla
    const libre = estrecho() ? 1 - DESPLAZAMIENTO * 2 : 1;
    const altoVis = (Math.max(tam.y, Math.max(tam.x, tam.z) / camera.aspect) * 1.35) / libre;
    const dist = Math.max(0.55, altoVis / 2 / Math.tan(vfov / 2));
    const pos = c.clone().addScaledVector(isla.dir, dist).add(new THREE.Vector3(0, dist * 0.16, 0));
    controls.minDistance = Math.max(0.2, dist * 0.25);
    controls.maxDistance = dist * 2.2;
    return { pos, objetivo: c };
  }

  // Entrada: desde muy alto, espiral suave hasta el archipiélago.
  function entrada() {
    const v = vistaGeneral();
    camera.position.set(-14, 16, -10);
    controls.target.copy(v.objetivo);
    controls.update();
    return volar(v.pos, v.objetivo, 3.2, 0.2);
  }

  return { volar, vistaGeneral, vistaIsla, entrada, encuadre };
}
export type Viaje = ReturnType<typeof crearViaje>;
