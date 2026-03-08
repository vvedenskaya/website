import * as THREE from 'three';

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

// Camera
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 8;

// Renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const geometry = new THREE.IcosahedronGeometry();
const material = new THREE.MeshBasicMaterial( { color: 0xffff00 } );
const icosahedron = new THREE.Mesh( geometry, material );
scene.add( icosahedron );

camera.position.z = 5;

function animate(time) {
  requestAnimationFrame(animate);
  icosahedron.rotation.x = time / 1000;
  icosahedron.rotation.y = time / 500;
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);
