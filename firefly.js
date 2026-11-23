// Shared by every page: load at the end of <body>. Pages style .firefly
// (fixed, full-screen, pointer-events: none) and hide the cursor under
// html.has-firefly.
// ================= Firefly cursor =================
// A soft point of warm light, with no hard edge: it trails a faint misty
// tail and now and then lets a mote drift up and away as it moves. Only for fine pointers (mouse, trackpad); touch
// screens keep their normal behaviour. With reduced motion the sphere
// still follows the pointer, but without the tail or sparks.
(function () {
  if (!matchMedia("(pointer: fine)").matches) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let cv = document.getElementById("firefly");
  if (!cv) {
    cv = document.createElement("canvas");
    cv.className = "firefly"; cv.id = "firefly"; cv.setAttribute("aria-hidden", "true");
    document.body.appendChild(cv);
  }
  const ctx = cv.getContext("2d");
  document.documentElement.classList.add("has-firefly");

  let dpr = 1, vw = 0, vh = 0;
  function size() {
    dpr = Math.min(2, devicePixelRatio || 1);
    vw = innerWidth; vh = innerHeight;
    cv.width = vw * dpr; cv.height = vh * dpr;
  }
  size();
  addEventListener("resize", size);

  // Everything is drawn from one feathered glow, so no part of the light
  // has an edge: a near-Gaussian falloff of warm ivory.
  const GLOW = 128;
  const glow = document.createElement("canvas");
  glow.width = glow.height = GLOW;
  {
    const g = glow.getContext("2d");
    const grad = g.createRadialGradient(GLOW / 2, GLOW / 2, 0, GLOW / 2, GLOW / 2, GLOW / 2);
    grad.addColorStop(0, "rgba(255, 252, 238, 1)");
    grad.addColorStop(0.16, "rgba(255, 249, 228, 0.82)");
    grad.addColorStop(0.32, "rgba(250, 243, 216, 0.5)");
    grad.addColorStop(0.52, "rgba(245, 238, 210, 0.2)");
    grad.addColorStop(0.74, "rgba(242, 236, 214, 0.06)");
    grad.addColorStop(1, "rgba(242, 236, 214, 0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, GLOW, GLOW);
  }
  const light = (x, y, d, alpha) => {
    if (alpha <= 0.004) return;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(glow, x - d / 2, y - d / 2, d, d);
  };

  const mouse = { x: -100, y: -100 };
  const orb = { x: -100, y: -100, r: 6, targetR: 6, alpha: 0, targetAlpha: 0 };
  const trail = [];  // recent positions of the orb: {x, y, t}
  const sparks = []; // {x, y, vx, vy, born, life, r, phase}
  const TRAIL_MS = 360;
  let down = false, over = false, raf = null, last = performance.now();

  const INTERACTIVE = "a, button, [role='button'], .pin, summary, label";
  addEventListener("pointermove", (e) => {
    if (e.pointerType && e.pointerType !== "mouse" && e.pointerType !== "pen") return;
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (orb.alpha === 0 && orb.targetAlpha === 0) { orb.x = mouse.x; orb.y = mouse.y; }
    over = !!(e.target.closest && e.target.closest(INTERACTIVE));
    // Over a small word on the hill the light dims, so it never washes
    // out the letters being read.
    orb.targetAlpha = e.target.closest && e.target.closest(".word") ? 0.32 : 1;
    wake();
  }, { passive: true });
  addEventListener("pointerdown", () => { down = true; wake(); });
  addEventListener("pointerup", () => { down = false; wake(); });
  document.addEventListener("mouseleave", () => { orb.targetAlpha = 0; wake(); });
  document.documentElement.addEventListener("mouseleave", () => { orb.targetAlpha = 0; wake(); });

  function wake() { if (raf === null) { last = performance.now(); raf = requestAnimationFrame(tick); } }

  function tick(now) {
    const dt = Math.max(0, Math.min(48, now - last)); last = now;
    // Frame-rate independent easing; k = 1 snaps straight to the target.
    const f = (k) => (k >= 1 ? 1 : 1 - Math.pow(1 - k, dt / 16.7));

    // The orb trails just behind the pointer, so the tail has room to form.
    orb.x += (mouse.x - orb.x) * f(reduce ? 1 : 0.27);
    orb.y += (mouse.y - orb.y) * f(reduce ? 1 : 0.27);
    orb.targetR = down ? 4.6 : over ? (orb.targetAlpha < 1 ? 5 : 8.5) : 6;
    orb.r += (orb.targetR - orb.r) * f(0.14);
    orb.alpha += (orb.targetAlpha - orb.alpha) * f(0.12);

    if (!reduce) {
      trail.push({ x: orb.x, y: orb.y, t: now });
      while (trail.length && now - trail[0].t > TRAIL_MS) trail.shift();
      // Sparks come off in proportion to how fast it's moving.
      const prev = trail[trail.length - 2];
      const speed = prev ? Math.hypot(orb.x - prev.x, orb.y - prev.y) : 0;
      if (sparks.length < 14 && Math.random() < Math.min(0.35, speed / 22)) {
        sparks.push({
          x: orb.x + (Math.random() - 0.5) * 8, y: orb.y + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 0.012, vy: -0.006 - Math.random() * 0.012,
          born: now, life: 1400 + Math.random() * 1200, r: 1.2 + Math.random() * 1.2, phase: Math.random() * 6.28,
        });
      }
      for (let i = sparks.length - 1; i >= 0; i--) if (now - sparks[i].born > sparks[i].life) sparks.splice(i, 1);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    const a = orb.alpha;

    if (a > 0.01) {
      // A faint cool shadow just below the light, the way the page's own
      // surfaces cast theirs: it keeps the light findable on the pale sky
      // without giving it a rim.
      const pulse = reduce ? 1 : 1 + 0.05 * Math.sin(now * 0.0024);
      const R = orb.r * pulse;
      ctx.globalAlpha = 1;
      const shade = ctx.createRadialGradient(orb.x, orb.y + R * 0.5, 0, orb.x, orb.y + R * 0.5, R * 3.4);
      shade.addColorStop(0, `rgba(51, 64, 63, ${(0.16 * a).toFixed(3)})`);
      shade.addColorStop(0.5, `rgba(51, 64, 63, ${(0.05 * a).toFixed(3)})`);
      shade.addColorStop(1, "rgba(51, 64, 63, 0)");
      ctx.fillStyle = shade;
      ctx.beginPath(); ctx.arc(orb.x, orb.y + R * 0.5, R * 3.4, 0, Math.PI * 2); ctx.fill();

      // Tail: a mist of soft light thinning out behind it.
      for (let i = 0; i < trail.length - 1; i++) {
        const k = (i + 1) / trail.length; // near 0 at the end of the tail, 1 at the light
        light(trail[i].x, trail[i].y, R * (1.4 + 2.2 * k), 0.3 * k * k * a);
      }

      // Motes: drift up and away, swelling in and out of view slowly.
      for (const m of sparks) {
        const age = (now - m.born) / m.life;
        m.x += m.vx * dt; m.y += m.vy * dt;
        m.vx += Math.sin(now * 0.0016 + m.phase) * 0.00018 * dt;
        const env = Math.sin(Math.PI * Math.min(1, age)); // fades in, then out
        const twinkle = 0.8 + 0.2 * Math.sin(now * 0.005 + m.phase);
        light(m.x, m.y, m.r * 6, 0.7 * env * twinkle * a);
      }

      // The light: a wide breath of glow, then a brighter heart, each
      // feathered all the way out.
      light(orb.x, orb.y, R * 7.5, 0.5 * a);
      light(orb.x, orb.y, R * 2.8, 0.95 * a);
      light(orb.x, orb.y, R * 1.3, a);
      ctx.globalAlpha = 1;
    }

    // Keep running while anything is still moving, pulsing or fading.
    const settling = Math.abs(mouse.x - orb.x) > 0.3 || Math.abs(mouse.y - orb.y) > 0.3 ||
      trail.length > 1 || sparks.length || Math.abs(orb.alpha - orb.targetAlpha) > 0.01 ||
      Math.abs(orb.r - orb.targetR) > 0.05;
    if (settling || (!reduce && orb.alpha > 0.01)) raf = requestAnimationFrame(tick);
    else raf = null;
  }
})();
