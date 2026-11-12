// Vuelos de cámara con GSAP entre la vista del archipiélago y cada isla.
import gsap from 'gsap';
import * as THREE from 'three';
import { reducirMovimiento } from './datos';
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

  function vistaGeneral() {
    const estrecho = camera.aspect < 0.9;
    const pos = estrecho ? new THREE.Vector3(0, 13.5, 15.5) : new THREE.Vector3(0, 9, 13.5);
    controls.minDistance = 4;
    controls.maxDistance = 24;
    return { pos, objetivo: new THREE.Vector3(0, estrecho ? 0 : 0.4, 0) };
  }

  function vistaIsla(isla: Isla, caja: THREE.Box3 | null) {
    const c = new THREE.Vector3();
    const tam = new THREE.Vector3(0.6, 1.7, 0.4);
    if (caja && !caja.isEmpty()) { caja.getCenter(c); caja.getSize(tam); }
    else c.copy(isla.centro).setY(0.9);
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const altoVis = Math.max(tam.y, Math.max(tam.x, tam.z) / camera.aspect) * 1.35;
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

  return { volar, vistaGeneral, vistaIsla, entrada };
}
export type Viaje = ReturnType<typeof crearViaje>;
