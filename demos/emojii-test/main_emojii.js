const canvas = document.getElementById('hydra-canvas');

if (!canvas || typeof window.Hydra === 'undefined') {
  throw new Error('Hydra canvas or library is not available.');
}

const dpr = Math.min(window.devicePixelRatio || 1, 2);
const initialWidth = Math.max(1, Math.floor(window.innerWidth * dpr));
const initialHeight = Math.max(1, Math.floor(window.innerHeight * dpr));

new window.Hydra({
  canvas: canvas,
  width: initialWidth,
  height: initialHeight,
  detectAudio: false,
  makeGlobal: true,
});

function draw() {
  speed = 0.16;

  noise(2.4, 0.035)
    .color(0.05, 0.08, 0.12)
    .brightness(0.06)
    .modulate(
      osc(3.2, 0.015, 1.1)
        .kaleid(3)
        .color(0.22, 0.28, 0.36)
        .rotate(() => Math.sin(time * 0.08) * 0.03),
      0.08
    )
    .add(
      gradient(0.18)
        .color(0.85, 0.9, 1.0)
        .rotate(1.57),
      0.1
    )
    .modulate(voronoi(4, 0.12, 0.5).brightness(-0.6), 0.03)
    .add(src(o0).scale(1.001).scrollX(0.00025).scrollY(-0.0002), 0.82)
    .contrast(1.03)
    .saturate(0.85)
    .out(o0);

  render(o0);
}

draw();

window.addEventListener('resize', () => {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(window.innerWidth * pixelRatio));
  const height = Math.max(1, Math.floor(window.innerHeight * pixelRatio));
  canvas.width = width;
  canvas.height = height;
  if (typeof window.setResolution === 'function') {
    window.setResolution(width, height);
  }
});
