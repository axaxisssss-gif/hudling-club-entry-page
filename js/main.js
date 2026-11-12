(function () {
  var STAGE_W = 1440;
  var STAGE_H = 1063;
  /* Mobile gets its own, much smaller design canvas (matches the
     --stage-w/--stage-h values set in style.css's mobile media query).
     Scaling the wide, short desktop canvas down to fit a narrow, tall
     phone is width-bound and shrinks everything to a fraction of its
     already-small mobile-authored size — a separate canvas close to a
     phone's own proportions keeps circles at a genuinely tappable size. */
  var STAGE_W_MOBILE = 430;
  var STAGE_H_MOBILE = 975;
  var mobileQuery = window.matchMedia('(max-width: 760px)');

  var stageOuter = document.querySelector('.stage-outer');
  var stage = document.getElementById('stage');
  var ambientScene = document.querySelector('.ambient-scene');
  var heroVideo = document.getElementById('heroVideo');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Desktop only: below this, the circles read as uncomfortably small
     before the mobile layout breakpoint (760px) ever kicks in. Floored
     here instead — the stage just crops at the left/right edges past
     this point rather than keep shrinking (the venn/logo sit centered,
     well clear of the edges, so cropping never touches them in this
     narrow band before mobile takes over). */
  var MIN_DESKTOP_SCALE = 0.75;

  /* Keep the original art direction centered while fitting every viewport. */
  function fitStage() {
    var isMobile = mobileQuery.matches;
    var w = isMobile ? STAGE_W_MOBILE : STAGE_W;
    var h = isMobile ? STAGE_H_MOBILE : STAGE_H;
    var vw = stageOuter.clientWidth;
    var vh = stageOuter.clientHeight;
    var scale = Math.min(vw / w, vh / h);
    if (!isMobile) {
      scale = Math.max(scale, MIN_DESKTOP_SCALE);
    }
    stage.style.transform = 'scale(' + scale + ')';
  }

  fitStage();
  window.addEventListener('resize', fitStage);

  /* The source loop is deliberately slowed so the light feels environmental,
     not like a five-second background clip. The still remains underneath. */
  if (heroVideo && !reduced) {
    heroVideo.playbackRate = 0.75;

    function showVideo() {
      ambientScene.classList.add('is-video-ready');
    }

    if (heroVideo.readyState >= 2) {
      showVideo();
    } else {
      heroVideo.addEventListener('loadeddata', showVideo, { once: true });
    }

    var playPromise = heroVideo.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(function () {
        ambientScene.classList.remove('is-video-ready');
      });
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        heroVideo.pause();
      } else {
        heroVideo.play().catch(function () {});
      }
    });
  }

  /* Focus is clear without erasing the other two choices. */
  var venn = document.querySelector('.venn');
  document.querySelectorAll('.portal').forEach(function (portal) {
    function activate() {
      venn.classList.add('is-focused');
      portal.classList.add('is-active');
    }

    function deactivate() {
      venn.classList.remove('is-focused');
      portal.classList.remove('is-active');
    }

    portal.addEventListener('mouseenter', activate);
    portal.addEventListener('mouseleave', deactivate);
    portal.addEventListener('focus', activate);
    portal.addEventListener('blur', deactivate);
  });

  /* Everything dissolves in place — no rising, no sliding. The circles (with
     their titles, but no "Explore Now" yet) fade in dim and all-at-once.
     Then a single clean 1px line traces each ring's edge once around
     (stroke-dasharray/-dashoffset), one circle at a time — Outer, then
     Inner, then Wellness. As each line completes it dissolves away into the
     permanent CSS border while that circle breathes up to full brightness
     and its "Explore Now" fades in. */
  function playEntrance() {
    var isMobile = mobileQuery.matches;
    var reveals = document.querySelectorAll('.reveal');
    var logo = document.getElementById('logoMark');
    var portals = document.querySelectorAll('.portal');
    var core = document.querySelector('.venn-core');
    var brandline = document.querySelector('.brandline');
    var brandRow = document.querySelector('.brandline-row');
    var brandRules = document.querySelectorAll('.brandline-rule');
    var brandSub = document.querySelector('.brandline-sub');
    var brandCopy = document.querySelector('.brandline-copy');
    var brandWatermark = document.querySelector('.brandline-watermark');
    var portalOrder = ['outer', 'inner', 'wellness'];
    /* Each circle gets its own clean, unhurried fade (no overlap — that
       read as busy/cheap) but quicker than the original pace, with a
       weighted deceleration instead of a flat linear glide so each arrival
       feels settled rather than abrupt. */
    var ringDuration = 0.95;
    var ringStagger = ringDuration;
    var ringEases = ['power2.out', 'power2.out', 'power2.out'];
    var dimOpacity = 0.18;

    if (reduced || typeof gsap === 'undefined') {
      reveals.forEach(function (el) {
        el.style.opacity = 1;
      });
      return;
    }

    gsap.set(reveals, { opacity: 1 });
    gsap.set(logo, { opacity: 0 });
    gsap.set(portals, { opacity: 0 });
    /* Mobile only: rather than appearing already spread out in the final
       vertical column, all three start stacked directly on top of each
       other at Inner's slot (dead center of the column), then Outer
       rides straight up and Wellness rides straight down into their
       final spots — a clean vertical gather-then-separate, no sideways
       motion. */
    if (isMobile) {
      var outerPortal = document.querySelector('.portal--outer');
      var innerPortal = document.querySelector('.portal--inner');
      var wellnessPortal = document.querySelector('.portal--wellness');
      gsap.set(outerPortal, { y: 180 });
      gsap.set(innerPortal, { y: 0 });
      gsap.set(wellnessPortal, { y: -180 });
    }
    gsap.set(core, { opacity: 0 });
    gsap.set(brandline, { opacity: 1 });
    gsap.set(brandRow, { opacity: 0 });
    /* Real layout width, not a transform — .brandline-left/-right are
       right/left-anchored flex boxes, so shrinking the rule's actual width
       pulls "Beauty"/"Balance" in close to "Is" at rest, and growing it
       back out is what physically pushes the words apart later. */
    gsap.set(brandRules, { width: 0 });
    /* Tagline dissolves in as one block, once "Beauty Is Balance" has
       fully opened. */
    gsap.set(brandSub, { opacity: 0 });
    gsap.set(brandCopy, { opacity: 0 });
    gsap.set(brandWatermark, { opacity: 0 });

    var ringTl = gsap.timeline();
    portalOrder.forEach(function (name, i) {
      var portal = document.querySelector('.portal--' + name);
      if (!portal) return;
      var at = i * ringStagger;
      var ringEase = ringEases[i] || 'none';
      /* Photos stay hidden on entrance (hover/focus-only, per the resting
         design) — no flash/pulse of the product shot while the circle
         fades in; that read as cheap. */
      ringTl.to(portal, {
        opacity: 1,
        duration: ringDuration,
        ease: ringEase,
        clearProps: 'opacity'
      }, at);
      /* A much brighter twin of the ring (.portal-ring-flash) sits on top
         at full strength the instant the circle lands, then dissolves
         away to reveal the quiet, low-contrast resting line underneath —
         a one-time emphasis on arrival rather than a permanently bright
         ring. */
      var ringFlash = portal.querySelector('.portal-ring-flash');
      if (ringFlash) {
        gsap.set(ringFlash, { opacity: 1 });
        ringTl.to(ringFlash, {
          opacity: 0,
          duration: 1.3,
          ease: 'power2.out'
        }, at + ringDuration * 0.5);
      }
    });
    /* Once all three circles are done, the center dot dissolves in and all
       three "Explore Now"s dissolve in together — one calm exhale that
       closes out the sequence. */
    var allRingsDoneAt = (portalOrder.length - 1) * ringStagger + ringDuration;
    ringTl.to(brandRules, {
      width: isMobile ? 72 : 95,
      duration: 1.3,
      stagger: 0.08,
      ease: 'power2.out',
      clearProps: 'width'
    }, 0.15);
    ringTl.to(core, {
      opacity: 1,
      duration: 0.9,
      ease: 'power1.inOut',
      clearProps: 'opacity'
    }, allRingsDoneAt + 0.15);

    /* Watermark, tagline, and copyright all dissolve in together, right
       after the rule lines finish opening (start 0.15, take 1.3s). */
    var subStart = 0.15 + 1.3 + 0.25;
    var subDuration = 1.1;
    ringTl.to([brandWatermark, brandSub, brandCopy], {
      opacity: function (i, target) {
        return target === brandWatermark ? 0.15 : (target === brandCopy ? 0.38 : 1);
      },
      duration: subDuration,
      ease: 'power1.inOut'
    }, subStart);

    /* Pure dissolve entrance: opacity only, everything already in its
       final position (desktop) — mobile adds the gather-then-separate
       move on top, so the ring-draw sequence is pushed back until after
       the circles have finished settling into their column spots. */
    var ringTlStart = isMobile ? 1.05 : 0.32;
    var finalTl = gsap.timeline({ defaults: { ease: 'power1.inOut' } })
      .to(logo, { opacity: 1, duration: 1.1 }, 0)
      .to(portals, { opacity: dimOpacity, duration: 0.2 }, 0.08);

    if (isMobile) {
      finalTl.to([outerPortal, innerPortal, wellnessPortal], {
        y: 0,
        duration: 0.8,
        stagger: 0.05,
        ease: 'power3.out'
      }, 0.15);
    }

    finalTl
      .add(ringTl, ringTlStart)
      .to(brandRow, { opacity: 1, duration: 0.9, clearProps: 'opacity' }, 0.5)
      .set(logo, { clearProps: 'opacity' });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', playEntrance, { once: true });
  } else {
    playEntrance();
  }

  /* A circular veil grows from the chosen gateway. It keeps the geometry's
     meaning without shrinking and wobbling the entire composition. */
  document.querySelectorAll('.portal').forEach(function (portal) {
    portal.addEventListener('click', function (event) {
      var href = portal.getAttribute('href');
      if (!href || event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
      event.preventDefault();
      enterPortal(portal, href);
    });
  });

  function enterPortal(portal, href) {
    if (reduced || typeof gsap === 'undefined') {
      window.location.href = href;
      return;
    }

    var veil = document.getElementById('zoomVeil');
    var win = portal.querySelector('.portal-window');
    veil.style.pointerEvents = 'auto';

    /* Simple, natural crossfade: show the tapped circle's photo (there's
       no hover on touch to have already revealed it), then the whole
       page dissolves to black before the next page loads. */
    var tl = gsap.timeline({
      onComplete: function () {
        window.location.href = href;
      }
    });

    tl.to(win, { opacity: 0.9, duration: 0.5, ease: 'power2.out' }, 0)
      .to(veil, { opacity: 1, duration: 0.7, ease: 'power1.inOut' }, 0.15);
  }
})();
