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
  var STAGE_H_MOBILE = 760;
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
  /* 220/279 — the floor matches the mobile circle size exactly, so the
     desktop layout never renders its circles smaller than mobile's. */
  var MIN_DESKTOP_SCALE = 0.789;

  /* Keep the original art direction centered while fitting every viewport. */
  function fitStage() {
    var isMobile = mobileQuery.matches;
    var w = isMobile ? STAGE_W_MOBILE : STAGE_W;
    var h = isMobile ? STAGE_H_MOBILE : STAGE_H;
    var vw = stageOuter.clientWidth;
    var vh = stageOuter.clientHeight;
    var scale = Math.min(vw / w, vh / h);
    if (!isMobile) {
      /* Tall/narrow desktop windows: fitting the full 1440px canvas width
         makes everything tiny while most of that width is empty video.
         All real content (logo, venn, brand line) lives inside the center
         ~1000px, so let the stage scale up to fill the height and crop
         the empty sides instead — as long as that center band still fits. */
      /* The widest real content is the venn triangle (~482px centered)
         — 600 leaves it ~60px of side margin at the crop limit. */
      var SAFE_CONTENT_W = 600;
      scale = Math.min(vh / h, Math.max(vw / w, Math.min(vw / SAFE_CONTENT_W, vh / h)));
      scale = Math.max(scale, MIN_DESKTOP_SCALE);
    }
    stage.style.transform = 'scale(' + scale + ')';
  }

  fitStage();
  window.addEventListener('resize', fitStage);

  /* The source loop is deliberately slowed so the light feels environmental,
     not like a five-second background clip. The still remains underneath. */
  if (heroVideo && !reduced) {
    function showVideo() {
      ambientScene.classList.add('is-video-ready');
    }

    /* Phones get their own 9:16 cut of the background; desktop keeps the
       wide one. Picked by the same 760px query as the layout, and swapped
       live if the viewport crosses the breakpoint. */
    var DESKTOP_BG = 'assets/bg_pc.mp4';
    var MOBILE_BG = 'assets/bg_mobile.mp4';
    var currentBg = null;

    function loadHeroSource() {
      var want = mobileQuery.matches ? MOBILE_BG : DESKTOP_BG;
      if (want === currentBg) return;
      currentBg = want;
      ambientScene.classList.remove('is-video-ready');
      heroVideo.src = want;
      heroVideo.addEventListener('loadeddata', function () {
        /* load() can reset playbackRate in some browsers — reapply. */
        heroVideo.playbackRate = 0.75;
        showVideo();
      }, { once: true });
      var playPromise = heroVideo.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(function () {
          ambientScene.classList.remove('is-video-ready');
        });
      }
    }

    loadHeroSource();
    if (mobileQuery.addEventListener) {
      mobileQuery.addEventListener('change', loadHeroSource);
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
    var brandSub = document.querySelector('.brandline-sub');
    var brandCopy = document.querySelector('.brandline-copy');
    var portalOrder = ['outer', 'inner', 'wellness'];
    /* Each circle gets its own clean, unhurried fade (no overlap — that
       read as busy/cheap) but quicker than the original pace, with a
       weighted deceleration instead of a flat linear glide so each arrival
       feels settled rather than abrupt. */
    var ringDuration = 0.95;
    /* Matched to the 3.4s eclipse lap (minus its fade-out tail): each
       circle arrives — with its label and its lap of light — right as
       the previous circle's lap hands off, one after another, never
       overlapping laps. */
    var ringStagger = 1.2;
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
    /* Mobile used to gather-then-separate; now it's the same triangle
       venn as desktop, so both share the identical pure-dissolve
       entrance — no positional motion anywhere. */
    gsap.set(core, { opacity: 0 });
    gsap.set(brandline, { opacity: 1 });
    gsap.set(brandRow, { opacity: 0 });
    gsap.set(brandSub, { opacity: 0 });
    gsap.set(brandCopy, { opacity: 0 });

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
      /* Fire the one-shot eclipse lap (CSS .is-arriving::before/::after)
         at the same instant this circle starts fading in, so the light,
         the ring, and the label all arrive as one motion. */
      ringTl.call(function () {
        portal.classList.add('is-arriving');
      }, null, at);
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
    ringTl.to(core, {
      opacity: 1,
      duration: 0.9,
      ease: 'power1.inOut',
      clearProps: 'opacity'
    }, allRingsDoneAt + 0.15);

    /* Tagline and copyright dissolve in together, right after the brand
       row itself has faded in. */
    var subStart = 0.15 + 1.3 + 0.25;
    var subDuration = 1.1;
    ringTl.to([brandSub, brandCopy], {
      opacity: function (i, target) {
        return target === brandCopy ? 0.38 : 1;
      },
      duration: subDuration,
      ease: 'power1.inOut'
    }, subStart);

    /* Pure dissolve entrance: opacity only, everything already in its
       final position — identical on desktop and mobile. */
    var ringTlStart = 0.32;
    var finalTl = gsap.timeline({ defaults: { ease: 'power1.inOut' } })
      .to(logo, { opacity: 1, duration: 1.1 }, 0)
      .to(portals, { opacity: dimOpacity, duration: 0.2 }, 0.08);

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
    var idleVeil = portal.querySelector('.portal-idle-veil');
    veil.style.pointerEvents = 'auto';

    /* Touch devices have no hover, so the tap itself plays the reveal:
       the chosen circle lights up with its photo (others dim via the
       same focus state hover uses), holds long enough to actually be
       seen, then the page dissolves to black and navigates. On desktop
       the photo is already showing from hover, so the fade starts
       almost immediately. */
    var touch = window.matchMedia('(hover: none)').matches;
    var holdBeforeFade = touch ? 0.95 : 0.15;

    venn.classList.add('is-focused');
    portal.classList.add('is-active');

    var tl = gsap.timeline({
      onComplete: function () {
        window.location.href = href;
      }
    });

    /* Touch: a fast fade — quick enough to feel like immediate tap
       feedback, soft enough to not pop. The inline transition:none keeps
       the stylesheet's slow .7s ease from fighting gsap's timing. */
    if (touch) {
      /* Mirror the desktop :hover reveal exactly (opacity .88, scale 1,
         brightened filter) so the tapped photo reads the same on both. */
      tl.to(win, {
        opacity: 0.88,
        scale: 1,
        filter: 'brightness(1.1) saturate(.98)',
        duration: 0.22,
        ease: 'power2.out',
        transition: 'none'
      }, 0);
      if (idleVeil) tl.to(idleVeil, { opacity: 0, duration: 0.22, ease: 'power2.out', transition: 'none' }, 0);
    } else {
      tl.to(win, { opacity: 0.9, duration: 0.5, ease: 'power2.out' }, 0);
      if (idleVeil) tl.to(idleVeil, { opacity: 0, duration: 0.45, ease: 'power2.out' }, 0);
    }
    tl.to(veil, { opacity: 1, duration: 0.7, ease: 'power1.inOut' }, holdBeforeFade);
  }
})();
