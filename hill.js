// The landscape: sky, clouds, hazy mountains, rolling grassland and a
// gently sloping field whose crest the page's words stand on. The scenery
// is painted on the GPU (one fragment shader, three layers: sky, far, near)
// so it reads like a photograph and redraws sharply at any size; it is
// rendered once per resize, not every frame. Words are <a class="word">
// elements inside #words; each sits on the crest and hops on a spring.
(function () {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const root = document.documentElement;
  root.classList.add("js");

  const wrap = document.getElementById("near-wrap");
  const skyCv = document.getElementById("sky");
  const farCv = document.getElementById("far");
  const nearCv = document.getElementById("near");
  const shadowsEl = document.getElementById("shadows");
  const wordsEl = document.getElementById("words");
  const pxLayers = [...document.querySelectorAll(".px")];

  const n1 = (v) => v.toFixed(1);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  let W = 0, H = 0, narrow = false;
  // How much wider than the screen the sky is painted, so it can drift.
  const SKY_EXTRA = 0.12;

  // ---------- The near field's crest ----------
  // Shared with the shader through uniforms, so the words stand exactly on
  // the painted edge.
  let CA = 0.69, CB = 0.555, CS = 0.6;
  function crest(x) {
    const u = x / W;
    return H * (CA + (CB - CA) * u + CS * (0.015 * Math.sin(u * 6.6 + 0.5) + 0.006 * Math.sin(u * 15.2 + 1.8)));
  }

  // ---------- The painter ----------
  const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
  const FRAG = `
precision highp float;
uniform vec2 uRes;    // canvas size in device pixels
uniform vec2 uSize;   // canvas size in CSS pixels
uniform vec2 uOff;    // canvas origin inside the scene, CSS pixels
uniform vec2 uWrap;   // scene size (W, H), CSS pixels
uniform vec3 uCrest;  // a, b, swell
uniform float uLayer; // 0 sky, 1 far, 2 near
uniform float uNarrow;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
const mat2 ROT = mat2(1.6, 1.2, -1.2, 1.6);
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) { s += a * noise(p); p = ROT * p; a *= 0.5; }
  return s;
}
float fbm3(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { s += a * noise(p); p = ROT * p; a *= 0.5; }
  return s;
}

float W, H;
float crest(float x) {
  float u = x / W;
  return H * (uCrest.x + (uCrest.y - uCrest.x) * u + uCrest.z * (0.015 * sin(u * 6.6 + 0.5) + 0.006 * sin(u * 15.2 + 1.8)));
}

// One sun, low in the upper right, drives every layer: the sky's glow,
// the lit sides of the clouds, the mountain faces and the field's folds.
// Colours: a blue sky warming to hazy cream at the horizon.
const vec3 SKY_TOP = vec3(0.537, 0.682, 0.784);
const vec3 SKY_MID = vec3(0.733, 0.808, 0.843);
const vec3 HAZE = vec3(0.925, 0.900, 0.835);
const vec3 SUNC = vec3(1.0, 0.95, 0.84);
vec2 SUN;            // sun position, CSS pixels
const vec2 TO_SUN = vec2(0.62, -0.78); // screen direction toward the sun

vec3 skyColor(float X, float Y) {
  float t = Y / (H * 0.6);
  vec3 c = mix(SKY_TOP, SKY_MID, smoothstep(0.0, 0.75, t));
  c = mix(c, HAZE, smoothstep(0.55, 1.0, t));
  // Warm forward scatter around the sun, strongest down at the horizon.
  float g = exp(-length((vec2(X, Y) - SUN) / vec2(W * 0.5, H * 0.55)) * 1.8);
  float hz = smoothstep(H * 0.3, H * 0.56, Y) * exp(-pow((X - SUN.x) / (W * 0.45), 2.0));
  return c + vec3(0.10, 0.08, 0.03) * g + vec3(0.04, 0.03, 0.0) * hz;
}

// Cumulus bank on the horizon. Its base sits behind the mountains, so only
// the sunlit heaped tops show above them.
float bankDensity(vec2 P, float base, out float hmax) {
  float prof = fbm3(vec2(P.x / 430.0, 3.1));
  hmax = H * (0.09 + 0.24 * smoothstep(0.28, 0.7, prof));
  float h = base - P.y;
  vec2 q = P / 95.0;
  q += 0.6 * vec2(fbm3(q * 0.5 + 2.3), fbm3(q * 0.5 + 7.9));
  float n = fbm(q);
  // Rounded heads: denser low down, thinning upward to a bumpy top.
  return n * 1.25 - pow(max(h, 0.0) / hmax, 1.4) * 0.8 + 0.14;
}

// Fair-weather clouds in the upper sky: separate heaped masses of
// different sizes with blue between them. Each sits on a soft, nearly
// flat base and builds up into rounded, sunlit heads.
float deckDensity(vec2 P, float yc, out float hm, out float yb) {
  // Which stretches of sky hold a cloud, and how big it is.
  float cell = fbm3(vec2(P.x / 260.0, 21.0));
  float cover = smoothstep(0.3, 0.5, cell);
  yb = yc + (fbm3(vec2(P.x / 900.0, 8.0)) - 0.5) * H * 0.06;
  hm = H * (0.03 + 0.1 * cover * smoothstep(0.25, 0.7, fbm3(vec2(P.x / 240.0, 4.4))));
  float h = yb - P.y;                       // height above the base
  vec2 q = vec2(P.x / 85.0, P.y / 60.0);
  q += 0.7 * vec2(fbm3(q * 0.55 + 4.0), fbm3(q * 0.55 + 1.7));
  float n = fbm(q);
  float body = n * 1.2 - pow(max(h, 0.0) / hm, 1.5) * 0.85 + 0.12;
  // Feathered underside instead of a ruled base.
  body *= smoothstep(-H * 0.012, H * 0.008, h + (n - 0.5) * H * 0.02);
  return body * (0.15 + 0.85 * cover);
}

vec4 sky(float X, float Y) {
  vec3 c = skyColor(X, Y);
  vec2 P = vec2(X, Y);

  // Thin high wisps first, behind everything.
  float w = fbm(vec2(X / 650.0, Y / 45.0) + 11.0);
  c = mix(c, vec3(0.97, 0.97, 0.95), smoothstep(0.6, 0.82, w) * 0.22 * (1.0 - smoothstep(H * 0.04, H * 0.24, Y)));

  // Upper clouds.
  float yc = H * (uNarrow > 0.5 ? 0.2 : 0.22);
  if (Y > yc - H * 0.16 && Y < yc + H * 0.06) {
    float hm, yb;
    float d = deckDensity(P, yc, hm, yb);
    float a = smoothstep(0.45, 0.62, d);
    if (a > 0.0) {
      float hm2, yb2;
      float dl = deckDensity(P + TO_SUN * 10.0, yc, hm2, yb2);
      // Lit where the cloud thins toward the sun; cool grey underneath.
      float lit = clamp(0.5 + (d - dl) * 3.2, 0.0, 1.0);
      float up = smoothstep(0.0, hm * 0.9, yb - Y);
      lit = clamp(lit * 0.7 + up * 0.55 - 0.08, 0.0, 1.0);
      vec3 shade = vec3(0.60, 0.64, 0.70);
      vec3 cc = mix(shade, vec3(1.0, 0.98, 0.94), smoothstep(0.0, 1.0, lit));
      // Silver lining on the thin, sun-facing edges.
      cc += SUNC * 0.08 * (1.0 - smoothstep(0.45, 0.56, d)) * smoothstep(0.45, 0.85, lit);
      // A touch of sky colour in the thinnest wisps.
      c = mix(c, cc, a * mix(0.75, 0.97, smoothstep(0.62, 0.9, d)));
    }
  }

  // Cumulus bank.
  float base = H * (uNarrow > 0.5 ? 0.55 : 0.525);
  if (Y > base - H * 0.36 && Y < base + 2.0) {
    float hmax;
    float d = bankDensity(P, base, hmax);
    // A soft underside, not a cut, for when the hills drop away below it.
    float a = smoothstep(0.46, 0.6, d) * (1.0 - smoothstep(base - H * 0.045, base, Y));
    if (a > 0.0 && base - Y > H * 0.06) {
      // Only keep cloud that is joined to the bank below it, so no lone
      // puff floats free in the open sky.
      float hb;
      float below = bankDensity(P + vec2(0.0, H * 0.05), base, hb);
      a *= smoothstep(0.44, 0.56, below);
    }
    if (a > 0.0) {
      float hm2;
      float dl = bankDensity(P + TO_SUN * 12.0, base, hm2);
      float lit = clamp(0.5 + (d - dl) * 3.0, 0.0, 1.0);
      float up = smoothstep(0.0, hmax * 0.8, base - Y);
      lit = clamp(lit * 0.75 + up * 0.5 - 0.05, 0.0, 1.0);
      vec3 cc = mix(vec3(0.68, 0.70, 0.73), vec3(1.0, 0.985, 0.95), lit);
      // Distance: the lower bank sits in the haze.
      cc = mix(cc, HAZE, 0.3 * (1.0 - up));
      c = mix(c, cc, a);
    }
  }
  // Haze thickening toward the horizon.
  c = mix(c, HAZE, smoothstep(H * 0.5, H * 0.62, Y) * 0.35);
  return vec4(c, 1.0);
}

// Distant mountains, softly rounded like old ranges.
float ridge(float X) {
  float m = 0.5 * fbm3(vec2(X / 820.0, 1.3)) + 0.5 * pow(fbm(vec2(X / 340.0, 5.7)), 2.0) * 2.2;
  return H * ((uNarrow > 0.5 ? 0.6 : 0.585) - (uNarrow > 0.5 ? 0.1 : 0.13) * m);
}
// A rolling grassland ridge line, with a ragged grassy top.
float hill(float X, float base, float amp, float sc, float seed) {
  return H * (base + amp * (fbm3(vec2(X / sc, seed)) - 0.5) + amp * 0.3 * (noise(vec2(X / (sc * 0.28), seed + 9.0)) - 0.5));
}

vec4 far(float X, float Y) {
  float rt = ridge(X);
  float aa = 1.2;
  if (Y < rt - aa) return vec4(0.0);
  float alpha = smoothstep(rt - aa, rt + aa, Y);
  float nb = uNarrow > 0.5 ? 0.035 : 0.0;

  // Mountain: faces toward the sun lit, the rest blue-grey, lost in haze.
  vec2 mp = vec2(X / 110.0, (Y - rt) / 40.0);
  float t0 = fbm(mp), t1 = fbm(mp + vec2(0.06, 0.0));
  float face = clamp((t0 - t1) * 10.0, -1.0, 1.0);
  float rim = 1.0 - smoothstep(0.0, H * 0.015, Y - rt);
  vec3 c = mix(vec3(0.50, 0.55, 0.60), vec3(0.70, 0.70, 0.68), 0.5 + 0.5 * face) * (1.0 + 0.08 * rim);
  c = mix(c, HAZE, 0.42 + 0.48 * smoothstep(rt, rt + H * 0.075, Y));

  // Five grassland ridges in front, each nearer one darker, greener and
  // more textured, with soft grassy edges and mist in the valleys.
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float top = hill(X, 0.562 + nb + 0.016 * fi, 0.05 + 0.008 * fi, 520.0 - 40.0 * fi, 2.0 + 4.3 * fi);
    float fringe = 0.9 * noise(vec2(X / (1.6 + 0.5 * fi), fi * 7.0));
    float e = smoothstep(top - 0.8, top + 0.8, Y + fringe * (0.6 + 0.3 * fi));
    if (e <= 0.0) continue;
    float k = fi / 4.0; // 0 far, 1 near
    // Light on the slopes that face the sun.
    float sl = (hill(X + 14.0, 0.562 + nb + 0.016 * fi, 0.05 + 0.008 * fi, 520.0 - 40.0 * fi, 2.0 + 4.3 * fi) - hill(X - 14.0, 0.562 + nb + 0.016 * fi, 0.05 + 0.008 * fi, 520.0 - 40.0 * fi, 2.0 + 4.3 * fi)) / 28.0;
    float lit = clamp(0.5 + sl * 2.5, 0.0, 1.0);
    vec3 shadow = mix(vec3(0.52, 0.58, 0.50), vec3(0.36, 0.45, 0.30), k);
    vec3 sun = mix(vec3(0.70, 0.71, 0.58), vec3(0.62, 0.66, 0.43), k);
    vec3 g = mix(shadow, sun, lit);
    float tex = fbm(vec2(X / (40.0 + 30.0 * k), (Y - top) / (8.0 + 8.0 * k)) + fi * 13.0);
    float trees = smoothstep(0.62, 0.72, fbm3(vec2(X / 26.0, (Y - top) / 9.0) + fi * 5.0)) * (1.0 - smoothstep(0.0, H * 0.03, Y - top));
    g *= 0.86 + 0.28 * tex;
    g = mix(g, g * vec3(0.72, 0.78, 0.72), trees * 0.7);
    // Bright grassy rim, then mist pooling lower in each valley.
    g += SUNC * 0.05 * (1.0 - smoothstep(0.0, 3.0, Y - top));
    float fog = mix(0.62, 0.2, k) + 0.22 * smoothstep(top + H * 0.012, top + H * 0.06, Y);
    g = mix(g, HAZE, clamp(fog, 0.0, 0.85));
    c = mix(c, g, e);
  }
  return vec4(c, alpha);
}

// The near field's large swells, as height over the ground plane.
float swell(vec2 g) {
  return fbm3(vec2(g.x * 0.75, g.y * 0.55) + 3.0) + 0.15 * noise(vec2(g.x * 2.0, g.y * 1.4) + 9.0);
}

vec4 near(float X, float Y) {
  float cr = crest(X);
  // A ragged grassy edge rather than a ruled line: blades and tufts.
  float tuft = pow(noise(vec2(X / 1.3, 0.0)), 3.0) * 2.6 + pow(noise(vec2(X / 6.0, 3.0)), 2.0) * 1.6;
  float edge = cr - tuft;
  float alpha = smoothstep(edge - 0.6, edge + 0.6, Y);
  if (alpha <= 0.0) return vec4(0.0);

  float z = clamp((Y - cr) / (H - cr), 0.0, 1.0); // 0 at the crest, 1 at the bottom
  // Project onto the ground plane so features shrink toward the horizon.
  float y0 = cr - H * 0.12;
  float gz = 1.0 / max(Y - y0, 1.0);
  vec2 g = vec2((X - W * 0.62) * gz, gz * H);

  // Big folds lit from the sun's side: compare the height a step toward
  // the sun (right and away).
  float h0 = swell(g);
  float hx = swell(g + vec2(0.04, 0.0));
  float hy = swell(g + vec2(0.0, 0.05));
  float sun = clamp(0.55 + (hx - h0) * 9.0 + (hy - h0) * 5.0, 0.0, 1.0);
  // Drifting cloud shadows on the land.
  float cs = smoothstep(0.42, 0.6, fbm3(vec2(g.x * 0.5, g.y * 0.35) + 31.0));

  vec3 shade = vec3(0.27, 0.36, 0.22);
  vec3 grass = vec3(0.45, 0.54, 0.31);
  vec3 lit = vec3(0.71, 0.71, 0.45);
  float l = sun * (1.0 - 0.45 * cs);
  vec3 c = mix(shade, grass, smoothstep(0.1, 0.55, l));
  c = mix(c, lit, smoothstep(0.55, 0.95, l));
  float patch = fbm3(vec2(g.x * 1.6, g.y * 1.1) + 7.0);
  c = mix(c, c * vec3(1.08, 1.03, 0.86), smoothstep(0.5, 0.72, patch) * 0.8); // drier straw

  // Grass. Three fixed-scale textures blended by distance, so blades grow
  // toward the viewer without shearing.
  float fine = noise(vec2(X / 0.8, Y / 2.0));
  float mid = noise(vec2(X / 1.8, Y / 7.0) + 40.0) * 0.6 + noise(vec2(X / 3.5, Y / 5.0) + 9.0) * 0.4;
  float big = noise(vec2(X / 3.2, Y / 16.0) + 70.0) * 0.55 + fbm3(vec2(X / 7.0, Y / 22.0) + 61.0) * 0.45;
  float tA = smoothstep(0.2, 0.55, z), tB = smoothstep(0.55, 0.95, z);
  float blade = mix(mix(fine, mid, tA), big, tB);
  float amp = mix(0.12, 0.42, smoothstep(0.1, 1.0, z));
  float clump = fbm3(vec2(X / 30.0, Y / 14.0) + 5.0);
  c *= 1.0 + amp * (blade - 0.5) + 0.14 * (clump - 0.5);

  // Pale seed heads, growing larger toward the bottom.
  float sA = smoothstep(0.8, 0.95, noise(vec2(X / 1.6, Y / 1.9) + 3.0));
  float sB = smoothstep(0.82, 0.96, noise(vec2(X / 2.6, Y / 3.4) + 13.0));
  float seeds = mix(sA, sB, tB) * smoothstep(0.35, 0.8, z) * (0.4 + 0.9 * fbm3(vec2(X / 70.0, Y / 40.0)));
  c = mix(c, vec3(0.90, 0.87, 0.73), clamp(seeds, 0.0, 1.0) * 0.75);

  // Haze toward the crest, warm light on the rim.
  c = mix(c, HAZE * vec3(0.84, 0.88, 0.78), (1.0 - smoothstep(0.0, 0.22, z)) * 0.3);
  c += SUNC * vec3(0.06, 0.05, 0.02) * (1.0 - smoothstep(0.0, 0.02, z)) * (0.6 + 0.4 * X / W);
  // The foreground deepens toward the viewer, a richer, darker green.
  float fg = smoothstep(0.2, 0.95, z);
  c = mix(c, c * vec3(0.6, 0.76, 0.48), fg);
  // Slightly darker bottom corners, as a lens would.
  float vx = (X / W - 0.5) * 2.0;
  c *= 1.0 - 0.12 * smoothstep(0.6, 1.0, z) * vx * vx;
  return vec4(c, alpha);
}

// Colour grade, applied last to every layer: a slightly warm, lush look.
// Greens lean yellow and grow richer; blues lean toward a soft grey-teal.
vec3 grade(vec3 c) {
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  float green = clamp((c.g - max(c.r, c.b)) * 5.0, 0.0, 1.0);
  float blue = clamp((c.b - c.r) * 3.0, 0.0, 1.0) * (1.0 - green);
  c = mix(vec3(l), c, 1.0 + 0.4 * green);       // richer grass
  c += green * vec3(0.04, 0.025, -0.06);        // toward yellow-green
  c = mix(c, vec3(l) * vec3(0.94, 1.02, 1.03) + (c - vec3(l)) * vec3(0.7, 1.05, 0.85), blue * 0.45); // teal, a touch muted
  c *= vec3(1.025, 1.0, 0.965);                 // overall warmth
  // Soft, pastel finish: a little less saturation and lifted shadows, like
  // a faded print, so nothing reads as vivid or deep.
  float l2 = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l2), c, 0.9);
  return c * 0.8 + vec3(0.19, 0.205, 0.2);
}

void main() {
  W = uWrap.x; H = uWrap.y;
  SUN = vec2(W * 0.82, H * 0.12);
  vec2 f = gl_FragCoord.xy / uRes;
  float X = uOff.x + f.x * uSize.x;
  float Y = uOff.y + (1.0 - f.y) * uSize.y;
  vec4 c;
  if (uLayer < 0.5) c = sky(X, Y);
  else if (uLayer < 1.5) c = far(X, Y);
  else c = near(X, Y);
  // Dither, so the long gradients don't band.
  c.rgb = grade(c.rgb);
  c.rgb += (hash(gl_FragCoord.xy + uLayer * 17.0) - 0.5) / 255.0;
  gl_FragColor = c;
}`;

  let gl = null, prog = null;
  const U = {};
  const glCv = document.createElement("canvas");
  function initGL() {
    try {
      gl = glCv.getContext("webgl", { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false });
    } catch (e) { gl = null; }
    if (!gl) return false;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) {
      console.warn("Landscape shader failed; using the plain fallback.", e);
      gl = null; return false;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const n of ["uRes", "uSize", "uOff", "uWrap", "uCrest", "uLayer", "uNarrow"]) U[n] = gl.getUniformLocation(prog, n);
    return true;
  }

  // Paint one layer into its canvas. The backing store follows the device
  // pixel ratio, capped, since the film grain hides anything finer.
  function paint(cv, layer, offX, offY, cssW, cssH) {
    const dpr = Math.min(1.6, devicePixelRatio || 1);
    const pw = Math.max(1, Math.round(cssW * dpr)), ph = Math.max(1, Math.round(cssH * dpr));
    cv.width = pw; cv.height = ph;
    cv.style.width = `${cssW}px`; cv.style.height = `${cssH}px`;
    const ctx = cv.getContext("2d");
    if (gl) {
      glCv.width = pw; glCv.height = ph;
      gl.viewport(0, 0, pw, ph);
      gl.uniform2f(U.uRes, pw, ph);
      gl.uniform2f(U.uSize, cssW, cssH);
      gl.uniform2f(U.uOff, offX, offY);
      gl.uniform2f(U.uWrap, W, H);
      gl.uniform3f(U.uCrest, CA, CB, CS);
      gl.uniform1f(U.uLayer, layer);
      gl.uniform1f(U.uNarrow, narrow ? 1 : 0);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      ctx.clearRect(0, 0, pw, ph);
      ctx.drawImage(glCv, 0, 0);
      return;
    }
    // Without WebGL: plain gradients in the same colours.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    if (layer === 0) {
      const g = ctx.createLinearGradient(0, 0, 0, cssH);
      g.addColorStop(0, "#8DB1C8"); g.addColorStop(0.55, "#BCCED5"); g.addColorStop(0.85, "#E7E5DC"); g.addColorStop(1, "#E7E5DC");
      ctx.fillStyle = g; ctx.fillRect(0, 0, cssW, cssH);
    } else if (layer === 1) {
      ctx.fillStyle = "#C9CEC0";
      ctx.fillRect(0, H * 0.56 - offY, cssW, cssH);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, cssH);
      g.addColorStop(0, "#9DAA7C"); g.addColorStop(1, "#56703F");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(0, cssH);
      for (let x = 0; x <= cssW + 6; x += 6) ctx.lineTo(x, crest(Math.min(x, cssW)) - offY);
      ctx.lineTo(cssW, cssH); ctx.closePath(); ctx.fill();
    }
  }

  function drawScene() {
    // Full height: when the land falls away on the way to the globe, the
    // sky behind the hills is uncovered and must already be painted.
    paint(skyCv, 0, 0, 0, Math.round(W * (1 + SKY_EXTRA)), H);
    skyCv.style.setProperty("--drift-span", `${Math.round(-W * SKY_EXTRA)}px`);
    // The far layer only needs the band from the mountain tops down.
    const farTop = Math.floor(H * 0.36);
    paint(farCv, 1, 0, farTop, W, H - farTop);
    farCv.style.top = `${farTop}px`;
    const nearTop = Math.floor(Math.min(crest(0), crest(W), crest(W * 0.5)) - H * 0.03);
    paint(nearCv, 2, 0, nearTop, W, H - nearTop);
    nearCv.style.top = `${nearTop}px`;
  }

  // ---------- Words standing on the crest ----------
  const state = [...wordsEl.querySelectorAll(".word")].map((el) => {
    const shadow = document.createElement("span");
    shadow.className = "word-shadow";
    shadowsEl.appendChild(shadow);
    return {
      el, shadow,
      lift: el.querySelector(".word-lift"),
      tilt: el.querySelector(".word-tilt"),
      ink: el.querySelector(".word-ink"),
      bl: el.querySelector(".bl"),
      F: 16, y: 0, v: 0, hover: false, focus: false, press: false, t0: 0, introAt: 0, hopUntil: 0,
    };
  });

  // The words sit together in the right third of the horizon, like a
  // fence line in the distance, not centred.
  function layoutWords() {
    if (!state.length) return;
    const F = parseFloat(getComputedStyle(state[0].el).fontSize);
    const widths = state.map((s) => s.ink.offsetWidth);
    const gap = F * (narrow ? 1.25 : 1.6);
    const total = widths.reduce((a, b) => a + b, 0) + gap * (state.length - 1);
    const edge = 28 + Math.max(20, W * 0.05);
    const right = narrow ? W - edge : W * 0.865;
    let x = Math.max(edge, right - total);
    const sink = -F * 0.02;
    state.forEach((s, i) => {
      const w = widths[i];
      const xl = x, xr = x + w, xc = x + w / 2;
      const yl = crest(xl), yr = crest(xr);
      // Baseline on the line between the crest under each end, raised over
      // any swell in between, so only descenders reach the grass.
      let lift0 = 0;
      for (let j = 1; j < 16; j++) {
        const xx = xl + (w * j) / 16;
        lift0 = Math.min(lift0, crest(xx) - (yl + ((yr - yl) * j) / 16));
      }
      const yc = (yl + yr) / 2 + lift0;
      const tilt = clamp(Math.atan2(yr - yl, w) * (180 / Math.PI), -6, 6);
      const pad = Math.max(10, F * 0.5);
      const top = yc - F * 1.7;
      const boxW = w + pad * 2, boxH = F * 2.3;
      const bl = s.bl.offsetTop;
      s.F = F;
      Object.assign(s.el.style, { left: `${xl - pad}px`, top: `${top}px`, width: `${boxW}px`, height: `${boxH}px` });
      Object.assign(s.lift.style, { left: `${pad}px`, top: `${yc + sink - top - bl}px` });
      s.tilt.style.transformOrigin = `50% ${bl}px`;
      s.tilt.style.transform = `rotate(${tilt.toFixed(2)}deg)`;
      // Cut the word off along the crest, so it stands on the field's edge.
      const pts = ["0 0", `${n1(boxW)}px 0`];
      const N = Math.max(10, Math.ceil(boxW / 5));
      for (let j = N; j >= 0; j--) {
        const px = (j / N) * boxW;
        pts.push(`${n1(px)}px ${n1(crest(xl - pad + px) - top + 1)}px`);
      }
      s.el.style.clipPath = `polygon(${pts.join(",")})`;
      Object.assign(s.shadow.style, {
        left: `${xc - w * 0.45}px`, top: `${yc - F * 0.08}px`, width: `${w * 0.9}px`, height: `${F * 0.3}px`,
      });
      x += w + gap;
    });
    wordsEl.classList.add("is-placed");
    paintWords(performance.now());
  }

  // Spring motion: hovering lifts a word with a little overshoot, then it
  // bobs while the pointer stays; letting go drops it back with a bounce.
  const K = 170, C = 11;
  let springRaf = null, last = 0;
  function target(s, now) {
    const L = s.F * 0.5;
    if (now < s.introAt) return s.F * 1.1;
    if (now < s.hopUntil) return -L * 1.4;
    if (s.press) return -L * 0.7;
    if (s.hover || s.focus) {
      const t = now - s.t0;
      return -L + (reduce ? 0 : Math.sin((t / 2600) * Math.PI * 2) * s.F * 0.06 * Math.min(1, t / 700));
    }
    return 0;
  }
  function paintWords(now) {
    for (const s of state) {
      if (reduce) s.y = target(s, now);
      s.lift.style.transform = `translate3d(0, ${s.y.toFixed(2)}px, 0)`;
      const L = s.F * 0.5;
      const k = clamp(-s.y / L, 0, 1);
      const under = clamp(s.y / (s.F * 0.25), 0, 1);
      s.shadow.style.transform = `scale(${(1 - 0.34 * k).toFixed(3)}, ${(1 - 0.2 * k).toFixed(3)})`;
      s.shadow.style.opacity = ((1 - 0.55 * k) * (1 - under)).toFixed(3);
    }
  }
  function step(now) {
    const dt = Math.max(0, Math.min(0.034, (now - last) / 1000));
    last = now;
    let busy = false;
    for (const s of state) {
      const T = target(s, now);
      for (let i = 0; i < 3; i++) {
        const h = dt / 3;
        s.v += (K * (T - s.y) - C * s.v) * h;
        s.y += s.v * h;
      }
      if (s.hover || s.focus || now < s.introAt || now < s.hopUntil || Math.abs(T - s.y) > 0.1 || Math.abs(s.v) > 0.3) busy = true;
    }
    paintWords(now);
    springRaf = busy ? requestAnimationFrame(step) : null;
  }
  function kick() {
    if (reduce) { paintWords(performance.now()); return; }
    if (springRaf === null) { last = performance.now(); springRaf = requestAnimationFrame(step); }
  }

  for (const s of state) {
    s.el.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "touch") return;
      s.hover = true; s.t0 = performance.now(); kick();
    });
    s.el.addEventListener("pointerleave", () => { s.hover = false; s.press = false; kick(); });
    s.el.addEventListener("pointerdown", () => { s.press = true; kick(); });
    s.el.addEventListener("pointerup", () => { s.press = false; kick(); });
    s.el.addEventListener("pointercancel", () => { s.press = false; kick(); });
    s.el.addEventListener("focus", () => {
      if (!s.el.matches(":focus-visible")) return;
      s.focus = true; s.t0 = performance.now(); kick();
    });
    s.el.addEventListener("blur", () => { s.focus = false; kick(); });
    // A little hop before leaving, so the click lands as a jump. The way
    // to the globe also rises off the hill (see rise() below).
    const toGlobe = /(^|\/)photos\.html$/.test(new URL(s.el.href).pathname);
    s.el.addEventListener("click", (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (reduce && !toGlobe) return;
      e.preventDefault();
      s.press = false;
      if (!reduce) { s.hopUntil = performance.now() + 170; kick(); }
      if (toGlobe) rise(s.el.href);
      else setTimeout(() => { location.href = s.el.href; }, 240);
    });
  }

  // ---------- Leaving for the globe: rise off the hill ----------
  // The camera lifts: the land drops away beneath, nearest fastest, the
  // view fills with the globe page's pale mist, and the globe page then
  // shows the Earth falling away below (photos.html reads the flag).
  const scene = document.getElementById("scene");
  const veil = document.createElement("div");
  veil.className = "veil";
  veil.setAttribute("aria-hidden", "true");
  scene.appendChild(veil);
  let leaving = false;
  function rise(href) {
    if (leaving) return;
    leaving = true;
    try { sessionStorage.setItem("arrive", "rise"); } catch (e) {}
    // Let the hop register, then go up.
    setTimeout(() => root.classList.add("is-rising"), reduce ? 0 : 60);
    setTimeout(() => { location.href = href; }, reduce ? 320 : 900);
  }
  // Coming back with the browser's back button restores this page as it
  // was left; put the hill back.
  addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    leaving = false;
    root.classList.remove("is-rising");
  });

  // ---------- Pointer parallax: the near field moves most ----------
  const DEPTH = new Map(pxLayers.map((el) => [el, parseFloat(el.dataset.depth || "0")]));
  const par = { x: 0, y: 0, tx: 0, ty: 0 };
  let parRaf = null;
  function parStep() {
    par.x += (par.tx - par.x) * 0.06;
    par.y += (par.ty - par.y) * 0.06;
    for (const [el, d] of DEPTH) el.style.transform = `translate3d(${n1(-par.x * d * 14)}px, ${n1(-par.y * d * 7)}px, 0)`;
    parRaf = Math.abs(par.tx - par.x) > 0.001 || Math.abs(par.ty - par.y) > 0.001 ? requestAnimationFrame(parStep) : null;
  }
  if (finePointer && !reduce) {
    addEventListener("pointermove", (e) => {
      par.tx = (e.clientX / innerWidth - 0.5) * 2;
      par.ty = (e.clientY / innerHeight - 0.5) * 2;
      if (parRaf === null) parRaf = requestAnimationFrame(parStep);
    }, { passive: true });
  }

  // ---------- Draw, and redraw on resize ----------
  function measure() {
    W = wrap.clientWidth;
    H = wrap.clientHeight;
    narrow = W < 700 || H > W * 1.15;
    if (narrow) { CA = 0.71; CB = 0.615; CS = 0.3; } else { CA = 0.69; CB = 0.555; CS = 0.6; }
  }
  function draw() {
    measure();
    drawScene();
    layoutWords();
  }
  let resizeRaf = null, lastW = 0, lastH = 0;
  addEventListener("resize", () => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = null;
      // Mobile toolbars nudge the height while scrolling; ignore tiny changes.
      if (Math.abs(innerWidth - lastW) < 1 && Math.abs(innerHeight - lastH) < 60) return;
      lastW = innerWidth; lastH = innerHeight;
      draw();
    });
  });

  function start() {
    lastW = innerWidth; lastH = innerHeight;
    initGL();
    draw();
    const now = performance.now();
    if (!reduce) state.forEach((s, i) => { s.introAt = now + 800 + i * 140; s.y = s.F * 1.1; });
    paintWords(now);
    requestAnimationFrame(() => {
      root.classList.add("is-ready");
      kick();
    });
  }
  // Measure the words only once the display face has loaded.
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1500))]).then(start);
  fontsReady.then(() => { if (W) layoutWords(); });
})();
