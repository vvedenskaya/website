import * as THREE from 'three';
import { createNoise3D } from 'simplex-noise';

// 1. Emoji Texture Atlas Setup
const emojis = ['😃', '😎', '😜', '🤩', '🔥', '🌸', '🍕', '🎉', '🌟', '🦄', '🚀', '💎', '🌈', '🍀', '🍎', '🍓'];
const atlasCols = 4;
const atlasRows = 4;
const tileVol = 128;
const canvas = document.createElement('canvas');
canvas.width = atlasCols * tileVol;
canvas.height = atlasRows * tileVol;
const ctx = canvas.getContext('2d');
ctx.font = '90px Arial';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';

// Draw emojis to atlas matrix
for (let i = 0; i < emojis.length; i++) {
  const x = (i % atlasCols) * tileVol + tileVol / 2;
  const y = Math.floor(i / atlasCols) * tileVol + tileVol / 2;
  ctx.fillText(emojis[i], x, y);
}

const texture = new THREE.CanvasTexture(canvas);
texture.colorSpace = THREE.SRGBColorSpace;

const noise3D = createNoise3D();

// 2. Three.js Scene Setup
const app = document.getElementById('app');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 25;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
app.appendChild(renderer.domElement);

// 3. Grid & Instanced Mesh
const gridSize = 50;
const count = gridSize * gridSize;
const spacing = 1.0;

const geometry = new THREE.PlaneGeometry(1, 1);
const material = new THREE.MeshBasicMaterial({
  map: texture,
  transparent: true,
  alphaTest: 0.1
});

material.onBeforeCompile = (shader) => {
  shader.vertexShader = `
    attribute float vIndex;
    varying float vInstanceIndex;
    ${shader.vertexShader}
  `.replace(
    '#include <begin_vertex>',
    `
    #include <begin_vertex>
    vInstanceIndex = vIndex;
    `
  );

  shader.fragmentShader = `
    varying float vInstanceIndex;
    ${shader.fragmentShader}
  `.replace(
    '#include <map_fragment>',
    `
    #ifdef USE_MAP
      float cols = ${atlasCols.toFixed(1)};
      float rows = ${atlasRows.toFixed(1)};
      float index = floor(mod(vInstanceIndex, cols * rows));
      float col = mod(index, cols);
      float row = floor(index / cols);
      vec2 subUv = vMapUv;
      subUv.x = (subUv.x + col) / cols;
      subUv.y = (subUv.y + (rows - 1.0 - row)) / rows;
      vec4 sampledDiffuseColor = texture2D( map, subUv );
      #ifdef DECODE_VIDEO_TEXTURE
        sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
      #endif
      diffuseColor *= sampledDiffuseColor;
    #endif
    `
  );
};

const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
scene.add(instancedMesh);

const positions = new Float32Array(count * 2);
const indices = new Float32Array(count);
const geometryIndexAttr = new THREE.InstancedBufferAttribute(indices, 1);
instancedMesh.geometry.setAttribute('vIndex', geometryIndexAttr);

const dummy = new THREE.Object3D();
const offset = (gridSize * spacing) / 2 - (spacing / 2);

for (let x = 0; x < gridSize; x++) {
  for (let y = 0; y < gridSize; y++) {
    const idx = x * gridSize + y;
    const px = x * spacing - offset;
    const py = y * spacing - offset;
    positions[idx * 2] = px;
    positions[idx * 2 + 1] = py;
    dummy.position.set(px, py, 0);
    dummy.updateMatrix();
    instancedMesh.setMatrixAt(idx, dummy.matrix);
  }
}
instancedMesh.instanceMatrix.needsUpdate = true;

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const time = clock.getElapsedTime();
  const noiseScale = 0.07;
  const timeScale = 0.2;

  for (let i = 0; i < count; i++) {
    const px = positions[i * 2];
    const py = positions[i * 2 + 1];
    const n = noise3D(px * noiseScale, py * noiseScale, time * timeScale);
    const mappedIndex = Math.floor(((n + 1) / 2) * 16);
    indices[i] = Math.max(0, Math.min(15, mappedIndex));
  }

  geometryIndexAttr.needsUpdate = true;
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
