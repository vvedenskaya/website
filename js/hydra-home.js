/* global Hydra */
(function () {
  'use strict';

  // Mouse-driven controls used by all templates.
  window.mX = 0.5;
  window.mY = 0.5;
  var targetMX = 0.5;
  var targetMY = 0.5;
  var TEMPLATE_INDEX_KEY = 'hydraTemplateIndex';
  var PORTRAIT_PATH = 'mars%20ph.jpg';

  var codeTemplates = [
    'voronoi(()=>6 + mX * 2,()=>1 + mY * 0.25)\n' +
      '.mult(osc(()=>10 + mX * 3,0.1,()=>Math.sin(time)*3).saturate(()=>2.4 + mY*0.9).kaleid(()=>80 + mX*35))\n' +
      '.modulate(o0,()=>0.35 + mY*0.25)\n' +
      '.add(o0,()=>0.18 + mX*0.2)\n' +
      '.scrollY(()=>-0.01 + mY * .16)\n' +
      '.scale(()=>0.95 + mX * 0.09)\n' +
      '.diff(src(s0).contrast(1.08).saturate(0.5).scale(()=>1.02 - mX*0.05),()=>0.24 + mY*0.24)\n' +
      '.modulate(voronoi(8,1),0.008)\n' +
      '.luma(()=>0.25 + mY*0.12)\n' +
      '.out()\n\n' +
      'speed = 0.1'
    
  ];

  var codeEditor = document.getElementById('hydra-code');
  var applyButton = document.getElementById('apply-code');
  var hydraCanvas = document.getElementById('hydra-canvas');
  var resizeTimer = null;

  function pickTemplateForLoad() {
    var total = codeTemplates.length;
    if (!total) return '';

    var nextIndex = 0;
    try {
      var previousIndex = Number(window.localStorage.getItem(TEMPLATE_INDEX_KEY));
      if (Number.isFinite(previousIndex) && previousIndex >= 0) {
        nextIndex = (previousIndex + 1) % total;
      } else {
        nextIndex = Math.floor(Math.random() * total);
      }
      window.localStorage.setItem(TEMPLATE_INDEX_KEY, String(nextIndex));
    } catch (_e) {
      nextIndex = Math.floor(Math.random() * total);
    }

    return codeTemplates[nextIndex];
  }

  function bindPointerInput() {
    function updateMouse(clientX, clientY) {
      var w = Math.max(window.innerWidth, 1);
      var h = Math.max(window.innerHeight, 1);
      targetMX = Math.min(1, Math.max(0, clientX / w));
      targetMY = Math.min(1, Math.max(0, clientY / h));
    }

    function tickMouseSmoothing() {
      window.mX += (targetMX - window.mX) * 0.08;
      window.mY += (targetMY - window.mY) * 0.08;
      window.requestAnimationFrame(tickMouseSmoothing);
    }

    window.addEventListener(
      'pointermove',
      function (event) {
        updateMouse(event.clientX, event.clientY);
      },
      { passive: true }
    );

    window.requestAnimationFrame(tickMouseSmoothing);
  }

  function applyCode() {
    if (!codeEditor) return;
    if (typeof window.hush === 'function') {
      window.hush();
    }
    if (typeof window.s0 !== 'undefined' && typeof window.s0.initImage === 'function') {
      window.s0.initImage(PORTRAIT_PATH);
    }

    try {
      window.eval(codeEditor.value);
      codeEditor.title = '';
    } catch (error) {
      codeEditor.title = error && error.message ? error.message : 'Hydra code error';
      console.error(error);
    }
  }

  function bindEditor() {
    if (!codeEditor || !applyButton) return;

    applyButton.addEventListener('click', applyCode);
    codeEditor.addEventListener('keydown', function (event) {
      var isEnter = event.key === 'Enter';
      var withModifier = event.metaKey || event.ctrlKey;
      if (!isEnter || !withModifier) return;
      event.preventDefault();
      applyCode();
    });
  }

  function updateResolution() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var width = Math.max(1, Math.floor(window.innerWidth * dpr));
    var height = Math.max(1, Math.floor(window.innerHeight * dpr));

    hydraCanvas.width = width;
    hydraCanvas.height = height;

    if (typeof window.setResolution === 'function') {
      window.setResolution(width, height);
    }
  }

  function handleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      updateResolution();
    }, 100);
  }

  function initHydra() {
    if (!codeEditor || !applyButton || !hydraCanvas) return;

    // Choose template once per page load.
    codeEditor.value = pickTemplateForLoad();

    if (typeof Hydra === 'undefined') {
      codeEditor.value = 'Hydra library did not load. Check your internet connection.';
      return;
    }

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var width = Math.max(1, Math.floor(window.innerWidth * dpr));
    var height = Math.max(1, Math.floor(window.innerHeight * dpr));

    new Hydra({
      canvas: hydraCanvas,
      width: width,
      height: height,
      detectAudio: false,
      makeGlobal: true,
    });
    if (typeof window.s0 !== 'undefined' && typeof window.s0.initImage === 'function') {
      window.s0.initImage(PORTRAIT_PATH);
    }

    bindEditor();
    bindPointerInput();
    updateResolution();
    applyCode();
    window.addEventListener('resize', handleResize);
  }

  document.addEventListener('DOMContentLoaded', initHydra);
})();
