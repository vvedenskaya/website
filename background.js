/**
 * Generative art background — Three.js
 * Abstract, fluid, ribbon-like forms with simplex noise displacement.
 * Style: Bicep / Rival Consoles album cover aesthetic.
 *
 * Usage: ensure a container with id="bg-canvas-container" exists; call initGenerativeBackground().
 */

(function () {
  'use strict';

  // ——— Config (adjust colors, speed, intensity) ———
  var CONFIG = {
    // Base background color (fallback and canvas clear)
    backgroundColor: 0x0d0d0d,

    // Palette: oranges, golds, purples, pinks, blues (Bicep/Isles style)
    colors: [0xff8c42, 0xffb347, 0x9b59b6, 0xe91e8c, 0x5c9ead],

    // Animation
    speed: 0.28,
    rotationSpeed: 0.04,
    flowScale: 1.2,

    // Noise displacement (vertex distortion)
    noiseScale: 2.0,
    displacementScale: 0.35,

    // Mouse influence (0 = off)
    mouseInfluence: 0.15,
    mouseRadius: 0.4,
  };

  // ——— GLSL: 3D Simplex noise ———
  var simplex3D = `
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec4 ns = vec4(n_ * D.wyz - D.xzx, 0.0);
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }
  `;

  var vertexShader = [
    'uniform float uTime;',
    'uniform float uNoiseScale;',
    'uniform float uDisplacement;',
    'uniform float uFlowScale;',
    'uniform vec2 uMouse;',
    'uniform float uMouseRadius;',
    'uniform float uMouseInfluence;',
    'uniform float uLayer;',
    simplex3D,
    'void main() {',
    '  vec3 pos = position;',
    '  float t = uTime * uFlowScale + uLayer * 2.0;',
    '  vec3 noiseCoord = pos * uNoiseScale + vec3(t * 0.3, t * 0.2, uLayer);',
    '  float n = snoise(noiseCoord) * 0.5 + 0.5;',
    '  float n2 = snoise(noiseCoord * 1.7 + 100.0) * 0.5 + 0.5;',
    '  pos.z += (n * n2 - 0.2) * uDisplacement;',
    '  float dist = length(uv - 0.5);',
    '  pos.z += snoise(vec3(uv * 4.0, t * 0.5)) * uDisplacement * 0.6;',
    '  if (uMouseInfluence > 0.0 && uMouseRadius > 0.0) {',
    '    vec2 toMouse = uv - 0.5 - uMouse;',
    '    float d = length(toMouse);',
    '    float influence = smoothstep(uMouseRadius, 0.0, d) * uMouseInfluence;',
    '    pos.z += influence * (n - 0.5) * uDisplacement;',
    '  }',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);',
    '}',
  ].join('\n');

  // Fragment: gradient from palette based on position + noise
  var fragmentShader = [
    'uniform float uTime;',
    'uniform float uLayer;',
    'uniform vec3 uColor0;',
    'uniform vec3 uColor1;',
    'uniform vec3 uColor2;',
    'void main() {',
    '  vec2 uv = gl_FragCoord.xy;',
    '  float mix1 = sin(uv.x * 0.002 + uTime * 0.2 + uLayer) * 0.5 + 0.5;',
    '  float mix2 = sin(uv.y * 0.002 + uTime * 0.15) * 0.5 + 0.5;',
    '  vec3 c = mix(uColor0, uColor1, mix1);',
    '  c = mix(c, uColor2, mix2 * 0.5);',
    '  float a = 0.75 + 0.15 * sin(uTime + uLayer);',
    '  gl_FragColor = vec4(c, a);',
    '}',
  ].join('\n');

  function hexToVec3(hex) {
    return [
      ((hex >> 16) & 255) / 255,
      ((hex >> 8) & 255) / 255,
      (hex & 255) / 255,
    ];
  }

  var scene, camera, renderer, meshes = [], clock;
  var container, width, height;
  var mouse = { x: 0.5, y: 0.5 };
  var rafId = null;

  function createMesh(layerIndex) {
    var segments = 64;
    var geometry = new THREE.PlaneGeometry(3.2, 2.4, segments, segments);
    var layer = layerIndex * 0.4;

    var colorCount = CONFIG.colors.length;
    var c0 = CONFIG.colors[layerIndex % colorCount];
    var c1 = CONFIG.colors[(layerIndex + 1) % colorCount];
    var c2 = CONFIG.colors[(layerIndex + 2) % colorCount];

    var material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uNoiseScale: { value: CONFIG.noiseScale },
        uDisplacement: { value: CONFIG.displacementScale },
        uFlowScale: { value: CONFIG.flowScale },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uMouseRadius: { value: CONFIG.mouseRadius },
        uMouseInfluence: { value: CONFIG.mouseInfluence },
        uLayer: { value: layer },
        uColor0: { value: new THREE.Vector3().fromArray(hexToVec3(c0)) },
        uColor1: { value: new THREE.Vector3().fromArray(hexToVec3(c1)) },
        uColor2: { value: new THREE.Vector3().fromArray(hexToVec3(c2)) },
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
    });

    var mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -0.2;
    mesh.rotation.y = 0.3;
    mesh.position.z = -layer * 0.5;
    return mesh;
  }

  function init() {
    container = document.getElementById('bg-canvas-container');
    if (!container) return;

    width = container.offsetWidth;
    height = container.offsetHeight;

    scene = new THREE.Scene();
    var aspect = width / height;
    var halfH = 1.2;
    var halfW = halfH * aspect;
    camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 10);
    camera.position.z = 2;
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(CONFIG.backgroundColor, 1);
    container.appendChild(renderer.domElement);

    // Multiple layers for depth
    for (var i = 0; i < 4; i++) {
      var mesh = createMesh(i);
      scene.add(mesh);
      meshes.push(mesh);
    }

    clock = new THREE.Clock();
    window.addEventListener('resize', onResize);
    if (CONFIG.mouseInfluence > 0) {
      document.addEventListener('mousemove', onMouseMove);
    }
  }

  function onResize() {
    if (!container) return;
    width = container.offsetWidth;
    height = container.offsetHeight;
    renderer.setSize(width, height);
    var aspect = width / height;
    var halfH = 1.2;
    var halfW = halfH * aspect;
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.updateProjectionMatrix();
  }

  function onMouseMove(e) {
    mouse.x = (e.clientX / window.innerWidth - 0.5);
    mouse.y = -(e.clientY / window.innerHeight - 0.5);
  }

  function animate() {
    rafId = requestAnimationFrame(animate);
    if (!renderer || !scene) return;

    var t = clock.getElapsedTime() * CONFIG.speed;

    for (var i = 0; i < meshes.length; i++) {
      var mesh = meshes[i];
      mesh.material.uniforms.uTime.value = t;
      mesh.material.uniforms.uMouse.value.set(mouse.x, mouse.y);
      mesh.rotation.z += CONFIG.rotationSpeed * 0.002;
    }

    renderer.render(scene, camera);
  }

  function dispose() {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('mousemove', onMouseMove);
    if (container && renderer && renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
    meshes.forEach(function (m) {
      m.geometry.dispose();
      m.material.dispose();
    });
    meshes = [];
    scene = null;
    camera = null;
    renderer = null;
  }

  function initGenerativeBackground(options) {
    if (options) {
      if (options.backgroundColor != null) CONFIG.backgroundColor = options.backgroundColor;
      if (options.colors) CONFIG.colors = options.colors;
      if (options.speed != null) CONFIG.speed = options.speed;
      if (options.rotationSpeed != null) CONFIG.rotationSpeed = options.rotationSpeed;
      if (options.flowScale != null) CONFIG.flowScale = options.flowScale;
      if (options.noiseScale != null) CONFIG.noiseScale = options.noiseScale;
      if (options.displacementScale != null) CONFIG.displacementScale = options.displacementScale;
      if (options.mouseInfluence != null) CONFIG.mouseInfluence = options.mouseInfluence;
      if (options.mouseRadius != null) CONFIG.mouseRadius = options.mouseRadius;
    }
    if (typeof THREE === 'undefined') {
      console.warn('Generative background: Three.js not loaded.');
      return { dispose: function () {} };
    }
    init();
    animate();
    return { dispose: dispose, config: CONFIG };
  }

  window.initGenerativeBackground = initGenerativeBackground;
})();
