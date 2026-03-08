/* global Hydra */
(function () {
  'use strict';

  var defaultCode =
    'voronoi(8,1)\n' +
    '.mult(osc(10,0.1,()=>Math.sin(time)*3).saturate(3).kaleid(200))\n' +
    '.modulate(o0,0.5)\n' +
    '.add(o0,0.8)\n' +
    '.scrollY(-0.01)\n' +
    '.scale(0.99)\n' +
    '.modulate(voronoi(8,1),0.008)\n' +
    '.luma(0.3)\n' +
    '.out()\n\n' +
    'speed = 0.1';

  var codeEditor = document.getElementById('hydra-code');
  var applyButton = document.getElementById('apply-code');
  var hydraCanvas = document.getElementById('hydra-canvas');
  var resizeTimer = null;

  function applyCode() {
    if (!codeEditor) return;
    if (typeof window.hush === 'function') {
      window.hush();
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
      applyCode();
    }, 100);
  }

  function initHydra() {
    if (!codeEditor || !applyButton || !hydraCanvas) return;

    codeEditor.value = defaultCode;

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

    bindEditor();
    updateResolution();
    applyCode();
    window.addEventListener('resize', handleResize);
  }

  document.addEventListener('DOMContentLoaded', initHydra);
})();
