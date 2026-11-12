// Escena Three.js: mar de pizarra, islote central y once islas alrededor.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ORDEN, esMovil } from './datos';

export const RADIO_ARCHIPIELAGO = 5.2;
export const ALTO_ISLA = 0.32;

// Generador pseudoaleatorio con semilla: el paisaje es siempre el mismo.
export function semilla(s: number) {
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Isla {
  k: string;
  indice: number;
  centro: THREE.Vector3;
  dir: THREE.Vector3; // hacia fuera, desde el centro del archipiélago
  grupo: THREE.Group; // contiene roca + modelo del sistema
  soporte: THREE.Group; // donde se coloca el modelo anatómico
  bandera: THREE.Mesh;
  rotulo: THREE.Sprite;
}

export function crearEscena(canvasPadre: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: !esMovil, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, esMovil ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.id = 'c3d';
  canvasPadre.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const fondo = new THREE.Color('#0b0b0b');
  scene.background = fondo;
  scene.fog = new THREE.Fog(fondo, 9, 26);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;

  const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.02, 80);
  camera.position.set(0, 7, 13);

  const key = new THREE.DirectionalLight(0xfff1e0, 1.7);
  key.position.set(3, 6, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xff6b5e, 0.9); // contraluz rojizo, sin azul
  rim.position.set(-4, 2.5, -5);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xf2ece1, 0x120c0a, 0.35));

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 0.35;
  controls.maxDistance = 22;
  controls.maxPolarAngle = Math.PI * 0.49; // no bajar del mar
  controls.target.set(0, 0.6, 0);

  // ---------------------------------------------------------------- mar
  const marUniforms = { uTiempo: { value: 0 } };
  const mar = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 70, esMovil ? 96 : 192, esMovil ? 96 : 192),
    new THREE.ShaderMaterial({
      uniforms: { ...marUniforms, uNiebla: { value: new THREE.Color('#0b0b0b') } },
      vertexShader: /* glsl */ `
        uniform float uTiempo;
        varying float vAlto; varying vec3 vMundo;
        float ola(vec2 p, vec2 d, float f, float v){ return sin(dot(p, d) * f + uTiempo * v); }
        void main(){
          vec3 p = position;
          vec2 q = p.xy;
          float h = 0.045 * ola(q, vec2(0.8, 0.6), 1.3, 0.9)
                  + 0.03 * ola(q, vec2(-0.5, 0.9), 2.1, 1.3)
                  + 0.015 * ola(q, vec2(0.2, -1.0), 4.3, 2.1);
          p.z += h;
          vAlto = h;
          vec4 w = modelMatrix * vec4(p, 1.0);
          vMundo = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uNiebla; uniform float uTiempo;
        varying float vAlto; varying vec3 vMundo;
        void main(){
          float d = length(vMundo.xz);
          vec3 hondo = vec3(0.035, 0.032, 0.03);
          vec3 claro = vec3(0.11, 0.095, 0.085);
          vec3 col = mix(hondo, claro, smoothstep(-0.05, 0.08, vAlto));
          // líneas de tiza en las crestas
          float cresta = smoothstep(0.068, 0.074, vAlto) * (1.0 - smoothstep(0.076, 0.082, vAlto));
          col = mix(col, vec3(0.95, 0.92, 0.88), cresta * 0.06);
          // reflejo rojizo de la luna en el horizonte
          col += vec3(0.25, 0.05, 0.04) * smoothstep(0.0, 1.0, (vMundo.z + 30.0) / 30.0) * 0.12;
          float niebla = smoothstep(9.0, 26.0, d);
          gl_FragColor = vec4(mix(col, uNiebla, niebla), 1.0);
        }`,
    }),
  );
  mar.rotation.x = -Math.PI / 2;
  scene.add(mar);

  // ---------------------------------------------------------------- islas
  const rand = semilla(1977);
  function roca(radio: number, alto: number) {
    const g = new THREE.CylinderGeometry(radio, radio * 1.35, alto, 28, 3);
    const pos = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const borde = Math.hypot(v.x, v.z) > radio * 0.6;
      if (borde) {
        const f = 1 + (rand() - 0.5) * 0.18;
        v.x *= f;
        v.z *= f;
      }
      if (v.y > 0 && !borde) v.y += (rand() - 0.5) * 0.02;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.95, flatShading: true }));
    m.position.y = alto / 2 - 0.12;
    // contorno de tiza en el borde superior
    const aro = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(
        Array.from({ length: 64 }, (_, i) => {
          const a = (i / 64) * Math.PI * 2;
          const r = radio * (1 + Math.sin(a * 5) * 0.015);
          return new THREE.Vector3(Math.cos(a) * r, alto - 0.11, Math.sin(a) * r);
        }),
      ),
      new THREE.LineBasicMaterial({ color: '#f2ece1', transparent: true, opacity: 0.55 }),
    );
    const g2 = new THREE.Group();
    g2.add(m, aro);
    // piedras sueltas alrededor
    for (let i = 0; i < 7; i++) {
      const a = rand() * Math.PI * 2;
      const r = radio * (1.35 + rand() * 0.5);
      const s = 0.05 + rand() * 0.09;
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), m.material);
      p.position.set(Math.cos(a) * r, s * 0.3, Math.sin(a) * r);
      p.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      g2.add(p);
    }
    return g2;
  }

  const centro = new THREE.Group();
  centro.add(roca(1.25, ALTO_ISLA + 0.06));
  scene.add(centro);
  const soporteCentral = new THREE.Group();
  soporteCentral.position.y = ALTO_ISLA - 0.05;
  centro.add(soporteCentral);

  const islas: Isla[] = ORDEN.map((k, i) => {
    const a = (i / ORDEN.length) * Math.PI * 2 + Math.PI / 2; // la primera, delante
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const radio = RADIO_ARCHIPIELAGO * (0.94 + rand() * 0.12);
    const c = dir.clone().multiplyScalar(radio);
    const grupo = new THREE.Group();
    grupo.position.copy(c);
    grupo.add(roca(0.85, ALTO_ISLA));
    const soporte = new THREE.Group();
    soporte.position.y = ALTO_ISLA - 0.09;
    soporte.rotation.y = Math.atan2(dir.x, dir.z); // el modelo mira hacia fuera, a la cámara
    grupo.add(soporte);
    // mástil y bandera con el color del sistema (se tiñe al cargar los datos)
    const mastil = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.7), new THREE.MeshStandardMaterial({ color: '#f2ece1' }));
    const lado = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(0.62);
    mastil.position.set(lado.x, ALTO_ISLA + 0.22, lado.z);
    const bandera = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.13, 8, 1),
      new THREE.MeshStandardMaterial({ color: '#ef4444', side: THREE.DoubleSide, roughness: 0.7 }),
    );
    bandera.position.set(lado.x + 0.11 * Math.sign(lado.x || 1), ALTO_ISLA + 0.5, lado.z);
    bandera.lookAt(bandera.position.clone().add(dir));
    grupo.add(mastil, bandera);
    const rotulo = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
    rotulo.position.set(0, ALTO_ISLA + 2.1, 0);
    rotulo.renderOrder = 10;
    grupo.add(rotulo);
    scene.add(grupo);
    return { k, indice: i, centro: c, dir, grupo, soporte, bandera, rotulo };
  });

  // espuma: anillos que laten alrededor de cada isla
  const espumas: THREE.Mesh[] = [];
  const espumaMat = new THREE.MeshBasicMaterial({ color: '#f2ece1', transparent: true, opacity: 0.18, depthWrite: false });
  for (const pos of [new THREE.Vector3(), ...islas.map(i => i.centro)]) {
    const r = pos.lengthSq() === 0 ? 1.75 : 1.2;
    const e = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.04, 64), espumaMat.clone());
    e.rotation.x = -Math.PI / 2;
    e.position.set(pos.x, 0.07, pos.z);
    scene.add(e);
    espumas.push(e);
  }

  function animarMar(t: number) {
    marUniforms.uTiempo.value = t;
    espumas.forEach((e, i) => {
      const f = (t * 0.25 + i * 0.37) % 1;
      e.scale.setScalar(1 + f * 0.25);
      (e.material as THREE.MeshBasicMaterial).opacity = 0.22 * (1 - f);
    });
    islas.forEach((isla, i) => {
      const b = isla.bandera.geometry.attributes.position as THREE.BufferAttribute;
      for (let j = 0; j < b.count; j++) {
        const x = b.getX(j);
        b.setZ(j, Math.sin(x * 25 + t * 4 + i) * 0.015 * (x + 0.11) * 4);
      }
      b.needsUpdate = true;
    });
  }

  function redimensionar() {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }

  return { renderer, scene, camera, controls, islas, soporteCentral, animarMar, redimensionar };
}
export type Escena = ReturnType<typeof crearEscena>;
