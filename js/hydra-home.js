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
  var VIDEO_PATHS = ['images/projects/vid1.mp4', 'images/projects/vid2.mp4', 'images/projects/vid3.mp4'];
  var MEDIA_BLEND_KEY = 'hydraMediaBlend';
  var sourceSwitchTimer = null;
  var sourceFallbackTimer = null;
  var activeSlotName = 's0';
  var activeMediaKey = '';
  var slotVideos = { s0: null, s1: null };

  var codeTemplates = [
    'voronoi(()=>6 + mX * 2,()=>1 + mY * 0.25)\n' +
      '.mult(osc(()=>10 + mX * 3,0.1,()=>Math.sin(time)*3).saturate(()=>2.4 + mY*0.9).kaleid(()=>80 + mX*35))\n' +
      '.modulate(o0,()=>0.35 + mY*0.25)\n' +
      '.add(o0,()=>0.18 + mX*0.2)\n' +
      '.scrollY(()=>-0.01 + mY * .16)\n' +
      '.scale(()=>0.95 + mX * 0.09)\n' +
      '.diff(src(s0).blend(src(s1),()=>window.' + MEDIA_BLEND_KEY + ').contrast(1.08).saturate(0.5).scale(()=>1.02 - mX*0.05),()=>0.24 + mY*0.24)\n' +
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

  function randomBetween(minMs, maxMs) {
    return Math.floor(minMs + Math.random() * (maxMs - minMs));
  }

  function clearVideoSlot(slotName) {
    var video = slotVideos[slotName];
    if (!video) return;
    video.onended = null;
    video.onerror = null;
    video.pause();
    video.removeAttribute('src');
    video.load();
    slotVideos[slotName] = null;
  }

  function clearSourceCycle() {
    if (sourceSwitchTimer) {
      clearTimeout(sourceSwitchTimer);
      sourceSwitchTimer = null;
    }
    if (sourceFallbackTimer) {
      clearTimeout(sourceFallbackTimer);
      sourceFallbackTimer = null;
    }
    clearVideoSlot('s0');
    clearVideoSlot('s1');
  }

  function scheduleNextSourceSwitch(minMs, maxMs) {
    sourceSwitchTimer = setTimeout(function () {
      transitionToRandomSource();
    }, randomBetween(minMs, maxMs));
  }

  function chooseRandomMedia(prevKey) {
    // Keep portrait visible most of the time.
    var weightedPool = [
      { key: 'portrait', type: 'image', path: PORTRAIT_PATH, weight: 0.64 },
      { key: 'vid1', type: 'video', path: VIDEO_PATHS[0], weight: 0.12 },
      { key: 'vid2', type: 'video', path: VIDEO_PATHS[1], weight: 0.12 },
      { key: 'vid3', type: 'video', path: VIDEO_PATHS[2], weight: 0.12 },
    ];
    var pick = null;
    var totalWeight = 0;
    var i;

    for (i = 0; i < weightedPool.length; i += 1) {
      totalWeight += weightedPool[i].weight;
    }
    var threshold = Math.random() * totalWeight;
    for (i = 0; i < weightedPool.length; i += 1) {
      threshold -= weightedPool[i].weight;
      if (threshold <= 0) {
        pick = weightedPool[i];
        break;
      }
    }
    if (!pick) pick = weightedPool[0];

    // Avoid showing exactly the same source twice in a row.
    if (pick.key === prevKey) {
      for (i = 0; i < weightedPool.length; i += 1) {
        if (weightedPool[i].key !== prevKey) return weightedPool[i];
      }
    }
    return pick;
  }

  function setBlendValue(value) {
    window[MEDIA_BLEND_KEY] = value;
  }

  function animateBlend(toValue, durationMs, onDone) {
    var fromValue = Number(window[MEDIA_BLEND_KEY] || 0);
    var start = performance.now();

    function step(now) {
      var t = Math.min(1, (now - start) / durationMs);
      // Smoothstep easing.
      var eased = t * t * (3 - 2 * t);
      setBlendValue(fromValue + (toValue - fromValue) * eased);
      if (t < 1) {
        window.requestAnimationFrame(step);
      } else if (typeof onDone === 'function') {
        onDone();
      }
    }

    window.requestAnimationFrame(step);
  }

  function bindActiveVideoHandlers(slotName) {
    var video = slotVideos[slotName];
    if (!video) return;
    video.onended = function () {
      transitionToRandomSource();
    };
    video.onerror = function () {
      transitionToRandomSource();
    };
  }

  function initMediaInSlot(slotName, media, onReady) {
    var source = window[slotName];
    if (!source) return;
    clearVideoSlot(slotName);

    if (media.type === 'video' && typeof source.init === 'function') {
      var video = document.createElement('video');
      var readyCalled = false;
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.autoplay = true;
      video.loop = false;
      video.playsInline = true;
      video.preload = 'auto';
      function done() {
        if (readyCalled) return;
        readyCalled = true;
        if (typeof onReady === 'function') onReady();
      }

      video.addEventListener(
        'loadeddata',
        function () {
          var playPromise = video.play();
          if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(function () {
              done();
            });
          }
          done();
        },
        { once: true }
      );
      video.addEventListener(
        'error',
        function () {
          done();
        },
        { once: true }
      );
      video.src = media.path;
      source.init({ src: video, dynamic: true });
      slotVideos[slotName] = video;
      return;
    }

    if (typeof source.initImage === 'function') {
      source.initImage(media.path);
      // Let Hydra refresh source texture before blending.
      setTimeout(function () {
        if (typeof onReady === 'function') onReady();
      }, 90);
    }
  }

  function scheduleAfterActivation(mediaType) {
    if (sourceFallbackTimer) {
      clearTimeout(sourceFallbackTimer);
      sourceFallbackTimer = null;
    }
    if (mediaType === 'image') {
      scheduleNextSourceSwitch(9000, 17000);
      return;
    }
    // If video end event is missed, fallback still advances.
    sourceFallbackTimer = setTimeout(function () {
      transitionToRandomSource();
    }, 16000);
  }

  function transitionToRandomSource(isInitial) {
    if (typeof window.s0 === 'undefined' || typeof window.s1 === 'undefined') return;

    if (sourceSwitchTimer) {
      clearTimeout(sourceSwitchTimer);
      sourceSwitchTimer = null;
    }
    if (sourceFallbackTimer) {
      clearTimeout(sourceFallbackTimer);
      sourceFallbackTimer = null;
    }

    var nextMedia = chooseRandomMedia(activeMediaKey);
    var targetSlotName;
    var targetBlend;

    if (isInitial) {
      targetSlotName = 's0';
      targetBlend = 0;
    } else {
      targetSlotName = activeSlotName === 's0' ? 's1' : 's0';
      targetBlend = targetSlotName === 's1' ? 1 : 0;
    }

    initMediaInSlot(targetSlotName, nextMedia, function () {
      animateBlend(targetBlend, isInitial ? 1 : 1100, function () {
        activeSlotName = targetSlotName;
        activeMediaKey = nextMedia.key;
        bindActiveVideoHandlers(activeSlotName);
        scheduleAfterActivation(nextMedia.type);
      });
    });
  }

  function applyCode() {
    if (!codeEditor) return;
    if (typeof window.hush === 'function') {
      window.hush();
    }
    transitionToRandomSource();

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
    setBlendValue(0);
    transitionToRandomSource(true);

    bindEditor();
    bindPointerInput();
    updateResolution();
    applyCode();
    window.addEventListener('resize', handleResize);
  }

  document.addEventListener('DOMContentLoaded', initHydra);
})();
