/**
 * Seohyo-inspired generative background for Three.js (WebGL).
 * Dense stack of geometric forms with line-based patterns and subtle motion.
 */

(function () {
  'use strict';

  var CONFIG = {
    backgroundColor: 0x0f0f0f,
    shapeCount: 170,
    mouseParallax: 0.22,
    animationSpeed: 0.2,
    maxPixelRatio: 2,
    // Core palette (blue/orange/red/cream/gray), inspired by the reference.
    palette: [0x0c3f8e, 0xec8d19, 0xca3046, 0xf3efdf, 0x4e5767, 0xc7b6bd],
    lineColor: '#133f70',
  };

  var scene;
  var camera;
  var renderer;
  var clock;
  var container;
  var width = 0;
  var height = 0;
  var rafId = null;

  var artGroup = null;
  var meshes = [];
  var resources = [];
  var patternTextures = [];
  var mouse = { x: 0, y: 0 };
  var smoothedMouse = { x: 0, y: 0 };

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function createPatternTexture(kind, lineColor) {
    var canvas = document.createElement('canvas');
    var size = 256;
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8;

    if (kind === 'radial') {
      var cx = size * 0.5;
      var cy = size * 0.5;
      var radius = size * 0.5;
      for (var a = 0; a < Math.PI * 2; a += Math.PI / 48) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
        ctx.stroke();
      }
    } else if (kind === 'diag') {
      for (var d = -size; d < size * 2; d += 10) {
        ctx.beginPath();
        ctx.moveTo(d, 0);
        ctx.lineTo(d - size, size);
        ctx.stroke();
      }
    } else if (kind === 'vertical') {
      for (var x = 0; x <= size; x += 9) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, size);
        ctx.stroke();
      }
    } else {
      for (var y = 0; y <= size; y += 9) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
      }
    }

    var texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  function createGeometry(kind) {
    if (kind === 'disc') return new THREE.CircleGeometry(0.23, 50);
    if (kind === 'cone') return new THREE.ConeGeometry(0.2, 0.44, 42, 1, true);
    if (kind === 'tri') return new THREE.ConeGeometry(0.22, 0.45, 3, 1, true);
    if (kind === 'cyl') return new THREE.CylinderGeometry(0.16, 0.16, 0.45, 40, 1, true);
    if (kind === 'tube') return new THREE.CylinderGeometry(0.12, 0.22, 0.5, 24, 1, true);
    return new THREE.SphereGeometry(0.19, 24, 18);
  }

  function createMaterial(baseColor, patternTexture) {
    return new THREE.MeshBasicMaterial({
      color: baseColor,
      map: patternTexture,
      transparent: true,
      opacity: rand(0.8, 0.97),
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }

  function createShape(i, count) {
    var t = i / Math.max(count - 1, 1);
    var kind = pick(['disc', 'cone', 'tri', 'cyl', 'sphere', 'tube']);
    var geometry = createGeometry(kind);
    var texture = pick(patternTextures);
    var color = pick(CONFIG.palette);
    var material = createMaterial(color, texture);
    var mesh = new THREE.Mesh(geometry, material);

    var baseY = 2.85 - t * 5.7 + rand(-0.23, 0.23);
    var baseX = rand(-0.9, 0.9) + Math.sin(t * 26.0) * 0.14;
    var baseZ = rand(-0.9, 0.9);
    var s = rand(0.55, 1.5);

    mesh.position.set(baseX, baseY, baseZ);
    mesh.rotation.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI));
    mesh.scale.set(s * rand(0.7, 1.25), s * rand(0.7, 1.25), s * rand(0.7, 1.25));

    mesh.userData.baseX = baseX;
    mesh.userData.baseY = baseY;
    mesh.userData.baseZ = baseZ;
    mesh.userData.phase = rand(0, Math.PI * 2);
    mesh.userData.floatAmp = rand(0.01, 0.045);
    mesh.userData.floatSpeed = rand(0.2, 0.9);
    mesh.userData.rotX = rand(-0.0016, 0.0016);
    mesh.userData.rotY = rand(-0.0018, 0.0018);
    mesh.userData.rotZ = rand(-0.002, 0.002);

    resources.push(geometry, material);
    return mesh;
  }

  function buildArtwork() {
    artGroup = new THREE.Group();
    scene.add(artGroup);

    patternTextures = [
      createPatternTexture('radial', CONFIG.lineColor),
      createPatternTexture('diag', CONFIG.lineColor),
      createPatternTexture('vertical', CONFIG.lineColor),
      createPatternTexture('horizontal', CONFIG.lineColor),
    ];

    for (var k = 0; k < patternTextures.length; k++) {
      resources.push(patternTextures[k]);
    }

    for (var i = 0; i < CONFIG.shapeCount; i++) {
      var shape = createShape(i, CONFIG.shapeCount);
      artGroup.add(shape);
      meshes.push(shape);
    }
  }

  function init() {
    container = document.getElementById('bg-canvas-container');
    if (!container) return;

    width = container.clientWidth || window.innerWidth;
    height = container.clientHeight || window.innerHeight;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(CONFIG.backgroundColor);

    var aspect = width / Math.max(height, 1);
    var halfH = 3.25;
    var halfW = halfH * aspect;

    camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 30);
    camera.position.set(0, 0, 8);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.maxPixelRatio));
    renderer.setSize(width, height);
    renderer.setClearColor(CONFIG.backgroundColor, 1);
    container.appendChild(renderer.domElement);

    clock = new THREE.Clock();
    buildArtwork();

    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouseMove);
  }

  function onResize() {
    if (!renderer || !camera) return;

    width = container.clientWidth || window.innerWidth;
    height = container.clientHeight || window.innerHeight;
    var aspect = width / Math.max(height, 1);
    var halfH = 3.25;
    var halfW = halfH * aspect;

    camera.left = -halfW;
    camera.right = halfW;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
  }

  function onMouseMove(event) {
    mouse.x = event.clientX / Math.max(width, 1) - 0.5;
    mouse.y = -(event.clientY / Math.max(height, 1) - 0.5);
  }

  function animate() {
    rafId = requestAnimationFrame(animate);
    if (!scene || !camera || !renderer) return;

    var t = clock.getElapsedTime() * CONFIG.animationSpeed;
    smoothedMouse.x += (mouse.x - smoothedMouse.x) * 0.06;
    smoothedMouse.y += (mouse.y - smoothedMouse.y) * 0.06;

    if (artGroup) {
      artGroup.rotation.y = smoothedMouse.x * CONFIG.mouseParallax;
      artGroup.rotation.x = -smoothedMouse.y * CONFIG.mouseParallax * 0.7;
    }

    for (var i = 0; i < meshes.length; i++) {
      var m = meshes[i];
      var d = m.userData;
      m.rotation.x += d.rotX;
      m.rotation.y += d.rotY;
      m.rotation.z += d.rotZ;
      m.position.x = d.baseX + Math.sin(t * d.floatSpeed + d.phase) * d.floatAmp;
      m.position.y = d.baseY + Math.cos(t * d.floatSpeed * 0.8 + d.phase) * d.floatAmp;
      m.position.z = d.baseZ + Math.sin(t * d.floatSpeed * 0.6 + d.phase) * (d.floatAmp * 0.8);
    }

    renderer.render(scene, camera);
  }

  function dispose() {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('mousemove', onMouseMove);

    for (var i = 0; i < resources.length; i++) {
      if (resources[i] && typeof resources[i].dispose === 'function') {
        resources[i].dispose();
      }
    }

    resources = [];
    meshes = [];
    patternTextures = [];

    if (container && renderer && renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }

    scene = null;
    camera = null;
    renderer = null;
    clock = null;
    artGroup = null;
  }

  function initGenerativeBackground(options) {
    if (options) {
      if (options.backgroundColor != null) CONFIG.backgroundColor = options.backgroundColor;
      if (options.shapeCount != null) CONFIG.shapeCount = options.shapeCount;
      if (options.palette) CONFIG.palette = options.palette;
      if (options.lineColor) CONFIG.lineColor = options.lineColor;
      if (options.animationSpeed != null) CONFIG.animationSpeed = options.animationSpeed;
      if (options.mouseParallax != null) CONFIG.mouseParallax = options.mouseParallax;
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
