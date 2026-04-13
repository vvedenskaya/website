/* global Hydra */
(function () {
  'use strict';

  // Mouse-driven controls used by all templates.
  window.mX = 0.5;
  window.mY = 0.5;
  var targetMX = 0.5;
  var targetMY = 0.5;
  var PORTRAIT_PATH = 'mars%20ph.jpg';
  var VIDEO_PATHS = ['images/projects/compressed/vid1.web.mp4', 'images/projects/compressed/vid2.web.mp4', 'images/projects/compressed/vid3.web.mp4'];
  var MEDIA_BLEND_KEY = 'hydraMediaBlend';
  var sourceSwitchTimer = null;
  var sourceFallbackTimer = null;
  var activeSlotName = 's0';
  var activeMediaKey = '';
  var slotVideos = { s0: null, s1: null };
  var slotMediaAspect = { s0: 1, s1: 1 };

  var HYDRA_SLIDER_IDS = ['hydra-speed', 'hydra-scale', 'hydra-scroll', 'hydra-kaleid', 'hydra-blend', 'hydra-luma', 'hydra-saturate'];
  var HYDRA_PARAM_KEYS = ['hydraSpeed', 'hydraScale', 'hydraScroll', 'hydraKaleid', 'hydraBlend', 'hydraLuma', 'hydraSaturate'];
  var HYDRA_DEFAULTS = [0.1, 0.96, 0.06, 45, 0.22, 0.18, 2.2];

  var hydraCanvas = document.getElementById('hydra-canvas');
  var resizeTimer = null;
  window.hydraMediaScaleX0 = 1;
  window.hydraMediaScaleY0 = 1;
  window.hydraMediaScaleX1 = 1;
  window.hydraMediaScaleY1 = 1;

  function getViewportAspect() {
    return Math.max(window.innerWidth, 1) / Math.max(window.innerHeight, 1);
  }

  function getCoverScale(mediaAspect, viewportAspect) {
    var safeMediaAspect = Number(mediaAspect);
    var safeViewportAspect = Number(viewportAspect);
    if (!isFinite(safeMediaAspect) || safeMediaAspect <= 0) return { x: 1, y: 1 };
    if (!isFinite(safeViewportAspect) || safeViewportAspect <= 0) return { x: 1, y: 1 };
    if (safeMediaAspect > safeViewportAspect) {
      return { x: safeMediaAspect / safeViewportAspect, y: 1 };
    }
    return { x: 1, y: safeViewportAspect / safeMediaAspect };
  }

  function updateSlotCoverScale(slotName) {
    var slotIndex = slotName === 's0' ? '0' : '1';
    var coverScale = getCoverScale(slotMediaAspect[slotName], getViewportAspect());
    window['hydraMediaScaleX' + slotIndex] = coverScale.x;
    window['hydraMediaScaleY' + slotIndex] = coverScale.y;
  }

  function updateAllCoverScales() {
    updateSlotCoverScale('s0');
    updateSlotCoverScale('s1');
  }

  function getTemplateCode() {
    return 'voronoi(()=>6 + mX * 0.2,()=>1 + mY * 0.05)\n' +
      '.mult(osc(()=>10 + mX * 3,0.1,()=>Math.sin(time)*1).saturate(()=>window.hydraSaturate).kaleid(()=>window.hydraKaleid))\n' +
      '.modulate(o0,()=>0.35 + mY*0.25)\n' +
      '.add(o0,()=>0.18 + mX*0.2)\n' +
      '.scrollY(()=>window.hydraScroll)\n' +
      '.scale(()=>window.hydraScale + mX * 0.04)\n' +
      '.diff(src(s0).scale(1, ()=>window.hydraMediaScaleX0, ()=>window.hydraMediaScaleY0).blend(src(s1).scale(1, ()=>window.hydraMediaScaleX1, ()=>window.hydraMediaScaleY1),()=>window.' + MEDIA_BLEND_KEY + ').contrast(1.08).saturate(0.5).scale(()=>1.02 - mX*0.05),()=>window.hydraBlend)\n' +
      '.modulate(voronoi(8,1),0.008)\n' +
      '.luma(()=>window.hydraLuma)\n' +
      '.out()\n\n' +
      'speed = window.hydraSpeed';
  }

  function bindPointerInput() {
    var isHudInteracting = false;
    var hudRoot = document.querySelector('.hud');

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
        var target = event.target;
        var insideHud = !!(target && typeof target.closest === 'function' && target.closest('.hud'));
        if (isHudInteracting || insideHud) return;
        updateMouse(event.clientX, event.clientY);
      },
      { passive: true }
    );

    if (hudRoot) {
      hudRoot.addEventListener('pointerdown', function () {
        isHudInteracting = true;
      });
    }

    window.addEventListener('pointerup', function () {
      isHudInteracting = false;
    });

    window.addEventListener('pointercancel', function () {
      isHudInteracting = false;
    });

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
      var sourceInitialized = false;
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.autoplay = true;
      video.loop = false;
      video.playsInline = true;
      video.preload = 'auto';
      function initHydraSourceFromVideo() {
        if (sourceInitialized) return;
        sourceInitialized = true;
        source.init({ src: video, dynamic: true });
        slotVideos[slotName] = video;
      }
      function done() {
        if (readyCalled) return;
        readyCalled = true;
        if (typeof onReady === 'function') onReady();
      }

      video.addEventListener(
        'loadeddata',
        function () {
          initHydraSourceFromVideo();
          var videoAspect = (video.videoWidth > 0 && video.videoHeight > 0) ? (video.videoWidth / video.videoHeight) : 1;
          slotMediaAspect[slotName] = videoAspect;
          updateSlotCoverScale(slotName);
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
      video.load();
      return;
    }

    if (typeof source.initImage === 'function') {
      source.initImage(media.path);
      var img = new Image();
      img.addEventListener(
        'load',
        function () {
          var imageAspect = (img.naturalWidth > 0 && img.naturalHeight > 0) ? (img.naturalWidth / img.naturalHeight) : 1;
          slotMediaAspect[slotName] = imageAspect;
          updateSlotCoverScale(slotName);
        },
        { once: true }
      );
      img.src = media.path;
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

  var codeEditor = document.getElementById('hydra-code');
  var applyCodeButton = document.getElementById('hydra-apply-code');

  function applyCode() {
    if (typeof window.hush === 'function') {
      window.hush();
    }
    var source = codeEditor && codeEditor.value ? codeEditor.value : getTemplateCode();
    try {
      window.eval(source);
      if (codeEditor) codeEditor.title = '';
    } catch (error) {
      if (codeEditor) codeEditor.title = error && error.message ? error.message : 'Error';
      console.error(error);
    }
  }

  function updateCodeDisplay() {
    if (codeEditor) codeEditor.value = getTemplateCode();
  }

  function bindCodeEditor() {
    if (!codeEditor) return;
    updateCodeDisplay();
    if (applyCodeButton) {
      applyCodeButton.addEventListener('click', function (e) {
        e.preventDefault();
        applyCode();
      });
    }
    codeEditor.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        applyCode();
      }
    });
  }

  function bindSliders() {
    function syncRuntimeParam(paramKey, value) {
      window[paramKey] = value;
      if (paramKey === 'hydraSpeed') {
        // Hydra uses the global speed variable at runtime.
        window.speed = value;
      }
    }

    for (var i = 0; i < HYDRA_SLIDER_IDS.length; i += 1) {
      var el = document.getElementById(HYDRA_SLIDER_IDS[i]);
      var key = HYDRA_PARAM_KEYS[i];
      var def = HYDRA_DEFAULTS[i];
      if (!el) continue;
      var min = parseFloat(el.min, 10);
      var max = parseFloat(el.max, 10);
      var initial = (typeof def === 'number' && def >= min && def <= max) ? def : (min + max) * 0.5;
      el.value = String(initial);
      syncRuntimeParam(key, initial);
      (function (input, paramKey) {
        function update() {
          var v = parseFloat(input.value, 10);
          if (!isFinite(v)) return;
          syncRuntimeParam(paramKey, v);
        }
        input.addEventListener('input', update);
        input.addEventListener('change', update);
      })(el, key);
    }
  }

  function preventEnterActivation() {
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      var target = event.target;
      var tagName = target && target.tagName ? target.tagName.toUpperCase() : '';
      if (tagName === 'BODY' || tagName === 'MAIN' || (hydraCanvas && target === hydraCanvas)) {
        event.preventDefault();
      }
    }, true);
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
      updateAllCoverScales();
    }, 100);
  }

  function bindProjectPopup() {
    var popup = document.getElementById('project-popup');
    var iframe = document.getElementById('project-popup-iframe');
    var caseStudy = document.getElementById('project-popup-case-study');
    var caseStudyVideo = caseStudy && caseStudy.querySelector('video');
    var titleEl = document.getElementById('project-popup-title');
    var closeBtn = popup && popup.querySelector('.project-popup-close');
    var backdrop = popup && popup.querySelector('.project-popup-backdrop');
    var projectLinks = document.querySelectorAll('.coverflow-track a');
    var lastFocusedElement = null;

    if (!popup || !iframe) return;
    popup.inert = true;

    function showIframeMode() {
      iframe.hidden = false;
      if (caseStudy) caseStudy.hidden = true;
    }

    function showCaseStudyMode() {
      iframe.hidden = true;
      if (caseStudy) caseStudy.hidden = false;
      if (caseStudyVideo) {
        caseStudyVideo.currentTime = 0;
        caseStudyVideo.play().catch(function () {});
      }
    }

    function openPopup(config) {
      var popupConfig = config || {};
      var mode = popupConfig.mode || 'iframe';
      var url = popupConfig.url || '';
      var label = popupConfig.label || 'Project';
      var trigger = popupConfig.trigger || null;

      lastFocusedElement = trigger || document.activeElement;

      if (mode === 'case-study') {
        showCaseStudyMode();
        iframe.src = '';
        titleEl.textContent = '';
      } else {
        showIframeMode();
        iframe.src = url;
        titleEl.textContent = label || 'Project';
      }
      popup.inert = false;
      popup.setAttribute('aria-hidden', 'false');
      popup.classList.add('project-popup-open');
      document.body.classList.add('project-popup-active');
      if (closeBtn) closeBtn.focus({ preventScroll: true });
    }

    function closePopup() {
      var active = document.activeElement;
      if (active && popup.contains(active) && active.blur) active.blur();
      if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
        lastFocusedElement.focus({ preventScroll: true });
      }
      popup.inert = true;
      popup.setAttribute('aria-hidden', 'true');
      popup.classList.remove('project-popup-open');
      document.body.classList.remove('project-popup-active');
      iframe.src = '';
      if (caseStudyVideo) caseStudyVideo.pause();
    }

    projectLinks.forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var url = link.getAttribute('href');
        var mode = link.getAttribute('data-popup-mode');
        var label = link.getAttribute('aria-label') || link.textContent.trim() || 'Project';
        if (mode === 'case-study') {
          openPopup({ mode: 'case-study', label: label, trigger: link });
          return;
        }
        if (url) openPopup({ mode: 'iframe', url: url, label: label, trigger: link });
      });
    });

    if (closeBtn) closeBtn.addEventListener('click', closePopup);
    if (backdrop) backdrop.addEventListener('click', closePopup);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && popup.classList.contains('project-popup-open')) closePopup();
    });
  }

  function initHydra() {
    if (!hydraCanvas) return;

    if (typeof Hydra === 'undefined') {
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
    updateAllCoverScales();
    setBlendValue(0);
    transitionToRandomSource(true);

    bindSliders();
    bindPointerInput();
    preventEnterActivation();
    updateResolution();
    applyCode();
    window.addEventListener('resize', handleResize);
  }

  document.addEventListener('DOMContentLoaded', function () {
    codeEditor = document.getElementById('hydra-code');
    applyCodeButton = document.getElementById('hydra-apply-code');
    bindCodeEditor();
    bindProjectPopup();
    initHydra();
  });
})();
