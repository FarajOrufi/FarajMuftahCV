import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { subscribeMotion } from "./motion-clock";

const STEP = 30, RADIUS = 5, SAMPLES = 1200;

/** Original geometry and shaders: camera travel inside a continuous curved tube. */
export function createTunnel(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.setClearColor(0x030614);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030614);
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, .08, 155);
  const mobile = innerWidth < 720;
  const path = new THREE.CatmullRomCurve3([
    [0, 0, 8], [0, 0, -24], [-2.8, 1, -52], [-3.5, 1.8, -81],
    [2.7, -1.4, -110], [-3, 2, -141], [0, 0, -176],
    [1.4, -.8, -210], [0, 0, -249], [3.2, 1.6, -283],
    [-3.4, -1.2, -319], [0, 0, -359], [0, 0, -395],
  ].map(p => new THREE.Vector3(...p)), false, "centripetal");
  path.arcLengthDivisions = 2400;
  const length = path.getLength();
  const frames = path.computeFrenetFrames(SAMPLES, false);
  const centers = path.getSpacedPoints(SAMPLES);
  let seed = 4271;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const uniforms = { uTime: { value: 0 }, uPixelScale: { value: 700 }, uLength: { value: length } };

  const particles = (count: number, wall: boolean) => {
    const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count), phases = new Float32Array(count);
    const point = new THREE.Vector3(), tint = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const sample = random() * SAMPLES, index = Math.floor(sample), angle = random() * Math.PI * 2;
      const radius = wall ? RADIUS * (.97 + random() * .07) : RADIUS * Math.sqrt(random()) * .93;
      point.copy(centers[index]).lerp(centers[index + 1], sample - index).addScaledVector(frames.normals[index], Math.cos(angle) * radius).addScaledVector(frames.binormals[index], Math.sin(angle) * radius);
      point.toArray(positions, i * 3);
      sizes[i] = wall ? .022 + Math.pow(random(), 5) * .07 : .018 + random() * .045;
      phases[i] = random() * Math.PI * 2;
      tint.set(random() > .85 ? 0xb0c8ff : random() > .35 ? 0x4a7adc : 0x25489a);
      tint.multiplyScalar(.65 + random() * .8).toArray(colors, i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.ShaderMaterial({
      uniforms, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        uniform float uTime, uPixelScale;
        attribute float aSize, aPhase;
        varying vec3 vColor;
        varying float vOpacity;
        void main() {
          vec3 p = position;
          p.xy += vec2(sin(uTime * .19 + aPhase), cos(uTime * .16 + aPhase)) * ${wall ? ".013" : ".065"};
          vec4 view = modelViewMatrix * vec4(p, 1.);
          float depth = -view.z;
          vOpacity = exp(-depth * depth * .00055) * smoothstep(.35, 2.5, depth) * (.82 + .18 * sin(uTime * .55 + aPhase));
          vColor = color;
          gl_PointSize = clamp(aSize * uPixelScale / max(depth, .1), 1.35, 13.);
          gl_Position = projectionMatrix * view;
        }`,
      fragmentShader: `
        varying vec3 vColor;
        varying float vOpacity;
        void main() {
          float r = length(gl_PointCoord - .5) * 2.;
          if (r > 1.) discard;
          float glow = exp(-r * r * 5.5) * (1. - smoothstep(.6, 1., r));
          gl_FragColor = vec4(vColor, glow * vOpacity);
        }`,
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    scene.add(points);
  };
  particles(mobile ? 50000 : 120000, true);
  particles(mobile ? 7000 : 20000, false);

  scene.add(new THREE.Mesh(new THREE.TubeGeometry(path, SAMPLES, RADIUS * 1.055, mobile ? 48 : 64, false), new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec2 vUv; varying float vDepth;
      void main() { vUv = uv; vec4 view = modelViewMatrix * vec4(position, 1.); vDepth = -view.z; gl_Position = projectionMatrix * view; }`,
    fragmentShader: `
      uniform float uTime, uLength;
      varying vec2 vUv; varying float vDepth;
      void main() {
        float laneId = floor(vUv.y * 44.);
        float d = vUv.x * uLength, segment = d / 7. + laneId * .237;
        float turn = smoothstep(.25, .4, fract(segment)) - smoothstep(.68, .83, fract(segment));
        float lane = vUv.y * 44. + turn * .38;
        float aa = max(fwidth(lane), .002);
        float line = 1. - smoothstep(.009, .009 + aa, abs(fract(lane + .5) - .5));
        float variation = .25 + .75 * fract(sin(laneId * 41.13) * 481.19);
        float breaks = smoothstep(.02, .09, fract(segment + laneId * .31));
        float rib = (1. - smoothstep(.003, .003 + fwidth(d / 3.), abs(fract(d / 3. + .5) - .5))) * .025;
        float fog = exp(-vDepth * vDepth * .00105) * smoothstep(.35, 2., vDepth);
        float breath = .93 + .07 * sin(uTime * .2 + vUv.y * 12.);
        gl_FragColor = vec4(vec3(.13, .27, .66), (line * variation * breaks * .065 + rib + .004) * fog * breath);
      }`,
  })));

  const ringGeometry = new THREE.RingGeometry(RADIUS * .972, RADIUS * 1.055, 160);
  const rings: { mesh: THREE.Mesh; distance: number; material: THREE.ShaderMaterial }[] = [];
  for (const distance of Array.from({ length: 11 }, (_, i) => 8 + (i + 1) * STEP)) {
    const material = new THREE.ShaderMaterial({
      uniforms: { uIntensity: { value: .4 } }, side: THREE.DoubleSide,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `varying vec3 vPosition; void main() { vPosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: `
        uniform float uIntensity; varying vec3 vPosition;
        void main() {
          float band = (length(vPosition.xy) - ${RADIUS * .972}) / ${RADIUS * .083};
          float glow = exp(-pow((band - .36) * 6., 2.));
          float core = exp(-pow((band - .36) * 28., 2.));
          gl_FragColor = vec4(mix(vec3(.17, .35, .95), vec3(.7, .83, 1.), core), (glow * .48 + core * .7) * uIntensity);
        }`,
    });
    const mesh = new THREE.Mesh(ringGeometry, material);
    const t = distance / length, index = Math.round(t * SAMPLES);
    mesh.position.copy(path.getPointAt(t));
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(frames.normals[index], frames.binormals[index], frames.tangents[index]));
    scene.add(mesh); rings.push({ mesh, distance, material });
  }

  // Black centre belongs to one of the real tube rings. Its perspective and
  // occlusion come from the same camera as the stars and circuit lines.
  const portal = new THREE.Mesh(
    new THREE.CircleGeometry(RADIUS * .972, 160),
    new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide, toneMapped: false,
      transparent: true, depthTest: false, depthWrite: false }),
  );
  portal.renderOrder = 2;
  portal.visible = false;
  scene.add(portal);
  let portalIndex = -1;

  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .55, .5, .22);
  const output = new OutputPass();
  composer.addPass(renderPass);
  if (!mobile) composer.addPass(bloom);
  composer.addPass(output);
  let width = 0, height = 0, disposed = false, currentFov = 60;
  let pointerX = 0, pointerY = 0, offsetX = 0, offsetY = 0;
  const pointer = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    pointerX = (event.clientX / innerWidth - .5) * .12;
    pointerY = -(event.clientY / innerHeight - .5) * .1;
  };
  const leave = () => { pointerX = 0; pointerY = 0; };
  window.addEventListener("pointermove", pointer, { passive: true });
  document.documentElement.addEventListener("pointerleave", leave);
  const aim = new THREE.Vector3();
  const debug = { renderer: "webgl", travel: 0, distance: 8, fov: 60, camera: [0, 0, 0], particles: mobile ? 57000 : 140000 };
  // Read-only diagnostics for QA, without exposing the renderer or scene globally.
  Object.defineProperty(canvas, "tunnelDiagnostics", { configurable: true, get: () => ({ ...debug, camera: [...debug.camera] }) });
  canvas.dataset.renderer = "webgl";
  const unsubscribe = subscribeMotion(frame => {
    if (disposed) return;
    if (width !== frame.width || height !== frame.height) {
      width = frame.width; height = frame.height;
      const ratio = Math.min(devicePixelRatio || 1, mobile ? 1.35 : 1.5);
      renderer.setPixelRatio(ratio); renderer.setSize(width, height, false);
      composer.setPixelRatio(ratio); composer.setSize(width, height);
      camera.aspect = width / height;
    }
    const distance = frame.reduced ? 8 : Math.min(length - 65, 8 + frame.travel * STEP);
    const t = distance / length, smoothing = 1 - Math.exp(-4 * frame.dt);
    camera.position.copy(path.getPointAt(t));
    offsetX = frame.reduced ? 0 : offsetX + (pointerX - offsetX) * smoothing;
    offsetY = frame.reduced ? 0 : offsetY + (pointerY - offsetY) * smoothing;
    camera.position.x += offsetX + (frame.reduced ? 0 : Math.sin(frame.time * .23) * .035);
    camera.position.y += offsetY + (frame.reduced ? 0 : Math.cos(frame.time * .19) * .025);
    aim.copy(path.getPointAt(Math.min(.999, t + .009)));
    const roll = frame.reduced ? 0 : Math.sin(t * Math.PI * 5) * .035;
    camera.up.set(Math.sin(roll), Math.cos(roll), 0); camera.lookAt(aim);
    const targetFov = frame.reduced ? 60 : 60 + Math.min(14, Math.abs(frame.velocity) * 5);
    currentFov = frame.reduced ? 60 : currentFov + (targetFov - currentFov) * smoothing;
    camera.fov = currentFov; camera.updateProjectionMatrix();
    if (frame.dark.index !== portalIndex && frame.dark.index >= 0) {
      portalIndex = frame.dark.index;
      const portalT = (8 + portalIndex * STEP) / length;
      const portalFrame = Math.round(portalT * SAMPLES);
      portal.position.copy(path.getPointAt(portalT));
      portal.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
        frames.normals[portalFrame], frames.binormals[portalFrame], frames.tangents[portalFrame],
      ));
      for (const ring of rings) ring.mesh.renderOrder = ring.distance === 8 + portalIndex * STEP ? 3 : 0;
    }
    portal.visible = frame.dark.approaching;
    uniforms.uTime.value = frame.reduced ? 0 : frame.time;
    uniforms.uPixelScale.value = height * renderer.getPixelRatio() / (2 * Math.tan(THREE.MathUtils.degToRad(currentFov / 2)));
    for (const ring of rings) {
      const gap = ring.distance - distance;
      ring.mesh.visible = gap > -.5 && gap < 115;
      ring.material.uniforms.uIntensity.value = (.4 + .4 * Math.exp(-gap * gap / 90)) * Math.exp(-Math.max(0, gap) * .028) * THREE.MathUtils.smoothstep(gap, -.3, 1.5);
    }
    composer.render();
    debug.travel = frame.travel; debug.distance = distance; debug.fov = currentFov;
    camera.position.toArray(debug.camera);
  });
  return () => {
    if (disposed) return;
    disposed = true; unsubscribe();
    window.removeEventListener("pointermove", pointer);
    document.documentElement.removeEventListener("pointerleave", leave);
    const geometries = new Set<THREE.BufferGeometry>();
    scene.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
        geometries.add(object.geometry);
        (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => material.dispose());
      }
    });
    geometries.forEach(geometry => geometry.dispose());
    bloom.dispose(); output.dispose(); renderPass.dispose(); composer.dispose(); renderer.dispose();
    delete (canvas as HTMLCanvasElement & { tunnelDiagnostics?: unknown }).tunnelDiagnostics;
  };
}
