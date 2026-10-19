/* hedgy-paint: the ONE copy of the painting toolkit.
 *
 * Extracted 2026-09-23 after the brush/bucket/pick/face code existed
 * three times (Paint page texture, Paint page mask, environment
 * assemble view) — Hector: "make the shared module, it's already out
 * of hand." Same treatment as hedgy-viewer.js: UMD-ish global, no DOM
 * ownership — pages keep their own state, wiring and undo stacks and
 * call in here for the actual painting.
 *
 * Two halves:
 *   TEXTURE  — canvas-backed live textures (CanvasTexture, glTF
 *              flipY=false): stamp/stroke, faceFill, bucket, pick.
 *   MASK     — per-vertex COLOR_0 painting: ensureColorAttr, radius
 *              stamps, channel fills, (de)serialisation.
 * Plus the shared swatch store and the dominant-colour extractor.
 */
(function (global) {
  "use strict";
  const THREE = global.THREE;

  const HP = {};

  // ---------------- texture half ----------------

  /** A live paint canvas over a material's map (or a blank fallback).
   *  Returns {can, ctx, tex}; the caller assigns tex to materials. */
  HP.canvasFromMap = function (srcMap, fallbackW, fallbackH, fallbackFill) {
    const w = srcMap ? (srcMap.image.naturalWidth || srcMap.image.width) : (fallbackW || 1024);
    const h = srcMap ? (srcMap.image.naturalHeight || srcMap.image.height) : (fallbackH || 1024);
    // BASE holds the real texture (what saves/downloads); VIEW is what
    // materials sample -- base plus the selection overlay, so a face
    // selection is visible without ever polluting the saved pixels.
    const can = document.createElement("canvas");
    can.width = w; can.height = h;
    const ctx = can.getContext("2d", {willReadFrequently: true});
    if (srcMap) ctx.drawImage(srcMap.image, 0, 0, w, h);
    else { ctx.fillStyle = fallbackFill || "#bfb8ab"; ctx.fillRect(0, 0, w, h); }
    const view = document.createElement("canvas");
    view.width = w; view.height = h;
    view.getContext("2d").drawImage(can, 0, 0);
    const tex = new THREE.CanvasTexture(view);
    tex.flipY = false;                          // glTF convention
    tex.encoding = srcMap ? srcMap.encoding : THREE.sRGBEncoding;
    if (srcMap) { tex.wrapS = srcMap.wrapS; tex.wrapT = srcMap.wrapT; }
    return {can, ctx, view, tex, stencil: null};
  };

  /** Recompose view = base (+ selection overlay) and flag the texture.
   *  EVERY paint op ends here -- and so must any PAGE code that writes to
   *  pc.can directly (undo, draft restore): the texture samples pc.view,
   *  so tex.needsUpdate alone shows nothing (2026-09-24, dead undo). */
  HP.refresh = function (pc) {
    const v = pc.view.getContext("2d");
    v.globalAlpha = 1;
    v.globalCompositeOperation = "source-over";
    v.clearRect(0, 0, pc.view.width, pc.view.height);
    v.drawImage(pc.can, 0, 0);
    if (pc.stencil && pc.stencilVisible) {
      // Show the selection by DIMMING everything OUTSIDE it -- reads as
      // "paint only lands in the bright region" far more clearly than a
      // faint tint inside did (Hector, 2026-09-24: brush looked dead
      // because a stray selection silently gated it, invisibly).
      if (!pc._tint) {
        pc._tint = document.createElement("canvas");
        pc._tint.width = pc.view.width; pc._tint.height = pc.view.height;
      }
      const t = pc._tint.getContext("2d");
      // CLEAR first: the tint canvas is cached, and without this every
      // refresh stacked another 0.45 layer -- a few strokes in, the
      // veil was near-opaque and hid the texture (Hector: "how can I
      // see the texture again?"; caught in the 2026-09-24 harness)
      t.globalCompositeOperation = "source-over";
      t.clearRect(0, 0, pc._tint.width, pc._tint.height);
      t.fillStyle = "rgba(10,6,26,0.45)";        // veil: dim, not black
      t.fillRect(0, 0, pc._tint.width, pc._tint.height);
      t.globalCompositeOperation = "destination-out";
      t.drawImage(pc.stencil, 0, 0);             // punch the selection clear
      t.globalCompositeOperation = "source-over";
      v.drawImage(pc._tint, 0, 0);               // veil the unselected area
    }
    if (pc.onion) {                              // flipbook onion skin: on the VIEW only, never in the saved texels
      v.globalAlpha = pc.onionAlpha == null ? 0.5 : pc.onionAlpha;
      v.drawImage(pc.onion, 0, 0);
      v.globalAlpha = 1;
    }
    if (pc.tex) pc.tex.needsUpdate = true;
  };

  // ---------------- flipbook onion skin (animation page slice 2, 2026-09-25) ----------------
  /** A layer showing where the previous frame (blue) and the next frame
   *  (red) DIFFER from the current one: those texels carry the neighbour's
   *  own colour mixed with the tint; everything shared stays clear, so a
   *  flipbook whose frames share most of the atlas shows just the motion.
   *  `out` is reused when given. Returns the canvas (null when no neighbour). */
  HP.onionLayer = function (cur, prev, next, out) {
    if (!prev && !next) return null;
    const W = cur.width, H = cur.height;
    if (!out || out.width !== W || out.height !== H) { out = document.createElement("canvas"); out.width = W; out.height = H; }
    const oc = out.getContext("2d"), img = oc.createImageData(W, H), d = img.data;
    const C = cur.getContext("2d").getImageData(0, 0, W, H).data;
    const P = prev ? prev.getContext("2d").getImageData(0, 0, W, H).data : null;
    const N = next ? next.getContext("2d").getImageData(0, 0, W, H).data : null;
    const TOL = 24;
    for (let i = 0; i < d.length; i += 4) {
      if (P && Math.abs(P[i] - C[i]) + Math.abs(P[i + 1] - C[i + 1]) + Math.abs(P[i + 2] - C[i + 2]) > TOL) {
        d[i] = P[i] * 0.4 + 80 * 0.6; d[i + 1] = P[i + 1] * 0.4 + 160 * 0.6; d[i + 2] = P[i + 2] * 0.4 + 255 * 0.6; d[i + 3] = 255;
      } else if (N && Math.abs(N[i] - C[i]) + Math.abs(N[i + 1] - C[i + 1]) + Math.abs(N[i + 2] - C[i + 2]) > TOL) {
        d[i] = N[i] * 0.4 + 255 * 0.6; d[i + 1] = N[i + 1] * 0.4 + 90 * 0.6; d[i + 2] = N[i + 2] * 0.4 + 90 * 0.6; d[i + 3] = 255;
      }
    }
    oc.putImageData(img, 0, 0);
    return out;
  };

  // ---- section selection (a stencil of faces) -------------------------
  HP.ensureStencil = function (pc) {
    if (!pc.stencil) {
      pc.stencil = document.createElement("canvas");
      pc.stencil.width = pc.can.width; pc.stencil.height = pc.can.height;
    }
    pc.stencilVisible = true;
    return pc.stencil;
  };
  /** Add (or with remove=true, subtract) the tapped triangle. */
  HP.stencilFace = function (pc, hit, remove) {
    HP.ensureStencil(pc);
    const g = hit.object.geometry, uva = g.attributes.uv, f = hit.face;
    if (!uva || !f) return;
    const c = pc.stencil.getContext("2d");
    const P = [f.a, f.b, f.c].map(i => [uva.getX(i) * pc.stencil.width, uva.getY(i) * pc.stencil.height]);
    c.globalCompositeOperation = remove ? "destination-out" : "source-over";
    c.fillStyle = c.strokeStyle = "#fff";
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(P[0][0], P[0][1]);
    c.lineTo(P[1][0], P[1][1]); c.lineTo(P[2][0], P[2][1]);
    c.closePath(); c.fill(); c.stroke();
    c.globalCompositeOperation = "source-over";
    HP.refresh(pc);
  };
  /** PROTECT EDGES: make the selection "everything except a band along the
   *  piece's joins", so repainting a variant cannot touch the edges it
   *  shares with its neighbours (Hector, 2026-09-24). Joins are the
   *  extremes of the piece along `opts.axes` (walls ["x"], floors
   *  ["x","z"]) measured in a frame given by `opts.frame` (a Matrix4 world
   *  -> piece-aligned metres; identity = world). Band = `opts.band` in
   *  frame units, or `opts.bandFrac` of the extent on each axis.
   *  Triangles that straddle the band are CUT at it (polygon clipping,
   *  UVs interpolated), so the protected strip is exactly the band.
   *  Replaces any current selection. Returns the selected triangle count. */
  HP.protectEdges = function (pc, root, opts) {
    const o = opts || {}, axes = (o.axes || ["x"]).map(a => "xyz".indexOf(a));
    const W = pc.can.width, H = pc.can.height;
    const frame = o.frame || new THREE.Matrix4();
    root.updateMatrixWorld(true);
    const tris = [];
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    const v = new THREE.Vector3();
    root.traverse(n => {
      if (!n.isMesh || !n.geometry.attributes.uv) return;
      const g = n.geometry, pos = g.attributes.position, uv = g.attributes.uv, ix = g.index;
      const M = frame.clone().multiply(n.matrixWorld);
      const cnt = ix ? ix.count : pos.count;
      for (let i = 0; i < cnt; i += 3) {
        const t = [];
        for (let k = 0; k < 3; k++) {
          const j = ix ? ix.getX(i + k) : i + k;
          v.fromBufferAttribute(pos, j).applyMatrix4(M);
          const P = [v.x, v.y, v.z];
          for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], P[a]); hi[a] = Math.max(hi[a], P[a]); }
          t.push({P, u: uv.getX(j) * W, w: uv.getY(j) * H});
        }
        tris.push(t);
      }
    });
    // clip a polygon to lo <= P[a] <= hi, interpolating position and UV
    const clip = (poly, a, min, max) => {
      for (const [bound, keepAbove] of [[min, true], [max, false]]) {
        const out = [];
        for (let i = 0; i < poly.length; i++) {
          const A = poly[i], B = poly[(i + 1) % poly.length];
          const ina = keepAbove ? A.P[a] >= bound : A.P[a] <= bound;
          const inb = keepAbove ? B.P[a] >= bound : B.P[a] <= bound;
          if (ina) out.push(A);
          if (ina !== inb) {
            const f = (bound - A.P[a]) / (B.P[a] - A.P[a]);
            out.push({P: A.P.map((x, k) => x + (B.P[k] - x) * f),
                      u: A.u + (B.u - A.u) * f, w: A.w + (B.w - A.w) * f, cut: true});
          }
        }
        poly = out;
        if (poly.length < 3) return poly;
      }
      return poly;
    };
    HP.ensureStencil(pc);
    const c = pc.stencil.getContext("2d");
    c.globalCompositeOperation = "source-over";
    c.clearRect(0, 0, pc.stencil.width, pc.stencil.height);
    c.fillStyle = c.strokeStyle = "#fff";
    // wide enough to cover the atlas padding between UV islands: with 2 px
    // the selection veil peeked through at island borders as faint zigzags
    c.lineWidth = 4;
    c.lineCap = "butt";
    let n = 0;
    for (const t of tris) {
      let poly = t;
      for (const a of axes) {
        const band = o.band != null ? o.band : (hi[a] - lo[a]) * (o.bandFrac || 0.05);
        poly = clip(poly, a, lo[a] + band, hi[a] - band);
        if (poly.length < 3) break;
      }
      if (poly.length < 3) continue;
      c.beginPath();
      poly.forEach((q, i) => (i ? c.lineTo(q.u, q.w) : c.moveTo(q.u, q.w)));
      c.closePath(); c.fill();
      // stroke only the edges shared with neighbours (closes AA hairlines
      // between triangles), never the cut at the band -- the band stays exact
      c.beginPath();
      for (let i = 0; i < poly.length; i++) {
        const A = poly[i], B = poly[(i + 1) % poly.length];
        if (A.cut && B.cut) continue;
        c.moveTo(A.u, A.w); c.lineTo(B.u, B.w);
      }
      c.stroke();
      n++;
    }
    pc.stencilVisible = true;
    HP.refresh(pc);
    return n;
  };

  HP.stencilClear = function (pc) {
    pc.stencil = null; pc.stencilVisible = false;
    HP.refresh(pc);
  };
  HP.hasStencil = function (pc) { return !!pc.stencil; };
  /** Hide/show the selection shading WITHOUT dropping the selection. */
  HP.setStencilVisible = function (pc, v) {
    pc.stencilVisible = !!v && !!pc.stencil;
    HP.refresh(pc);
  };
  /** The stencil tinted cyan, for drawing the selection over a flat
   *  atlas view (the 3D view shows it as the veil instead). */
  HP.stencilTint = function (pc) {
    if (!pc.stencil) return null;
    if (!pc._flatTint) {
      pc._flatTint = document.createElement("canvas");
      pc._flatTint.width = pc.stencil.width; pc._flatTint.height = pc.stencil.height;
    }
    const t = pc._flatTint.getContext("2d");
    t.globalCompositeOperation = "source-over";
    t.clearRect(0, 0, pc._flatTint.width, pc._flatTint.height);
    t.drawImage(pc.stencil, 0, 0);
    t.globalCompositeOperation = "source-in";
    t.fillStyle = "#5ce1e6";
    t.fillRect(0, 0, pc._flatTint.width, pc._flatTint.height);
    t.globalCompositeOperation = "source-over";
    return pc._flatTint;
  };
  /** Count selected texels (0 means an empty stencil that would eat all
   *  paint -- treated as "no selection" by callers). */
  HP.stencilCount = function (pc) {
    if (!pc.stencil) return 0;
    const d = pc.stencil.getContext("2d").getImageData(
      0, 0, pc.stencil.width, pc.stencil.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
    return n;
  };
  HP._stencilData = function (pc) {
    return pc.stencil
      ? pc.stencil.getContext("2d").getImageData(0, 0, pc.stencil.width, pc.stencil.height).data
      : null;
  };

  /** Upload/replace: draw an image over the whole base (scaled to fit).
   *  Round-trips the download button; the atlas layout must match. */
  HP.replaceBase = function (pc, image) {
    pc.ctx.drawImage(image, 0, 0, pc.can.width, pc.can.height);
    HP.dilateAll(pc);                                  // includes refresh
  };

  /** Triplanar bake: tile ANY image across a mesh in world metres and
   *  rasterise it INTO the existing atlas -- the projection pass that
   *  makes custom UVs irrelevant for "drop a brick photo on the wall"
   *  (Hector, 2026-09-24). Per triangle: dominant normal axis picks the
   *  projection plane, an affine maps that plane (in metres / tileM,
   *  scaled to image pixels) onto the triangle's UV footprint, and the
   *  triangle is clip-filled with a repeating pattern under that
   *  transform. Honours the stencil: with a selection, only selected
   *  texels change. root must be in-tree (world transforms). */
  HP.triplanarBake = function (pc, root, image, tileM) {
    const W = pc.can.width, H = pc.can.height;
    const px = image.width / (tileM || 1);      // image px per world metre
    // bake to a temp so the stencil can gate the composite
    const tmp = document.createElement("canvas");
    tmp.width = W; tmp.height = H;
    const t = tmp.getContext("2d");
    t.drawImage(pc.can, 0, 0);                  // keep base where faces miss
    const pat = t.createPattern(image, "repeat");
    const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
    const nrm = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    root.updateMatrixWorld(true);
    root.traverse(n => {
      if (!n.isMesh || !n.geometry.attributes.uv) return;
      const g = n.geometry, pos = g.attributes.position, uv = g.attributes.uv;
      const ix = g.index;
      const tris = ix ? ix.count : pos.count;
      for (let i = 0; i < tris; i += 3) {
        const a = ix ? ix.getX(i) : i, b = ix ? ix.getX(i + 1) : i + 1,
              c = ix ? ix.getX(i + 2) : i + 2;
        vA.fromBufferAttribute(pos, a); n.localToWorld(vA);
        vB.fromBufferAttribute(pos, b); n.localToWorld(vB);
        vC.fromBufferAttribute(pos, c); n.localToWorld(vC);
        e1.subVectors(vB, vA); e2.subVectors(vC, vA);
        nrm.crossVectors(e1, e2);
        const ax = Math.abs(nrm.x), ay = Math.abs(nrm.y), az = Math.abs(nrm.z);
        // world-plane coords (metres) per vertex by dominant axis
        let w0, w1, w2;
        if (ay >= ax && ay >= az) {           // top/bottom: use x,z
          w0 = [vA.x, vA.z]; w1 = [vB.x, vB.z]; w2 = [vC.x, vC.z];
        } else if (ax >= az) {                // x-facing wall: use z,y
          w0 = [vA.z, -vA.y]; w1 = [vB.z, -vB.y]; w2 = [vC.z, -vC.y];
        } else {                              // z-facing wall: use x,y
          w0 = [vA.x, -vA.y]; w1 = [vB.x, -vB.y]; w2 = [vC.x, -vC.y];
        }
        // to image pixels
        for (const w of [w0, w1, w2]) { w[0] *= px; w[1] *= px; }
        const u0 = [uv.getX(a) * W, uv.getY(a) * H];
        const u1 = [uv.getX(b) * W, uv.getY(b) * H];
        const u2 = [uv.getX(c) * W, uv.getY(c) * H];
        // affine M: worldpx -> uvpx  (solve from the three pairs)
        const d = (w1[0] - w0[0]) * (w2[1] - w0[1]) - (w2[0] - w0[0]) * (w1[1] - w0[1]);
        if (Math.abs(d) < 1e-9) continue;      // degenerate in this plane
        const m11 = ((u1[0] - u0[0]) * (w2[1] - w0[1]) - (u2[0] - u0[0]) * (w1[1] - w0[1])) / d;
        const m12 = ((u2[0] - u0[0]) * (w1[0] - w0[0]) - (u1[0] - u0[0]) * (w2[0] - w0[0])) / d;
        const m21 = ((u1[1] - u0[1]) * (w2[1] - w0[1]) - (u2[1] - u0[1]) * (w1[1] - w0[1])) / d;
        const m22 = ((u2[1] - u0[1]) * (w1[0] - w0[0]) - (u1[1] - u0[1]) * (w2[0] - w0[0])) / d;
        const dx = u0[0] - m11 * w0[0] - m12 * w0[1];
        const dy = u0[1] - m21 * w0[0] - m22 * w0[1];
        t.save();
        t.setTransform(m11, m21, m12, m22, dx, dy);
        t.beginPath();
        t.moveTo(w0[0], w0[1]); t.lineTo(w1[0], w1[1]); t.lineTo(w2[0], w2[1]);
        t.closePath();
        t.fillStyle = pat;
        t.fill();
        // hairline overdraw to close raster seams between triangles
        t.lineWidth = 1 / Math.max(Math.hypot(m11, m21), 1e-6);
        t.strokeStyle = pat;
        t.stroke();
        t.restore();
      }
    });
    // composite: everywhere (no stencil) or only selected texels
    if (pc.stencil) {
      const m = tmp.getContext("2d");
      m.globalCompositeOperation = "destination-in";
      m.drawImage(pc.stencil, 0, 0);
      m.globalCompositeOperation = "source-over";
      pc.ctx.drawImage(tmp, 0, 0);
    } else {
      pc.ctx.clearRect(0, 0, W, H);
      pc.ctx.drawImage(tmp, 0, 0);
    }
    HP.refresh(pc);
  };

  /** Atlas-space smooth (the Paint page's FLAT atlas panel). The first
   *  version box-blurred with a 1-4 px kernel -- sub-pixel on screen for
   *  a 2048 atlas, so it looked like nothing (Hector, 2026-09-24). Now:
   *  blur radius = opts.blur (0..1) of the brush radius, floor 25%, via
   *  the canvas blur filter; blended back with a radial falloff at
   *  opts.alpha strength; honours the selection. On the 3D model use
   *  surfaceSmooth, which blends ACROSS UV islands. */
  HP.smoothStamp = function (pc, u, v, opts) {
    const W = pc.can.width, H = pc.can.height;
    const r = Math.max(2, opts.size / 2);
    // blur std-dev: its 3-sigma reach stays INSIDE the ring (blur 100% =
    // the ring's edge). It was blur x the RADIUS -- reaching ~2.7 rings
    // out, so smoothing inside light paint pulled in the dark wall around
    // it and each pass drew a dark band: the cross (2026-09-25)
    const b = Math.max(1, Math.round(r * Math.max(0.25, opts.blur || 0) / 3));
    const pad = Math.ceil(r + b * 3 + 2);
    const cx = u * W, cy = v * H;
    const x0 = Math.max(0, Math.floor(cx - pad)), y0 = Math.max(0, Math.floor(cy - pad));
    const x1 = Math.min(W, Math.ceil(cx + pad)), y1 = Math.min(H, Math.ceil(cy + pad));
    const w = x1 - x0, h = y1 - y0;
    if (w < 3 || h < 3) return;
    const soft = HP._blurred(pc.can, x0, y0, w, h, b);
    const wts = HP._weightPatch(w, h, cx - x0, cy - y0, r, opts.alpha == null ? 1 : opts.alpha);
    HP._ditherBlend(pc, x0, y0, w, h,
      soft.getContext("2d").getImageData(0, 0, w, h).data,
      wts.getContext("2d").getImageData(0, 0, w, h).data);
    HP.refresh(pc);
  };

  /** Brush weights as a canvas: R = strength (0..255), full `k` out to
   *  40% of r, then a smoothstep to 0 at r -- no kink (the old
   *  hold-then-linear falloff's kink showed up as a ridge), outside r 0. */
  HP._weightPatch = function (w, h, cx, cy, r, k, core) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const x = c.getContext("2d");
    x.fillStyle = "#000"; x.fillRect(0, 0, w, h);
    const kk = Math.max(0, Math.min(1, k));
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    const red = v => "rgb(" + Math.round(v * 255) + ",0,0)";
    g.addColorStop(0, red(kk));
    const c0 = core == null ? 0.4 : Math.max(0, Math.min(1, core));
    for (let i = 0; i <= 10; i++) {
      const t = i / 10, sm = 1 - t * t * (3 - 2 * t);
      g.addColorStop(c0 + (1 - c0) * t, red(kk * sm));
    }
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    return c;
  };

  /** Blend the base toward `td` (target RGBA) by weights `md` (R channel)
   *  over rect (x0,y0,w,h), in FLOAT with DITHERED rounding, honouring the
   *  selection. Canvas compositing rounds every partial-alpha blend to a
   *  whole level: once two colours are a few levels apart, (target -
   *  current) * alpha < 0.5 rounds to no change, and the same rounding
   *  all along a stroke builds a faint stripe. Measured 2026-09-24 on the
   *  env wall: a 6 px line 8 levels off stuck at 3 levels, lumpy, after 5
   *  passes -- Hector's "two very similar colours in a line" that smooth
   *  could not finish. Dithering makes sub-level changes land on average. */
  HP._ditherBlend = function (pc, x0, y0, w, h, td, md) {
    const cur = pc.ctx.getImageData(x0, y0, w, h), cd = cur.data;
    const sd = pc.stencil
      ? pc.stencil.getContext("2d").getImageData(x0, y0, w, h).data : null;
    let any = false;
    for (let i = 0; i < cd.length; i += 4) {
      let k = (md[i] / 255) * (md[i + 3] / 255) * (td[i + 3] / 255);
      if (sd) k *= sd[i + 3] / 255;
      if (k <= 0) continue;
      any = true;
      for (let c = 0; c < 3; c++) {
        const v = cd[i + c] + (td[i + c] - cd[i + c]) * k;
        cd[i + c] = Math.min(255, Math.max(0, Math.floor(v + Math.random())));
      }
    }
    if (any) pc.ctx.putImageData(cur, x0, y0);
  };

  /** A named full-atlas scratch canvas + CPU-side context (read back
   *  every dab, so willReadFrequently). */
  HP._scratchCtx = function (pc, name) {
    let e = pc[name];
    if (!e || e.can.width !== pc.can.width || e.can.height !== pc.can.height) {
      const can = document.createElement("canvas");
      can.width = pc.can.width; can.height = pc.can.height;
      e = pc[name] = {can, ctx: can.getContext("2d", {willReadFrequently: true})};
    }
    return e.ctx;
  };

  /** Atlas rects [x0,y0,x1,y1] -> disjoint merged rects inside W x H, so
   *  no pixel is blended twice. */
  HP._mergeRects = function (rects, W, H) {
    let rs = rects.map(r => [Math.max(0, r[0]), Math.max(0, r[1]), Math.min(W, r[2]), Math.min(H, r[3])])
                  .filter(r => r[2] > r[0] && r[3] > r[1]);
    let merged = true;
    while (merged) {
      merged = false;
      outer: for (let i = 0; i < rs.length; i++)
        for (let j = i + 1; j < rs.length; j++) {
          const a = rs[i], b = rs[j];
          if (a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3]) {
            rs[i] = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
            rs.splice(j, 1); merged = true; break outer;
          }
        }
    }
    return rs;
  };

  /** src region (x,y,w,h) -> a new canvas holding it blurred by b px. */
  HP._blurred = function (src, x, y, w, h, b) {
    const out = document.createElement("canvas");
    out.width = w; out.height = h;
    const c = out.getContext("2d");
    c.filter = "blur(" + b + "px)";
    c.drawImage(src, x, y, w, h, 0, 0, w, h);
    c.filter = "none";
    return out;
  };

  /** Keep only a radial falloff of `can`: full `k` out to half of r,
   *  fading to 0 at r. A straight centre-to-edge fade left the outer half
   *  of the ring barely touched, so smooth looked smaller than its brush
   *  (Hector, 2026-09-24). */
  HP._falloff = function (can, cx, cy, r, k) {
    const c = can.getContext("2d");
    c.globalCompositeOperation = "destination-in";
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
    const a = "rgba(0,0,0," + Math.max(0, Math.min(1, k)) + ")";
    g.addColorStop(0, a);
    g.addColorStop(0.5, a);
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, can.width, can.height);
    c.globalCompositeOperation = "source-over";
  };

  /** One brush stamp. opts: {size (px), soft 0..1, alpha 0..1, color
   *  "#rrggbb", bmode composite-op}. */
  HP.stamp = function (pc, u, v, opts) {
    const x = u * pc.can.width, y = v * pc.can.height, r = opts.size / 2;
    pc.ctx.globalCompositeOperation = opts.bmode || "source-over";
    pc.ctx.globalAlpha = opts.alpha == null ? 1 : opts.alpha;
    if (opts.soft > 0) {
      const g = pc.ctx.createRadialGradient(x, y, r * (1 - opts.soft), x, y, r);
      g.addColorStop(0, opts.color);
      g.addColorStop(1, opts.color + "00");
      pc.ctx.fillStyle = g;
    } else pc.ctx.fillStyle = opts.color;
    pc.ctx.beginPath(); pc.ctx.arc(x, y, r, 0, Math.PI * 2); pc.ctx.fill();
    pc.ctx.globalAlpha = 1;
    pc.ctx.globalCompositeOperation = "source-over";
    HP.refresh(pc);
  };

  /** Connected stroke: stamps from `last` {u,v} to (u,v) unless the jump
   *  crosses UV islands (>25% of the atlas). Returns the new `last`. */
  HP.stroke = function (pc, last, u, v, opts) {
    if (last) {
      const du = u - last.u, dv = v - last.v;
      const distPx = Math.hypot(du * pc.can.width, dv * pc.can.height);
      if (distPx < Math.max(opts.size * 3, 48)) {
        const steps = Math.max(1, Math.ceil(distPx / (opts.size / 3)));
        for (let i = 1; i <= steps; i++)
          HP.stamp(pc, last.u + du * i / steps, last.v + dv * i / steps, opts);
        return {u, v};
      }
    }
    HP.stamp(pc, u, v, opts);
    return {u, v};
  };

  /** Flood the tapped triangle (flat N64 shading). `hit` is a raycast
   *  intersection carrying .object.geometry and .face. */
  HP.faceFill = function (pc, hit, opts) {
    const g = hit.object.geometry, uva = g.attributes.uv, f = hit.face;
    if (!uva || !f) return;
    const P = [f.a, f.b, f.c].map(i => [uva.getX(i) * pc.can.width, uva.getY(i) * pc.can.height]);
    pc.ctx.globalAlpha = opts.alpha == null ? 1 : opts.alpha;
    pc.ctx.fillStyle = pc.ctx.strokeStyle = opts.color;
    pc.ctx.lineWidth = 1.5;                     // outset hides tri seams
    pc.ctx.beginPath(); pc.ctx.moveTo(P[0][0], P[0][1]);
    pc.ctx.lineTo(P[1][0], P[1][1]); pc.ctx.lineTo(P[2][0], P[2][1]);
    pc.ctx.closePath(); pc.ctx.fill(); pc.ctx.stroke();
    pc.ctx.globalAlpha = 1;
    HP.dilatePadding(pc, [Math.min(P[0][0], P[1][0], P[2][0]), Math.min(P[0][1], P[1][1], P[2][1]),
                          Math.max(P[0][0], P[1][0], P[2][0]), Math.max(P[0][1], P[1][1], P[2][1])]);
    HP.refresh(pc);
  };

  // ---- per-STROKE compositing sessions --------------------------------
  // One drag = one application of opacity and blend mode, however many
  // overlapping stamps the interpolator emits. Direct stamping compounded
  // multiply into black blotches and saturated low-opacity strokes into
  // flat paint within a single drag (Hector's floor, 2026-09-24).
  // Stamps land on a transparent LAYER at full alpha; after every stamp
  // the visible canvas is recomposed as base + layer @ (opacity, mode).

  HP.beginStroke = function (pc, opts) {
    const base = document.createElement("canvas");
    base.width = pc.can.width; base.height = pc.can.height;
    base.getContext("2d").drawImage(pc.can, 0, 0);
    const layer = document.createElement("canvas");
    layer.width = pc.can.width; layer.height = pc.can.height;
    // willReadFrequently: the surface brush reads the layer back per dab
    return {pc, opts, base, layer, lctx: layer.getContext("2d", {willReadFrequently: true}), last: null};
  };

  HP._layerStamp = function (sess, u, v) {
    const o = sess.opts;
    let x = u * sess.layer.width, y = v * sess.layer.height;
    const vr = HP._vary(sess, o), rgb = "rgb(" + vr.rgb.join(",") + ")";
    x += vr.dx; y += vr.dy;
    if (o.pixel > 0) {                          // pixel mode: an N-texel square on the grid
      const off = Math.floor((o.pixel - 1) / 2);
      sess.lctx.fillStyle = rgb;
      sess.lctx.fillRect(Math.floor(x) - off, Math.floor(y) - off, o.pixel, o.pixel);
      return;
    }
    if (o.tip && o.tip.img) {                   // an image tip, coloured by the swatch unless RGBA
      const r2 = vr.size / 2, c = sess.lctx;
      let ang = 0;
      if (o.tip.rotate === "follow" && sess._lastXY) ang = Math.atan2(y - sess._lastXY[1], x - sess._lastXY[0]);
      else if (o.tip.rotate === "random") ang = sess.rng() * Math.PI * 2;
      sess._lastXY = [x, y];
      const P = HP._dabPatches(sess, o, vr.size, o.tip, ang);
      const tmp = sess._stampTmp || (sess._stampTmp = document.createElement("canvas"));
      tmp.width = tmp.height = P.size;
      const t = tmp.getContext("2d"), src = P.cov.getContext("2d").getImageData(0, 0, P.size, P.size).data;
      const colD = P.col ? P.col.getContext("2d").getImageData(0, 0, P.size, P.size).data : null;
      const img = t.createImageData(P.size, P.size), d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = colD ? colD[i] : vr.rgb[0]; d[i + 1] = colD ? colD[i + 1] : vr.rgb[1]; d[i + 2] = colD ? colD[i + 2] : vr.rgb[2];
        d[i + 3] = src[i];
      }
      t.putImageData(img, 0, 0);
      c.drawImage(tmp, x - P.half, y - P.half);
      return;
    }
    const r = vr.size / 2;
    if (o.soft > 0) {
      const g = sess.lctx.createRadialGradient(x, y, r * (1 - o.soft), x, y, r);
      g.addColorStop(0, rgb);
      g.addColorStop(1, "rgba(" + vr.rgb.join(",") + ",0)");
      sess.lctx.fillStyle = g;
    } else sess.lctx.fillStyle = rgb;
    sess.lctx.beginPath(); sess.lctx.arc(x, y, r, 0, Math.PI * 2); sess.lctx.fill();
  };

  HP._compose = function (sess) {
    const pc = sess.pc, ctx = pc.ctx;
    let layer = sess.layer;
    if (pc.stencil) {
      // strokes only land inside the selection
      if (!sess._masked) {
        sess._masked = document.createElement("canvas");
        sess._masked.width = layer.width; sess._masked.height = layer.height;
      }
      const m = sess._masked.getContext("2d");
      m.globalCompositeOperation = "source-over";
      m.clearRect(0, 0, layer.width, layer.height);
      m.drawImage(layer, 0, 0);
      m.globalCompositeOperation = "destination-in";
      m.drawImage(pc.stencil, 0, 0);
      layer = sess._masked;
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, pc.can.width, pc.can.height);
    ctx.drawImage(sess.base, 0, 0);
    ctx.globalCompositeOperation = sess.opts.bmode || "source-over";
    ctx.globalAlpha = sess.opts.alpha == null ? 1 : sess.opts.alpha;
    ctx.drawImage(layer, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    HP.refresh(pc);
  };

  /** Stamp (with stroke interpolation + island guard) into the session. */
  // ---------------- N64 / pixel-art path (plans/n64-pixel-mode, 2026-09-25) ----------------
  // Read from Aseprite (IntertwineAsPixelPerfect) and Pixelorama
  // (PixelPerfectDrawer, LightenDarkenOp, DrawingAlgos): a 32-texel atlas is
  // a pixel-art canvas, so a pencil stroke is a chain of whole texels walked
  // with Bresenham, "pixel perfect" drops the corner texel of every L so a
  // freehand curve is one texel wide, the shading ink lightens toward yellow
  // and darkens toward blue along the hue wheel, and every texel is snapped
  // to the console's 5-bit channels.
  HP.quant5 = v => Math.round(Math.round(Math.max(0, Math.min(255, v)) / 255 * 31) * 255 / 31);
  HP.quant5Hex = hex => "#" + HP.hexRgb(hex).map(HP.quant5).map(n => n.toString(16).padStart(2, "0")).join("");
  /** Every texel of pc to 5 bits per channel (the N64's RGBA16). */
  HP.quantizeCanvas = function (pc) {
    const img = pc.ctx.getImageData(0, 0, pc.can.width, pc.can.height), d = img.data;
    for (let i = 0; i < d.length; i += 4) { d[i] = HP.quant5(d[i]); d[i + 1] = HP.quant5(d[i + 1]); d[i + 2] = HP.quant5(d[i + 2]); }
    pc.ctx.putImageData(img, 0, 0); HP.refresh(pc);
  };
  HP.rgbHsv = function (r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0; if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h /= 6; if (h < 0) h += 1; }
    return [h, mx ? d / mx : 0, mx];
  };
  HP.hsvRgb = function (h, s, v) {
    const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    const c = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((i % 6) + 6) % 6];
    return c.map(x => Math.round(x * 255));
  };
  /** Pixelorama's hue-shifting shading: lighter = hue toward yellow (60 deg),
   *  less saturated, brighter; darker = hue toward blue (240 deg), more
   *  saturated, dimmer -- 10 units a step, with the same floors. */
  HP.shadeRgb = function (rgb, dir, amount) {
    const a = amount == null ? 1 : amount;
    let [h, s, v] = HP.rgbHsv(rgb[0], rgb[1], rgb[2]);
    const hueStep = 10 / 360 * a, satStep = 0.10 * a, valStep = 0.10 * a;
    const toward = target => { let d = target - h; d -= Math.round(d); return Math.abs(d) < hueStep ? target : h + Math.sign(d) * hueStep; };
    if (dir === "darker") { h = toward(240 / 360); s = Math.min(1, s + satStep); v = v > 0.1 ? Math.max(0.1, v - valStep) : v; }
    else { h = toward(60 / 360); s = s > 0.1 ? Math.max(0.1, s - satStep) : s; v = Math.min(1, v + valStep); }
    h = ((h % 1) + 1) % 1;
    return HP.hsvRgb(h, s, v);
  };
  // ---- UV islands: which triangles share one continuous piece of the atlas.
  // A shape drawn on the model as exact texels needs both ends on ONE island:
  // across islands there is no straight line in the atlas.
  /** Island id per face of a BufferGeometry: union-find over edges whose
   *  two vertices carry the same UVs on both faces. Cached on the geometry. */
  HP.uvIslands = function (geo) {
    if (geo.userData._uvIslands) return geo.userData._uvIslands;
    const uv = geo.attributes.uv, ix = geo.index, cnt = ix ? ix.count : geo.attributes.position.count, nf = (cnt / 3) | 0;
    const parent = new Int32Array(nf); for (let i = 0; i < nf; i++) parent[i] = i;
    const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    const key = a => Math.round(uv.getX(a) * 8192) + "," + Math.round(uv.getY(a) * 8192);
    const edges = new Map();                                  // "uvA|uvB" -> the first face with that UV edge
    for (let f = 0; f < nf; f++) {
      const v = [0, 1, 2].map(k => key(ix ? ix.getX(f * 3 + k) : f * 3 + k));
      for (let k = 0; k < 3; k++) {
        const a = v[k], b = v[(k + 1) % 3], e = a < b ? a + "|" + b : b + "|" + a, g = edges.get(e);
        if (g === undefined) edges.set(e, f); else { const ra = find(f), rb = find(g); if (ra !== rb) parent[ra] = rb; }
      }
    }
    const out = new Int32Array(nf); for (let f = 0; f < nf; f++) out[f] = find(f);
    geo.userData._uvIslands = out; return out;
  };
  /** How the model connects, for the "◬ edges" view (2026-09-26, Hector: "is there some way we
   *  could add a wireframe button that lets me see the way the texels or whatever connect?").
   *  Per mesh, in the mesh's OWN space (the page places them with its matrixWorld): every triangle
   *  edge once, split into `inner` (both faces use the same UVs there: the texture runs on
   *  smoothly), `seam` (a UV seam: the faces on each side sample different places of the atlas,
   *  so colour can step there) and `border` (one face only: an open edge or a piece's cut); plus
   *  `seamUV`, both sides' UV segments of every seam (pairs of [u, v]) for the atlas panel.
   *  Vertices are welded by position; faces with no UV area (the N64 lane's caps) are skipped.
   *  Line ends are pushed out along the vertex normal by `lift` (mesh units) so they sit on top
   *  of the surface instead of fighting it. */
  HP.meshEdges = function (root, lift) {
    const out = [];
    root.updateMatrixWorld(true);
    root.traverse(n => {
      if (!n.isMesh || !n.geometry.attributes.uv || !n.geometry.attributes.position) return;
      const g = n.geometry, pos = g.attributes.position, uv = g.attributes.uv, nr = g.attributes.normal, ix = g.index, cnt = ix ? ix.count : pos.count;
      if (!g.boundingSphere) g.computeBoundingSphere();
      const L = lift != null ? lift : g.boundingSphere.radius * 0.004;
      const wid = new Int32Array(pos.count), seen = new Map();
      for (let i = 0; i < pos.count; i++) {
        const k = Math.round(pos.getX(i) * 1e5) + "," + Math.round(pos.getY(i) * 1e5) + "," + Math.round(pos.getZ(i) * 1e5);
        let w = seen.get(k); if (w === undefined) { w = seen.size; seen.set(k, w); } wid[i] = w;
      }
      const edges = new Map();
      for (let t = 0; t < cnt; t += 3) {
        const v = [0, 1, 2].map(k => ix ? ix.getX(t + k) : t + k);
        const ua = (uv.getX(v[1]) - uv.getX(v[0])) * (uv.getY(v[2]) - uv.getY(v[0])) - (uv.getX(v[2]) - uv.getX(v[0])) * (uv.getY(v[1]) - uv.getY(v[0]));
        if (Math.abs(ua) < 1e-12) continue;                      // a cap: no UV area, hidden inside
        for (let k = 0; k < 3; k++) {
          let i = v[k], j = v[(k + 1) % 3];
          if (wid[i] === wid[j]) continue;
          if (wid[i] > wid[j]) { const s2 = i; i = j; j = s2; }  // oriented by welded id, so both faces agree on the ends
          const key = wid[i] + "|" + wid[j];
          (edges.get(key) || edges.set(key, []).get(key)).push([i, j]);
        }
      }
      const inner = [], seam = [], border = [], seamUV = [];
      const put = (arr, i) => {
        let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        if (nr && L) { x += nr.getX(i) * L; y += nr.getY(i) * L; z += nr.getZ(i) * L; }
        arr.push(x, y, z);
      };
      const uvSame = (i, j) => Math.abs(uv.getX(i) - uv.getX(j)) < 1e-5 && Math.abs(uv.getY(i) - uv.getY(j)) < 1e-5;
      for (const list of edges.values()) {
        const [i, j] = list[0];
        if (list.length === 1) { put(border, i); put(border, j); continue; }
        const same = list.every(([a, b]) => uvSame(a, i) && uvSame(b, j));
        const arr = same ? inner : seam;
        put(arr, i); put(arr, j);
        if (!same) for (const [a, b] of list) seamUV.push([uv.getX(a), uv.getY(a)], [uv.getX(b), uv.getY(b)]);
      }
      out.push({mesh: n, inner: new Float32Array(inner), seam: new Float32Array(seam), border: new Float32Array(border), seamUV,
                counts: {inner: inner.length / 6, seam: seam.length / 6, border: border.length / 6}});
    });
    return out;
  };

  /** ◩ flip (2026-09-26, Hector: "even cooler if i could somehow correct them to make more sense
   *  for human editing"). Two triangles of one UV island that share an edge form a quad; turning
   *  its diagonal the other way changes how each half stretches the texture, so a colour blended
   *  across the patch bends along the other diagonal. The edge flipped is the one of `faceIndex`
   *  nearest `pointWorld`. Refused, with the reason, for an open edge, a UV seam (the two faces
   *  sample different places of the atlas: no flip joins them) and a quad that is not convex in
   *  the atlas or on the surface (the flip would fold the texture or the mesh). Only the index
   *  buffer changes -- same vertices, same count -- so it saves as the GLB's triangle order.
   *  opts.dry: judge only. Returns {ok, reason?, edge: [aLocal, bLocal], faces, before, after}. */
  HP.flipDiagonal = function (mesh, faceIndex, pointWorld, opts) {
    const g = mesh.geometry, ix = g.index, pos = g.attributes.position, uv = g.attributes.uv;
    if (!ix || !uv) return {ok: false, reason: "this mesh has no triangle index or no UVs"};
    const V3 = THREE.Vector3, P = pointWorld.clone().applyMatrix4(new THREE.Matrix4().copy(mesh.matrixWorld).invert());
    const at = i => new V3().fromBufferAttribute(pos, i);
    const f = faceIndex, v = [ix.getX(f * 3), ix.getX(f * 3 + 1), ix.getX(f * 3 + 2)];
    let k = 0, bd = Infinity;
    for (let q = 0; q < 3; q++) { const d = new THREE.Line3(at(v[q]), at(v[(q + 1) % 3])).closestPointToPoint(P, true, new V3()).distanceTo(P); if (d < bd) { bd = d; k = q; } }
    const a = v[k], b = v[(k + 1) % 3], c = v[(k + 2) % 3], A = at(a), B = at(b), C = at(c);
    const res = {ok: false, edge: [A.toArray(), B.toArray()]};
    const same = (i, j) => at(i).distanceToSquared(at(j)) < 1e-12;
    let o = -1, oa = -1, ob = -1, d = -1, many = false;
    for (let t = 0; t < ix.count / 3; t++) {
      if (t === f) continue;
      const w = [ix.getX(t * 3), ix.getX(t * 3 + 1), ix.getX(t * 3 + 2)];
      const ia = w.findIndex(x => same(x, a)), ib = w.findIndex(x => same(x, b));
      if (ia < 0 || ib < 0) continue;
      if (o >= 0) { many = true; break; }
      o = t; oa = w[ia]; ob = w[ib]; d = w[3 - ia - ib];
    }
    if (many) return Object.assign(res, {reason: "more than two faces meet at this edge"});
    if (o < 0) return Object.assign(res, {reason: "an open edge: there is no face on the other side"});
    const uvEq = (i, j) => Math.abs(uv.getX(i) - uv.getX(j)) < 1e-6 && Math.abs(uv.getY(i) - uv.getY(j)) < 1e-6;
    if (!uvEq(oa, a) || !uvEq(ob, b)) return Object.assign(res, {reason: "a UV seam: the two faces take their colour from different places of the atlas, and a flip cannot join them"});
    // convex in the atlas and on the surface: the new diagonal c-d must cross the old one a-b
    const cross2 = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const crosses = (p1, p2, p3, p4) => cross2(p1, p2, p3) * cross2(p1, p2, p4) < 0 && cross2(p3, p4, p1) * cross2(p3, p4, p2) < 0;
    const U = i => [uv.getX(i), uv.getY(i)];
    if (!crosses(U(a), U(b), U(c), U(d))) return Object.assign(res, {reason: "the four corners do not make a convex quad in the atlas: the flip would fold the texture"});
    const D = at(d), n1 = new V3().subVectors(B, A).cross(new V3().subVectors(C, A)).normalize(), n2 = new V3().subVectors(A, B).cross(new V3().subVectors(D, B)).normalize();
    const n = n1.clone().add(n2); if (n.lengthSq() < 1e-12) return Object.assign(res, {reason: "the two faces fold back onto each other"});
    n.normalize();
    const e1 = new V3().subVectors(B, A); e1.addScaledVector(n, -e1.dot(n)).normalize(); const e2 = new V3().crossVectors(n, e1);
    const Q = X => [X.dot(e1), X.dot(e2)];
    if (!crosses(Q(A), Q(B), Q(C), Q(D))) return Object.assign(res, {reason: "the four corners do not make a convex quad on the surface: the flip would fold the mesh"});
    // around the quad the boundary runs a -> d -> b -> c: the new triangles keep that winding
    let t1 = [a, d, c], t2 = [d, b, c];
    const nt = t => new V3().subVectors(at(t[1]), at(t[0])).cross(new V3().subVectors(at(t[2]), at(t[0])));
    if (nt(t1).dot(n1) < 0) { t1 = [a, c, d]; t2 = [d, c, b]; }
    const before = [[...v], [ix.getX(o * 3), ix.getX(o * 3 + 1), ix.getX(o * 3 + 2)]];
    Object.assign(res, {ok: true, faces: [f, o], before, after: [t1, t2]});
    if (opts && opts.dry) return res;
    HP._setTris(g, [f, o], [t1, t2]);
    return res;
  };
  /** Least-squares conformal map (Lévy et al. 2002): flat coordinates for a triangle mesh that keep
   *  its angles -- how a piece of surface lies flat without shearing its texels. P: 3n positions,
   *  F: 3m vertex indices, pins: two vertices held at (0,0) and (|Pi-Pj|, 0). Solved with a
   *  Jacobi-preconditioned conjugate gradient on the normal equations, started from a planar
   *  projection. Returns Float64Array(2n): u, v per vertex, in P's units. */
  HP.lscm = function (P, F, pins) {
    const n = P.length / 3, m = F.length / 3, N2 = 2 * n;
    const tv = [], co = [];                                      // per kept triangle: 3 vertices, 6 coefficients
    for (let t = 0; t < m; t++) {
      const i0 = F[t * 3], i1 = F[t * 3 + 1], i2 = F[t * 3 + 2];
      const e1 = [P[i1 * 3] - P[i0 * 3], P[i1 * 3 + 1] - P[i0 * 3 + 1], P[i1 * 3 + 2] - P[i0 * 3 + 2]];
      const e2 = [P[i2 * 3] - P[i0 * 3], P[i2 * 3 + 1] - P[i0 * 3 + 1], P[i2 * 3 + 2] - P[i0 * 3 + 2]];
      const l1 = Math.hypot(e1[0], e1[1], e1[2]); if (l1 < 1e-12) continue;
      const nn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const ln = Math.hypot(nn[0], nn[1], nn[2]); if (ln < 1e-14) continue;
      const x = [e1[0] / l1, e1[1] / l1, e1[2] / l1], nz = [nn[0] / ln, nn[1] / ln, nn[2] / ln];
      const y = [nz[1] * x[2] - nz[2] * x[1], nz[2] * x[0] - nz[0] * x[2], nz[0] * x[1] - nz[1] * x[0]];
      const q = [[0, 0], [l1, 0], [e2[0] * x[0] + e2[1] * x[1] + e2[2] * x[2], e2[0] * y[0] + e2[1] * y[1] + e2[2] * y[2]]];
      const sc = 1 / Math.sqrt(0.5 * ln), c = [];
      for (let k = 0; k < 3; k++) { const A = q[(k + 2) % 3], B = q[(k + 1) % 3]; c.push((A[0] - B[0]) * sc, (A[1] - B[1]) * sc); }
      tv.push(i0, i1, i2); co.push(...c);
    }
    const T = tv.length / 3, fixed = new Uint8Array(N2), xp = new Float64Array(N2);
    const [pa, pb] = pins, d = Math.hypot(P[pb * 3] - P[pa * 3], P[pb * 3 + 1] - P[pa * 3 + 1], P[pb * 3 + 2] - P[pa * 3 + 2]);
    fixed[pa] = fixed[n + pa] = fixed[pb] = fixed[n + pb] = 1; xp[pb] = d;
    const AtA = (x, out) => {                                    // out = A^T A x
      out.fill(0);
      for (let t = 0; t < T; t++) {
        let r1 = 0, r2 = 0;
        for (let k = 0; k < 3; k++) { const i = tv[t * 3 + k], a = co[t * 6 + k * 2], b = co[t * 6 + k * 2 + 1]; r1 += a * x[i] - b * x[n + i]; r2 += b * x[i] + a * x[n + i]; }
        for (let k = 0; k < 3; k++) { const i = tv[t * 3 + k], a = co[t * 6 + k * 2], b = co[t * 6 + k * 2 + 1]; out[i] += a * r1 + b * r2; out[n + i] += -b * r1 + a * r2; }
      }
    };
    const D = new Float64Array(N2);
    for (let t = 0; t < T; t++) for (let k = 0; k < 3; k++) { const i = tv[t * 3 + k], a = co[t * 6 + k * 2], b = co[t * 6 + k * 2 + 1], w = a * a + b * b; D[i] += w; D[n + i] += w; }
    // start: the positions projected on the pins' plane (pa->pb along u), then CG on the free unknowns
    const x = new Float64Array(N2);
    { const ex = [(P[pb * 3] - P[pa * 3]) / d, (P[pb * 3 + 1] - P[pa * 3 + 1]) / d, (P[pb * 3 + 2] - P[pa * 3 + 2]) / d];
      let nx = 0, ny = 0, nzz = 0;                                // the chart's mean normal
      for (let t = 0; t < T; t++) { const i0 = tv[t * 3], i1 = tv[t * 3 + 1], i2 = tv[t * 3 + 2];
        const u = [P[i1 * 3] - P[i0 * 3], P[i1 * 3 + 1] - P[i0 * 3 + 1], P[i1 * 3 + 2] - P[i0 * 3 + 2]], w = [P[i2 * 3] - P[i0 * 3], P[i2 * 3 + 1] - P[i0 * 3 + 1], P[i2 * 3 + 2] - P[i0 * 3 + 2]];
        nx += u[1] * w[2] - u[2] * w[1]; ny += u[2] * w[0] - u[0] * w[2]; nzz += u[0] * w[1] - u[1] * w[0]; }
      let ey = [ny * ex[2] - nzz * ex[1], nzz * ex[0] - nx * ex[2], nx * ex[1] - ny * ex[0]]; const ly = Math.hypot(...ey) || 1; ey = ey.map(v => v / ly);
      for (let i = 0; i < n; i++) { const dx = P[i * 3] - P[pa * 3], dy = P[i * 3 + 1] - P[pa * 3 + 1], dz = P[i * 3 + 2] - P[pa * 3 + 2]; x[i] = dx * ex[0] + dy * ex[1] + dz * ex[2]; x[n + i] = dx * ey[0] + dy * ey[1] + dz * ey[2]; }
      for (let i = 0; i < N2; i++) if (fixed[i]) x[i] = xp[i]; }
    const Ax = new Float64Array(N2), r = new Float64Array(N2), z = new Float64Array(N2), p = new Float64Array(N2), Ap = new Float64Array(N2);
    AtA(x, Ax);
    for (let i = 0; i < N2; i++) r[i] = fixed[i] ? 0 : -Ax[i];    // b - A^T A x with the pins folded in (x holds them)
    for (let i = 0; i < N2; i++) { z[i] = fixed[i] || !D[i] ? 0 : r[i] / D[i]; p[i] = z[i]; }
    let rz = 0; for (let i = 0; i < N2; i++) rz += r[i] * z[i];
    const r0 = Math.sqrt(r.reduce((s2, v) => s2 + v * v, 0)) || 1;
    for (let it = 0; it < 4 * N2 + 50; it++) {
      AtA(p, Ap); for (let i = 0; i < N2; i++) if (fixed[i]) Ap[i] = 0;
      let pAp = 0; for (let i = 0; i < N2; i++) pAp += p[i] * Ap[i];
      if (Math.abs(pAp) < 1e-300) break;
      const al = rz / pAp; let rr = 0;
      for (let i = 0; i < N2; i++) { x[i] += al * p[i]; r[i] -= al * Ap[i]; rr += r[i] * r[i]; }
      if (Math.sqrt(rr) < 1e-10 * r0) break;
      let rz2 = 0; for (let i = 0; i < N2; i++) { z[i] = fixed[i] || !D[i] ? 0 : r[i] / D[i]; rz2 += r[i] * z[i]; }
      const be = rz2 / rz; rz = rz2;
      for (let i = 0; i < N2; i++) p[i] = z[i] + be * p[i];
    }
    const out = new Float64Array(N2); for (let i = 0; i < n; i++) { out[i * 2] = x[i]; out[i * 2 + 1] = x[n + i]; }
    return out;
  };

  // ---- the atlas editor's shared machinery (plans/atlas-editor, 2026-09-26) ----
  HP._meshAccess = function (mesh, W, H) {
    const g = mesh.geometry, ix = g.index, pos = g.attributes.position, uv = g.attributes.uv;
    const nf = ix.count / 3, fv = t => [ix.getX(t * 3), ix.getX(t * 3 + 1), ix.getX(t * 3 + 2)];
    const uvA = t => { const q = fv(t); return Math.abs((uv.getX(q[1]) - uv.getX(q[0])) * (uv.getY(q[2]) - uv.getY(q[0])) - (uv.getX(q[2]) - uv.getX(q[0])) * (uv.getY(q[1]) - uv.getY(q[0]))) * W * H / 2; };
    const kp = i => Math.round(pos.getX(i) * 1e5) + "," + Math.round(pos.getY(i) * 1e5) + "," + Math.round(pos.getZ(i) * 1e5);
    const uvEq = (i, j) => Math.abs(uv.getX(i) - uv.getX(j)) < 1e-6 && Math.abs(uv.getY(i) - uv.getY(j)) < 1e-6;
    return {g, ix, pos, uv, nf, fv, uvA, kp, uvEq};
  };
  /** How far a set of faces' texture mapping is from conformal: the area-weighted mean, over the
   *  faces, of the ratio of the mapping's two stretches (1 = every texel square on the surface; 2 =
   *  texels twice as long one way as the other -- the shear that bends a blended colour). */
  /** One triangle's texture mapping, as its two principal stretches.
   *
   *  The map from the surface to the atlas is affine across a triangle, so
   *  it has a 2x2 Jacobian J, and J's singular values s1 >= s2 are how far
   *  the texture is pulled along its two principal directions (texels per
   *  metre). s1/s2 is the SHAPE distortion - 1 means a circle drawn on the
   *  surface is a circle in the atlas, higher means an ellipse - and
   *  s1*s2 is the texel AREA the triangle gets per unit of surface.
   *  Blender's UV stretch overlay shows exactly these two (angle / area).
   *  Returns null for a degenerate triangle. */
  HP.faceStretchAt = function (M, t, W, H) {
    const V3 = THREE.Vector3;
    const q = M.fv(t), P = q.map(i => new V3().fromBufferAttribute(M.pos, i)), U = q.map(i => [M.uv.getX(i) * W, M.uv.getY(i) * H]);
    const e1 = P[1].clone().sub(P[0]), e2 = P[2].clone().sub(P[0]), l1 = e1.length(), n = e1.clone().cross(e2), ln = n.length(); if (l1 < 1e-12 || ln < 1e-14) return null;
    const x = e1.clone().divideScalar(l1), y = n.clone().divideScalar(ln).cross(x);
    const q1 = [l1, 0], q2 = [e2.dot(x), e2.dot(y)], det = q1[0] * q2[1] - q2[0] * q1[1]; if (Math.abs(det) < 1e-14) return null;
    const du1 = [U[1][0] - U[0][0], U[1][1] - U[0][1]], du2 = [U[2][0] - U[0][0], U[2][1] - U[0][1]];
    // J = [du1 du2] * inverse([q1 q2])
    const ia = q2[1] / det, ib = -q2[0] / det, ic = -q1[1] / det, id = q1[0] / det;
    const a = du1[0] * ia + du2[0] * ic, b = du1[0] * ib + du2[0] * id, c = du1[1] * ia + du2[1] * ic, d = du1[1] * ib + du2[1] * id;
    const E = (a + d) / 2, F = (a - d) / 2, G = (c + b) / 2, Hh = (c - b) / 2, Q = Math.hypot(E, Hh), R = Math.hypot(F, G);
    const s1 = Q + R, s2 = Math.abs(Q - R); if (s1 < 1e-12) return null;
    return {s1, s2, area3: ln / 2, ratio: Math.min(100, s1 / Math.max(s2, s1 / 100)), density: s1 * s2};
  };

  HP.chartShear = function (mesh, faces, W, H) {
    const M = HP._meshAccess(mesh, W, H); let sum = 0, wsum = 0;
    for (const t of faces) {
      const f = HP.faceStretchAt(M, t, W, H); if (!f) continue;
      sum += f.area3 * f.ratio; wsum += f.area3;
    }
    return wsum ? sum / wsum : 1;
  };

  /** Every face's stretch, for the overlay (plans/atlas-editor).
   *
   *  `ratio` is shape distortion, 1 = undistorted. `rel` is the face's
   *  texel density against the MESH'S OWN area-weighted mean, so 1 means
   *  "its fair share of the atlas", 0.5 half of it, 2 twice - which is the
   *  number that says where the texture will look soft and where it is
   *  wasting texels. Both are per FACE, in triangle order. */
  HP.faceStretch = function (mesh, W, H) {
    const g = mesh.geometry, M = HP._meshAccess(mesh, W, H), nf = M.nf;
    const ratio = new Float32Array(nf), dens = new Float32Array(nf), ok = new Uint8Array(nf);
    let dsum = 0, asum = 0;
    for (let t = 0; t < nf; t++) {
      const f = HP.faceStretchAt(M, t, W, H);
      // A face whose UVs collapse to a line or a point occupies no atlas
      // at all - a hidden cap, a degenerate triangle. Counting its zero
      // density in the mean drags the whole model's reading toward it
      // (a two-face test read 8192 where the one real face was 16384),
      // so it is simply not mapped: neutral in the overlay, out of the mean.
      if (!f || f.density * f.area3 < 1e-9) continue;
      ratio[t] = f.ratio; dens[t] = f.density; ok[t] = 1;
      dsum += f.area3 * f.density; asum += f.area3;
    }
    const mean = asum ? dsum / asum : 1;
    const rel = new Float32Array(nf);
    let worst = 0, worstFace = -1;
    for (let t = 0; t < nf; t++) {
      if (!ok[t]) { rel[t] = 1; ratio[t] = 1; continue; }
      rel[t] = mean > 1e-12 ? dens[t] / mean : 1;
      if (ratio[t] > worst) { worst = ratio[t]; worstFace = t; }
    }
    return {ratio, rel, ok, mean, worst, worstFace, count: nf};
  };

  /** The orientation a part takes when it is laid ON a surface.
   *
   *  Matching a part's mount axis (+Y) to the surface normal leaves one
   *  degree of freedom - the turn ABOUT the normal - and a shortest-arc
   *  rotation resolves it arbitrarily, which is fine for a bolt and wrong
   *  for anything with a length: a hazard bar came out hanging straight
   *  down the first time (2026-09-27). So spin 0 means the part's +X stays
   *  HORIZONTAL across the face and its +Z points up-slope; on a face that
   *  is itself horizontal, +X is world +X and the whole thing is identity.
   *
   *  The same rule as hedgy-workers tools/floaters.py `orient`, which is
   *  what actually builds the mesh. It lives here so the Paint page's
   *  preview, the Environment page's stick-to-surface and that placer
   *  cannot drift apart about which way a part faces.
   */
  HP.surfaceBasis = function (normal, spinDeg) {
    const N = normal.clone().normalize();
    let x = new THREE.Vector3().crossVectors(N, new THREE.Vector3(0, 1, 0));
    if (x.lengthSq() < 1e-12) x = new THREE.Vector3().crossVectors(N, new THREE.Vector3(0, 0, 1));
    x.normalize();
    const z = new THREE.Vector3().crossVectors(x, N);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, N, z));
    if (spinDeg) q.premultiply(new THREE.Quaternion().setFromAxisAngle(N, spinDeg * Math.PI / 180));
    return q;
  };

  /** Blue (fine) through green to red (bad), as the overlay paints it.
   *  `t` is already normalised 0..1. */
  HP.stretchColour = function (t) {
    const h = (1 - Math.max(0, Math.min(1, t))) * 0.62;      // 0.62 = blue, 0 = red
    const c = new THREE.Color(); c.setHSL(h, 0.85, 0.5); return c;
  };
  // ---- shared by join, straighten, move and pack (plans/atlas-editor): rasters on a coarse grid, the
  // free-space search, the texel carry, and the N64 caps that ride along ----
  HP._uvChanged = function (g) { delete g.userData._uvIslands; delete g.userData._uvUnits; delete g.userData._twins; delete g.userData._points; };
  /** Duplicate triangles: faces with the same three corners (positions) and the same UVs as an earlier
   *  face, under their own vertex numbers. The N64 rigs carry them ON PURPOSE: n64ify's segment_by_bone gives
   *  each bone piece a ring of its neighbour's faces, weighted to its own bone, so a bending joint slides one
   *  skin under the other instead of opening a slit (216 of the king oyster's 1442, every one on another bone
   *  than its original). At rest they coincide; the atlas tools keep each on its original's UVs
   *  (rep[t] = the first such face; rep[t] === t for most). */
  HP._twins = function (g) {
    if (g.userData._twins) return g.userData._twins;
    const ix = g.index, pos = g.attributes.position, uv = g.attributes.uv, nf = ix ? ix.count / 3 : 0, rep = new Int32Array(nf), seen = new Map();
    const kp = i => Math.round(pos.getX(i) * 1e5) + "," + Math.round(pos.getY(i) * 1e5) + "," + Math.round(pos.getZ(i) * 1e5) + (uv ? "/" + Math.round(uv.getX(i) * 1e6) + "," + Math.round(uv.getY(i) * 1e6) : "");
    for (let t = 0; t < nf; t++) { const key = [0, 1, 2].map(k => kp(ix.getX(t * 3 + k))).sort().join("|"), o = seen.get(key); if (o === undefined) { seen.set(key, t); rep[t] = t; } else rep[t] = o; }
    g.userData._twins = rep; return rep;
  };
  HP._SUB = [0.125, 0.375, 0.625, 0.875];
  /** Mark the cells of `grid` (gw x gh) a triangle touches: any of its 16 sub-samples inside, or a corner
   *  (a sliver thinner than the samples still claims its corners). */
  HP._rasterTri = function (ax, ay, bx, by, cx, cy, grid, gw, gh) {
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy), SUB = HP._SUB;
    const X0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), X1 = Math.min(gw - 1, Math.floor(Math.max(ax, bx, cx)));
    const Y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), Y1 = Math.min(gh - 1, Math.floor(Math.max(ay, by, cy)));
    for (const [px, py] of [[ax, ay], [bx, by], [cx, cy]]) { const X = Math.floor(px), Y = Math.floor(py); if (X >= 0 && Y >= 0 && X < gw && Y < gh) grid[Y * gw + X] = 1; }
    if (Math.abs(den) < 1e-12) return;
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
      if (grid[y * gw + x]) continue;
      search: for (const sy of SUB) for (const sx of SUB) { const px = x + sx, py = y + sy, w0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den, w1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den;
        if (w0 >= -1e-4 && w1 >= -1e-4 && 1 - w0 - w1 >= -1e-4) { grid[y * gw + x] = 1; break search; } }
    }
  };
  /** The grid the placement runs on: k-texel cells, at most 256 a side (1 texel up to a 256 atlas). */
  HP._gridCell = (W, H) => Math.max(1, Math.ceil(Math.max(W, H) / 256));
  /** The cells (k texels) every face under `root` covers, but where skip(mesh, face) says so. */
  HP._occupancy = function (root, W, H, k, skip) {
    const Wc = Math.ceil(W / k), Hc = Math.ceil(H / k), occ = new Uint8Array(Wc * Hc);
    root.traverse(nd => {
      if (!nd.isMesh || !nd.geometry.attributes.uv) return;
      const gg = nd.geometry, gi = gg.index, gu = gg.attributes.uv, cnt = gi ? gi.count : gg.attributes.position.count;
      for (let t = 0; t < cnt / 3; t++) {
        if (skip && skip(nd, t)) continue;
        const q0 = gi ? gi.getX(t * 3) : t * 3, q1 = gi ? gi.getX(t * 3 + 1) : t * 3 + 1, q2 = gi ? gi.getX(t * 3 + 2) : t * 3 + 2;
        HP._rasterTri(gu.getX(q0) * W / k, gu.getY(q0) * H / k, gu.getX(q1) * W / k, gu.getY(q1) * H / k, gu.getX(q2) * W / k, gu.getY(q2) * H / k, occ, Wc, Hc);
      }
    });
    return {occ, Wc, Hc};
  };
  HP._grow = function (occ, Wc, Hc, n) {
    for (let s3 = 0; s3 < n; s3++) { const nx = occ.slice(); for (let y = 0; y < Hc; y++) for (let x = 0; x < Wc; x++) if (occ[y * Wc + x]) { if (x > 0) nx[y * Wc + x - 1] = 1; if (x < Wc - 1) nx[y * Wc + x + 1] = 1; if (y > 0) nx[(y - 1) * Wc + x] = 1; if (y < Hc - 1) nx[(y + 1) * Wc + x] = 1; } occ = nx; }
    return occ;
  };
  /** A mask of triangles given in cells (flat [ax, ay, bx, by, cx, cy] per face), trimmed: {m, mw, mh,
   *  cells: x, y pairs, x0, y0: the cell of the mask's corner}. */
  HP._mask = function (tris) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < tris.length; i += 2) { x0 = Math.min(x0, tris[i]); x1 = Math.max(x1, tris[i]); y0 = Math.min(y0, tris[i + 1]); y1 = Math.max(y1, tris[i + 1]); }
    const X0 = Math.floor(x0), Y0 = Math.floor(y0), mw = Math.floor(x1) - X0 + 1, mh = Math.floor(y1) - Y0 + 1, m = new Uint8Array(mw * mh);
    for (let i = 0; i < tris.length; i += 6) HP._rasterTri(tris[i] - X0, tris[i + 1] - Y0, tris[i + 2] - X0, tris[i + 3] - Y0, tris[i + 4] - X0, tris[i + 5] - Y0, m, mw, mh);
    const cells = []; for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) if (m[y * mw + x]) cells.push(x, y);
    return {m, mw, mh, cells, x0: X0, y0: Y0};
  };
  /** A free place for a mask (its cells hit nothing in occG) with a one-cell margin from the border:
   *  nearest `pref` (the mask's middle, in cells) first, else the first in reading order; only better
   *  than `limit` (a distance) is looked for. {ox, oy, dd} or null. */
  HP._findSpot = function (occG, Wc, Hc, cells, mw, mh, pref, limit, bnd) {
    const b = bnd || {x0: 0, y0: 0, x1: Wc, y1: Hc};           // a multi-part model: one part's region (cells, end exclusive)
    const free = (ox, oy) => { for (let c2 = 0; c2 < cells.length; c2 += 2) if (occG[(oy + cells[c2 + 1]) * Wc + ox + cells[c2]]) return false; return true; };
    if (!pref) { for (let oy = b.y0 + 1; oy + mh <= b.y1 - 1; oy++) for (let ox = b.x0 + 1; ox + mw <= b.x1 - 1; ox++) { const dd = oy * Wc + ox; if (limit != null && dd >= limit) return null; if (free(ox, oy)) return {ox, oy, dd}; } return null; }
    const cand = [];
    for (let oy = b.y0 + 1; oy + mh <= b.y1 - 1; oy++) for (let ox = b.x0 + 1; ox + mw <= b.x1 - 1; ox++) cand.push([ox, oy, (ox + mw / 2 - pref[0]) ** 2 + (oy + mh / 2 - pref[1]) ** 2]);
    cand.sort((A, B) => A[2] - B[2]);
    for (const [ox, oy, dd] of cand) { if (limit != null && dd >= limit) return null; if (free(ox, oy)) return {ox, oy, dd}; }
    return null;
  };
  /** A region in texels ({x0, y0, x1, y1}, a part of a multi-part model's working atlas) as whole cells of the
   *  k-texel grid inside it; the whole grid without one. */
  HP._cellBounds = (b, k, Wc, Hc) => b ? {x0: Math.ceil(b.x0 / k), y0: Math.ceil(b.y0 / k), x1: Math.min(Wc, Math.floor(b.x1 / k)), y1: Math.min(Hc, Math.floor(b.y1 / k))} : {x0: 0, y0: 0, x1: Wc, y1: Hc};
  /** Where each part's texture goes in a multi-part model's ONE working canvas (plans/atlas-editor 5b-1): `sizes` =
   *  [{w, h}] in texels, laid on shelves tallest first, `gutter` texels apart and from the edge, into the smallest
   *  square that holds them. Returns {S, rects: [{x0, y0, x1, y1}]} in the order given; the same input always gives
   *  the same layout (a draft made on it can come back). */
  HP.partsLayout = function (sizes, gutter) {
    const g = gutter == null ? 8 : gutter, order = sizes.map((s, i) => i).sort((a, b) => sizes[b].h - sizes[a].h || sizes[b].w - sizes[a].w || a - b);
    let S = Math.max(...sizes.map(s => Math.max(s.w, s.h))) + 2 * g;
    const area = sizes.reduce((a, s) => a + (s.w + g) * (s.h + g), 0); S = Math.max(S, Math.ceil(Math.sqrt(area)) + g);
    for (;;) {
      const rects = new Array(sizes.length); let x = g, y = g, rowH = 0, ok = true;
      for (const i of order) {
        const s = sizes[i];
        if (x + s.w + g > S) { x = g; y += rowH + g; rowH = 0; }
        if (y + s.h + g > S) { ok = false; break; }
        rects[i] = {x0: x, y0: y, x1: x + s.w, y1: y + s.h}; x += s.w + g; rowH = Math.max(rowH, s.h);
      }
      if (ok) return {S, rects};
      S = Math.ceil(S * 1.125);
    }
  };
  /** Carry texels: every texel of each face's NEW place (texel coords, `n` = [ax, ay, bx, by, cx, cy])
   *  takes its colour from the same point of its OLD place (`o`) in a snapshot; a texel just outside a
   *  face (the rim the bilinear filter reads) from the nearest face, unless a face covers it. `nearest`
   *  carries whole texels (pixel art, a palette; a move or a quarter turn is exact either way).
   *  opts.fill: the colour for texels no face lands on (a repack), else they keep what they had. opts.src: another
   *  canvas to take the colours from (the old atlas, when 🎨 parts splits a model into textures of their own); the
   *  old places `o` are then in ITS texels. */
  HP._carryTexels = function (pc, list, nearest, opts) {
    const W = pc.can.width, H = pc.can.height, src = opts && opts.src, SW = src ? src.width : W, SH = src ? src.height : H;
    const S = (src ? src.getContext("2d") : pc.ctx).getImageData(0, 0, SW, SH).data, img = pc.ctx.getImageData(0, 0, W, H), D2 = img.data;
    const sample = nearest ? (u, v2) => { const X = ((Math.floor(u) % SW) + SW) % SW, Y = ((Math.floor(v2) % SH) + SH) % SH, o2 = (Y * SW + X) * 4; return [S[o2], S[o2 + 1], S[o2 + 2], S[o2 + 3]]; }
      : (u, v2) => { const x = u - 0.5, y = v2 - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, c = [0, 0, 0, 0];
      for (const [dx, dy, wt] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) { const X = ((x0 + dx) % SW + SW) % SW, Y = ((y0 + dy) % SH + SH) % SH, o2 = (Y * SW + X) * 4; for (let q = 0; q < 4; q++) c[q] += wt * S[o2 + q]; }
      return c; };
    // three strengths: 3 = the texel's centre is inside a face; 2 = a face touches the texel (a sliver can cross a
    // texel far from its centre, and the renderer reads it there); 1 = the ring the renderer and the bilinear
    // filter read just outside, by DISTANCE: centre within 1.5 texels of a face, from the nearest face (a
    // barycentric bound left texels beside a thin face's long edge uncarried). A stronger claim overwrites a
    // weaker one; the colour comes from the same point of the old place either way
    let moved = 0; const done = new Uint8Array(W * H), near = new Float32Array(W * H).fill(Infinity), SUB = HP._SUB;
    const segD = (px, py, x0, y0, x1, y1) => { const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy, t = L > 0 ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / L)) : 0; return Math.hypot(px - x0 - t * dx, py - y0 - t * dy); };
    for (const {o, n} of list) {
      const [ax, ay, bx, by, cx, cy] = n, den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(den) < 1e-12) continue;
      const bw = (px, py) => { const w0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den, w1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den; return [w0, w1, 1 - w0 - w1]; };
      const touches = (x, y) => { for (const [qx, qy] of [[ax, ay], [bx, by], [cx, cy]]) if (Math.floor(qx) === x && Math.floor(qy) === y) return true;
        for (const sy of SUB) for (const sx of SUB) { const w = bw(x + sx, y + sy); if (w[0] >= -1e-4 && w[1] >= -1e-4 && w[2] >= -1e-4) return true; } return false; };
      for (let y = Math.max(0, Math.floor(Math.min(ay, by, cy) - 2)); y <= Math.min(H - 1, Math.ceil(Math.max(ay, by, cy) + 1)); y++)
        for (let x = Math.max(0, Math.floor(Math.min(ax, bx, cx) - 2)); x <= Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx) + 1)); x++) {
          const i = y * W + x; if (done[i] === 3) continue;
          const px = x + 0.5, py = y + 0.5, [w0, w1, w2] = bw(px, py);
          let lvl, d = 0;
          if (w0 >= -1e-6 && w1 >= -1e-6 && w2 >= -1e-6) lvl = 3;
          else if (done[i] < 2 && touches(x, y)) lvl = 2;
          else { d = Math.min(segD(px, py, ax, ay, bx, by), segD(px, py, bx, by, cx, cy), segD(px, py, cx, cy, ax, ay)); lvl = d <= 1.5 ? 1 : 0; }
          if (lvl < done[i] || lvl === 0 || (lvl === done[i] && (lvl > 1 || d >= near[i]))) continue;
          const c = sample(w0 * o[0] + w1 * o[2] + w2 * o[4], w0 * o[1] + w1 * o[3] + w2 * o[5]), o2 = i * 4;
          for (let r2 = 0; r2 < 4; r2++) D2[o2 + r2] = Math.round(c[r2]);
          if (!done[i]) moved++;
          done[i] = lvl; if (lvl === 1) near[i] = d;
        }
    }
    if (opts && opts.fill) {                                  // only inside opts.fillRect (a part's region): the other parts' textures are theirs
      const r = opts.fillRect || {x0: 0, y0: 0, x1: W, y1: H};
      for (let y = Math.max(0, r.y0); y < Math.min(H, r.y1); y++) for (let x = Math.max(0, r.x0); x < Math.min(W, r.x1); x++) { const i = y * W + x; if (!done[i]) { const o2 = i * 4; D2[o2] = opts.fill[0]; D2[o2 + 1] = opts.fill[1]; D2[o2 + 2] = opts.fill[2]; D2[o2 + 3] = 255; } }
    }
    pc.ctx.putImageData(img, 0, 0);
    return moved;
  };
  /** The N64 caps: faces with no texture area sample one texel (a ring corner of an island). One whose
   *  point lies in a moved face's OLD place follows it to the same point of its new place (uv set here),
   *  unless its vertices moved already (skip). Faces of `list` carry `o` (in SW x SH texels: the source's, when the
   *  colours came from another canvas) / `n` (in W x H) in texels. Returns how many. */
  HP._carryPoints = function (mesh, list, skip, W, H, SW, SH) {
    const g = mesh.geometry, ix = g.index, uv = g.attributes.uv; if (!ix || !uv) return 0;
    const RW = SW || W, RH = SH || H;
    let n = 0;
    for (let t = 0; t < ix.count / 3; t++) {
      const q = [ix.getX(t * 3), ix.getX(t * 3 + 1), ix.getX(t * 3 + 2)];
      if (q.every(x => skip.has(x))) continue;
      const u = q.map(x => [uv.getX(x) * RW, uv.getY(x) * RH]);
      if (Math.abs((u[1][0] - u[0][0]) * (u[2][1] - u[0][1]) - (u[2][0] - u[0][0]) * (u[1][1] - u[0][1])) >= 1e-12 * RW * RH) continue;   // it has area (HP.uvUnits' test): not a cap
      const px = (u[0][0] + u[1][0] + u[2][0]) / 3, py = (u[0][1] + u[1][1] + u[2][1]) / 3;
      let best = null, bw = -0.02;
      for (const e of list) {
        const o = e.o, den = (o[3] - o[5]) * (o[0] - o[4]) + (o[4] - o[2]) * (o[1] - o[5]); if (Math.abs(den) < 1e-12) continue;
        const w0 = ((o[3] - o[5]) * (px - o[4]) + (o[4] - o[2]) * (py - o[5])) / den, w1 = ((o[5] - o[1]) * (px - o[4]) + (o[0] - o[4]) * (py - o[5])) / den, w2 = 1 - w0 - w1, mw = Math.min(w0, w1, w2);
        if (mw > bw) { bw = mw; best = [e, w0, w1, w2]; if (mw >= 0) break; }
      }
      if (!best) continue;
      const [e, w0, w1, w2] = best, nx = w0 * e.n[0] + w1 * e.n[2] + w2 * e.n[4], ny = w0 * e.n[1] + w1 * e.n[3] + w2 * e.n[5];
      for (const x of q) if (!skip.has(x)) uv.setXY(x, nx / W, ny / H);
      n++;
    }
    if (n) uv.needsUpdate = true;
    return n;
  };
  /** Lay a chart (faces of `mesh`) out again: welded where `weld(t1, t2, i1, i2, j1, j2)` says two chart
   *  faces share an edge, flattened conformally (LSCM), at its old texel density, turned to its tightest
   *  box, placed first-fit into the space no other face uses -- nearest `opts.prefer` (texels) first, on a
   *  grid of at most 256 cells a side so a 2048 atlas places as fast as a 64 one, shrunk by bisection if
   *  it has to be -- and every texel carried from the same surface point in a snapshot of pc. Refused for
   *  a vertex shared with a face outside the chart, a chart that will not lie flat, no room at half size.
   *  opts: {root, dry, prefer: [x, y] texels, nearest: carry whole texels (pixel art, a palette)}. */
  HP._relayChart = function (mesh, chart, weld, pc, opts, res) {
    const W = pc.can.width, H = pc.can.height, M = HP._meshAccess(mesh, W, H), {g, pos, uv, nf, fv, uvA, kp} = M, V3 = THREE.Vector3;
    const inC = new Uint8Array(nf); chart.forEach(t => { inC[t] = 1; });
    const used = new Set(); chart.forEach(t => fv(t).forEach(x => used.add(x)));
    for (let t = 0; t < nf; t++) if (!inC[t] && uvA(t) > 1e-9 && fv(t).some(x => used.has(x))) return Object.assign(res, {reason: "a corner of this piece of the atlas is shared with another island; changing it would drag that island too", sharedBy: t, vertex: fv(t).find(x => used.has(x))});
    const par = new Map(); const find = x => { while (par.has(x) && par.get(x) !== x) { const y = par.get(x); par.set(x, par.has(y) ? par.get(y) : y); x = par.get(x); } return x; };
    const union = (x, y) => { x = find(x); y = find(y); if (x !== y) par.set(x, y); };
    const edges = new Map();
    for (const t of chart) { const w = fv(t); for (let q = 0; q < 3; q++) { const i = w[q], j = w[(q + 1) % 3], ki = kp(i), kj = kp(j); const key = ki < kj ? ki + "|" + kj : kj + "|" + ki; (edges.get(key) || edges.set(key, []).get(key)).push([t, i, j]); } }
    for (const list of edges.values()) {
      if (list.length !== 2) continue;
      const [[t1, i1, j1], [t2, i2, j2]] = list, i2m = kp(i2) === kp(i1) ? i2 : j2, j2m = i2m === i2 ? j2 : i2;
      if (weld(t1, t2, i1, i2m, j1, j2m)) { union(i1, i2m); union(j1, j2m); }
    }
    // one position with one UV is one point of the surface: duplicate triangles and normal-split vertices go
    // together (a straighten left 40 of 41 duplicates of the N64 rig off their original's UVs); a cut's two
    // sides carry different opts.tag values so they part
    const pt = new Map();
    for (const x of used) { const key = kp(x) + "/" + Math.round(uv.getX(x) * 1e6) + "," + Math.round(uv.getY(x) * 1e6) + "/" + (opts.tag ? opts.tag.get(x) || 0 : 0), o = pt.get(key); if (o === undefined) pt.set(key, x); else union(x, o); }
    const cid = new Map(), verts = [];
    for (const x of used) { const r = find(x); if (!cid.has(r)) { cid.set(r, verts.length); verts.push(r); } }
    if (opts.dry) return Object.assign(res, {ok: true, faces: chart.length});
    const C = new Float64Array(verts.length * 3), wp = new V3();
    verts.forEach((x, i) => { wp.fromBufferAttribute(pos, x).applyMatrix4(mesh.matrixWorld); C[i * 3] = wp.x; C[i * 3 + 1] = wp.y; C[i * 3 + 2] = wp.z; });
    const FC = new Int32Array(chart.length * 3); chart.forEach((t, q) => fv(t).forEach((x, r) => { FC[q * 3 + r] = cid.get(find(x)); }));
    const far = from => { let best = 0, bdist = -1; for (let i = 0; i < verts.length; i++) { const dd = (C[i * 3] - C[from * 3]) ** 2 + (C[i * 3 + 1] - C[from * 3 + 1]) ** 2 + (C[i * 3 + 2] - C[from * 3 + 2]) ** 2; if (dd > bdist) { bdist = dd; best = i; } } return best; };
    const p0 = far(0), p1 = far(p0), L = HP.lscm(C, FC, [p0, p1]);
    let oldA = 0; for (const t of chart) oldA += uvA(t);
    let newA = 0; for (let q = 0; q < chart.length; q++) { const A0 = FC[q * 3], A1 = FC[q * 3 + 1], A2 = FC[q * 3 + 2]; newA += Math.abs((L[A1 * 2] - L[A0 * 2]) * (L[A2 * 2 + 1] - L[A0 * 2 + 1]) - (L[A2 * 2] - L[A0 * 2]) * (L[A1 * 2 + 1] - L[A0 * 2 + 1])) / 2; }
    if (!(newA > 1e-12) || !Number.isFinite(newA)) return Object.assign(res, {reason: "this piece would not lie flat (a degenerate chart)"});
    const dens = Math.sqrt(oldA / newA);
    let best = null;
    for (let ang = 0; ang < 180; ang += 5) {
      const c = Math.cos(ang * Math.PI / 180), s2 = Math.sin(ang * Math.PI / 180); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i < verts.length; i++) { const X = (L[i * 2] * c - L[i * 2 + 1] * s2) * dens, Y = (L[i * 2] * s2 + L[i * 2 + 1] * c) * dens; if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y; }
      if (!best || (x1 - x0) * (y1 - y0) < best.area) best = {ang, area: (x1 - x0) * (y1 - y0)};
    }
    const cA = Math.cos(best.ang * Math.PI / 180), sA = Math.sin(best.ang * Math.PI / 180), U0 = new Float64Array(verts.length * 2);
    for (let i = 0; i < verts.length; i++) { U0[i * 2] = (L[i * 2] * cA - L[i * 2 + 1] * sA) * dens; U0[i * 2 + 1] = (L[i * 2] * sA + L[i * 2 + 1] * cA) * dens; }
    // the free space, on a grid of k-texel cells (k = 1 up to 256 texels), grown by the 2-cell gutter
    const k = HP._gridCell(W, H), gap = 2, O = HP._occupancy(opts.root || mesh, W, H, k, (nd, t) => nd === mesh && inC[t]), Wc = O.Wc, Hc = O.Hc, occG = HP._grow(O.occ, Wc, Hc, gap), bnd = HP._cellBounds(opts.bounds, k, Wc, Hc);
    const turn = (U, r) => { const out = new Float64Array(U.length); for (let i = 0; i < U.length; i += 2) { let X = U[i], Y = U[i + 1]; for (let q = 0; q < r; q++) { const t2 = X; X = -Y; Y = t2; } out[i] = X; out[i + 1] = Y; } let mx = 1e9, my = 1e9; for (let i = 0; i < out.length; i += 2) { mx = Math.min(mx, out[i]); my = Math.min(my, out[i + 1]); } for (let i = 0; i < out.length; i += 2) { out[i] -= mx; out[i + 1] -= my; } return out; };
    const pref = opts.prefer ? [opts.prefer[0] / k, opts.prefer[1] / k] : null;
    const tryFit = sc => {
      let bestFit = null;
      for (let r = 0; r < 4; r++) {
        const U = turn(U0, r).map(v2 => v2 * sc), tris = new Float64Array(chart.length * 6);
        for (let q = 0; q < chart.length; q++) for (let c3 = 0; c3 < 3; c3++) { const A = FC[q * 3 + c3]; tris[q * 6 + c3 * 2] = U[A * 2] / k; tris[q * 6 + c3 * 2 + 1] = U[A * 2 + 1] / k; }
        const M = HP._mask(tris); if (M.mw + 2 > bnd.x1 - bnd.x0 || M.mh + 2 > bnd.y1 - bnd.y0) continue;
        const spot = HP._findSpot(occG, Wc, Hc, M.cells, M.mw, M.mh, pref, bestFit ? bestFit.dd : null, bnd);
        if (spot) bestFit = {U, ox: (spot.ox - M.x0) * k, oy: (spot.oy - M.y0) * k, sc, r, dd: spot.dd};
      }
      return bestFit;
    };
    let fit = tryFit(1);
    if (!fit) { let lo = 0.5, hi = 1; if (!(fit = tryFit(lo))) return Object.assign(res, {reason: "no room in the atlas for this piece, even at half its density"}); for (let it = 0; it < 7; it++) { const mid = (lo + hi) / 2, got = tryFit(mid); if (got) { lo = mid; fit = got; } else hi = mid; } }
    // What the edit would COST, worked out without doing it (Hector, 2026-10-03:
    // the atlas "started looking morphed and off" from joining seams alone).
    // Two costs, and only the second was ever reported:
    //   * the SHRINK -- `fit.sc` below 1, because the piece is placed first-fit
    //     into free atlas space and bisected down to half size if it must be;
    //   * the SPREAD -- LSCM is CONFORMAL, so it preserves angles and not area.
    //     `dens` above scales the chart so its TOTAL area matches the old total,
    //     which keeps the piece's AVERAGE density, but the area is redistributed
    //     WITHIN it: a joined chart has to absorb the curvature the seam was
    //     relieving, so some of it gets more texels a metre than the rest. That
    //     is what "morphed" looks like, and nothing measured it.
    // Measured the way glbtexture.uv_distortion measures a layout: per face the
    // texel density sqrt(uv area / surface area), then the 95th percentile over
    // the 5th by surface area. Returns without carrying a texel or moving a UV.
    if (opts.cost) {
      const area3 = q => {
        const a = FC[q * 3], b = FC[q * 3 + 1], c3 = FC[q * 3 + 2];
        const ux = C[b * 3] - C[a * 3], uy = C[b * 3 + 1] - C[a * 3 + 1], uz = C[b * 3 + 2] - C[a * 3 + 2];
        const vx = C[c3 * 3] - C[a * 3], vy = C[c3 * 3 + 1] - C[a * 3 + 1], vz = C[c3 * 3 + 2] - C[a * 3 + 2];
        return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
      };
      const spreadOf = uvAt => {
        const rows = [];
        for (let q = 0; q < chart.length; q++) {
          const wA = area3(q); if (!(wA > 1e-12)) continue;
          const p = uvAt(q);
          const uA = Math.abs((p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1])) / 2;
          if (!(uA > 1e-12)) continue;                 // no atlas area is not mapped, not zero density
          rows.push({d: Math.sqrt(uA / wA), w: wA});
        }
        if (rows.length < 2) return null;
        rows.sort((x, y) => x.d - y.d);
        const tot = rows.reduce((s2, r2) => s2 + r2.w, 0);
        const at = f => { let acc = 0; for (const r2 of rows) { acc += r2.w; if (acc >= tot * f) return r2.d; } return rows[rows.length - 1].d; };
        const lo2 = at(0.05), hi2 = at(0.95);
        return lo2 > 1e-12 ? hi2 / lo2 : null;
      };
      return Object.assign(res, {ok: true, faces: chart.length, scale: fit.sc,
        spread: spreadOf(q => [0, 1, 2].map(c3 => { const A = FC[q * 3 + c3]; return [fit.U[A * 2], fit.U[A * 2 + 1]]; })),
        spreadBefore: spreadOf(q => { const w = fv(chart[q]); return [0, 1, 2].map(c3 => [uv.getX(w[c3]) * W, uv.getY(w[c3]) * H]); })});
    }
    // carry the texels from a snapshot: every texel of the new chart from the same surface point; the caps follow
    const before = new Float32Array(uv.array);
    const NU = new Float64Array(verts.length * 2); for (let i = 0; i < verts.length; i++) { NU[i * 2] = fit.U[i * 2] + fit.ox; NU[i * 2 + 1] = fit.U[i * 2 + 1] + fit.oy; }
    const list = chart.map((t, q) => { const w = fv(t), o = [], n = []; for (let c3 = 0; c3 < 3; c3++) { o.push(uv.getX(w[c3]) * W, uv.getY(w[c3]) * H); const A = FC[q * 3 + c3]; n.push(NU[A * 2], NU[A * 2 + 1]); } return {o, n}; });
    const moved = HP._carryTexels(pc, list, opts.nearest);
    const caps = HP._carryPoints(mesh, list, used, W, H);
    for (const x of used) { const i = cid.get(find(x)); uv.setXY(x, NU[i * 2] / W, NU[i * 2 + 1] / H); }
    uv.needsUpdate = true; HP._uvChanged(g);
    return Object.assign(res, {ok: true, faces: chart.length, scale: fit.sc, texels: moved, caps, before});
  };
  HP._nearestEdge = function (mesh, faceIndex, pointWorld) {
    const g = mesh.geometry, ix = g.index, pos = g.attributes.position, V3 = THREE.Vector3;
    const Pl = pointWorld.clone().applyMatrix4(new THREE.Matrix4().copy(mesh.matrixWorld).invert()), at = i => new V3().fromBufferAttribute(pos, i);
    const v = [ix.getX(faceIndex * 3), ix.getX(faceIndex * 3 + 1), ix.getX(faceIndex * 3 + 2)];
    let k = 0, bd = Infinity;
    for (let q = 0; q < 3; q++) { const dd = new THREE.Line3(at(v[q]), at(v[(q + 1) % 3])).closestPointToPoint(Pl, true, new V3()).distanceTo(Pl); if (dd < bd) { bd = dd; k = q; } }
    return {a: v[k], b: v[(k + 1) % 3], edge: [at(v[k]).toArray(), at(v[(k + 1) % 3]).toArray()]};
  };

  /** What 🔗 join would do at the seam edge of `faceIndex` nearest `pointWorld`, worked out without doing it -- the
   *  join and its hover preview (plans/atlas-editor 6f) share it, so what is tinted is what joins. Two islands: every
   *  edge between them closes. One island meeting ITSELF: only the seam you point at closes (the run of its
   *  self-seam edges through that edge) -- a slit (a cut that stopped inside; Hector: "stuck with seams just kinda
   *  in the middle of things") closes and the island stays one flat piece; a seam that wraps round is refused, as
   *  closed the island would be a band (a tube), which will not lie flat. Returns {ok, reason, edge, islands,
   *  slit, chart, weld, closes: [[a, b] positions], prefer}. */
  HP._joinPlan = function (mesh, faceIndex, pointWorld, W, H) {
    const g = mesh.geometry;
    if (!g.index || !g.attributes.uv) return {ok: false, reason: "this mesh has no triangle index or no UVs"};
    const M = HP._meshAccess(mesh, W, H), {nf, fv, uvA, kp, uvEq, uv} = M;
    const {a, b, edge} = HP._nearestEdge(mesh, faceIndex, pointWorld), f = faceIndex, res = {ok: false, edge};
    let o = -1; const tw = HP._twins(g);
    for (let t = 0; t < nf; t++) { if (t === f || tw[t] === tw[f]) continue; const w = fv(t); if (w.some(x => kp(x) === kp(a)) && w.some(x => kp(x) === kp(b))) { o = t; break; } }
    if (o < 0) return Object.assign(res, {reason: "an open edge: there is no face on the other side"});
    const isl = HP.uvIslands(g), IA = isl[f], IB = isl[o], ow = fv(o), oa = ow.find(x => kp(x) === kp(a)), ob = ow.find(x => kp(x) === kp(b));
    if (IA === IB && uvEq(oa, a) && uvEq(ob, b)) return Object.assign(res, {reason: "not a seam: the two faces already share their UVs here (◩ flip works on this edge)"});
    const ek = (i, j) => { const x = kp(i), y = kp(j); return x < y ? x + "|" + y : y + "|" + x; };
    const chart = []; let cx = 0, cy = 0, cw = 0;
    for (let t = 0; t < nf; t++) if ((isl[t] === IA || isl[t] === IB) && uvA(t) > 1e-9) { chart.push(t); if (isl[t] === IA) { const q = fv(t), A2 = uvA(t); cx += A2 * (uv.getX(q[0]) + uv.getX(q[1]) + uv.getX(q[2])) / 3 * W; cy += A2 * (uv.getY(q[0]) + uv.getY(q[1]) + uv.getY(q[2])) / 3 * H; cw += A2; } }
    // the edges between the chart's faces (originals: a duplicate coincides with its original, UVs and all)
    const em = new Map(); for (const t of chart) { if (tw[t] !== t) continue; const w = fv(t); for (let q = 0; q < 3; q++) { const k = ek(w[q], w[(q + 1) % 3]); (em.get(k) || em.set(k, []).get(k)).push([t, w[q], w[(q + 1) % 3]]); } }
    const seamOf = L => { if (L.length !== 2) return false; const [[t1, i1, j1], [t2, i2, j2]] = L, m1 = kp(i2) === kp(i1) ? i2 : j2, m2 = m1 === i2 ? j2 : i2; return !(uvEq(i1, m1) && uvEq(j1, m2)) ? [t1, t2] : false; };
    const closes = new Set();
    if (IA !== IB) { for (const [k, L] of em) { const s2 = seamOf(L); if (s2 && isl[s2[0]] !== isl[s2[1]]) closes.add(k); } }
    else {
      const self = new Map(); for (const [k, L] of em) if (seamOf(L)) self.set(k, k.split("|"));
      const byV = new Map(); for (const [k, [p, q]] of self) for (const v of [p, q]) (byV.get(v) || byV.set(v, []).get(v)).push(k);
      const start = ek(a, b), todo = [start]; closes.add(start);
      while (todo.length) { const k = todo.pop(); for (const v of self.get(k) || []) for (const k2 of byV.get(v) || []) if (!closes.has(k2)) { closes.add(k2); todo.push(k2); } }
      // closed, would the island still be one flat piece? the Euler characteristic (points - edges + faces) with
      // those edges welded must stay what it was: a wrap round seam drops it by one (a disc becomes a band)
      const chi = weldK => {
        const par = new Map(), find = x => { while (par.has(x) && par.get(x) !== x) { par.set(x, par.get(par.get(x)) ?? par.get(x)); x = par.get(x); } return x; };
        const vk = x => kp(x) + "/" + Math.round(uv.getX(x) * 1e6) + "," + Math.round(uv.getY(x) * 1e6);
        for (const [k, L] of em) if (weldK.has(k) && L.length === 2) { const [[, i1, j1], [, i2, j2]] = L, m1 = kp(i2) === kp(i1) ? i2 : j2, m2 = m1 === i2 ? j2 : i2;
          for (const [x, y] of [[vk(i1), vk(m1)], [vk(j1), vk(m2)]]) { const rx = find(x), ry = find(y); if (rx !== ry) par.set(rx, ry); } }
        const V = new Set(), E = new Set(); let F = 0;
        for (const t of chart) { if (tw[t] !== t) continue; F++; const w = fv(t).map(x => find(vk(x))); w.forEach(x => V.add(x)); for (let q = 0; q < 3; q++) { const x = w[q], y = w[(q + 1) % 3]; E.add(x < y ? x + "#" + y : y + "#" + x); } }
        return V.size - E.size + F;
      };
      if (chi(closes) < chi(new Set())) return Object.assign(res, {reason: "the same island on both sides, and this seam wraps round it: joining would close it into a tube (a band that will not lie flat)", islands: [IA], closes: [...closes].map(k => k.split("|").map(p2 => p2.split(",").map(Number).map(v => v / 1e5)))});
    }
    const weld = (t1, t2, i1, i2, j1, j2) => closes.has(ek(i1, j1)) || (isl[t1] === isl[t2] && uvEq(i1, i2) && uvEq(j1, j2));
    return Object.assign(res, {ok: true, islands: IA === IB ? [IA] : [IA, IB], slit: IA === IB, chart, weld, prefer: cw ? [cx / cw, cy / cw] : null,
      closes: [...closes].map(k => k.split("|").map(p2 => p2.split(",").map(Number).map(v => v / 1e5)))});
  };
  /** 🔗 join a UV seam (plans/atlas-editor phase 1): the seam at the edge of `faceIndex` nearest `pointWorld`
   *  closes (HP._joinPlan: two islands become ONE chart; one island's slit closes) and the chart is laid out by
   *  _relayChart near the first island. Refused, with the reason, for an open edge, an edge that is not a
   *  seam, a seam that wraps round its own island (it would close into a tube), and what _relayChart refuses.
   *  opts: {root, dry}. */
  HP.joinSeam = function (mesh, faceIndex, pointWorld, pc, opts) {
    opts = opts || {};
    const P = HP._joinPlan(mesh, faceIndex, pointWorld, pc.can.width, pc.can.height);
    if (!P.ok) { const r = {ok: false, reason: P.reason}; if (P.edge) r.edge = P.edge; if (P.islands) { r.islands = P.islands; r.closes = P.closes; } return r; }
    // what closes rides along, refused or not: the hover preview lights it
    return HP._relayChart(mesh, P.chart, P.weld, pc, Object.assign({}, opts, {prefer: P.prefer}), {ok: false, edge: P.edge, islands: P.islands, slit: P.slit, closes: P.closes});
  };
  /** What marking `keys` (edge keys by position, as 🧵 cut marks them) would do, worked out without doing it -- the
   *  marking preview (plans/atlas-editor 6f; it uses the cut's own grouping, HP._cutGroups): the PIECES the
   *  islands it runs through would fall into (faces joined across unmarked edges that are not seams already; no
   *  hidden caps), and the state: "pieces" (a piece comes off), "slit" (the island opens along the marks but stays
   *  one piece: run them on to the island's edge, or round a loop) or "nothing" (no point on the marks opens --
   *  the cut would be refused). */
  HP.cutPreview = function (mesh, keys, W, H) {
    const g = mesh.geometry; if (!g.index || !g.attributes.uv) return {pieces: [], islands: 0, state: "nothing"};
    const M = HP._meshAccess(mesh, W || 1, H || 1), isl = HP.uvIslands(g), tw = HP._twins(g);
    const ek = (i, j) => { const a = M.kp(i), b = M.kp(j); return a < b ? a + "|" + b : b + "|" + a; };
    const touched = new Set(); for (let t = 0; t < M.nf; t++) { const w = M.fv(t); for (let q = 0; q < 3; q++) if (keys.has(ek(w[q], w[(q + 1) % 3]))) touched.add(isl[t]); }
    const faces = []; for (let t = 0; t < M.nf; t++) if (touched.has(isl[t])) faces.push(t);
    const opens = HP._cutGroups(M, keys, faces, tw).filter(x => x.groups.length > 1).map(x => x.kp);
    const orig = faces.filter(t => tw[t] === t && M.uvA(t) > 1e-9);
    const par = new Map(orig.map(t => [t, t])), find = x => { while (par.get(x) !== x) { par.set(x, par.get(par.get(x))); x = par.get(x); } return x; };
    const em = new Map(); for (const t of orig) { const w = M.fv(t); for (let q = 0; q < 3; q++) { const i = w[q], j = w[(q + 1) % 3], k = ek(i, j); if (keys.has(k)) continue; const o = em.get(k); if (!o) { em.set(k, [t, i, j]); continue; }
      const [t2, i2, j2] = o, m1 = M.kp(i2) === M.kp(i) ? i2 : j2, m2 = m1 === i2 ? j2 : i2; if (M.uvEq(i, m1) && M.uvEq(j, m2)) { const x = find(t), y = find(t2); if (x !== y) par.set(x, y); } } }
    const by = new Map(); for (const t of orig) { const r = find(t); (by.get(r) || by.set(r, []).get(r)).push(t); }
    const pieces = [...by.values()].sort((x, y) => y.length - x.length), islands = new Set(orig.map(t => isl[t])).size;
    return {pieces, islands, opens: opens.length, state: !opens.length ? "nothing" : pieces.length > islands ? "pieces" : "slit"};
  };
  /** ⊞ straighten an island (plans/atlas-editor phase 2): the island under `faceIndex` is laid out
   *  again conformally (_relayChart, near where it was), so its texel grid runs straight and a blended
   *  colour no longer bends along the triangles' diagonals. Returns the shear before and after
   *  (HP.chartShear). Refused for an island already square to 3%. opts: as _relayChart. */
  HP.straightenIsland = function (mesh, faceIndex, pc, opts) {
    opts = opts || {};
    const g = mesh.geometry;
    if (!g.index || !g.attributes.uv) return {ok: false, reason: "this mesh has no triangle index or no UVs"};
    const W = pc.can.width, H = pc.can.height, M = HP._meshAccess(mesh, W, H), {nf, fv, uvA, uvEq, uv} = M;
    const isl = HP.uvIslands(g), I = isl[faceIndex], chart = []; let cx = 0, cy = 0, cw = 0;
    for (let t = 0; t < nf; t++) if (isl[t] === I && uvA(t) > 1e-9) { chart.push(t); const q = fv(t), A2 = uvA(t); cx += A2 * (uv.getX(q[0]) + uv.getX(q[1]) + uv.getX(q[2])) / 3 * W; cy += A2 * (uv.getY(q[0]) + uv.getY(q[1]) + uv.getY(q[2])) / 3 * H; cw += A2; }
    const res = {ok: false, island: I};
    if (!chart.length) return Object.assign(res, {reason: "this face has no texture area (a hidden cap)"});
    const shear0 = HP.chartShear(mesh, chart, W, H); res.shear = shear0;
    if (shear0 < 1.03) return Object.assign(res, {reason: "already straight: its texels are square to within 3% (shear " + shear0.toFixed(2) + ")"});
    const weld = (t1, t2, i1, i2, j1, j2) => uvEq(i1, i2) && uvEq(j1, j2);
    const r = HP._relayChart(mesh, chart, weld, pc, Object.assign({}, opts, {prefer: [cx / cw, cy / cw]}), res);
    if (opts.dry) return r;
    if (r.ok) { r.shearBefore = shear0; r.shearAfter = HP.chartShear(mesh, chart, W, H); }
    return r;
  };
  // ---- 🧩 islands: move / turn / scale, and pack the atlas (plans/atlas-editor phase 3, 2026-09-26) ----
  /** Faces that must move together: a UV island plus every island sharing a vertex with it (a vertex
   *  has one UV, so two islands meeting at a corner cannot move apart). Faces with no texture area (the
   *  N64 caps) are -1: they follow the texel they sample (HP._carryPoints). Cached with the islands. */
  HP.uvUnits = function (geo) {
    if (geo.userData._uvUnits) return geo.userData._uvUnits;
    const isl = HP.uvIslands(geo), ix = geo.index, uv = geo.attributes.uv, cnt = ix ? ix.count : geo.attributes.position.count, nf = (cnt / 3) | 0;
    const par = new Map(), find = x => { while (par.has(x) && par.get(x) !== x) x = par.get(x); return x; };
    const vi = (f, k) => ix ? ix.getX(f * 3 + k) : f * 3 + k, flat = f => { const a = vi(f, 0), b = vi(f, 1), c = vi(f, 2); return Math.abs((uv.getX(b) - uv.getX(a)) * (uv.getY(c) - uv.getY(a)) - (uv.getX(c) - uv.getX(a)) * (uv.getY(b) - uv.getY(a))) < 1e-12; };
    const byVert = new Map(), out = new Int32Array(nf);
    for (let f = 0; f < nf; f++) {
      if (flat(f)) { out[f] = -1; continue; }
      for (let k = 0; k < 3; k++) { const v = vi(f, k), o = byVert.get(v); if (o === undefined) byVert.set(v, isl[f]); else { const a = find(o), b = find(isl[f]); if (a !== b) par.set(a, b); } }
    }
    for (let f = 0; f < nf; f++) if (out[f] !== -1) out[f] = find(isl[f]);
    geo.userData._uvUnits = out; return out;
  };
  /** The outline of a set of faces: their edges no other face of the set shares, as line-segment
   *  positions in the mesh's own space (the hover of ⊞ straighten and 🧩 islands). */
  HP.facesOutline = function (mesh, faces) {
    const g = mesh.geometry, ix = g.index, pos = g.attributes.position; if (!ix) return new Float32Array(0);
    const cnt = new Map(), kp = i => Math.round(pos.getX(i) * 1e5) + "," + Math.round(pos.getY(i) * 1e5) + "," + Math.round(pos.getZ(i) * 1e5);
    for (const t of faces) for (let q = 0; q < 3; q++) { const a = ix.getX(t * 3 + q), b = ix.getX(t * 3 + (q + 1) % 3), ka = kp(a), kb = kp(b), key = ka < kb ? ka + "|" + kb : kb + "|" + ka, e = cnt.get(key); if (e) e.n++; else cnt.set(key, {n: 1, a, b}); }
    const out = []; for (const e of cnt.values()) if (e.n === 1) out.push(pos.getX(e.a), pos.getY(e.a), pos.getZ(e.a), pos.getX(e.b), pos.getY(e.b), pos.getZ(e.b));
    return new Float32Array(out);
  };
  /** Texel density: texels per metre of surface, sqrt(texture area / surface area) over some faces. */
  HP._density = function (mesh, faces, W, H) {
    const g = mesh.geometry, ix = g.index, pos = g.attributes.position, uv = g.attributes.uv, V3 = THREE.Vector3, a = new V3(), b = new V3(), c = new V3();
    let ua = 0, wa = 0;
    for (const t of faces) {
      const q = [ix.getX(t * 3), ix.getX(t * 3 + 1), ix.getX(t * 3 + 2)];
      ua += Math.abs((uv.getX(q[1]) - uv.getX(q[0])) * (uv.getY(q[2]) - uv.getY(q[0])) - (uv.getX(q[2]) - uv.getX(q[0])) * (uv.getY(q[1]) - uv.getY(q[0]))) * W * H / 2;
      a.fromBufferAttribute(pos, q[0]).applyMatrix4(mesh.matrixWorld); b.fromBufferAttribute(pos, q[1]).applyMatrix4(mesh.matrixWorld); c.fromBufferAttribute(pos, q[2]).applyMatrix4(mesh.matrixWorld);
      wa += b.sub(a).cross(c.sub(a)).length() / 2;
    }
    return {ua, wa, d: wa > 1e-12 ? Math.sqrt(ua / wa) : 0};
  };
  /** What 🧩 islands shows for the unit under `faceIndex`: its faces, how many islands it holds, its box in
   *  texels, its texel density against the whole model's (every mesh under `root`). */
  HP.unitInfo = function (mesh, faceIndex, W, H, root) {
    const g = mesh.geometry; if (!g.index || !g.attributes.uv) return {ok: false, reason: "this mesh has no triangle index or no UVs"};
    const un = HP.uvUnits(g), U = un[faceIndex];
    if (U === -1) return {ok: false, reason: "this face has no texture area (a hidden cap): it follows the island its texel sits on"};
    const faces = [], isl = HP.uvIslands(g), islands = new Set(), uv = g.attributes.uv, ix = g.index; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let t = 0; t < un.length; t++) if (un[t] === U) { faces.push(t); islands.add(isl[t]); for (let k = 0; k < 3; k++) { const v = ix.getX(t * 3 + k), x = uv.getX(v) * W, y = uv.getY(v) * H; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
    root = root || mesh; root.updateMatrixWorld(true);
    let ua = 0, wa = 0;
    root.traverse(nd => { if (!nd.isMesh || !nd.geometry.index || !nd.geometry.attributes.uv) return; const u2 = HP.uvUnits(nd.geometry), fs = []; for (let t = 0; t < u2.length; t++) if (u2[t] !== -1) fs.push(t); const d = HP._density(nd, fs, W, H); ua += d.ua; wa += d.wa; });
    return {ok: true, unit: U, faces, islands: islands.size, box: {x0, y0, x1, y1}, density: HP._density(mesh, faces, W, H).d, mean: wa > 1e-12 ? Math.sqrt(ua / wa) : 0};
  };
  /** For the live preview of a drag: the other faces' cells once at the start ({occ} on the k grid),
   *  then per offset (texels) the cells the unit would SHARE with another island (overlap), crowd within
   *  one cell (the bilinear filter would bleed), or whether it leaves the atlas. */
  HP.unitDragStart = function (mesh, faceIndex, W, H, root, bounds) {
    const info = HP.unitInfo(mesh, faceIndex, W, H, root); if (!info.ok) return null;
    const g = mesh.geometry, un = HP.uvUnits(g), U = info.unit, ix = g.index, uv = g.attributes.uv, k = HP._gridCell(W, H);
    const O = HP._occupancy(root || mesh, W, H, k, (nd, t) => nd === mesh ? (un[t] === U || un[t] === -1) : HP.uvUnits(nd.geometry)[t] === -1);
    const tris = new Float64Array(info.faces.length * 6);
    info.faces.forEach((t, q) => { for (let c3 = 0; c3 < 3; c3++) { const v = ix.getX(t * 3 + c3); tris[q * 6 + c3 * 2] = uv.getX(v) * W; tris[q * 6 + c3 * 2 + 1] = uv.getY(v) * H; } });
    return {mesh, info, k, W, H, occ: O.occ, near: HP._grow(O.occ, O.Wc, O.Hc, 1), Wc: O.Wc, Hc: O.Hc, tris, bounds: bounds || {x0: 0, y0: 0, x1: W, y1: H}};
  };
  HP.unitDragTest = function (d, dx, dy) {
    const b = d.info.box, R = d.bounds, off = b.x0 + dx < R.x0 - 1e-6 || b.y0 + dy < R.y0 - 1e-6 || b.x1 + dx > R.x1 + 1e-6 || b.y1 + dy > R.y1 + 1e-6;
    const t2 = new Float64Array(d.tris.length); for (let i = 0; i < t2.length; i += 2) { t2[i] = (d.tris[i] + dx) / d.k; t2[i + 1] = (d.tris[i + 1] + dy) / d.k; }
    const M = HP._mask(t2); let overlap = 0, crowd = 0;
    for (let c2 = 0; c2 < M.cells.length; c2 += 2) { const x = M.x0 + M.cells[c2], y = M.y0 + M.cells[c2 + 1]; if (x < 0 || y < 0 || x >= d.Wc || y >= d.Hc) continue; const i = y * d.Wc + x; if (d.occ[i]) overlap++; else if (d.near[i]) crowd++; }
    return {off, overlap: overlap * d.k * d.k, crowd: crowd * d.k * d.k};
  };
  /** 🧩 move / turn / scale the unit under `faceIndex` with its texels. Its new place is p' = s R p + t:
   *  R `rot` quarter turns (clockwise on the atlas panel) about the middle of its box, s `scale`, moved
   *  (dx, dy) texels, t rounded to whole texels so texel centres land on texel centres -- a move or a
   *  quarter turn is an exact permutation of the texels, nothing resampled. A move that would overlap
   *  another island or leave the atlas is refused (it is where the user put it); a turn or a scale that
   *  no longer fits where it is goes to the nearest free place with a 2-cell gutter (`slid` says how far).
   *  The caps sitting on it follow. opts: {dx, dy, rot, scale, nearest, root, dry}. */
  HP.transformUnit = function (mesh, faceIndex, pc, opts) {
    opts = opts || {};
    const W = pc.can.width, H = pc.can.height, root = opts.root || mesh, info = HP.unitInfo(mesh, faceIndex, W, H, root);
    if (!info.ok) return info;
    const g = mesh.geometry, ix = g.index, uv = g.attributes.uv, un = HP.uvUnits(g), U = info.unit, rot = ((opts.rot || 0) % 4 + 4) % 4, sc = opts.scale || 1, dx = opts.dx || 0, dy = opts.dy || 0;
    const res = {ok: false, faces: info.faces.length, islands: info.islands};
    const verts = new Set(); info.faces.forEach(t => { for (let k = 0; k < 3; k++) verts.add(ix.getX(t * 3 + k)); });
    const Rm = p => { let x = p[0], y = p[1]; for (let q = 0; q < rot; q++) { const t2 = x; x = -y; y = t2; } return [x, y]; };
    const b = info.box, c = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2], Rc = Rm(c);
    let t = [c[0] - sc * Rc[0] + dx, c[1] - sc * Rc[1] + dy];
    if (sc === 1) t = [Math.round(t[0]), Math.round(t[1])];        // whole texels: centres land on centres
    const place = p => { const r = Rm(p); return [sc * r[0] + t[0], sc * r[1] + t[1]]; };
    const NU = new Map(); for (const v of verts) NU.set(v, place([uv.getX(v) * W, uv.getY(v) * H]));
    let nx0 = Infinity, ny0 = Infinity, nx1 = -Infinity, ny1 = -Infinity; for (const p of NU.values()) { nx0 = Math.min(nx0, p[0]); nx1 = Math.max(nx1, p[0]); ny0 = Math.min(ny0, p[1]); ny1 = Math.max(ny1, p[1]); }
    const k = HP._gridCell(W, H), O = HP._occupancy(root, W, H, k, (nd, t3) => nd === mesh ? (un[t3] === U || un[t3] === -1) : HP.uvUnits(nd.geometry)[t3] === -1);
    const trisOf = (sx, sy) => { const T = new Float64Array(info.faces.length * 6); info.faces.forEach((f, q) => { for (let c3 = 0; c3 < 3; c3++) { const p = NU.get(ix.getX(f * 3 + c3)); T[q * 6 + c3 * 2] = (p[0] + sx) / k; T[q * 6 + c3 * 2 + 1] = (p[1] + sy) / k; } }); return T; };
    const M = HP._mask(trisOf(0, 0));
    let overlap = 0; for (let c2 = 0; c2 < M.cells.length; c2 += 2) { const x = M.x0 + M.cells[c2], y = M.y0 + M.cells[c2 + 1]; if (x >= 0 && y >= 0 && x < O.Wc && y < O.Hc && O.occ[y * O.Wc + x]) overlap++; }
    const RB = opts.bounds || {x0: 0, y0: 0, x1: W, y1: H}, bnd = HP._cellBounds(opts.bounds, k, O.Wc, O.Hc);
    const off = nx0 < RB.x0 - 1e-6 || ny0 < RB.y0 - 1e-6 || nx1 > RB.x1 + 1e-6 || ny1 > RB.y1 + 1e-6, turned = rot !== 0 || sc !== 1;
    let shift = [0, 0];
    if (off || overlap) {
      if (!turned) return Object.assign(res, {overlap: overlap * k * k, off, reason: off ? (opts.bounds ? "that would take it out of its part's texture" : "that would take it off the atlas") : "it would share " + overlap * k * k + " texels with another island there (painting one would paint both)"});
      if (M.mw + 2 > bnd.x1 - bnd.x0 || M.mh + 2 > bnd.y1 - bnd.y0) return Object.assign(res, {reason: "at that size it is bigger than the " + (opts.bounds ? "part's texture" : "atlas")});
      const spot = HP._findSpot(HP._grow(O.occ, O.Wc, O.Hc, 2), O.Wc, O.Hc, M.cells, M.mw, M.mh, [M.x0 + M.mw / 2, M.y0 + M.mh / 2], null, bnd);
      if (!spot) return Object.assign(res, {reason: "no free place in the atlas for it " + (sc > 1 ? "at that size" : "turned")});
      shift = [(spot.ox - M.x0) * k, (spot.oy - M.y0) * k];
      for (const p of NU.values()) { p[0] += shift[0]; p[1] += shift[1]; }
    }
    if (opts.dry) return Object.assign(res, {ok: true, slid: shift[0] || shift[1] ? shift : null});
    const before = new Float32Array(uv.array);
    const list = info.faces.map(f => { const o = [], n = []; for (let c3 = 0; c3 < 3; c3++) { const v = ix.getX(f * 3 + c3); o.push(uv.getX(v) * W, uv.getY(v) * H); n.push(...NU.get(v)); } return {o, n}; });
    const moved = HP._carryTexels(pc, list, opts.nearest || sc === 1);
    const caps = HP._carryPoints(mesh, list, verts, W, H);
    for (const [v, p] of NU) uv.setXY(v, p[0] / W, p[1] / H);
    uv.needsUpdate = true; HP._uvChanged(g);
    return Object.assign(res, {ok: true, before, texels: moved, caps, slid: shift[0] || shift[1] ? shift : null});
  };
  /** ▣ pack the atlas (n64ify's raster packer, in the page): every unit of every mesh under `root` at ONE
   *  texel density -- the largest at which all fit -- biggest first, each in its best quarter turn,
   *  first-fit on the grid with a `gap`-texel gutter and half a gutter from the border (the sampler wraps,
   *  so the border is a seam too); texels carried (bilinear, or whole texels with `nearest`), the caps
   *  follow, texels no island uses take the atlas's mean colour. opts: {gap, nearest, dry}.
   *  Returns {ok, units, density: texels per metre, before: texels per metre, coverage, befores}. */
  HP.packAtlas = function (root, pc, opts) {
    opts = opts || {};
    // a multi-part model packs one part at a time: opts.only (its meshes) inside opts.bounds (its region, texels);
    // 🎨 parts packs a part's islands out of the OLD atlas (opts.src, the canvas its UVs still point into) at the
    // model's own density (opts.density, texels a metre: that or nothing, no search)
    const W = pc.can.width, H = pc.can.height, RB = opts.bounds || {x0: 0, y0: 0, x1: W, y1: H}, RW = RB.x1 - RB.x0, RH = RB.y1 - RB.y0;
    const src = opts.src, SW = src ? src.width : W, SH = src ? src.height : H;
    const k = HP._gridCell(RW, RH), gapC = Math.max(1, Math.round((opts.gap == null ? 2 : opts.gap) / k)), half = Math.ceil(gapC / 2), Wc = Math.floor(RW / k), Hc = Math.floor(RH / k);
    root.updateMatrixWorld(true);
    const units = [], meshes = [];
    root.traverse(nd => {
      if (!nd.isMesh || !nd.geometry.index || !nd.geometry.attributes.uv || (opts.only && !opts.only.has(nd))) return;
      meshes.push(nd);
      const g = nd.geometry, ix = g.index, uv = g.attributes.uv, un = HP.uvUnits(g), by = new Map();
      for (let t = 0; t < un.length; t++) if (un[t] !== -1) (by.get(un[t]) || by.set(un[t], []).get(un[t])).push(t);
      for (const faces of by.values()) {
        const d = HP._density(nd, faces, SW, SH); if (d.ua < 1e-9 || d.wa < 1e-12) continue;
        const sc = 1 / d.d, P = new Float64Array(faces.length * 6);                  // texels -> metres of surface
        faces.forEach((t, q) => { for (let c3 = 0; c3 < 3; c3++) { const v = ix.getX(t * 3 + c3); P[q * 6 + c3 * 2] = uv.getX(v) * SW * sc; P[q * 6 + c3 * 2 + 1] = uv.getY(v) * SH * sc; } });
        units.push({mesh: nd, faces, P, wa: d.wa, ua: d.ua});
      }
    });
    if (!units.length) return {ok: false, reason: "nothing with a texture area to pack"};
    units.sort((a, b) => b.wa - a.wa);
    const turned = (P, r) => { const out = new Float64Array(P.length); for (let i = 0; i < P.length; i += 2) { let x = P[i], y = P[i + 1]; for (let q = 0; q < r; q++) { const t2 = x; x = -y; y = t2; } out[i] = x; out[i + 1] = y; } let mx = Infinity, my = Infinity; for (let i = 0; i < out.length; i += 2) { mx = Math.min(mx, out[i]); my = Math.min(my, out[i + 1]); } for (let i = 0; i < out.length; i += 2) { out[i] -= mx; out[i + 1] -= my; } return out; };
    const T4 = units.map(u => [0, 1, 2, 3].map(r => turned(u.P, r)));
    const attempt = s => {                                   // s: texels per metre
      const occ = new Uint8Array(Wc * Hc), placed = [];
      for (let ui = 0; ui < units.length; ui++) {
        let best = null;
        for (let r = 0; r < 4; r++) {
          const T = T4[ui][r], tc = new Float64Array(T.length); for (let i = 0; i < T.length; i++) tc[i] = T[i] * s / k;
          const M = HP._mask(tc), fw = M.mw + 2 * gapC, fh = M.mh + 2 * gapC;
          if (M.mw + 2 * half > Wc || M.mh + 2 * half > Hc) continue;
          let foot = new Uint8Array(fw * fh); for (let c2 = 0; c2 < M.cells.length; c2 += 2) foot[(M.cells[c2 + 1] + gapC) * fw + M.cells[c2] + gapC] = 1;
          foot = HP._grow(foot, fw, fh, gapC);
          const fc = []; for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (foot[y * fw + x]) fc.push(x - gapC, y - gapC);
          search: for (let y = half; y <= Hc - M.mh - half; y++) {
            if (best && y > best.y) break;
            for (let x = half; x <= Wc - M.mw - half; x++) {
              if (best && y === best.y && x >= best.x) break;
              let hit = false; for (let c2 = 0; c2 < fc.length; c2 += 2) { const X = x + fc[c2], Y = y + fc[c2 + 1]; if (X >= 0 && Y >= 0 && X < Wc && Y < Hc && occ[Y * Wc + X]) { hit = true; break; } }
              if (!hit) { best = {x, y, r, M, tc}; break search; }
            }
          }
        }
        if (!best) return null;
        for (let c2 = 0; c2 < best.M.cells.length; c2 += 2) occ[(best.y + best.M.cells[c2 + 1]) * Wc + best.x + best.M.cells[c2]] = 1;
        placed.push(best);
      }
      let used = 0; for (let i = 0; i < occ.length; i++) used += occ[i];
      return {placed, used};
    };
    // the largest single density at which everything fits, by bisection; above the density at which the
    // longest piece alone spans the atlas nothing can fit
    let hi = Infinity; for (const T of T4) { let mx = 0; for (let i = 0; i < T[0].length; i++) mx = Math.max(mx, T[0][i]); hi = Math.min(hi, Math.max(RW, RH) / Math.max(1e-9, mx)); }
    let lo = 0, best = null;
    if (opts.density > 0) {                                  // that density or nothing
      const got = opts.density <= hi ? attempt(opts.density) : null;
      if (!got) return {ok: false, reason: "the pieces do not fit at " + opts.density.toFixed(1) + " texels a metre", tooSmall: true};
      best = {s: opts.density, got};
    } else for (let it = 0; it < 16; it++) { const mid = (lo + hi) / 2, got = attempt(mid); if (got) { lo = mid; best = {s: mid, got}; } else hi = mid; }
    if (!best) return {ok: false, reason: "the pieces do not fit in the atlas at any size (too many for its grid)"};
    let oldUa = 0, oldWa = 0; for (const u of units) { oldUa += u.ua; oldWa += u.wa; }
    const res = {ok: true, units: units.length, density: best.s, densityBefore: Math.sqrt(oldUa / oldWa), worldArea: oldWa, coverage: best.got.used * k * k / (RW * RH)};
    if (opts.dry) return res;
    const befores = meshes.map(m => ({mesh: m, before: new Float32Array(m.geometry.attributes.uv.array)}));
    const byMesh = new Map(), NUs = new Map();
    best.got.placed.forEach((pl, ui) => {
      const u = units[ui], ix = u.mesh.geometry.index, uv = u.mesh.geometry.attributes.uv, nu = NUs.get(u.mesh) || NUs.set(u.mesh, new Map()).get(u.mesh), list = byMesh.get(u.mesh) || byMesh.set(u.mesh, []).get(u.mesh);
      u.faces.forEach((t, q) => { const o = [], n = []; for (let c3 = 0; c3 < 3; c3++) { const v = ix.getX(t * 3 + c3), x = RB.x0 + (pl.x - pl.M.x0) * k + pl.tc[q * 6 + c3 * 2] * k, y = RB.y0 + (pl.y - pl.M.y0) * k + pl.tc[q * 6 + c3 * 2 + 1] * k; o.push(uv.getX(v) * SW, uv.getY(v) * SH); n.push(x, y); nu.set(v, [x, y]); } list.push({o, n}); });
    });
    // the mean colour the faces show (the texel under each one's middle), for the texels nothing will use
    const D = (src ? src.getContext("2d") : pc.ctx).getImageData(0, 0, SW, SH).data, m = [0, 0, 0]; let mn = 0;
    for (const list of byMesh.values()) for (const {o} of list) { const X = Math.min(SW - 1, Math.max(0, Math.floor((o[0] + o[2] + o[4]) / 3))), Y = Math.min(SH - 1, Math.max(0, Math.floor((o[1] + o[3] + o[5]) / 3))), i = (Y * SW + X) * 4; m[0] += D[i]; m[1] += D[i + 1]; m[2] += D[i + 2]; mn++; }
    res.texels = HP._carryTexels(pc, [].concat(...byMesh.values()), opts.nearest, {fill: m.map(v => Math.round(v / mn)), fillRect: RB, src});
    res.caps = 0;
    for (const [mesh, nu] of NUs) { res.caps += HP._carryPoints(mesh, byMesh.get(mesh), new Set(nu.keys()), W, H, SW, SH); const uv = mesh.geometry.attributes.uv; for (const [v, p] of nu) uv.setXY(v, p[0] / W, p[1] / H); uv.needsUpdate = true; HP._uvChanged(mesh.geometry); }
    res.befores = befores;
    return res;
  };
  // ---- 🧵 cut a seam (plans/atlas-editor phase 4, 2026-09-27) ----
  /** Append copies of vertices `src` to a geometry: every attribute and morph attribute (positions,
   *  normals, UVs, the mask's colours, skin indices and weights -- raw values, interleaved or not); an
   *  index array too small for the new count becomes 32-bit. Returns what HP._restoreGeometry needs to
   *  undo it. The file gets the same copies from glbtexture.split_vertices when the page saves. */
  HP._growGeometry = function (g, src) {
    const n0 = g.attributes.position.count, n = src.length, rec = {attrs: {}, morph: {}, index: g.index, n0};
    const grow = a => {
      const k = a.itemSize, isI = a.isInterleavedBufferAttribute, A = isI ? a.data.array : a.array, out = new A.constructor((n0 + n) * k);
      const raw = (i, c) => isI ? A[i * a.data.stride + a.offset + c] : A[i * k + c];
      if (isI) { for (let i = 0; i < n0; i++) for (let c = 0; c < k; c++) out[i * k + c] = raw(i, c); } else out.set(A.subarray(0, n0 * k));
      for (let j = 0; j < n; j++) for (let c = 0; c < k; c++) out[(n0 + j) * k + c] = raw(src[j], c);
      return new THREE.BufferAttribute(out, k, a.normalized);
    };
    for (const name of Object.keys(g.attributes)) { rec.attrs[name] = g.attributes[name]; g.setAttribute(name, grow(g.attributes[name])); }
    for (const name of Object.keys(g.morphAttributes || {})) { rec.morph[name] = g.morphAttributes[name]; g.morphAttributes[name] = g.morphAttributes[name].map(grow); }
    if (g.index) {
      const I = g.index.array, big = n0 + n - 1 > (I instanceof Uint16Array ? 0xFFFF : I instanceof Uint8Array ? 0xFF : 0xFFFFFFFF);
      g.setIndex(new THREE.BufferAttribute(big ? Uint32Array.from(I) : I.slice(), 1));
    }
    HP._uvChanged(g); g.dispose();                           // the renderer re-uploads; its morph texture is keyed by the target count, not the vertices
    return rec;
  };
  HP._restoreGeometry = function (g, rec) {
    for (const name of Object.keys(g.attributes)) if (!rec.attrs[name]) g.deleteAttribute(name);
    for (const name of Object.keys(rec.attrs)) g.setAttribute(name, rec.attrs[name]);
    for (const name of Object.keys(rec.morph)) g.morphAttributes[name] = rec.morph[name];
    if (rec.index) g.setIndex(rec.index);
    HP._uvChanged(g); g.dispose();
  };
  /** The edge of `faceIndex` nearest `pointWorld`, judged for 🧵 cut: {ok, key, a, b, edge, island,
   *  reason}. Only an edge INSIDE one UV island (both faces use the same UVs along it) can be cut: a seam
   *  is one already, an open edge has nothing on the other side. `key` names it by its two positions. */
  HP.cutEdgeAt = function (mesh, faceIndex, pointWorld) {
    const g = mesh.geometry; if (!g.index || !g.attributes.uv) return {ok: false, reason: "this mesh has no triangle index or no UVs"};
    const M = HP._meshAccess(mesh, 1, 1), {a, b, edge} = HP._nearestEdge(mesh, faceIndex, pointWorld), ka = M.kp(a), kb = M.kp(b);
    const key = ka < kb ? ka + "|" + kb : kb + "|" + ka, res = {ok: false, key, a, b, edge, island: HP.uvIslands(g)[faceIndex]};
    let o = -1; const tw = HP._twins(g); for (let t = 0; t < M.nf; t++) { if (t === faceIndex || tw[t] === tw[faceIndex]) continue; const w = M.fv(t); if (w.some(x => M.kp(x) === ka) && w.some(x => M.kp(x) === kb)) { o = t; break; } }
    if (o < 0) return Object.assign(res, {reason: "an open edge: nothing on the other side to cut from"});
    const ow = M.fv(o), oa = ow.find(x => M.kp(x) === ka), ob = ow.find(x => M.kp(x) === kb);
    if (!(M.uvEq(oa, a) && M.uvEq(ob, b))) return Object.assign(res, {reason: "already a UV seam (amber): the two sides take their colour from different places"});
    return Object.assign(res, {ok: true});
  };
  /** The shortest run of cuttable edges (inside `island`, by length on the surface) from either end of
   *  `fromKeys` (position keys) to either end of edge `to` ({a, b} vertex indices): the keys of its edges,
   *  `to` last, or null when nothing joins them. For marking a cut with two clicks instead of twenty. */
  HP.cutPath = function (mesh, island, fromKeys, to) {
    const g = mesh.geometry, M = HP._meshAccess(mesh, 1, 1), isl = HP.uvIslands(g), pos = g.attributes.position;
    const edges = new Map(), tw = HP._twins(g);              // key -> [{t, i, j}]; one face of each duplicate set
    for (let t = 0; t < M.nf; t++) { if (isl[t] !== island || tw[t] !== t) continue; const w = M.fv(t); for (let q = 0; q < 3; q++) { const i = w[q], j = w[(q + 1) % 3], ki = M.kp(i), kj = M.kp(j), key = ki < kj ? ki + "|" + kj : kj + "|" + ki; (edges.get(key) || edges.set(key, []).get(key)).push({t, i, j}); } }
    const adj = new Map(), P = new Map();
    for (const [key, L] of edges) {
      if (L.length !== 2) continue;
      const [e1, e2] = L, m1 = M.kp(e2.i) === M.kp(e1.i) ? e2.i : e2.j, m2 = m1 === e2.i ? e2.j : e2.i;
      if (!(M.uvEq(e1.i, m1) && M.uvEq(e1.j, m2))) continue;   // a seam inside the island's faces: not cuttable
      const ka = M.kp(e1.i), kb = M.kp(e1.j), w = new THREE.Vector3().fromBufferAttribute(pos, e1.i).distanceTo(new THREE.Vector3().fromBufferAttribute(pos, e1.j));
      (adj.get(ka) || adj.set(ka, []).get(ka)).push([kb, w, key]); (adj.get(kb) || adj.set(kb, []).get(kb)).push([ka, w, key]);
    }
    const goal = new Set([M.kp(to.a), M.kp(to.b)]), dist = new Map(), prev = new Map(), open = [];
    for (const k of fromKeys) if (adj.has(k)) { dist.set(k, 0); open.push([0, k]); }
    let hit = null;
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [d, k] = open.splice(bi, 1)[0]; if (d > dist.get(k)) continue;
      if (goal.has(k)) { hit = k; break; }
      for (const [k2, w, key] of adj.get(k) || []) { const nd = d + w; if (!dist.has(k2) || nd < dist.get(k2)) { dist.set(k2, nd); prev.set(k2, [k, key]); open.push([nd, k2]); } }
    }
    if (!hit) return null;
    const out = []; for (let k = hit; prev.has(k); k = prev.get(k)[0]) out.unshift(prev.get(k)[1]);
    const kt = M.kp(to.a) < M.kp(to.b) ? M.kp(to.a) + "|" + M.kp(to.b) : M.kp(to.b) + "|" + M.kp(to.a);
    if (!out.includes(kt)) out.push(kt);
    return out;
  };
  /** 🧵 cut: the marked edges (`keys`, position pairs, all cuttable) become a UV seam. At each vertex on
   *  the cut, the faces around it that still join without crossing the cut stay on it; every other such
   *  group gets a COPY of the vertex (HP._growGeometry: all its attributes). The piece or pieces are then
   *  laid out again (HP._relayChart: flattened, near where they were, density kept, paint carried, caps
   *  along). Refused, with the reason, for a cut that opens nothing (it stops inside the island at both
   *  ends: the surface stays joined round the ends) and for whatever _relayChart refuses -- the mesh is
   *  then as it was. Returns {ok, pieces, added, src, rec (for HP.cutUndo), shearBefore, shearAfter}. */
  /** At every vertex on a cut (`keys`: edge keys by position): the groups of faces (originals: a duplicate
   *  follows its original) still joined round it without crossing the cut -- two or more, and the cut opens there. */
  HP._cutGroups = function (M, keys, faces, tw) {
    const cutV = new Set(); for (const k of keys) { const [a, b] = k.split("|"); cutV.add(a); cutV.add(b); }
    const around = new Map();                                // position key -> [[t, corner]]
    for (const t of faces) { if (tw[t] !== t) continue; const w = M.fv(t); for (let q = 0; q < 3; q++) { const kp = M.kp(w[q]); if (cutV.has(kp)) (around.get(kp) || around.set(kp, []).get(kp)).push([t, q]); } }
    const out = [];
    for (const [kp, list] of around) {
      const par = list.map((_, i) => i), find = i => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; };
      const byOther = new Map();                             // the other end of each edge through this vertex
      list.forEach(([t, q], li) => { const w = M.fv(t); for (const r of [(q + 1) % 3, (q + 2) % 3]) { const ko = M.kp(w[r]); (byOther.get(ko) || byOther.set(ko, []).get(ko)).push([li, w[q], w[r]]); } });
      for (const [ko, L] of byOther) {
        if (L.length !== 2 || keys.has(kp < ko ? kp + "|" + ko : ko + "|" + kp)) continue;
        const [[l1, v1, o1], [l2, v2, o2]] = L;
        if (M.uvEq(v1, v2) && M.uvEq(o1, o2)) { const a = find(l1), b = find(l2); if (a !== b) par[a] = b; }
      }
      const groups = new Map(); list.forEach((_, li) => { const r = find(li); (groups.get(r) || groups.set(r, []).get(r)).push(li); });
      out.push({kp, list, groups: [...groups.values()]});
    }
    return out;
  };
  HP.cutSeam = function (mesh, keys, pc, opts) {
    opts = opts || {};
    const g = mesh.geometry; if (!g.index || !g.attributes.uv) return {ok: false, reason: "this mesh has no triangle index or no UVs"};
    const W = pc.can.width, H = pc.can.height, M = HP._meshAccess(mesh, W, H), isl = HP.uvIslands(g), res = {ok: false};
    let KP = M.kp;                                           // positions: re-read once the copies exist (a copy past the old array read NaN, and every copy shared one key)
    const ek = (i, j) => { const ki = KP(i), kj = KP(j); return ki < kj ? ki + "|" + kj : kj + "|" + ki; };
    // the islands the cut runs through, and the faces there
    const touched = new Set(); for (let t = 0; t < M.nf; t++) { const w = M.fv(t); for (let q = 0; q < 3; q++) if (keys.has(ek(w[q], w[(q + 1) % 3]))) touched.add(isl[t]); }
    const faces = []; for (let t = 0; t < M.nf; t++) if (touched.has(isl[t])) faces.push(t);
    if (!faces.length) return Object.assign(res, {reason: "no marked edge on this mesh"});
    const shearBefore = HP.chartShear(mesh, faces.filter(t => M.uvA(t) > 1e-9), W, H);
    const tw = HP._twins(g), twinsOf = new Map(); for (const t of faces) if (tw[t] !== t) (twinsOf.get(tw[t]) || twinsOf.set(tw[t], []).get(tw[t])).push(t);
    const src = [], reassign = [], tag = new Map();         // [t, corner, new vertex]; tag: which side of the cut a copy is on
    let next = g.attributes.position.count;
    for (const {kp, list, groups} of HP._cutGroups(M, keys, faces, tw)) {
      if (groups.length < 2) continue;
      const order = groups.sort((A, B) => Math.min(...A.map(li => list[li][0])) - Math.min(...B.map(li => list[li][0])));
      order.slice(1).forEach((grp, gi) => {
        const dup = new Map();                               // old vertex -> its copy, for this group
        const give = (t, q) => { const v = M.fv(t)[q]; if (!dup.has(v)) { dup.set(v, next); tag.set(next, gi + 1); next++; src.push(v); } reassign.push([t, q, dup.get(v)]); };
        for (const li of grp) { const [t, q] = list[li]; give(t, q); for (const d of twinsOf.get(t) || []) give(d, M.fv(d).findIndex(x => M.kp(x) === kp)); }
      });
    }
    if (!src.length) return Object.assign(res, {reason: "this cut opens nothing: it stops inside the island at both ends, so the surface stays joined round them — run it to the island's edge (or close a loop)"});
    const snap = pc.ctx.getImageData(0, 0, W, H);
    const rec = HP._growGeometry(g, src), ix = g.index;
    for (const [t, q, v] of reassign) ix.setX(t * 3 + q, v);
    ix.needsUpdate = true; HP._uvChanged(g);
    // the pieces: faces joined across edges that are not cut (UVs still equal there, copies included)
    const M2 = HP._meshAccess(mesh, W, H); KP = M2.kp;
    const fpar = new Map(faces.map(t => [t, t])), ffind = t => { while (fpar.get(t) !== t) t = fpar.get(t); return t; };
    const em = new Map(); for (const t of faces) { if (tw[t] !== t) { const a = ffind(t), b = ffind(tw[t]); if (a !== b) fpar.set(a, b); continue; } const w = M2.fv(t); for (let q = 0; q < 3; q++) { const i = w[q], j = w[(q + 1) % 3], k = ek(i, j); if (keys.has(k)) continue; const o = em.get(k); if (!o) { em.set(k, [t, i, j]); continue; }
      const [t2, i2, j2] = o, m1 = M2.kp(i2) === M2.kp(i) ? i2 : j2, m2 = m1 === i2 ? j2 : i2; if (M2.uvEq(i, m1) && M2.uvEq(j, m2)) { const a = ffind(t), b = ffind(t2); if (a !== b) fpar.set(a, b); } } }
    const pieces = new Map(); for (const t of faces) if (M2.uvA(t) > 1e-9) { const r = ffind(t); (pieces.get(r) || pieces.set(r, []).get(r)).push(t); }
    const weld = (t1, t2, i1, i2, j1, j2) => M2.uvEq(i1, i2) && M2.uvEq(j1, j2) && !keys.has(ek(i1, j1));
    for (const chart of pieces.values()) {
      let cx = 0, cy = 0, cw = 0; for (const t of chart) { const q = M2.fv(t), A = M2.uvA(t); cx += A * (M2.uv.getX(q[0]) + M2.uv.getX(q[1]) + M2.uv.getX(q[2])) / 3 * W; cy += A * (M2.uv.getY(q[0]) + M2.uv.getY(q[1]) + M2.uv.getY(q[2])) / 3 * H; cw += A; }
      const r = HP._relayChart(mesh, chart, weld, pc, {root: opts.root, nearest: opts.nearest, prefer: [cx / cw, cy / cw], tag, bounds: opts.bounds}, {});
      if (!r.ok) { HP._restoreGeometry(g, rec); pc.ctx.putImageData(snap, 0, 0); return Object.assign(res, {reason: r.reason, detail: {sharedBy: r.sharedBy, vertex: r.vertex, pieces: [...pieces.values()].map(c => c.length)}}); }
    }
    return Object.assign(res, {ok: true, pieces: pieces.size, added: src.length, src, rec, shearBefore, shearAfter: HP.chartShear(mesh, faces.filter(t => HP._meshAccess(mesh, W, H).uvA(t) > 1e-9), W, H)});
  };
  HP.cutUndo = function (mesh, rec) { HP._restoreGeometry(mesh.geometry, rec); };
  // ---- 🧲 pull: move vertices with a soft falloff (plans/atlas-editor phase 6a, 2026-09-27) ----
  /** The falloff: 1 at the grab point, 0 at the radius (t = distance / radius). smooth = (1 - t²)², Blender's
   *  proportional editing's "smooth"; linear; sharp = (1 - t)³. */
  HP.falloff = (t, kind) => t >= 1 ? 0 : kind === "linear" ? 1 - t : kind === "sharp" ? (1 - t) ** 3 : (1 - t * t) ** 2;
  /** Begin a pull: every vertex of `mesh` within `radius` (world units) of `centerWorld` with its weight -- by
   *  POSITION, so vertices at one place (UV seams, normal splits, duplicate faces, a cap's ring) move together
   *  -- and, with opts.mirror, the ones near the mirror image of the centre across the mesh's own x = 0 (their
   *  weight moves them by the delta mirrored in x). opts: {falloff, mirror}. */
  HP.pullBegin = function (mesh, centerWorld, radius, opts) {
    opts = opts || {};
    const g = mesh.geometry, pos = g.attributes.position; mesh.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(mesh.matrixWorld).invert(), c = centerWorld.clone().applyMatrix4(inv);
    const sc = new THREE.Vector3().setFromMatrixScale(mesh.matrixWorld), rl = radius / Math.max(1e-12, (Math.abs(sc.x) + Math.abs(sc.y) + Math.abs(sc.z)) / 3);
    const idx = [], w = [], wm = [], v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const a = HP.falloff(v.distanceTo(c) / rl, opts.falloff), b = opts.mirror ? HP.falloff(Math.hypot(v.x + c.x, v.y - c.y, v.z - c.z) / rl, opts.falloff) : 0;
      if (a > 0 || b > 0) { idx.push(i); w.push(a); wm.push(b); }
    }
    const rest = new Float32Array(idx.length * 3); idx.forEach((i, k) => { rest[k * 3] = pos.getX(i); rest[k * 3 + 1] = pos.getY(i); rest[k * 3 + 2] = pos.getZ(i); });
    return {mesh, idx, w, wm, rest, lin: new THREE.Matrix3().setFromMatrix4(inv), moved: false};
  };
  /** Move the pull's vertices by `deltaWorld` from where they STARTED (call it on every pointer move: nothing
   *  accumulates); the mirrored side by the delta mirrored in x. */
  HP.pullTo = function (P, deltaWorld) {
    const pos = P.mesh.geometry.attributes.position, d = deltaWorld.clone().applyMatrix3(P.lin);
    for (let k = 0; k < P.idx.length; k++) {
      const a = P.w[k], b = P.wm[k];
      pos.setXYZ(P.idx[k], P.rest[k * 3] + a * d.x - b * d.x, P.rest[k * 3 + 1] + (a + b) * d.y, P.rest[k * 3 + 2] + (a + b) * d.z);
    }
    pos.needsUpdate = true; P.moved = d.lengthSq() > 0;
  };
  /** Recompute the normals of every vertex whose faces touch a vertex of `moved` -- area-weighted over the faces of
   *  its SMOOTHING GROUP (the vertices at its position whose normals agreed within 45 degrees before, so a flat-shaded
   *  cap or a hard edge keeps its crease); every other normal stays as it was. Returns {nIdx, nrm: the normals before}. */
  HP._renormal = function (mesh, moved) {
    const g = mesh.geometry, pos = g.attributes.position, nrm = g.attributes.normal, ix = g.index;
    if (!nrm || !ix) return {nIdx: [], nrm: new Float32Array(0)};
    const nf = ix.count / 3, touched = new Set(), faceOf = new Map();
    for (let t = 0; t < nf; t++) { const q = [ix.getX(t * 3), ix.getX(t * 3 + 1), ix.getX(t * 3 + 2)]; for (const v of q) (faceOf.get(v) || faceOf.set(v, []).get(v)).push(t); if (q.some(v => moved.has(v))) q.forEach(v => touched.add(v)); }
    const kp = i => Math.round(pos.getX(i) * 1e5) + "," + Math.round(pos.getY(i) * 1e5) + "," + Math.round(pos.getZ(i) * 1e5);
    const byPos = new Map(); for (let i = 0; i < pos.count; i++) { const k = kp(i); (byPos.get(k) || byPos.set(k, []).get(k)).push(i); }
    const old = new Float32Array(nrm.count * 3); for (let i = 0; i < nrm.count; i++) { old[i * 3] = nrm.getX(i); old[i * 3 + 1] = nrm.getY(i); old[i * 3 + 2] = nrm.getZ(i); }
    const fn = new Map(), V3 = THREE.Vector3, A = new V3(), B = new V3(), C = new V3();
    const faceN = t => { if (!fn.has(t)) { A.fromBufferAttribute(pos, ix.getX(t * 3)); B.fromBufferAttribute(pos, ix.getX(t * 3 + 1)); C.fromBufferAttribute(pos, ix.getX(t * 3 + 2)); fn.set(t, B.clone().sub(A).cross(C.clone().sub(A))); } return fn.get(t); };
    const nIdx = [...touched], before = new Float32Array(nIdx.length * 3);
    nIdx.forEach((i, k) => {
      before[k * 3] = old[i * 3]; before[k * 3 + 1] = old[i * 3 + 1]; before[k * 3 + 2] = old[i * 3 + 2];
      const sum = new V3(), seen = new Set();
      for (const j of byPos.get(kp(i)) || [i]) {
        if (old[i * 3] * old[j * 3] + old[i * 3 + 1] * old[j * 3 + 1] + old[i * 3 + 2] * old[j * 3 + 2] < 0.707) continue;   // another smoothing group
        for (const t of faceOf.get(j) || []) if (!seen.has(t)) { seen.add(t); sum.add(faceN(t)); }
      }
      if (sum.lengthSq() > 1e-20) { sum.normalize(); nrm.setXYZ(i, sum.x, sum.y, sum.z); }
    });
    nrm.needsUpdate = true;
    return {nIdx, nrm: before};
  };
  /** End a pull: the normals of every vertex whose faces changed are recomputed -- area-weighted over the faces
   *  of its SMOOTHING GROUP (the vertices at its position whose normals agreed within 45 degrees before, so a
   *  flat-shaded cap or a hard edge keeps its crease); every other normal stays as it was. The bounding volumes
   *  follow (raycasts). Returns {idx, pos: positions before, nIdx, nrm: normals before} for HP.pullRestore and
   *  the save, or null when nothing moved. */
  HP.pullEnd = function (P) {
    const g = P.mesh.geometry, pos = g.attributes.position, nrm = g.attributes.normal, ix = g.index;
    if (!P.moved || !P.idx.length) { if (P.idx.length) HP.pullRestore(P.mesh, {idx: P.idx, pos: P.rest, nIdx: [], nrm: new Float32Array(0)}); return null; }
    const rec = {idx: P.idx.slice(), pos: P.rest.slice(), nIdx: [], nrm: new Float32Array(0)};
    const rn = HP._renormal(P.mesh, new Set(P.idx)); rec.nIdx = rn.nIdx; rec.nrm = rn.nrm;
    g.computeBoundingSphere(); g.computeBoundingBox(); HP._uvChanged(g);
    return rec;
  };
  /** Undo a pull: the positions and normals it changed go back. */
  HP.pullRestore = function (mesh, rec) {
    const g = mesh.geometry, pos = g.attributes.position, nrm = g.attributes.normal;
    rec.idx.forEach((i, k) => pos.setXYZ(i, rec.pos[k * 3], rec.pos[k * 3 + 1], rec.pos[k * 3 + 2])); pos.needsUpdate = true;
    if (nrm) { rec.nIdx.forEach((i, k) => nrm.setXYZ(i, rec.nrm[k * 3], rec.nrm[k * 3 + 1], rec.nrm[k * 3 + 2])); nrm.needsUpdate = true; }
    g.computeBoundingSphere(); g.computeBoundingBox(); HP._uvChanged(g);
  };
  // ---- ⊹ points: pick vertices and move them (plans/atlas-editor phase 6e, 2026-09-27) ----
  /** The mesh's POINTS: the vertices at one position are one point (a UV seam's copies, split normals, the N64 rigs'
   *  joint-overlap copies move together, as 🧲 pull moves them). {n, verts: [[vertex, ...] per point], of: Int32Array
   *  (vertex -> point), nbr: [Set of the points each shares an edge with], live: Uint8Array (1 = a face uses it; a
   *  🗑 deleted face's corners stay in the mesh, unused)}. Cached until the geometry changes (HP._uvChanged). */
  HP.meshPoints = function (mesh) {
    const g = mesh.geometry, pos = g.attributes.position, ix = g.index;
    if (g.userData._points && g.userData._points.count === pos.count) return g.userData._points;
    const kp = i => Math.round(pos.getX(i) * 1e5) + "," + Math.round(pos.getY(i) * 1e5) + "," + Math.round(pos.getZ(i) * 1e5);
    const byKey = new Map(), verts = [], of = new Int32Array(pos.count);
    for (let i = 0; i < pos.count; i++) { const k = kp(i); let q = byKey.get(k); if (q === undefined) { q = verts.length; byKey.set(k, q); verts.push([]); } verts[q].push(i); of[i] = q; }
    const nbr = verts.map(() => new Set()), live = new Uint8Array(verts.length);
    const nf = ix ? ix.count / 3 : pos.count / 3, at = i => ix ? ix.getX(i) : i;
    for (let t = 0; t < nf; t++) for (let k = 0; k < 3; k++) { const a = of[at(t * 3 + k)], b = of[at(t * 3 + (k + 1) % 3)]; live[a] = 1; if (a !== b) { nbr[a].add(b); nbr[b].add(a); } }
    return (g.userData._points = {n: verts.length, count: pos.count, verts, of, nbr, live});
  };
  /** A 🧲 pull of exactly these points (every vertex of each at weight 1): move it with HP.pullTo, end it with HP.pullEnd
   *  (the normals, the undo record, the save's sparse positions -- the pull's own path). */
  HP.pointsBegin = function (mesh, points) {
    const pt = HP.meshPoints(mesh), pos = mesh.geometry.attributes.position; mesh.updateMatrixWorld(true);
    const idx = []; for (const q of points) for (const v of pt.verts[q]) idx.push(v);
    const rest = new Float32Array(idx.length * 3); idx.forEach((i, k) => { rest[k * 3] = pos.getX(i); rest[k * 3 + 1] = pos.getY(i); rest[k * 3 + 2] = pos.getZ(i); });
    return {mesh, idx, w: idx.map(() => 1), wm: idx.map(() => 0), rest, lin: new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().copy(mesh.matrixWorld).invert()), moved: false};
  };
  /** ⌇ smooth: each picked point moves `k` of the way to the middle of the points it shares an edge with -- all from
   *  where they were (one step for every point at once, so the order does not matter): a spike's tip comes down to its
   *  ring. Returns the pull record (HP.pullRestore) or null when none has a neighbour. */
  HP.pointsSmooth = function (mesh, points, k) {
    const pt = HP.meshPoints(mesh), pos = mesh.geometry.attributes.position, V3 = THREE.Vector3;
    const at = q => new V3().fromBufferAttribute(pos, pt.verts[q][0]), to = [];
    for (const q of points) {
      const nb = [...pt.nbr[q]].filter(r => pt.live[r]); if (!nb.length) continue;
      const m = new V3(); nb.forEach(r => m.add(at(r))); m.divideScalar(nb.length);
      to.push([q, at(q).lerp(m, k == null ? 1 : k)]);
    }
    if (!to.length) return null;
    const P = HP.pointsBegin(mesh, to.map(e => e[0]));
    for (const [q, v] of to) for (const i of pt.verts[q]) pos.setXYZ(i, v.x, v.y, v.z);
    pos.needsUpdate = true; P.moved = true;
    return HP.pullEnd(P);
  };
  /** The loose pieces of a mesh (faces joined through shared positions): [{faces: [..], area (world m²)}], biggest first. */
  HP.loosePieces = function (mesh) {
    const g = mesh.geometry, ix = g.index, pos = g.attributes.position; if (!ix) return [];
    const pt = HP.meshPoints(mesh), nf = ix.count / 3, par = new Int32Array(pt.n).map((_, i) => i);
    const find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
    for (let t = 0; t < nf; t++) { const a = find(pt.of[ix.getX(t * 3)]); for (let k = 1; k < 3; k++) { const b = find(pt.of[ix.getX(t * 3 + k)]); if (a !== b) par[b] = a; } }
    mesh.updateMatrixWorld(true);
    const V3 = THREE.Vector3, A = new V3(), B = new V3(), C = new V3(), by = new Map();
    for (let t = 0; t < nf; t++) {
      const r = find(pt.of[ix.getX(t * 3)]); let e = by.get(r); if (!e) by.set(r, e = {faces: [], area: 0});
      A.fromBufferAttribute(pos, ix.getX(t * 3)).applyMatrix4(mesh.matrixWorld); B.fromBufferAttribute(pos, ix.getX(t * 3 + 1)).applyMatrix4(mesh.matrixWorld); C.fromBufferAttribute(pos, ix.getX(t * 3 + 2)).applyMatrix4(mesh.matrixWorld);
      e.faces.push(t); e.area += B.sub(A).cross(C.sub(A)).length() / 2;
    }
    return [...by.values()].sort((a, b) => b.faces.length - a.faces.length || b.area - a.area);
  };
  // ---- 🗑 delete faces (plans/atlas-editor phase 6b, 2026-09-27) ----
  /** The faces joined to `faceIndex` through shared corners (by position, so a UV seam or a split normal does not
   *  part them): a loose piece -- a stray bit, an inner shell -- in one click (Blender's L). Returns a Set. */
  HP.linkedFaces = function (mesh, faceIndex) {
    const g = mesh.geometry, ix = g.index, pos = g.attributes.position; if (!ix) return new Set([faceIndex]);
    const kp = i => Math.round(pos.getX(i) * 1e5) + "," + Math.round(pos.getY(i) * 1e5) + "," + Math.round(pos.getZ(i) * 1e5);
    const byKey = new Map(), nf = ix.count / 3;
    for (let t = 0; t < nf; t++) for (let k = 0; k < 3; k++) { const key = kp(ix.getX(t * 3 + k)); (byKey.get(key) || byKey.set(key, []).get(key)).push(t); }
    const out = new Set([faceIndex]), stack = [faceIndex];
    while (stack.length) { const t = stack.pop(); for (let k = 0; k < 3; k++) for (const u of byKey.get(kp(ix.getX(t * 3 + k))) || []) if (!out.has(u)) { out.add(u); stack.push(u); } }
    return out;
  };
  // ---- 🎨 parts: a texture per part (plans/atlas-editor 5b-2, 2026-09-27) ----
  /** Parts suggested for a mesh's faces: by = "bone" (the joint weighing most on each face; a skinned mesh) or
   *  "piece" (loose pieces: faces joined through shared positions). A part under opts.min of the faces (2%, at
   *  least 4) joins the part it shares the most edges with (or the biggest, when it touches none), so a stray
   *  triangle does not become a texture. Returns {parts: Int32Array (the part of each face, 0 = the biggest),
   *  n, why} -- why says what was not possible ("no skin"). */
  HP._comp = (a, i, c) => c === 0 ? a.getX(i) : c === 1 ? a.getY(i) : c === 2 ? a.getZ(i) : a.getW(i);   // this three has no getComponent
  HP.partsSuggest = function (mesh, by, opts) {
    opts = opts || {};
    const g = mesh.geometry, ix = g.index, pos = g.attributes.position; if (!ix) return {parts: null, n: 0, why: "this mesh has no triangle index"};
    const nf = ix.count / 3, lab = new Int32Array(nf).fill(-1);
    const kp = i => Math.round(pos.getX(i) * 1e5) + "," + Math.round(pos.getY(i) * 1e5) + "," + Math.round(pos.getZ(i) * 1e5);
    if (by === "bone") {
      const si = g.attributes.skinIndex, sw = g.attributes.skinWeight; if (!si || !sw) return {parts: null, n: 0, why: "this mesh has no skin: suggest by piece, or pick the parts by hand"};
      for (let t = 0; t < nf; t++) { const w = new Map();
        for (let k = 0; k < 3; k++) { const v = ix.getX(t * 3 + k); for (let c = 0; c < si.itemSize; c++) { const j = HP._comp(si, v, c), x = HP._comp(sw, v, c); if (x > 0) w.set(j, (w.get(j) || 0) + x); } }
        let bj = 0, bx = -1; for (const [j, x] of w) if (x > bx || (x === bx && j < bj)) { bj = j; bx = x; } lab[t] = bj; }
    } else {
      const byKey = new Map(); for (let t = 0; t < nf; t++) for (let k = 0; k < 3; k++) { const key = kp(ix.getX(t * 3 + k)); (byKey.get(key) || byKey.set(key, []).get(key)).push(t); }
      let n = 0; for (let t0 = 0; t0 < nf; t0++) { if (lab[t0] !== -1) continue; lab[t0] = n; const st = [t0];
        while (st.length) { const t = st.pop(); for (let k = 0; k < 3; k++) for (const u of byKey.get(kp(ix.getX(t * 3 + k))) || []) if (lab[u] === -1) { lab[u] = n; st.push(u); } } n++; }
    }
    // edges between labels, by position, for the merge of small parts
    const em = new Map(); for (let t = 0; t < nf; t++) for (let k = 0; k < 3; k++) { const a = kp(ix.getX(t * 3 + k)), b = kp(ix.getX(t * 3 + (k + 1) % 3)), key = a < b ? a + "|" + b : b + "|" + a; (em.get(key) || em.set(key, []).get(key)).push(t); }
    const minF = Math.max(4, Math.ceil(nf * (opts.min == null ? 0.02 : opts.min)));
    for (;;) {
      const size = new Map(); for (let t = 0; t < nf; t++) size.set(lab[t], (size.get(lab[t]) || 0) + 1);
      if (size.size < 2) break;
      const small = [...size].filter(([, c]) => c < minF).sort((a, b) => a[1] - b[1] || a[0] - b[0])[0]; if (!small) break;
      const L = small[0], touch = new Map();
      for (const faces of em.values()) { const ls = new Set(faces.map(t => lab[t])); if (!ls.has(L)) continue; for (const o of ls) if (o !== L) touch.set(o, (touch.get(o) || 0) + 1); }
      let into = null, bc = -1; for (const [o, c] of touch) if (c > bc || (c === bc && size.get(o) > size.get(into))) { into = o; bc = c; }
      if (into === null) into = [...size].filter(([l]) => l !== L).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
      for (let t = 0; t < nf; t++) if (lab[t] === L) lab[t] = into;
    }
    const size = new Map(); for (let t = 0; t < nf; t++) size.set(lab[t], (size.get(lab[t]) || 0) + 1);
    const order = [...size].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([l]) => l), num = new Map(order.map((l, i) => [l, i]));
    const parts = new Int32Array(nf); for (let t = 0; t < nf; t++) parts[t] = num.get(lab[t]);
    return {parts, n: order.length, why: order.length < 2 ? (by === "bone" ? "one bone holds the whole mesh" : "the mesh is one piece") + ": pick the parts by hand" : ""};
  };
  /** The geometry of each part: `parts` = the part of each face (0..n-1). Part k gets the triangles of its faces in
   *  their order and the vertices they use in THEIR order (a vertex on a border between parts goes into each), with
   *  every attribute and morph attribute (interleaved or not) -- the layout glbtexture.split_parts writes, so the
   *  page's part meshes ARE the file's primitives once saved. Returns [{geometry, faces, verts}] (Int32Arrays: the
   *  old face / vertex index of each). */
  HP.splitGeometry = function (g, parts, n) {
    const ix = g.index, nf = ix.count / 3, nv = g.attributes.position.count, out = [];
    const rows = (a, verts) => {
      const k = a.itemSize, isI = a.isInterleavedBufferAttribute, A = isI ? a.data.array : a.array, o = new A.constructor(verts.length * k);
      for (let j = 0; j < verts.length; j++) for (let c = 0; c < k; c++) o[j * k + c] = isI ? A[verts[j] * a.data.stride + a.offset + c] : A[verts[j] * k + c];
      return new THREE.BufferAttribute(o, k, a.normalized);
    };
    for (let p = 0; p < n; p++) {
      const faces = [], mark = new Uint8Array(nv);
      for (let t = 0; t < nf; t++) if (parts[t] === p) { faces.push(t); for (let c = 0; c < 3; c++) mark[ix.getX(t * 3 + c)] = 1; }
      const verts = [], remap = new Int32Array(nv).fill(-1);
      for (let v = 0; v < nv; v++) if (mark[v]) { remap[v] = verts.length; verts.push(v); }
      const ng = new THREE.BufferGeometry();
      for (const name of Object.keys(g.attributes)) ng.setAttribute(name, rows(g.attributes[name], verts));
      for (const name of Object.keys(g.morphAttributes || {})) ng.morphAttributes[name] = g.morphAttributes[name].map(a => rows(a, verts));
      ng.morphTargetsRelative = g.morphTargetsRelative;
      const I = verts.length > 0xFFFF ? new Uint32Array(faces.length * 3) : new Uint16Array(faces.length * 3);
      faces.forEach((t, q) => { for (let c = 0; c < 3; c++) I[q * 3 + c] = remap[ix.getX(t * 3 + c)]; });
      ng.setIndex(new THREE.BufferAttribute(I, 1));
      ng.computeBoundingBox(); ng.computeBoundingSphere();
      out.push({geometry: ng, faces: Int32Array.from(faces), verts: Int32Array.from(verts)});
    }
    return out;
  };
  /** Take `faces` (a Set of face indices) out of the mesh's triangle list; their vertices stay, unused (no vertex
   *  count changes, so every attribute, the rig and the atlas are untouched). Returns what HP.deleteRestore needs. */
  HP.deleteFaces = function (mesh, faces) {
    const g = mesh.geometry, ix = g.index; if (!ix || !faces.size) return null;
    const A = ix.array, keep = [];
    for (let t = 0; t < ix.count / 3; t++) if (!faces.has(t)) keep.push(A[t * 3], A[t * 3 + 1], A[t * 3 + 2]);
    if (!keep.length) return null;                           // a mesh with no triangles left is not an edit
    const rec = {index: ix, groups: g.groups.map(gr => Object.assign({}, gr))};
    g.setIndex(new THREE.BufferAttribute(new A.constructor(keep), 1));
    if (rec.groups.length) {                                  // draw groups (several materials) shrink by the faces taken from them
      let at = 0; g.clearGroups();
      for (const gr of rec.groups) { let n = 0; for (let t = gr.start / 3; t < (gr.start + gr.count) / 3; t++) if (!faces.has(t)) n++; g.addGroup(at, n * 3, gr.materialIndex); at += n * 3; }
    }
    HP._uvChanged(g); g.computeBoundingSphere(); g.computeBoundingBox();
    return rec;
  };
  HP.deleteRestore = function (mesh, rec) { const g = mesh.geometry; g.setIndex(rec.index); if (rec.groups.length) { g.clearGroups(); for (const gr of rec.groups) g.addGroup(gr.start, gr.count, gr.materialIndex); } HP._uvChanged(g); g.computeBoundingSphere(); g.computeBoundingBox(); };
  // ---- ⋈ collapse an edge (plans/atlas-editor phase 6c, 2026-09-27) ----
  /** The edge of `faceIndex` nearest `pointWorld`, collapsed: every vertex at either end (all copies: seams, split
   *  normals, the N64 joint overlap) moves to the middle; the faces along it (they would have no area) leave the
   *  triangle list; on each side of the edge the two corners' UVs meet at their middle, so the texture closes up
   *  instead of smearing. Refused, with the reason, when a remaining face would turn over (the surface would fold)
   *  or collapse to nothing, or for an edge of a lone triangle. opts.dry judges only. Returns {ok, edge, removed,
   *  rec (for HP.collapseRestore), reason}. The save needs `positions`, `uvs` and `indices`. */
  HP.collapseEdge = function (mesh, faceIndex, pointWorld, opts) {
    opts = opts || {};
    const g = mesh.geometry, ix = g.index, pos = g.attributes.position, uv = g.attributes.uv;
    if (!ix) return {ok: false, reason: "this mesh has no triangle index"};
    const {a, b, edge} = HP._nearestEdge(mesh, faceIndex, pointWorld), res = {ok: false, edge};
    const kp = i => Math.round(pos.getX(i) * 1e5) + "," + Math.round(pos.getY(i) * 1e5) + "," + Math.round(pos.getZ(i) * 1e5);
    const ka = kp(a), kb = kp(b), nf = ix.count / 3, fv = t => [ix.getX(t * 3), ix.getX(t * 3 + 1), ix.getX(t * 3 + 2)];
    const atA = new Set(), atB = new Set(); for (let i = 0; i < pos.count; i++) { const k = kp(i); if (k === ka) atA.add(i); else if (k === kb) atB.add(i); }
    const along = [], around = [];
    for (let t = 0; t < nf; t++) { const w = fv(t), hasA = w.some(x => atA.has(x)), hasB = w.some(x => atB.has(x)); if (hasA && hasB) along.push(t); else if (hasA || hasB) around.push(t); }
    if (along.length >= nf) return Object.assign(res, {reason: "nothing would be left"});
    const Pa = new THREE.Vector3().fromBufferAttribute(pos, a), Pb = new THREE.Vector3().fromBufferAttribute(pos, b), Mid = Pa.clone().add(Pb).multiplyScalar(0.5);
    // would a remaining face turn over, or collapse to nothing?
    const V = THREE.Vector3, at = (i, moved) => moved && (atA.has(i) || atB.has(i)) ? Mid.clone() : new V().fromBufferAttribute(pos, i);
    for (const t of around) {
      const w = fv(t), n0 = at(w[1], false).sub(at(w[0], false)).cross(at(w[2], false).sub(at(w[0], false))), n1 = at(w[1], true).sub(at(w[0], true)).cross(at(w[2], true).sub(at(w[0], true)));
      if (n1.lengthSq() < 1e-16 * Math.max(1e-12, n0.lengthSq())) return Object.assign(res, {reason: "a neighbouring face would collapse to nothing (the edge closes a gap it spans)"});
      if (n0.dot(n1) <= 0) return Object.assign(res, {reason: "a neighbouring face would turn over: the surface would fold"});
    }
    if (opts.dry) return Object.assign(res, {ok: true, removed: along.length});
    const moved = [...atA, ...atB], rec = {idx: moved, pos: new Float32Array(moved.length * 3), uv: uv ? new Float32Array(uv.array) : null, index: ix};
    moved.forEach((i, k) => { rec.pos[k * 3] = pos.getX(i); rec.pos[k * 3 + 1] = pos.getY(i); rec.pos[k * 3 + 2] = pos.getZ(i); });
    if (uv) for (const t of along) {                          // each side: its own two corners meet at their UV middle
      const w = fv(t), ca = w.filter(x => atA.has(x)), cb = w.filter(x => atB.has(x));
      if (!ca.length || !cb.length) continue;
      const u = (uv.getX(ca[0]) + uv.getX(cb[0])) / 2, v2 = (uv.getY(ca[0]) + uv.getY(cb[0])) / 2;
      for (const x of ca.concat(cb)) uv.setXY(x, u, v2);
    }
    for (const i of moved) pos.setXYZ(i, Mid.x, Mid.y, Mid.z);
    pos.needsUpdate = true; if (uv) uv.needsUpdate = true;
    const gone = new Set(along), keep = [], A = ix.array;
    for (let t = 0; t < nf; t++) if (!gone.has(t)) keep.push(A[t * 3], A[t * 3 + 1], A[t * 3 + 2]);
    g.setIndex(new THREE.BufferAttribute(new A.constructor(keep), 1));
    const rn = HP._renormal(mesh, new Set(moved)); rec.nIdx = rn.nIdx; rec.nrm = rn.nrm;
    HP._uvChanged(g); g.computeBoundingSphere(); g.computeBoundingBox();
    return Object.assign(res, {ok: true, removed: along.length, moved: moved.length, rec});
  };
  HP.collapseRestore = function (mesh, rec) {
    const g = mesh.geometry, pos = g.attributes.position;
    rec.idx.forEach((i, k) => pos.setXYZ(i, rec.pos[k * 3], rec.pos[k * 3 + 1], rec.pos[k * 3 + 2])); pos.needsUpdate = true;
    if (rec.uv && g.attributes.uv) { g.attributes.uv.array.set(rec.uv); g.attributes.uv.needsUpdate = true; }
    if (g.attributes.normal && rec.nIdx) { rec.nIdx.forEach((i, k) => g.attributes.normal.setXYZ(i, rec.nrm[k * 3], rec.nrm[k * 3 + 1], rec.nrm[k * 3 + 2])); g.attributes.normal.needsUpdate = true; }
    g.setIndex(rec.index); HP._uvChanged(g); g.computeBoundingSphere(); g.computeBoundingBox();
  };
  // ---- ⊕ split an edge (plans/atlas-editor phase 6d, 2026-09-27) ----
  /** The edge of `faceIndex` nearest `pointWorld`, split at its middle: every face along it becomes two, meeting at a
   *  new vertex -- one per side of the edge (a UV seam's two sides, a duplicate face's own corners each get their
   *  own), a copy of the side's first end (it keeps that vertex's rig weights and blend mask, as the saved file's
   *  copy will) placed at the exact middle in position, UV and normal. Nothing moves and the texture is untouched: the model looks the same until
   *  the new vertex is pulled. Returns {ok, edge, added, src (the copied vertices, for the save's split), faces,
   *  rec (HP._restoreGeometry)} or {ok: false, reason}. opts.dry judges only. */
  HP.splitEdge = function (mesh, faceIndex, pointWorld, opts) {
    opts = opts || {};
    const g = mesh.geometry, ix = g.index, pos = g.attributes.position;
    if (!ix) return {ok: false, reason: "this mesh has no triangle index"};
    const {a, b, edge} = HP._nearestEdge(mesh, faceIndex, pointWorld), res = {ok: false, edge};
    const kp = i => Math.round(pos.getX(i) * 1e5) + "," + Math.round(pos.getY(i) * 1e5) + "," + Math.round(pos.getZ(i) * 1e5);
    const ka = kp(a), kb = kp(b), nf = ix.count / 3, fv = t => [ix.getX(t * 3), ix.getX(t * 3 + 1), ix.getX(t * 3 + 2)];
    const along = [];                                        // [face, corner of the a end, corner of the b end]
    for (let t = 0; t < nf; t++) { const w = fv(t), qa = w.findIndex(x => kp(x) === ka), qb = w.findIndex(x => kp(x) === kb); if (qa >= 0 && qb >= 0) along.push([t, qa, qb]); }
    if (!along.length) return Object.assign(res, {reason: "no face along that edge"});
    if (opts.dry) return Object.assign(res, {ok: true, faces: along.length});
    // one new vertex per distinct pair of end vertices (the sides of a seam, a duplicate face's own corners)
    const pairs = new Map(), src = []; let next = pos.count;
    for (const [t, qa, qb] of along) { const w = fv(t), key = w[qa] + "|" + w[qb]; if (!pairs.has(key)) { pairs.set(key, {m: next++, va: w[qa], vb: w[qb]}); src.push(w[qa]); } }
    const rec = HP._growGeometry(g, src), P2 = g.attributes.position, UV = g.attributes.uv, N = g.attributes.normal;
    for (const {m, va, vb} of pairs.values()) {
      P2.setXYZ(m, (P2.getX(va) + P2.getX(vb)) / 2, (P2.getY(va) + P2.getY(vb)) / 2, (P2.getZ(va) + P2.getZ(vb)) / 2);
      if (UV) UV.setXY(m, (UV.getX(va) + UV.getX(vb)) / 2, (UV.getY(va) + UV.getY(vb)) / 2);
      if (N) { const n = new THREE.Vector3(N.getX(va) + N.getX(vb), N.getY(va) + N.getY(vb), N.getZ(va) + N.getZ(vb)); if (n.lengthSq() > 1e-20) { n.normalize(); N.setXYZ(m, n.x, n.y, n.z); } }
    }
    P2.needsUpdate = true; if (UV) UV.needsUpdate = true; if (N) N.needsUpdate = true;   // the mask (COLOR_0) and rig weights stay the copied end's: what the saved file gets
    // each face along it becomes two: (a, m, c) and (m, b, c) in its own winding
    const I = g.index, A = I.array, out = [], split = new Set(along.map(r => r[0])), byFace = new Map(along.map(r => [r[0], r]));
    for (let t = 0; t < nf; t++) {
      const w = [A[t * 3], A[t * 3 + 1], A[t * 3 + 2]];
      if (!split.has(t)) { out.push(...w); continue; }
      const [, qa, qb] = byFace.get(t), m = pairs.get(w[qa] + "|" + w[qb]).m, f1 = w.slice(), f2 = w.slice();
      f1[qb] = m; f2[qa] = m;                               // the corner at b becomes m in one, the corner at a in the other
      out.push(...f1, ...f2);
    }
    const big = next - 1 > (A instanceof Uint16Array ? 0xFFFF : A instanceof Uint8Array ? 0xFF : 0xFFFFFFFF);
    g.setIndex(new THREE.BufferAttribute(big ? Uint32Array.from(out) : new A.constructor(out), 1));
    HP._uvChanged(g); g.computeBoundingSphere(); g.computeBoundingBox();
    return Object.assign(res, {ok: true, added: src.length, src, faces: along.length, rec});
  };
  /** Put UVs back (an undo of joinSeam: the array it returned as `before`). */
  HP.uvRestore = function (mesh, before) { const uv = mesh.geometry.attributes.uv; uv.array.set(before); uv.needsUpdate = true; HP._uvChanged(mesh.geometry); };

  /** Put triangles back (an undo of flipDiagonal: res.faces with res.before). */
  HP.flipRestore = function (mesh, res) { HP._setTris(mesh.geometry, res.faces, res.before); };
  HP._setTris = function (g, faces, tris) {
    const ix = g.index;
    faces.forEach((f, i) => { for (let q = 0; q < 3; q++) ix.setX(f * 3 + q, tris[i][q]); });
    ix.needsUpdate = true;
    HP._uvChanged(g);                                            // islands are rebuilt on demand
  };

  /** A texture of the atlas's texel grid, `k` px per texel: lines on every texel boundary, for
   *  laying over the model ("▦ texels") so the shape of each texel on the surface shows. */
  HP.texelGridCanvas = function (W, H, k, every) {             // k canvas px per texel; a line every `every` texels (1 = each)
    every = every || 1;
    const c = document.createElement("canvas"); c.width = Math.round(W * k); c.height = Math.round(H * k);
    const x = c.getContext("2d"), st = every * k;
    x.fillStyle = "rgba(0,0,0,.55)";                             // a dark line beside a light one: visible on any colour
    for (let i = 0; i <= W / every; i++) x.fillRect(Math.round(i * st) + 1, 0, 1, c.height);
    for (let j = 0; j <= H / every; j++) x.fillRect(0, Math.round(j * st) + 1, c.width, 1);
    x.fillStyle = "rgba(255,255,255,.75)";
    for (let i = 0; i <= W / every; i++) x.fillRect(Math.round(i * st), 0, 1, c.height);
    for (let j = 0; j <= H / every; j++) x.fillRect(0, Math.round(j * st), c.width, 1);
    return c;
  };
  /** The outline of the UV island under `faceIndex`: its edges that no other face of the island shares,
   *  as line-segment positions in the mesh's own space (the ⊞ straighten hover). */
  HP.islandOutline = function (mesh, faceIndex) {
    const g = mesh.geometry, ix = g.index, pos = g.attributes.position; if (!ix || !g.attributes.uv) return new Float32Array(0);
    const isl = HP.uvIslands(g), I = isl[faceIndex], cnt = new Map(), kp = i => Math.round(pos.getX(i) * 1e5) + "," + Math.round(pos.getY(i) * 1e5) + "," + Math.round(pos.getZ(i) * 1e5);
    for (let t = 0; t < ix.count / 3; t++) { if (isl[t] !== I) continue; for (let q = 0; q < 3; q++) { const a = ix.getX(t * 3 + q), b = ix.getX(t * 3 + (q + 1) % 3), ka = kp(a), kb = kp(b), key = ka < kb ? ka + "|" + kb : kb + "|" + ka, e = cnt.get(key); if (e) e.n++; else cnt.set(key, {n: 1, a, b}); } }
    const out = []; for (const e of cnt.values()) if (e.n === 1) out.push(pos.getX(e.a), pos.getY(e.a), pos.getZ(e.a), pos.getX(e.b), pos.getY(e.b), pos.getZ(e.b));
    return new Float32Array(out);
  };

  /** The island a raycast hit sits on, "<object uuid>:<island>" (null without UVs). */
  HP.islandOf = function (hit) {
    if (!hit || !hit.object || !hit.object.geometry || !hit.object.geometry.attributes.uv || hit.faceIndex == null) return null;
    return hit.object.uuid + ":" + HP.uvIslands(hit.object.geometry)[hit.faceIndex];
  };
  /** The island under every texel of a W x H atlas for `root`'s meshes
   *  (plans/n64-uv-layout phase 1): {first, second: Int32Array (island id
   *  or -1), islands, used, shared, border, borderMask: Uint8Array,
   *  slivers} -- `shared` texels are covered by two islands (paint one,
   *  two places change), `border` texels have a 4-neighbour that is empty
   *  or another island's (the filter blends across it). 4x4 sub-samples per
   *  texel; meant for N64-sized atlases (null over 256 px a side). */
  HP.islandTexels = function (root, W, H) {
    if (W > 256 || H > 256) return null;
    const first = new Int32Array(W * H).fill(-1), second = new Int32Array(W * H).fill(-1);
    let base = 0, islands = 0; const counts = [];
    root.updateMatrixWorld(true);
    root.traverse(n => {
      if (!n.isMesh || !n.geometry.attributes.uv) return;
      const g = n.geometry, uv = g.attributes.uv, ix = g.index, cnt = ix ? ix.count : g.attributes.position.count, isl = HP.uvIslands(g);
      const compact = new Map(); let maxId = -1;                 // uvIslands gives union-find roots; number them 0..n-1
      for (let f = 0; f < cnt / 3; f++) {
        if (!compact.has(isl[f])) compact.set(isl[f], compact.size);
        const cid = compact.get(isl[f]), id = base + cid; if (cid > maxId) maxId = cid;
        const v = [0, 1, 2].map(k => ix ? ix.getX(f * 3 + k) : f * 3 + k);
        const ax = uv.getX(v[0]) * W, ay = uv.getY(v[0]) * H, bx = uv.getX(v[1]) * W, by = uv.getY(v[1]) * H, cx = uv.getX(v[2]) * W, cy = uv.getY(v[2]) * H;
        const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(den) < 1e-9) continue;   // no UV area (a cap sampling one texel): no island
        const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
        const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          let hit = false;
          for (let sy = 0; sy < 4 && !hit; sy++) for (let sx = 0; sx < 4; sx++) {
            const px = x + sx / 4 + 0.125, py = y + sy / 4 + 0.125;
            const w0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den, w1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den;
            if (w0 >= -1e-9 && w1 >= -1e-9 && 1 - w0 - w1 >= -1e-9) { hit = true; break; }
          }
          if (!hit) continue;
          const t = y * W + x;
          if (first[t] < 0) first[t] = id; else if (first[t] !== id && second[t] < 0) second[t] = id;
        }
      }
      base += maxId + 1;
    });
    islands = base;
    for (let i = 0; i < base; i++) counts.push(0);
    // islands that never covered a texel (degenerate faces) drop out of the count below
    let used = 0, shared = 0;
    for (let t = 0; t < W * H; t++) { if (first[t] >= 0) { used++; counts[first[t]]++; } if (second[t] >= 0) { shared++; counts[second[t]]++; } }
    const borderMask = new Uint8Array(W * H); let border = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = y * W + x, me = first[t]; if (me < 0) continue;
      const nb = (xx, yy) => (xx < 0 || yy < 0 || xx >= W || yy >= H) ? -2 : first[yy * W + xx];
      if (nb(x + 1, y) !== me || nb(x - 1, y) !== me || nb(x, y + 1) !== me || nb(x, y - 1) !== me) { borderMask[t] = 1; border++; }
    }
    const real = counts.filter(c => c > 0);
    const slivers = real.filter(c => c <= 4).length;
    return {first, second, islands: real.length, used, shared, border, borderMask, slivers, W, H};
  };

  // ---- palettes (indexed painting): the atlas holds only the palette's colours
  HP.paletteRgb = pal => pal.map(HP.hexRgb);
  /** The slot nearest an rgb (squared distance). */
  HP.nearestSlot = function (palRgb, r, g, b) {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < palRgb.length; i++) { const p = palRgb[i], d = (p[0] - r) * (p[0] - r) + (p[1] - g) * (p[1] - g) + (p[2] - b) * (p[2] - b); if (d < bd) { bd = d; bi = i; } }
    return bi;
  };
  /** Every opaque texel to the nearest palette colour, the whole atlas
   *  (the selection ignored). Returns how many texels moved. */
  HP.snapToPalette = function (pc, pal) {
    const P = HP.paletteRgb(pal), W = pc.can.width, H = pc.can.height;
    if (!P.length) return 0;
    const img = pc.ctx.getImageData(0, 0, W, H), d = img.data, cache = new Map();
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      let s = cache.get(k); if (s === undefined) { s = HP.nearestSlot(P, d[i], d[i + 1], d[i + 2]); cache.set(k, s); }
      const q = P[s];
      if (d[i] !== q[0] || d[i + 1] !== q[1] || d[i + 2] !== q[2]) { d[i] = q[0]; d[i + 1] = q[1]; d[i + 2] = q[2]; n++; }
    }
    if (n) { pc.ctx.putImageData(img, 0, 0); HP.refresh(pc); }
    return n;
  };
  /** Bresenham's line as texel pairs, both ends included. */
  HP.pixLine = function (x0, y0, x1, y1) {
    const out = []; let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (;;) { out.push([x0, y0]); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
    return out;
  };
  /** Midpoint ellipse (Bresenham) inside the rect x0..x1, y0..y1 inclusive; filled = every texel inside. */
  HP.pixEllipse = function (x0, y0, x1, y1, filled) {
    const pts = new Set(), put = (x, y) => pts.add(x + "," + y);
    if (x0 > x1) [x0, x1] = [x1, x0]; if (y0 > y1) [y0, y1] = [y1, y0];
    let a = x1 - x0, b = y1 - y0; const b1 = b & 1;
    let dx = 4 * (1 - a) * b * b, dy = 4 * (b1 + 1) * a * a, err = dx + dy + b1 * a * a, e2;
    let ya = y0 + ((b + 1) >> 1), yb = ya - b1; a *= 8 * a; const b8 = 8 * b * b;
    let xa = x0, xb = x1;
    do {
      if (filled) { for (let x = xa; x <= xb; x++) { put(x, ya); put(x, yb); } }
      else { put(xb, ya); put(xa, ya); put(xa, yb); put(xb, yb); }
      e2 = 2 * err;
      if (e2 <= dy) { ya++; yb--; err += dy += a; }
      if (e2 >= dx || 2 * err > dy) { xa++; xb--; err += dx += b8; }
    } while (xa <= xb);
    while (ya - yb < b) { put(xa - 1, ya); put(xb + 1, ya++); put(xa - 1, yb); put(xb + 1, yb--); }
    return [...pts].map(k => k.split(",").map(Number));
  };
  /** A rect outline (or filled) as texels. */
  HP.pixRect = function (x0, y0, x1, y1, filled) {
    if (x0 > x1) [x0, x1] = [x1, x0]; if (y0 > y1) [y0, y1] = [y1, y0];
    const out = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (filled || x === x0 || x === x1 || y === y0 || y === y1) out.push([x, y]);
    return out;
  };
  /** One texel of a pixel stroke: the colour (or the shaded base texel),
   *  snapped to 5 bits when asked; pixel-perfect drops the L corner. */
  HP._pixelPut = function (sess, x, y) {
    const o = sess.opts, L = sess.layer, c = sess.lctx, W = L.width, H = L.height;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    let rgb;
    if (o.shade) {
      const key = y * W + x; sess._shaded = sess._shaded || new Set();
      if (sess._shaded.has(key)) return;                    // once per stroke per texel
      sess._shaded.add(key);
      const b = (sess._baseData || (sess._baseData = sess.base.getContext("2d").getImageData(0, 0, W, H).data));
      const base = [b[key * 4], b[key * 4 + 1], b[key * 4 + 2]];
      if (o.palette && o.palette.length) {                    // indexed: one step along the ramp (the palette is sorted dark to light)
        const P = sess._palRgb || (sess._palRgb = HP.paletteRgb(o.palette));
        const sI = HP.nearestSlot(P, base[0], base[1], base[2]);
        rgb = P[Math.max(0, Math.min(P.length - 1, sI + (o.shade === "darker" ? -1 : 1)))].slice();
      } else rgb = HP.shadeRgb(base, o.shade);
    } else rgb = HP.hexRgb(o.color);
    if (o.quant5) rgb = rgb.map(HP.quant5);
    const n = o.pixel || 1, off = Math.floor((n - 1) / 2);
    c.fillStyle = "rgb(" + rgb.join(",") + ")"; c.fillRect(x - off, y - off, n, n);
    const P = sess._pxs || (sess._pxs = []);
    P.push([x, y]);
    if (o.perfect && n === 1 && P.length >= 3) {
      const A = P[P.length - 3], B = P[P.length - 2], C = P[P.length - 1];
      const orth = (p, q) => (p[0] === q[0] || p[1] === q[1]) && Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) === 1;
      if (orth(A, B) && orth(B, C) && A[0] !== C[0] && A[1] !== C[1]) {   // the middle of an L: drop it
        c.clearRect(B[0], B[1], 1, 1); P.splice(P.length - 2, 1);
        if (sess._shaded) sess._shaded.delete(B[1] * W + B[0]);
      }
    }
  };
  HP.strokeSession = function (sess, u, v) {
    const o = sess.opts, W = sess.layer.width;
    if (o.pixel > 0) {                                        // the pencil: whole texels, walked one by one
      const H = sess.layer.height, x = Math.floor(u * W), y = Math.floor(v * H);
      if (sess._lastPx) {
        if (sess._lastPx[0] === x && sess._lastPx[1] === y) return;
        const pts = HP.pixLine(sess._lastPx[0], sess._lastPx[1], x, y);
        for (let i = 1; i < pts.length; i++) HP._pixelPut(sess, pts[i][0], pts[i][1]);
      } else HP._pixelPut(sess, x, y);
      sess._lastPx = [x, y]; sess.last = {u, v};
      HP._compose(sess);
      return;
    }
    if (sess.last) {
      const du = u - sess.last.u, dv = v - sess.last.v;
      // Interpolate only a few brush-widths: consecutive move events
      // on one surface are never further apart than that, while an
      // island hop (bevel to top, across a seam) is. The old cap of a
      // quarter of the atlas drew streak lines straight through
      // everything between islands (Hector's floor, 2026-09-24).
      const distPx = Math.hypot(du * W, dv * sess.layer.height);
      if (distPx < Math.max(o.size * 3, 48)) {
        const steps = Math.max(1, Math.ceil(distPx / (o.size / 3)));
        for (let i = 1; i <= steps; i++)
          HP._layerStamp(sess, sess.last.u + du * i / steps, sess.last.v + dv * i / steps);
        sess.last = {u, v};
        HP._compose(sess);
        return;
      }
    }
    HP._layerStamp(sess, u, v);
    sess.last = {u, v};
    HP._compose(sess);
  };

  HP.hexRgb = function (hex) {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16),
            parseInt(hex.slice(5, 7), 16)];
  };

  // ---------------- brush engine: variation, steady hand, tips ----------------
  // (phase 1 of the paint roadmap, 2026-09-25: Grease Pencil's randomize,
  // stabilize stroke and stroke materials, in raster form)

  /** Seeded RNG (mulberry32): a stroke's variation replays the same way
   *  from the same seed, which the vector overlay (phase 3) relies on. */
  HP.rng = function (seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /** [r,g,b] shifted by dh degrees of hue, ds saturation, dv value (each
   *  may be negative); clamps. */
  HP.shiftHsv = function (rgb, dh, ds, dv) {
    let [r, g, b] = rgb.map(v => v / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0, sat = mx ? d / mx : 0, v = mx;
    if (d) {
      if (mx === r) h = ((g - b) / d) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    h = (h + (dh || 0) + 360) % 360;
    sat = Math.min(1, Math.max(0, sat + (ds || 0)));
    v = Math.min(1, Math.max(0, v + (dv || 0)));
    const c = v * sat, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    let q = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
          : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return q.map(u => Math.round((u + m) * 255));
  };

  /** One dab's variation from opts.jitter {hue deg, sat, val, size (fraction),
   *  pos (px), perStroke}: {rgb, size, dx, dy} (dx/dy in px). `st` keeps the
   *  rng and, for perStroke, the draw. */
  HP._vary = function (st, o) {
    if (!st.rng) st.rng = HP.rng(o.seed == null ? (Math.random() * 4294967296) >>> 0 : o.seed);
    if (!st._rgb0 || st._rgb0hex !== o.color) { st._rgb0 = HP.hexRgb(o.color); st._rgb0hex = o.color; }
    const J = o.jitter;
    if (!J || !(J.hue || J.sat || J.val || J.size || J.pos)) return {rgb: st._rgb0, size: o.size, dx: 0, dy: 0};
    let jit = J.perStroke ? st._strokeJit : null;
    if (!jit) {
      const r1 = () => st.rng() * 2 - 1;
      jit = {h: r1() * (J.hue || 0), s: r1() * (J.sat || 0), v: r1() * (J.val || 0),
             k: 1 + r1() * (J.size || 0), dx: r1() * (J.pos || 0), dy: r1() * (J.pos || 0)};
      if (J.perStroke) st._strokeJit = jit;
    }
    return {rgb: HP.shiftHsv(st._rgb0, jit.h, jit.s, jit.v), size: Math.max(1, o.size * jit.k), dx: jit.dx, dy: jit.dy};
  };

  /** Steady hand ("lazy mouse"): the pen trails the cursor on a rope of
   *  `radius` px, then eases toward it by (1 - smooth). st.pen holds the
   *  pen between events (null at stroke start). Returns [x, y]. */
  HP.steady = function (st, cx, cy, radius, smooth) {
    if (!st.pen) { st.pen = [cx, cy]; return st.pen; }
    let [px, py] = st.pen;
    const dx = cx - px, dy = cy - py, d = Math.hypot(dx, dy);
    if (d > radius) { const k = (d - radius) / d; px += dx * k; py += dy * k; }
    const f = 1 - Math.min(0.95, Math.max(0, smooth == null ? 0.5 : smooth));
    px += (cx - px) * f; py += (cy - py) * f;
    st.pen = [px, py];
    return st.pen;
  };

  /** Built-in brush tips: white-on-transparent 128 px canvases (alpha =
   *  coverage), generated once. "round" is the plain disc (null). */
  HP._tips = {};
  HP.tip = function (name) {
    if (name in HP._tips) return HP._tips[name];
    const S = 128, cv = document.createElement("canvas"); cv.width = cv.height = S;
    const x = cv.getContext("2d"), rng = HP.rng(7);
    if (name === "square") { x.fillStyle = "#fff"; x.fillRect(0, 0, S, S); }
    else if (name === "chalk") {
      const img = x.createImageData(S, S), d = img.data;
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
        const rr = Math.hypot(i - S / 2 + 0.5, j - S / 2 + 0.5) / (S / 2);
        if (rr > 1) continue;
        const a = Math.pow(1 - rr, 0.6) * (0.3 + 0.7 * rng()) * (rng() < 0.7 ? 1 : 0);
        const k = (j * S + i) * 4; d[k] = d[k + 1] = d[k + 2] = 255; d[k + 3] = Math.round(a * 255);
      }
      x.putImageData(img, 0, 0);
    } else if (name === "splatter") {
      x.fillStyle = "#fff";
      for (let n = 0; n < 70; n++) {
        const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * S * 0.46, rad = 1.5 + rng() * rng() * 8;
        x.beginPath(); x.arc(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r, rad, 0, Math.PI * 2); x.fill();
      }
    } else if (name === "stripes") {
      x.fillStyle = "#fff"; for (let y = 0; y < S; y += 16) x.fillRect(0, y, S, 9);
    } else return HP._tips[name] = null;
    return HP._tips[name] = cv;
  };

  /** Build the dab's coverage patch (opaque: R = coverage) and, for RGBA
   *  tips, the colour patch (opaque: the tip's colours). Opaque patches
   *  can be drawn twice at shared triangle edges without changing (the
   *  lattice fix in _surfaceDab); transparent ones could not. */
  HP._dabPatches = function (st, o, size, tip, ang) {
    const r = Math.max(0.5, size / 2), half = Math.ceil(r + 2), sz = half * 2;
    const key = sz + "|" + (tip ? tip.id : "disc") + "|" + (tip ? ang.toFixed(3) : o.soft);
    if (st._dabCov && st._dabKey === key) return st._dab;
    const cov = st._dabCov || (st._dabCov = document.createElement("canvas"));
    cov.width = cov.height = sz;
    const x = cov.getContext("2d");
    let col = null;
    if (tip && tip.img) {
      const tmp = st._dabTmp || (st._dabTmp = document.createElement("canvas"));
      tmp.width = tmp.height = sz;
      const tx = tmp.getContext("2d");
      tx.clearRect(0, 0, sz, sz); tx.save(); tx.translate(half, half); tx.rotate(ang || 0);
      tx.drawImage(tip.img, -r, -r, 2 * r, 2 * r); tx.restore();
      const src = tx.getImageData(0, 0, sz, sz).data;
      const cimg = x.createImageData(sz, sz), cd = cimg.data;
      for (let i = 0; i < cd.length; i += 4) { cd[i] = src[i + 3]; cd[i + 3] = 255; }   // R = alpha
      x.putImageData(cimg, 0, 0);
      if (tip.rgba) {
        col = st._dabCol || (st._dabCol = document.createElement("canvas"));
        col.width = col.height = sz;
        const cx2 = col.getContext("2d"), img2 = cx2.createImageData(sz, sz), d2 = img2.data;
        for (let i = 0; i < d2.length; i += 4) { d2[i] = src[i]; d2[i + 1] = src[i + 1]; d2[i + 2] = src[i + 2]; d2[i + 3] = 255; }
        cx2.putImageData(img2, 0, 0);
      }
    } else {
      x.fillStyle = "#000"; x.fillRect(0, 0, sz, sz);
      if (o.soft > 0) {
        const g = x.createRadialGradient(half, half, r * (1 - o.soft), half, half, r);
        g.addColorStop(0, "#f00"); g.addColorStop(1, "#000");
        x.fillStyle = g;
      } else x.fillStyle = "#f00";
      x.beginPath(); x.arc(half, half, r, 0, Math.PI * 2); x.fill();
    }
    st._dabKey = key;
    return st._dab = {cov, col, half, size: sz};
  };

  HP._inTri = function (p, q) {
    const [a, b, c] = p, e = 1e-9;
    const s1 = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]);
    const s2 = (c[0] - b[0]) * (q[1] - b[1]) - (c[1] - b[1]) * (q[0] - b[0]);
    const s3 = (a[0] - c[0]) * (q[1] - c[1]) - (a[1] - c[1]) * (q[0] - c[0]);
    return (s1 >= -e && s2 >= -e && s3 >= -e) || (s1 <= e && s2 <= e && s3 <= e);
  };

  // ---------------- morphology (phase 6: fill gap closure) ----------------
  // Chebyshev (square) dilate / erode of a byte mask by r texels. Separable
  // and O(N) whatever r is: per row then per column, the distance to the
  // nearest set texel in two sweeps, set where it is <= r. The atlas edge
  // counts as "same as the mask" so erosion never eats in from the border.
  HP._dilateMask = function (mask, W, H, r, out) {
    out = out || new Uint8Array(W * H);
    if (r <= 0) { out.set(mask); return out; }
    const tmp = new Uint8Array(W * H), INF = 1e9;
    const pass = (src, dst, lines, len, stride, step) => {
      for (let l = 0; l < lines; l++) {
        const base = l * stride;
        let d = INF;
        for (let i = 0, q = base; i < len; i++, q += step) { d = src[q] ? 0 : d + 1; dst[q] = d <= r ? 1 : 0; }
        d = INF;
        for (let i = len - 1, q = base + (len - 1) * step; i >= 0; i--, q -= step) { d = src[q] ? 0 : d + 1; if (d <= r) dst[q] = 1; }
      }
    };
    pass(mask, tmp, H, W, W, 1);
    pass(tmp, out, W, H, 1, W);
    return out;
  };
  HP._erodeMask = function (mask, W, H, r, out) {
    out = out || new Uint8Array(W * H);
    if (r <= 0) { out.set(mask); return out; }
    const inv = new Uint8Array(W * H);
    for (let i = 0; i < inv.length; i++) inv[i] = mask[i] ? 0 : 1;
    const big = HP._dilateMask(inv, W, H, r);
    for (let i = 0; i < big.length; i++) out[i] = big[i] ? 0 : 1;
    return out;
  };

  /** The texels a bucket tap at (u, v) would fill: {mask, count, rect, img}
   *  or null. opts.tol: colour distance (|dr|+|dg|+|db|, default 30) that
   *  still counts as the tapped area. opts.close: bridge gaps in the
   *  outline narrower than 2*close texels -- the fillable set is eroded
   *  then dilated by close, so a leak through a break in a line stops at
   *  the break (Grease Pencil's fill "gap closure", by morphology instead
   *  of virtual strokes). opts.grow: spread the flooded region this many
   *  texels INTO the outline (under a line's soft edge, so no hairline
   *  shows between fill and line; never into other texels of the tapped
   *  colour, never outside the stencil), or negative: pull it back that
   *  far, leaving a margin. The stencil (a face selection) bounds the
   *  flood as before. opts.img: an ImageData already read, to reuse. */
  HP.bucketRegion = function (pc, u, v, opts) {
    opts = opts || {};
    const w = pc.can.width, h = pc.can.height, TOL = opts.tol == null ? 30 : opts.tol;
    const x0 = Math.floor(u * w), y0 = Math.floor(v * h);
    if (x0 < 0 || y0 < 0 || x0 >= w || y0 >= h) return null;
    const img = opts.img || pc.ctx.getImageData(0, 0, w, h), d = img.data;
    const i0 = (y0 * w + x0) * 4, tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2];
    const N = w * h, sten = HP._stencilData(pc);
    const same = new Uint8Array(N), allowed = new Uint8Array(N);
    for (let q = 0, i = 0; q < N; q++, i += 4) {
      same[q] = Math.abs(d[i] - tr) + Math.abs(d[i + 1] - tg) + Math.abs(d[i + 2] - tb) <= TOL ? 1 : 0;
      allowed[q] = sten && !sten[i + 3] ? 0 : 1;
    }
    let fill = new Uint8Array(N);
    for (let q = 0; q < N; q++) fill[q] = same[q] & allowed[q];
    const close = Math.max(0, Math.round(opts.close || 0));
    if (close) fill = HP._dilateMask(HP._erodeMask(fill, w, h, close), w, h, close);
    const seed = y0 * w + x0;
    if (!fill[seed]) return null;              // the tap sits in a bridged gap, or on a sliver thinner than the closure
    const mask = new Uint8Array(N), stack = [seed]; mask[seed] = 1;
    while (stack.length) {
      const q = stack.pop(), px = q % w, py = (q / w) | 0;
      if (px > 0 && !mask[q - 1] && fill[q - 1]) { mask[q - 1] = 1; stack.push(q - 1); }
      if (px < w - 1 && !mask[q + 1] && fill[q + 1]) { mask[q + 1] = 1; stack.push(q + 1); }
      if (py > 0 && !mask[q - w] && fill[q - w]) { mask[q - w] = 1; stack.push(q - w); }
      if (py < h - 1 && !mask[q + w] && fill[q + w]) { mask[q + w] = 1; stack.push(q + w); }
    }
    const grow = Math.round(opts.grow || 0);
    let region = mask;
    if (grow > 0) {
      region = HP._dilateMask(mask, w, h, grow);
      for (let q = 0; q < N; q++) if (region[q] && !mask[q] && (same[q] || !allowed[q])) region[q] = 0;
    } else if (grow < 0) region = HP._erodeMask(mask, w, h, -grow);
    let count = 0, rx0 = w, ry0 = h, rx1 = -1, ry1 = -1;
    for (let q = 0; q < N; q++) {
      if (!region[q]) continue;
      count++;
      const px = q % w, py = (q / w) | 0;
      if (px < rx0) rx0 = px; if (px > rx1) rx1 = px; if (py < ry0) ry0 = py; if (py > ry1) ry1 = py;
    }
    if (!count) return null;
    return {mask: region, count, rect: [rx0, ry0, rx1 + 1, ry1 + 1], img};
  };

  /** Paint-bucket: flood the tapped area with hexColor. `tol` and `opts`
   *  ({close, grow, tol}) as in bucketRegion; both optional, so the old
   *  call bucket(pc, u, v, hex) floods exactly as before. On flat textures
   *  a colour region IS the mask. Returns true when texels changed. */
  HP.bucket = function (pc, u, v, hexColor, tol, opts) {
    opts = Object.assign({}, opts || {});
    if (tol != null && opts.tol == null) opts.tol = tol;
    const w = pc.can.width, h = pc.can.height;
    const x0 = Math.floor(u * w), y0 = Math.floor(v * h);
    if (x0 < 0 || y0 < 0 || x0 >= w || y0 >= h) return false;
    const img = pc.ctx.getImageData(0, 0, w, h), d = img.data;
    const i0 = (y0 * w + x0) * 4;
    const [fr, fg, fb] = HP.hexRgb(hexColor);
    if (Math.abs(d[i0] - fr) + Math.abs(d[i0 + 1] - fg) + Math.abs(d[i0 + 2] - fb) < 3) return false;
    opts.img = img;
    const reg = HP.bucketRegion(pc, u, v, opts);
    if (!reg) return false;
    const m = reg.mask;
    for (let q = 0, i = 0; q < m.length; q++, i += 4) {
      if (!m[q]) continue;
      d[i] = fr; d[i + 1] = fg; d[i + 2] = fb; d[i + 3] = 255;
    }
    pc.ctx.putImageData(img, 0, 0);
    HP.refresh(pc);
    return true;
  };

  // ---------------- edge bake (phase 6) ----------------
  /** The mesh's folds: every edge shared by exactly two triangles whose
   *  planes differ by more than opts.minDeg (default 40). Vertices are
   *  welded by position (1e-4) so UV and normal splits do not hide an
   *  edge, and the angle comes from the triangles' own planes, so a flat
   *  face cut into islands (the env wall's 1270 pieces) yields nothing.
   *  Each edge: {deg, convex, uv: [[ax, ay, bx, by], ...]} -- the edge's
   *  UV segment in EACH of its two triangles (0..1, the mesh's own uv), so
   *  a line lands on both sides of a UV seam. `convex` is true for an
   *  outer corner (the second triangle's centroid lies behind the first's
   *  plane), with the mesh's winding taken as outward. Boundary and
   *  non-manifold edges and degenerate triangles are skipped. */
  HP.creaseEdges = function (root, opts) {
    opts = opts || {};
    const minDeg = opts.minDeg == null ? 40 : opts.minDeg, cosMin = Math.cos(minDeg * Math.PI / 180);
    const out = [];
    const A = new THREE.Vector3(), B = new THREE.Vector3(), Cv = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    root.traverse(mesh => {
      if (!mesh.isMesh || !mesh.geometry || !mesh.geometry.attributes.uv) return;
      const g = mesh.geometry, p = g.attributes.position, uv = g.attributes.uv, ix = g.index;
      const cnt = ix ? ix.count : p.count, F = (cnt / 3) | 0;
      const wid = new Int32Array(p.count), key = new Map();
      for (let i = 0; i < p.count; i++) {
        const k = p.getX(i).toFixed(4) + "," + p.getY(i).toFixed(4) + "," + p.getZ(i).toFixed(4);
        let w = key.get(k); if (w === undefined) { w = key.size; key.set(k, w); } wid[i] = w;
      }
      const corner = (f, k) => ix ? ix.getX(f * 3 + k) : f * 3 + k;
      const N = new Float32Array(F * 3), C = new Float32Array(F * 3), bad = new Uint8Array(F);
      for (let f = 0; f < F; f++) {
        A.fromBufferAttribute(p, corner(f, 0)); B.fromBufferAttribute(p, corner(f, 1)); Cv.fromBufferAttribute(p, corner(f, 2));
        e1.subVectors(B, A); e2.subVectors(Cv, A); e1.cross(e2);
        const L = e1.length(); if (L < 1e-12) { bad[f] = 1; continue; }
        N[f * 3] = e1.x / L; N[f * 3 + 1] = e1.y / L; N[f * 3 + 2] = e1.z / L;
        C[f * 3] = (A.x + B.x + Cv.x) / 3; C[f * 3 + 1] = (A.y + B.y + Cv.y) / 3; C[f * 3 + 2] = (A.z + B.z + Cv.z) / 3;
      }
      const edges = new Map();                      // "wa,wb" -> [{f, i, j}] with i, j the unwelded corners in face f
      for (let f = 0; f < F; f++) {
        if (bad[f]) continue;
        for (let k = 0; k < 3; k++) {
          const i = corner(f, k), j = corner(f, (k + 1) % 3), wa = wid[i], wb = wid[j];
          if (wa === wb) continue;
          const ek = wa < wb ? wa + "," + wb : wb + "," + wa;
          const l = edges.get(ek); if (l) l.push({f, i, j}); else edges.set(ek, [{f, i, j}]);
        }
      }
      for (const l of edges.values()) {
        if (l.length !== 2) continue;
        const f1 = l[0].f, f2 = l[1].f;
        const dot = N[f1 * 3] * N[f2 * 3] + N[f1 * 3 + 1] * N[f2 * 3 + 1] + N[f1 * 3 + 2] * N[f2 * 3 + 2];
        if (dot >= cosMin) continue;
        const deg = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
        A.fromBufferAttribute(p, l[0].i);
        const side = (C[f2 * 3] - A.x) * N[f1 * 3] + (C[f2 * 3 + 1] - A.y) * N[f1 * 3 + 1] + (C[f2 * 3 + 2] - A.z) * N[f1 * 3 + 2];
        out.push({deg, convex: side < 0, uv: l.map(e => [uv.getX(e.i), uv.getY(e.i), uv.getX(e.j), uv.getY(e.j)])});
      }
    });
    return out;
  };

  /** Draw the folds as lines in the atlas (an ink outline / cavity look
   *  that follows the geometry): opts.minDeg (default 40), opts.kind
   *  "all" | "convex" | "concave", opts.width in atlas px (default 2),
   *  opts.color, opts.alpha 0..1, opts.edges (a creaseEdges list to
   *  reuse; filtered here by minDeg and kind). Lines go on a layer, are
   *  composed through the stencil with alpha, then the padding is dilated
   *  so a line on an island border survives the renderer's bilinear
   *  sampling. Returns {edges, drawn}. */
  HP.edgeLines = function (pc, root, opts) {
    opts = opts || {};
    const minDeg = opts.minDeg == null ? 40 : opts.minDeg, kind = opts.kind || "all";
    const all = opts.edges || HP.creaseEdges(root, {minDeg});
    const W = pc.can.width, H = pc.can.height, width = opts.width || 2;
    if (!pc._edgeCan || pc._edgeCan.width !== W || pc._edgeCan.height !== H) {
      pc._edgeCan = document.createElement("canvas"); pc._edgeCan.width = W; pc._edgeCan.height = H;
    }
    const lc = pc._edgeCan.getContext("2d");
    lc.clearRect(0, 0, W, H); lc.lineCap = "round"; lc.lineJoin = "round"; lc.lineWidth = width;
    lc.strokeStyle = opts.color || "#000000"; lc.globalAlpha = 1;
    let drawn = 0, x0 = W, y0 = H, x1 = 0, y1 = 0;
    lc.beginPath();
    for (const e of all) {
      if (e.deg < minDeg) continue;
      if (kind === "convex" && !e.convex) continue;
      if (kind === "concave" && e.convex) continue;
      for (const sg of e.uv) {
        const ax = sg[0] * W, ay = sg[1] * H, bx = sg[2] * W, by = sg[3] * H;
        lc.moveTo(ax, ay); lc.lineTo(bx, by);
        x0 = Math.min(x0, ax, bx); x1 = Math.max(x1, ax, bx); y0 = Math.min(y0, ay, by); y1 = Math.max(y1, ay, by);
      }
      drawn++;
    }
    lc.stroke();
    if (!drawn) return {edges: all.length, drawn: 0};
    const pad = Math.ceil(width) + 1;
    x0 = Math.max(0, Math.floor(x0) - pad); y0 = Math.max(0, Math.floor(y0) - pad);
    x1 = Math.min(W, Math.ceil(x1) + pad); y1 = Math.min(H, Math.ceil(y1) + pad);
    const w = x1 - x0, h = y1 - y0; if (w <= 0 || h <= 0) return {edges: all.length, drawn};
    const src = lc.getImageData(x0, y0, w, h).data, img = pc.ctx.getImageData(x0, y0, w, h), d = img.data;
    const sten = HP._stencilData(pc), alpha = opts.alpha == null ? 1 : opts.alpha;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, a = src[i + 3] / 255 * alpha; if (!a) continue;
      if (sten && !sten[((y0 + y) * W + (x0 + x)) * 4 + 3]) continue;
      d[i] += (src[i] - d[i]) * a; d[i + 1] += (src[i + 1] - d[i + 1]) * a; d[i + 2] += (src[i + 2] - d[i + 2]) * a; d[i + 3] = 255;
    }
    pc.ctx.putImageData(img, x0, y0);
    HP.dilatePadding(pc, [x0, y0, x1, y1]);
    HP.refresh(pc);
    return {edges: all.length, drawn};
  };

  /** Eyedropper. Returns {hex, r, g, b}. */
  HP.pick = function (pc, u, v) {
    const d = pc.ctx.getImageData(Math.floor(u * pc.can.width),
                                  Math.floor(v * pc.can.height), 1, 1).data;
    return {hex: "#" + [d[0], d[1], d[2]].map(n => n.toString(16).padStart(2, "0")).join(""),
            r: d[0], g: d[1], b: d[2]};
  };

  /** Everything the recolour action needs: every texel within `tol` of
   *  target becomes `next`. Returns how many changed. */
  HP.recolour = function (pc, targetHex, nextHex, tol) {
    const img = pc.ctx.getImageData(0, 0, pc.can.width, pc.can.height), d = img.data;
    const [br, bg, bb] = HP.hexRgb(targetHex);
    const [fr, fg, fb] = HP.hexRgb(nextHex);
    const TOL = tol == null ? 45 : tol;
    const sten = HP._stencilData(pc);
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (sten && !sten[i + 3]) continue;
      if (Math.abs(d[i] - br) + Math.abs(d[i + 1] - bg) + Math.abs(d[i + 2] - bb) <= TOL) {
        d[i] = fr; d[i + 1] = fg; d[i + 2] = fb; n++;
      }
    }
    pc.ctx.putImageData(img, 0, 0);
    HP.refresh(pc);
    return n;
  };

  // ---------------- mask half (COLOR_0) ----------------

  /** RGBA float colour attribute on a mesh, created black/opaque (or
   *  upgraded from RGB) if absent. Returns the attribute. */
  HP.ensureColorAttr = function (mesh) {
    const g = mesh.geometry, cnt = g.attributes.position.count;
    if (!g.attributes.color || g.attributes.color.itemSize !== 4) {
      const arr = new Float32Array(cnt * 4);
      if (g.attributes.color && g.attributes.color.itemSize === 3) {
        for (let i = 0; i < cnt; i++) {
          arr[i * 4] = g.attributes.color.getX(i);
          arr[i * 4 + 1] = g.attributes.color.getY(i);
          arr[i * 4 + 2] = g.attributes.color.getZ(i);
          arr[i * 4 + 3] = 1;
        }
      } else for (let i = 0; i < cnt; i++) arr[i * 4 + 3] = 1;
      g.setAttribute("color", new THREE.BufferAttribute(arr, 4));
    }
    return g.attributes.color;
  };

  /** Cached world positions for a mesh (call after updateMatrixWorld). */
  HP.worldPositions = function (mesh) {
    const g = mesh.geometry, cnt = g.attributes.position.count;
    const wp = new Float32Array(cnt * 3), v = new THREE.Vector3();
    for (let i = 0; i < cnt; i++) {
      v.fromBufferAttribute(g.attributes.position, i);
      mesh.localToWorld(v);
      wp[i * 3] = v.x; wp[i * 3 + 1] = v.y; wp[i * 3 + 2] = v.z;
    }
    return wp;
  };

  /** Radius stamp into one mesh's channel. entry: {mesh, world}
   *  (world from HP.worldPositions). opts: {point THREE.Vector3,
   *  radius, k strength 0..1, dir +1/-1, ch 0..3, flags Uint8Array?,
   *  step gain (default .5 add / .6*k lerp-ish)}. Returns true if any
   *  vertex changed. */
  HP.maskStamp = function (entry, opts) {
    const col = entry.mesh.geometry.attributes.color, w = entry.world;
    const p = opts.point, r2 = opts.radius * opts.radius;
    const gain = (opts.step == null ? 0.6 : opts.step) * (opts.k == null ? 1 : opts.k)
      * (opts.dir == null ? 1 : opts.dir);
    let any = false;
    for (let i = 0; i < col.count; i++) {
      if (opts.flags && !opts.flags[i]) continue;
      const dx = w[i * 3] - p.x, dy = w[i * 3 + 1] - p.y, dz = w[i * 3 + 2] - p.z;
      if (dx * dx + dy * dy + dz * dz > r2) continue;
      const j = i * 4 + opts.ch;
      col.array[j] = Math.max(0, Math.min(1, col.array[j] + gain));
      any = true;
    }
    if (any) col.needsUpdate = true;
    return any;
  };

  /** Apply fn to a channel across a root's meshes (optionally flagged). */
  HP.maskChannel = function (root, ch, fn, flagsByMeshIndex) {
    let mi = 0;
    root.traverse(n => {
      if (!n.isMesh || !n.geometry.attributes || !n.geometry.attributes.color) return;
      const col = n.geometry.attributes.color;
      const flags = flagsByMeshIndex ? flagsByMeshIndex[mi] : null;
      mi++;
      for (let i = 0; i < col.count; i++) {
        if (flags && !flags[i]) continue;
        const j = i * 4 + ch;
        col.array[j] = fn(col.array[j]);
      }
      col.needsUpdate = true;
    });
  };

  /** Serialise a root's R channel: {counts:[per mesh], data: base64}. */
  HP.maskData = function (root) {
    const counts = [], parts = [];
    root.traverse(n => {
      if (!n.isMesh || !n.geometry.attributes.color) return;
      const col = n.geometry.attributes.color;
      const u8 = new Uint8Array(col.count);
      for (let i = 0; i < col.count; i++)
        u8[i] = Math.round(Math.max(0, Math.min(1, col.array[i * 4])) * 255);
      counts.push(col.count);
      parts.push(u8);
    });
    const all = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
    let o = 0; for (const p of parts) { all.set(p, o); o += p.length; }
    let bin = "";
    for (let i = 0; i < all.length; i += 8192)
      bin += String.fromCharCode.apply(null, all.subarray(i, i + 8192));
    return {counts, data: btoa(bin)};
  };

  /** The inverse; count-mismatched meshes are skipped, never fatal. */
  HP.applyMaskData = function (root, mask) {
    if (!mask || !mask.data) return;
    const raw = atob(mask.data);
    let o = 0, mi = 0;
    root.traverse(n => {
      if (!n.isMesh || !n.geometry.attributes || !n.geometry.attributes.position) return;
      HP.ensureColorAttr(n);
      const col = n.geometry.attributes.color;
      const want = (mask.counts || [])[mi++];
      if (want !== col.count) { o += (want || 0); return; }
      for (let i = 0; i < col.count; i++)
        col.array[i * 4] = raw.charCodeAt(o + i) / 255;
      o += col.count;
      col.needsUpdate = true;
    });
  };

  /** Full RGBA bytes of one mesh's colour attribute (the Paint page's
   *  mask-save payload). */
  HP.colorBytes = function (mesh) {
    const a = mesh.geometry.attributes.color.array;
    const u8 = new Uint8Array(a.length);
    for (let i = 0; i < a.length; i++)
      u8[i] = Math.max(0, Math.min(255, Math.round(a[i] * 255)));
    let bin = "";
    for (let i = 0; i < u8.length; i += 8192)
      bin += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
    return btoa(bin);
  };

  // ---------------- shared palette + helpers ----------------

  HP.SWATCH_KEY = "paint.swatches";
  HP.DEFAULT_SWATCHES = ["#c94f4f", "#e08c3a", "#e6c86e", "#7aa65a", "#4f8f6e",
    "#4f7ac9", "#7a5ac9", "#b45ac0", "#8a5a3a", "#5a4632", "#d9d2c5",
    "#8f8a99", "#3a3244", "#171320", "#f5f2ff", "#2e6b5e"];

  HP.loadSwatches = function () {
    try {
      return JSON.parse(localStorage.getItem(HP.SWATCH_KEY) || "null")
        || HP.DEFAULT_SWATCHES.slice();
    } catch (e) { return HP.DEFAULT_SWATCHES.slice(); }
  };
  HP.saveSwatches = function (list) {
    try { localStorage.setItem(HP.SWATCH_KEY, JSON.stringify(list)); } catch (e) {}
  };

  /** A palette of n colours from pc's texels by median cut: boxes of
   *  texels split at the median of their widest channel until there are n,
   *  each box's mean a colour; sorted dark to light. Sampled to ~64k texels. */
  HP.paletteFromCanvas = function (pc, n) {
    const W = pc.can.width, H = pc.can.height, d = pc.ctx.getImageData(0, 0, W, H).data;
    const step = Math.max(1, Math.floor(Math.sqrt(W * H / 65536))), pts = [];
    for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) { const i = (y * W + x) * 4; if (d[i + 3] > 8) pts.push([d[i], d[i + 1], d[i + 2]]); }
    if (!pts.length) return [];
    let boxes = [pts];
    while (boxes.length < n) {
      let bi = -1, bw = -1, bc = 0;
      boxes.forEach((b, i) => { if (b.length < 2) return; for (let ch = 0; ch < 3; ch++) { let lo = 255, hi = 0; for (const p of b) { if (p[ch] < lo) lo = p[ch]; if (p[ch] > hi) hi = p[ch]; } if (hi - lo > bw) { bw = hi - lo; bi = i; bc = ch; } } });
      if (bi < 0 || bw === 0) break;
      const b = boxes[bi]; b.sort((p, q) => p[bc] - q[bc]); const m = b.length >> 1;
      boxes.splice(bi, 1, b.slice(0, m), b.slice(m));
    }
    return boxes.map(b => { const s = [0, 0, 0]; for (const p of b) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; } return s.map(x => Math.round(x / b.length)); })
      .sort((a, b) => (a[0] * 0.299 + a[1] * 0.587 + a[2] * 0.114) - (b[0] * 0.299 + b[1] * 0.587 + b[2] * 0.114))
      .map(c => "#" + c.map(v => v.toString(16).padStart(2, "0")).join(""));
  };

  /** The N dominant colours of an image (4-bit bucket vote). */
  HP.dominantColors = function (image, n) {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const x = c.getContext("2d"); x.drawImage(image, 0, 0, 64, 64);
    const d = x.getImageData(0, 0, 64, 64).data, vote = {};
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      const k = (d[i] >> 4) + "," + (d[i + 1] >> 4) + "," + (d[i + 2] >> 4);
      (vote[k] = vote[k] || {n: 0, r: 0, g: 0, b: 0});
      vote[k].n++; vote[k].r += d[i]; vote[k].g += d[i + 1]; vote[k].b += d[i + 2];
    }
    return Object.values(vote).sort((a, b) => b.n - a.n).slice(0, n || 8)
      .map(t => "#" + [t.r / t.n, t.g / t.n, t.b / t.n]
        .map(v => Math.round(v).toString(16).padStart(2, "0")).join(""));
  };

  // ---------------- shapes (line / rect / ellipse) ----------------
  // Hector, 2026-09-24: "trying to make a line identical to the other
  // side, but brush is circular -- I need line and shape tools." Shapes
  // ride the SAME per-stroke session as the brush, so opacity, blend
  // mode, soft and a face selection all apply exactly as they do to a
  // stroke; each move redraws the layer, so the drag IS the preview.

  HP.beginShape = function (pc, opts) { return HP.beginStroke(pc, opts); };

  /** Redraw the session's shape from (u0,v0) to (u1,v1) in UV 0..1.
   *  sopts: {fill: bool, snap: bool}. snap locks lines to 45 degree
   *  steps and rect/ellipse to square/circle (measured in atlas pixels,
   *  so it is square ON THE TEXTURE). */
  HP.shapeSession = function (sess, kind, u0, v0, u1, v1, sopts) {
    const o = sess.opts, L = sess.layer, c = sess.lctx;
    const W = L.width, H = L.height, so = sopts || {};
    if (o.pixel > 0 && (kind === "line" || kind === "rect" || kind === "ellipse")) {   // pixel shapes: whole texels, no anti-aliasing
      let px0 = Math.floor(u0 * W), py0 = Math.floor(v0 * H), px1 = Math.floor(u1 * W), py1 = Math.floor(v1 * H);
      if (so.snap) { const s2 = HP._snapP1(kind, px0, py0, px1, py1, so); px1 = Math.round(s2[0]); py1 = Math.round(s2[1]); }
      const pts = kind === "line" ? HP.pixLine(px0, py0, px1, py1) : kind === "rect" ? HP.pixRect(px0, py0, px1, py1, so.fill) : HP.pixEllipse(px0, py0, px1, py1, so.fill);
      c.clearRect(0, 0, W, H);
      const rgb = o.quant5 ? HP.hexRgb(o.color).map(HP.quant5) : HP.hexRgb(o.color);
      c.fillStyle = "rgb(" + rgb.join(",") + ")";
      for (const [x, y] of pts) c.fillRect(x, y, 1, 1);
      HP._compose(sess);
      return;
    }
    const x0 = u0 * W, y0 = v0 * H;
    let x1 = u1 * W, y1 = v1 * H;
    if (so.snap) [x1, y1] = HP._snapP1(kind, x0, y0, x1, y1, so);
    c.clearRect(0, 0, W, H);
    c.save();
    const blur = o.soft > 0 ? Math.max(0.5, o.size * o.soft * 0.5) : 0;
    c.filter = blur ? "blur(" + blur + "px)" : "none";
    c.strokeStyle = c.fillStyle = o.color;
    c.lineWidth = Math.max(1, o.size);
    c.lineCap = "round"; c.lineJoin = "round";
    HP._drawPrimitive(c, kind, x0, y0, x1, y1, so, Math.max(1, o.size), false);
    c.restore();
    HP._compose(sess);
  };

  /** Grow triangle P ([[x,y] x3]) by pushing every EDGE out d px, with
   *  the corner miter capped at 4d. The first version pushed vertices
   *  away from the centroid, which barely moves the long edges of the
   *  sliver triangles generated meshes are full of -- anti-aliased clips
   *  then left hairline seams where triangles meet (2026-09-24 harness). */
  HP._inflate = function (P, d) {
    const n = [];
    for (let i = 0; i < 3; i++) {
      const A = P[i], B = P[(i + 1) % 3], O = P[(i + 2) % 3];
      let nx = B[1] - A[1], ny = A[0] - B[0];
      const l = Math.hypot(nx, ny);
      if (l < 1e-9) return P.map(q => q.slice());       // degenerate: leave it
      nx /= l; ny /= l;
      if (nx * (O[0] - A[0]) + ny * (O[1] - A[1]) > 0) { nx = -nx; ny = -ny; }
      n.push([nx, ny]);                                  // outward normal of edge i
    }
    return P.map((V, i) => {
      const a = n[(i + 2) % 3], b = n[i];                // the two edges meeting at V
      const k = d / Math.max(1e-6, 1 + a[0] * b[0] + a[1] * b[1]);
      let ex = (a[0] + b[0]) * k, ey = (a[1] + b[1]) * k;
      const L = Math.hypot(ex, ey), cap = 4 * d;
      if (L > cap) { ex *= cap / L; ey *= cap / L; }
      return [V[0] + ex, V[1] + ey];
    });
  };

  /** Atlas texels per world unit on the triangle a raycast `hit` landed
   *  on (W x H = atlas size) -- how big a brush of N atlas px really is
   *  there. null when the hit has no UVs. */
  HP.texelsPerWorld = function (hit, W, H) {
    const g = hit && hit.object && hit.object.geometry, f = hit && hit.face;
    if (!g || !f || !g.attributes.uv) return null;
    const pos = g.attributes.position, uv = g.attributes.uv, mw = hit.object.matrixWorld;
    const A = new THREE.Vector3().fromBufferAttribute(pos, f.a).applyMatrix4(mw);
    const B = new THREE.Vector3().fromBufferAttribute(pos, f.b).applyMatrix4(mw);
    const C = new THREE.Vector3().fromBufferAttribute(pos, f.c).applyMatrix4(mw);
    const wa = B.sub(A).cross(C.sub(A)).length() / 2;
    const ax = uv.getX(f.a) * W, ay = uv.getY(f.a) * H;
    const ua = Math.abs((uv.getX(f.b) * W - ax) * (uv.getY(f.c) * H - ay) -
                        (uv.getX(f.c) * W - ax) * (uv.getY(f.b) * H - ay)) / 2;
    return wa > 1e-12 && ua > 1e-9 ? Math.sqrt(ua / wa) : null;
  };

  /** CSS px that `worldLen` world units span at `point` for `camera`
   *  drawn `viewH` CSS px tall. */
  HP.worldToScreenPx = function (camera, point, worldLen, viewH) {
    if (camera.isOrthographicCamera)
      return worldLen * viewH * camera.zoom / Math.max(1e-9, camera.top - camera.bottom);
    const depth = -point.clone().applyMatrix4(camera.matrixWorldInverse).z;
    return worldLen * viewH / Math.max(1e-9, 2 * depth * Math.tan(camera.fov * Math.PI / 360));
  };

  /** On-screen diameter of a brush `sizePx` ATLAS px wide at `hit`. The
   *  cursor rings used to be the slider value in SCREEN px -- right at
   *  one zoom only, and 4x too big on a quarter-scale atlas panel
   *  (Hector: "size doesn't scale with the smooth brush", 2026-09-24). */
  HP.brushScreenPx = function (hit, camera, viewH, sizePx, W, H) {
    const tpw = HP.texelsPerWorld(hit, W, H);
    return tpw ? HP.worldToScreenPx(camera, hit.point, sizePx / tpw, viewH) : null;
  };

  /** Planar DECAL for 3D shape drags. The first version extended the
   *  START triangle's UV map, which is only valid inside that triangle's
   *  UV island -- and generated pieces split flat faces into islands and
   *  warp the map from triangle to triangle (the env wall's one flat front
   *  face is 6 UV islands; its vertex buffer is split into 1270 index
   *  pieces, which an earlier count mistook for 272 islands), so a
   *  line "stopped" a few triangles in and the rest painted unrelated
   *  atlas pixels (Hector, 2026-09-24). Instead the shape lives in the
   *  start face's PLANE (world units) and is projected along its normal
   *  through EVERY triangle of `root` that faces the same way within a
   *  depth band: each gets its own affine plane->uv map and a clip, so
   *  the line crosses any number of islands. The 2D frame is aligned to
   *  the world (x = horizontal, y = up on walls; world x/z on floors), so
   *  snap means level and plumb, not "parallel to some triangle edge".
   *  Built ONCE per drag. W/H = atlas size in pixels.
   *  `root` may be an ARRAY of placed copies that share this atlas: the
   *  environment page passes a piece and its same-kind neighbours, so a
   *  smooth/smudge stroke sees ACROSS the join between two copies (Hector,
   *  2026-09-24: two walls side by side "should see the opposite side's
   *  texture and blend into it"). The depth band comes from the first. */
  HP._affine2 = function (p, u) {                       // 2D -> uv px, 3 point pairs
    const d = (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1]);
    if (Math.abs(d) < 1e-12) return null;
    const m11 = ((u[1][0] - u[0][0]) * (p[2][1] - p[0][1]) - (u[2][0] - u[0][0]) * (p[1][1] - p[0][1])) / d;
    const m12 = ((u[2][0] - u[0][0]) * (p[1][0] - p[0][0]) - (u[1][0] - u[0][0]) * (p[2][0] - p[0][0])) / d;
    const m21 = ((u[1][1] - u[0][1]) * (p[2][1] - p[0][1]) - (u[2][1] - u[0][1]) * (p[1][1] - p[0][1])) / d;
    const m22 = ((u[2][1] - u[0][1]) * (p[1][0] - p[0][0]) - (u[1][1] - u[0][1]) * (p[2][0] - p[0][0])) / d;
    return [m11, m21, m12, m22,
            u[0][0] - m11 * p[0][0] - m12 * p[0][1],
            u[0][1] - m21 * p[0][0] - m22 * p[0][1]];
  };
  // roots: Object3Ds, or {root, pc} pairs when several PIECES with their
  // own textures form one surface (the environment page: two saved
  // versions of the same wall side by side -- Hector, 2026-09-25). Each
  // triangle then records the pc it reads from and writes to.
  HP._decalRoots = root => (Array.isArray(root) ? root : [root]).map(r => (r && r.isObject3D) ? {root: r, pc: null} : r);
  /** World-aligned 2D basis in the plane with normal N: y = up on walls,
   *  x = world x on floors -- so snap means level and plumb. */
  HP._planeBasis = function (N) {
    const V3 = THREE.Vector3, up = new V3(0, 1, 0);
    let ex, ey;
    if (Math.abs(N.dot(up)) < 0.85) {                 // wall-ish: y = up
      ey = up.clone().addScaledVector(N, -N.dot(up)).normalize();
      ex = new V3().crossVectors(ey, N).normalize();
    } else {                                          // floor-ish: x = world x
      const wx = new V3(1, 0, 0);
      ex = wx.clone().addScaledVector(N, -N.dot(wx)).normalize();
      ey = new V3().crossVectors(N, ex).normalize();
    }
    return [ex, ey];
  };
  HP.planarDecal = function (root, hit, W, H, opts) {
    const roots = HP._decalRoots(root);
    const V3 = THREE.Vector3;
    const g0 = hit.object.geometry, f0 = hit.face;
    if (!g0.attributes.uv || !f0) return null;
    const mw0 = hit.object.matrixWorld, pos0 = g0.attributes.position;
    const A = new V3().fromBufferAttribute(pos0, f0.a).applyMatrix4(mw0);
    const B = new V3().fromBufferAttribute(pos0, f0.b).applyMatrix4(mw0);
    const C = new V3().fromBufferAttribute(pos0, f0.c).applyMatrix4(mw0);
    const N = new V3().subVectors(B, A).cross(new V3().subVectors(C, A)).normalize();
    if (!isFinite(N.x)) return null;
    const O = hit.point.clone();
    const [ex, ey] = HP._planeBasis(N);
    const q = new V3();
    const to2D = P => { q.subVectors(P, O); return [q.dot(ex), q.dot(ey)]; };
    // texel density at the start triangle converts brush px -> world width
    const uv0 = g0.attributes.uv;
    const a0 = HP._affine2([to2D(A), to2D(B), to2D(C)],
      [[uv0.getX(f0.a) * W, uv0.getY(f0.a) * H], [uv0.getX(f0.b) * W, uv0.getY(f0.b) * H],
       [uv0.getX(f0.c) * W, uv0.getY(f0.c) * H]]);
    let pxPerWorld = a0 ? Math.sqrt(Math.abs(a0[0] * a0[3] - a0[2] * a0[1])) : 1;
    // a cap (n64ify folds a stem's end into one texel: no UV area) has no texel size of its own -- the brush
    // pressed there painted NOTHING, not even onto the faces round it (2026-09-27): the mesh's own median
    if (!(pxPerWorld > 1e-6)) pxPerWorld = HP._meshPxPerWorld(hit.object, W, H) || 1;
    return HP._decalBuild(roots, O, N, ex, ey, pxPerWorld, W, H, opts);
  };
  /** A mesh's median texel density (atlas px per world unit) over its faces with UV area. */
  HP._meshPxPerWorld = function (mesh, W, H) {
    const g = mesh.geometry, pos = g.attributes.position, uv = g.attributes.uv, ix = g.index; if (!uv) return 0;
    const V3 = THREE.Vector3, a = new V3(), b = new V3(), c = new V3(), sc = new V3().setFromMatrixScale(mesh.matrixWorld), k = (Math.abs(sc.x) + Math.abs(sc.y) + Math.abs(sc.z)) / 3 || 1;
    const out = [], n = ix ? ix.count : pos.count;
    for (let i = 0; i < n; i += 3) {
      const q = [0, 1, 2].map(j => ix ? ix.getX(i + j) : i + j);
      a.fromBufferAttribute(pos, q[0]); b.fromBufferAttribute(pos, q[1]); c.fromBufferAttribute(pos, q[2]);
      const wa = b.sub(a).cross(c.sub(a)).length() / 2 * k * k;
      const ua = Math.abs((uv.getX(q[1]) - uv.getX(q[0])) * (uv.getY(q[2]) - uv.getY(q[0])) - (uv.getX(q[2]) - uv.getX(q[0])) * (uv.getY(q[1]) - uv.getY(q[0]))) / 2 * W * H;
      if (wa > 1e-12 && ua > 1e-6) out.push(Math.sqrt(ua / wa));
    }
    out.sort((x, y) => x - y);
    return out.length ? out[out.length >> 1] : 0;
  };
  /** The same decal from a world-space basis {o, n, ex, ey, ppw} -- how a
   *  recorded shape (phase 3) gets its plane back without a raycast. */
  HP.planarDecalFrom = function (root, basis, W, H, opts) {
    const V3 = THREE.Vector3;
    return HP._decalBuild(HP._decalRoots(root), new V3().fromArray(basis.o), new V3().fromArray(basis.n),
      new V3().fromArray(basis.ex), new V3().fromArray(basis.ey), basis.ppw || 1, W, H, opts);
  };
  HP._decalBuild = function (roots, O, N, ex, ey, pxPerWorld, W, H, opts) {
    const V3 = THREE.Vector3, q = new V3();
    const to2D = P => { q.subVectors(P, O); return [q.dot(ex), q.dot(ey)]; };
    const affine = HP._affine2;
    for (const r of roots) r.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(roots[0].root);
    // depth band: faces this far from the plane count as "this face". 8%
    // of the piece suits smooth/smudge/shapes on a flat face; the surface
    // BRUSH passes opts.bandPx (a few brush widths, atlas px) so a dab
    // never paints through onto a surface just behind -- a torso behind
    // an arm -- the way the island-bound flat brush never could.
    const span = box.getSize(new V3()).length();
    // The brush band is in atlas px, so on a low-density atlas it grew into
    // metres: an N64 model (32-texel atlas on a 0.9 m character, ~30 px/m)
    // got a 15 cm band and every stroke painted the arm AND the torso behind
    // it (Hector, 2026-09-25: "brush, smooth, paint all screwed" on the N64
    // versions). Cap it at 2% of the piece: 1.8 cm there, and the wall's
    // 1 cm band is untouched.
    const band = opts && opts.bandPx
      ? Math.min(Math.max(0.01, opts.bandPx / pxPerWorld), Math.max(0.01, span * 0.02))
      : Math.max(1e-4, span * 0.08);
    const tris = [];
    const va = new V3(), vb = new V3(), vc = new V3(), nt = new V3(), e1 = new V3(), e2 = new V3();
    for (const rt of roots) rt.root.traverse(n => {
      if (!n.isMesh || !n.geometry.attributes.uv) return;
      const g = n.geometry, pos = g.attributes.position, uv = g.attributes.uv, ix = g.index;
      const cnt = ix ? ix.count : pos.count;
      for (let i = 0; i < cnt; i += 3) {
        const ia = ix ? ix.getX(i) : i, ib = ix ? ix.getX(i + 1) : i + 1, ic = ix ? ix.getX(i + 2) : i + 2;
        va.fromBufferAttribute(pos, ia).applyMatrix4(n.matrixWorld);
        vb.fromBufferAttribute(pos, ib).applyMatrix4(n.matrixWorld);
        vc.fromBufferAttribute(pos, ic).applyMatrix4(n.matrixWorld);
        e1.subVectors(vb, va); e2.subVectors(vc, va);
        nt.crossVectors(e1, e2);
        const len = nt.length(); if (len < 1e-12) continue;
        if (nt.dot(N) / len < 0.5) continue;            // faces away / perpendicular
        const depth = Math.abs(((va.x + vb.x + vc.x) / 3 - O.x) * N.x +
                               ((va.y + vb.y + vc.y) / 3 - O.y) * N.y +
                               ((va.z + vb.z + vc.z) / 3 - O.z) * N.z);
        if (depth > band) continue;                      // a different parallel face
        const p = [to2D(va), to2D(vb), to2D(vc)];
        const u = [[uv.getX(ia) * W, uv.getY(ia) * H], [uv.getX(ib) * W, uv.getY(ib) * H],
                   [uv.getX(ic) * W, uv.getY(ic) * H]];
        const m = affine(p, u); if (!m) continue;
        // clip polygon grown 1.5px on every edge: paints into the atlas
        // padding so island borders do not show hairline seams
        const clip = HP._inflate(u, 1.5);
        tris.push({m, clip, p, pc: rt.pc,
          ub: [Math.floor(Math.min(clip[0][0], clip[1][0], clip[2][0])),
               Math.floor(Math.min(clip[0][1], clip[1][1], clip[2][1])),
               Math.ceil(Math.max(clip[0][0], clip[1][0], clip[2][0])),
               Math.ceil(Math.max(clip[0][1], clip[1][1], clip[2][1]))],
          bb: [Math.min(p[0][0], p[1][0], p[2][0]), Math.min(p[0][1], p[1][1], p[2][1]),
               Math.max(p[0][0], p[1][0], p[2][0]), Math.max(p[0][1], p[1][1], p[2][1])]});
      }
    });
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(N, O);
    const P = new V3();
    return {
      tris, pxPerWorld, start: [0, 0], normal: N.clone(), plane, band,
      basis: {o: O.toArray(), n: N.toArray(), ex: ex.toArray(), ey: ey.toArray(), ppw: pxPerWorld},
      point: ray => (ray.intersectPlane(plane, P) ? to2D(P) : null),
      // plane <-> world, for shape handles and chaining across decals
      to2D: P2 => to2D(P2),
      toWorld: q => new V3().copy(O).addScaledVector(ex, q[0]).addScaledVector(ey, q[1]),
    };
  };

  /** Snap p1 for a shape: lines to 45 degree steps, rect/ellipse to a
   *  square, text upright (its up vector to 90 degree steps), an image to
   *  its own aspect. Returns [x1, y1]. */
  HP._snapP1 = function (kind, x0, y0, x1, y1, so) {
    const dx = x1 - x0, dy = y1 - y0;
    if (kind === "line" || kind === "text") {
      const step = kind === "line" ? Math.PI / 4 : Math.PI / 2;
      const a = Math.round(Math.atan2(dy, dx) / step) * step, len = Math.hypot(dx, dy);
      return [x0 + Math.cos(a) * len, y0 + Math.sin(a) * len];
    }
    if (kind === "image") {
      const img = HP._imgFor(so && so.img), asp = img && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1;
      const h = Math.abs(dy) || Math.abs(dx) / asp;
      return [x0 + (dx < 0 ? -1 : 1) * h * asp, y0 + (dy < 0 ? -1 : 1) * h];
    }
    const m = Math.max(Math.abs(dx), Math.abs(dy));
    return [x0 + (dx < 0 ? -m : m), y0 + (dy < 0 ? -m : m)];
  };
  // image decals (phase 3c): records carry the picture as a data URL;
  // drawing needs a decoded element, so preload before a replay
  HP._imgs = new Map();
  HP._imgFor = function (src) {
    if (!src) return null;
    let im = HP._imgs.get(src);
    if (!im) { im = new Image(); im.src = src; HP._imgs.set(src, im); }
    return im;
  };
  /** Resolve when every image the records carry is decoded (or failed). */
  HP.preloadImages = function (records) {
    const ps = [];
    for (const r of records || []) {
      if (!r.img) continue;
      const im = HP._imgFor(r.img);
      if (!im.complete) ps.push(new Promise(res => { im.addEventListener("load", res, {once: true}); im.addEventListener("error", res, {once: true}); }));
    }
    return Promise.all(ps);
  };
  /** Draw one primitive with the context already in the shape's own units
   *  (plane metres through a decal, atlas px flat). Lines, rects and
   *  ellipses use the current stroke/fill style and width; text (phase 3c:
   *  p0 the left end of the baseline, p1 the top of the letters above it,
   *  so height and tilt come from the two handles; fill or outlined with
   *  the width) and images (p0/p1 opposite corners, the top toward "up").
   *  `yUp`: a decal plane's y points up, so text and pictures go through a
   *  flip to read upright; the flat atlas is y-down already. */
  HP._drawPrimitive = function (c, kind, x0, y0, x1, y1, so, w, yUp) {
    if (kind === "line") { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); return; }
    if (kind === "rect") {
      const rx = Math.min(x0, x1), ry = Math.min(y0, y1), rw = Math.abs(x1 - x0), rh = Math.abs(y1 - y0);
      if (so.fill) c.fillRect(rx, ry, rw, rh); else c.strokeRect(rx, ry, rw, rh);
      return;
    }
    if (kind === "ellipse") {
      c.beginPath();
      c.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, Math.PI * 2);
      if (so.fill) c.fill(); else c.stroke();
      return;
    }
    if (kind === "text") {
      const h = Math.hypot(x1 - x0, y1 - y0), text = so.text || "";
      if (h <= 0 || !text) return;
      const uy = [(x1 - x0) / h, (y1 - y0) / h];                   // the letters' up
      const ux = yUp ? [uy[1], -uy[0]] : [-uy[1], uy[0]];          // the baseline, reading direction
      c.save();
      c.transform(ux[0], ux[1], -uy[0], -uy[1], x0, y0);          // canvas x -> baseline, canvas y (down) -> -up
      c.scale(h / 100, h / 100);                                  // 100 px glyphs scaled to h: tiny font sizes are not reliable
      c.font = (so.bold ? "bold " : "") + "100px " + (so.font || "sans-serif");
      c.textBaseline = "alphabetic"; c.textAlign = "left";
      if (so.fill === false) { c.lineWidth = Math.max(0.5, w) * 100 / h; c.strokeText(text, 0, 0); }
      else c.fillText(text, 0, 0);
      c.restore();
      return;
    }
    if (kind === "image") {
      const img = HP._imgFor(so.img);
      if (!img || !img.complete || !img.naturalWidth) return;
      const rx = Math.min(x0, x1), ry = Math.min(y0, y1), rw = Math.abs(x1 - x0), rh = Math.abs(y1 - y0);
      if (!rw || !rh) return;
      c.save();
      if (yUp) { c.transform(1, 0, 0, -1, rx, ry + rh); c.drawImage(img, 0, 0, rw, rh); }
      else c.drawImage(img, rx, ry, rw, rh);
      c.restore();
    }
  };
  /** The extent a shape can reach beyond its two points (text runs along
   *  its baseline): used to pick the decal triangles it may touch. */
  HP._shapeReach = function (kind, x0, y0, x1, y1, so) {
    if (kind !== "text") return 0;
    const h = Math.hypot(x1 - x0, y1 - y0);
    return h * (0.75 * (so.text || "").length + 1);
  };

  /** Redraw a shape from p0 to p1 (decal-plane 2D, world units) through
   *  every triangle of the decal. Same session contract as shapeSession:
   *  opacity/blend/selection apply at compose. Edges are crisp -- a blur
   *  would be cut at every triangle clip, so soft is not applied here. */
  HP.decalShapeSession = function (sess, decal, kind, p0, p1, sopts) {
    const o = sess.opts, c = sess.lctx, L = sess.layer, so = sopts || {};
    let [x0, y0] = p0, [x1, y1] = p1;
    if (so.snap) [x1, y1] = HP._snapP1(kind, x0, y0, x1, y1, so);
    const w = Math.max(1, o.size) / decal.pxPerWorld;   // brush px -> world width
    const reach = w + HP._shapeReach(kind, x0, y0, x1, y1, so);
    const bx0 = Math.min(x0, x1) - reach, by0 = Math.min(y0, y1) - reach;
    const bx1 = Math.max(x0, x1) + reach, by1 = Math.max(y0, y1) + reach;
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (!so.keep) c.clearRect(0, 0, L.width, L.height);   // keep: a mirrored copy adds to what is there
    for (const t of decal.tris) {
      if (t.bb[2] < bx0 || t.bb[0] > bx1 || t.bb[3] < by0 || t.bb[1] > by1) continue;
      (sess._shapeRects || (sess._shapeRects = [])).push(t.ub);
      c.save();
      c.beginPath();
      c.moveTo(t.clip[0][0], t.clip[0][1]);
      c.lineTo(t.clip[1][0], t.clip[1][1]);
      c.lineTo(t.clip[2][0], t.clip[2][1]);
      c.closePath();
      c.clip();
      c.setTransform(t.m[0], t.m[1], t.m[2], t.m[3], t.m[4], t.m[5]);
      c.strokeStyle = c.fillStyle = o.color;
      c.lineWidth = w; c.lineCap = "round"; c.lineJoin = "round";
      HP._drawPrimitive(c, kind, x0, y0, x1, y1, so, w, true);
      c.restore();
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (sess._shapeRects) {                              // the shape's paint continues into the padding (on the layer)
      for (const R of HP._mergeRects(sess._shapeRects, sess.pc.can.width, sess.pc.can.height)) HP.dilatePadding(sess.pc, R, sess.lctx);
      sess._shapeRects = null;
    }
    HP._compose(sess);
  };

  /** A shape through a MULTI-texture decal (copies and saved versions of
   *  a piece side by side, planarDecal([{root, pc}...])): one shape
   *  session per texture the decal touches, each redrawn from the same two
   *  plane points. `ms` is the {pc, opts, sessions} record the surface
   *  brush keeps; beginShapeMulti makes one. */
  HP.beginShapeMulti = function (pc, opts) {
    return {pc, opts, sessions: new Map([[pc, HP.beginShape(pc, opts)]])};
  };
  HP.decalShapeMulti = function (ms, decal, kind, p0, p1, sopts) {
    for (const g of HP._groups(decal, ms.pc))
      HP.decalShapeSession(HP._sessFor(ms, g.pc), g.decal, kind, p0, p1, sopts);
  };

  // ---------------- vector shape overlay (phase 3 of the paint roadmap) ----------------
  // A shape drawn on the model is kept as a RECORD: its plane in the mesh's
  // own space, its two points in metres on that plane, and the brush
  // settings it was drawn with. Records replay onto any base texture of
  // the same mesh (a saved copy, a later session) byte for byte, so shapes
  // stay editable across saves: the atlas = base (+) replay(records), and
  // the overlay is always on top until it is flattened into the base.
  HP.shapeRecord = function (root, decal, kind, p0, p1, opts, sopts) {
    const rec = {id: Math.random().toString(36).slice(2, 10), tool: kind, p0: [p0[0], p0[1]], p1: [p1[0], p1[1]],
      size: opts.size, color: opts.color, alpha: opts.alpha == null ? 1 : opts.alpha, bmode: opts.bmode || "source-over",
      fill: !!(sopts && sopts.fill), snap: !!(sopts && sopts.snap), plane: null};
    if (kind === "text") { rec.text = (sopts && sopts.text) || ""; rec.font = (sopts && sopts.font) || "sans-serif"; rec.bold = !!(sopts && sopts.bold); }
    if (kind === "image") rec.img = (sopts && sopts.img) || null;
    if (opts.pixel) rec.pixel = true;                           // N64 mode: whole texels, replayed the same way
    if (decal && decal.basis) {
      // the plane in the root's own space: the viewer only moves the root
      root.updateMatrixWorld(true);                  // a piece moved this frame has not been rendered yet
      const V3 = THREE.Vector3, inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
      const dir = a => new V3().fromArray(a).transformDirection(inv).toArray();
      rec.plane = {o: new V3().fromArray(decal.basis.o).applyMatrix4(inv).toArray(),
        n: dir(decal.basis.n), ex: dir(decal.basis.ex), ey: dir(decal.basis.ey), ppw: decal.basis.ppw};
    }
    return rec;
  };
  /** The decal a record draws through, on this root (cached per id). */
  HP.recordDecal = function (root, rec, W, H, cache) {
    if (!rec.plane) return null;
    if (cache && cache.has(rec.id)) return cache.get(rec.id);
    root.updateMatrixWorld(true);
    const V3 = THREE.Vector3, m = root.matrixWorld;
    const b = {o: new V3().fromArray(rec.plane.o).applyMatrix4(m).toArray(),
      n: new V3().fromArray(rec.plane.n).transformDirection(m).toArray(),
      ex: new V3().fromArray(rec.plane.ex).transformDirection(m).toArray(),
      ey: new V3().fromArray(rec.plane.ey).transformDirection(m).toArray(), ppw: rec.plane.ppw};
    const d = HP.planarDecalFrom(root, b, W, H);
    if (cache && d) cache.set(rec.id, d);
    return d;
  };
  /** Replay records onto pc, in order, over whatever it holds, ignoring
   *  the selection (a record is not limited by a later selection).
   *  opts.cache: a Map of decals by record id. Returns the count drawn. */
  HP.replayShapes = function (pc, root, records, opts) {
    opts = opts || {};
    const W = pc.can.width, H = pc.can.height, sten = pc.stencil;
    pc.stencil = null;
    let n = 0;
    try {
      for (const rec of records || []) {
        const sess = HP.beginShape(pc, {size: rec.size, color: rec.color, alpha: rec.alpha, bmode: rec.bmode, soft: 0, pixel: rec.pixel ? 1 : 0, quant5: !!rec.pixel});
        const so = {fill: rec.fill, snap: rec.snap, text: rec.text, font: rec.font, bold: rec.bold, img: rec.img};
        if (rec.plane) {
          const d = HP.recordDecal(root, rec, W, H, opts.cache); if (!d) continue;
          HP.decalShapeSession(sess, d, rec.tool, rec.p0, rec.p1, so);
        } else HP.shapeSession(sess, rec.tool, rec.p0[0], rec.p0[1], rec.p1[0], rec.p1[1], so);
        n++;
      }
    } finally { pc.stencil = sten; }
    if (sten) HP.refresh(pc);
    return n;
  };

  /** Distance from (x, y) to a record's outline, in the record's own
   *  units (plane metres, or atlas px for a flat record measured in px);
   *  0 inside a filled shape. Snap is applied as when it was drawn. */
  HP._shapeDist = function (rec, x, y) {
    let [x0, y0] = rec.p0, [x1, y1] = rec.p1;
    if (rec.snap) [x1, y1] = HP._snapP1(rec.tool, x0, y0, x1, y1, rec);
    if (rec.tool === "text") {                       // the box the letters fill: along the baseline, h tall
      const h = Math.hypot(x1 - x0, y1 - y0); if (!h) return Infinity;
      const uy = [(x1 - x0) / h, (y1 - y0) / h], yUp = !!rec.plane, ux = yUp ? [uy[1], -uy[0]] : [-uy[1], uy[0]];
      const u = (x - x0) * ux[0] + (y - y0) * ux[1], v = (x - x0) * uy[0] + (y - y0) * uy[1];
      const len = h * 0.6 * (rec.text || "").length;
      return Math.hypot(Math.max(-u, 0, u - len), Math.max(-v, 0, v - h));
    }
    if (rec.tool === "line") {
      const vx = x1 - x0, vy = y1 - y0, L2 = vx * vx + vy * vy;
      const t = L2 ? Math.max(0, Math.min(1, ((x - x0) * vx + (y - y0) * vy) / L2)) : 0;
      return Math.hypot(x - (x0 + vx * t), y - (y0 + vy * t));
    }
    const rx0 = Math.min(x0, x1), rx1 = Math.max(x0, x1), ry0 = Math.min(y0, y1), ry1 = Math.max(y0, y1);
    if (rec.tool === "rect" || rec.tool === "image") {
      const inside = x >= rx0 && x <= rx1 && y >= ry0 && y <= ry1;
      if (inside && (rec.fill || rec.tool === "image")) return 0;
      if (!inside) return Math.hypot(Math.max(rx0 - x, 0, x - rx1), Math.max(ry0 - y, 0, y - ry1));
      return Math.min(x - rx0, rx1 - x, y - ry0, ry1 - y);
    }
    if (rec.tool === "ellipse") {
      const cx = (rx0 + rx1) / 2, cy = (ry0 + ry1) / 2, a = (rx1 - rx0) / 2 || 1e-9, b = (ry1 - ry0) / 2 || 1e-9;
      const r = Math.hypot((x - cx) / a, (y - cy) / b);          // 1 on the outline
      if (r <= 1 && rec.fill) return 0;
      return Math.abs(r - 1) * Math.min(a, b);
    }
    return Infinity;
  };
  /** The record nearest a world point on the model (phase 3b picking):
   *  records whose plane is farther than opts.band (default 5 cm; pages
   *  pass 8% of the piece, the decal's own depth band, since generated
   *  faces carry relief) from the point are skipped; the point is dropped into the plane and
   *  measured against the outline; within opts.tol metres (default the
   *  line's half width plus 1 cm). Returns {rec, index, dist} or null. */
  HP.pickShape = function (root, records, world, opts) {
    opts = opts || {};
    root.updateMatrixWorld(true);
    const V3 = THREE.Vector3, m = root.matrixWorld, band = opts.band == null ? 0.05 : opts.band;
    let best = null;
    (records || []).forEach((rec, index) => {
      if (!rec.plane) return;
      const o = new V3().fromArray(rec.plane.o).applyMatrix4(m), n = new V3().fromArray(rec.plane.n).transformDirection(m);
      const ex = new V3().fromArray(rec.plane.ex).transformDirection(m), ey = new V3().fromArray(rec.plane.ey).transformDirection(m);
      const q = new V3().subVectors(world, o);
      if (Math.abs(q.dot(n)) > band) return;
      const d = HP._shapeDist(rec, q.dot(ex), q.dot(ey));
      const tol = opts.tol == null ? (rec.size / (rec.plane.ppw || 1)) / 2 + 0.01 : opts.tol;
      if (d <= tol && (!best || d < best.dist)) best = {rec, index, dist: d};
    });
    return best;
  };
  /** The flat (atlas) record nearest uv, measured in atlas px; within
   *  opts.tol px (default half the width plus 4). */
  HP.pickFlatShape = function (records, u, v, W, H, opts) {
    opts = opts || {};
    let best = null;
    (records || []).forEach((rec, index) => {
      if (rec.plane) return;
      const d = HP._shapeDist(Object.assign({}, rec, {p0: [rec.p0[0] * W, rec.p0[1] * H], p1: [rec.p1[0] * W, rec.p1[1] * H]}), u * W, v * H);
      const tol = opts.tol == null ? rec.size / 2 + 4 : opts.tol;
      if (d <= tol && (!best || d < best.dist)) best = {rec, index, dist: d};
    });
    return best;
  };

  // ---------------- mirror (phase 5 of the paint roadmap) ----------------
  /** The surface point opposite `world` across the model's centre plane
   *  (axis "x" or "z", centre a Vector3): the mirrored point is cast back
   *  onto the model along the mirrored normal. Returns the raycast hit
   *  (with uv/face/point) or null when nothing is there. */
  HP.mirrorHit = function (root, world, normal, centre, axis) {
    const m = world.clone(), n = normal.clone();
    if (axis === "z") { m.z = 2 * centre.z - m.z; n.z = -n.z; } else { m.x = 2 * centre.x - m.x; n.x = -n.x; }
    const rc = new THREE.Raycaster(m.clone().addScaledVector(n, 0.08), n.clone().negate(), 0, 0.5);
    const hits = rc.intersectObject(root, true).filter(h => h.uv);
    return hits[0] || null;
  };

  // ---------------- adjust (phase 5 of the paint roadmap) ----------------
  /** Hue / saturation / lightness / contrast over the atlas, inside the
   *  stencil when there is one, computed from `base` (a snapshot canvas)
   *  so sliders preview live and re-apply from the same source. o:
   *  {hue deg, sat -1..1, light -1..1, contrast -1..1}. Returns texels
   *  touched. Blender's Hue/Saturation and Brightness/Contrast
   *  modifiers, on a selection. */
  HP.adjust = function (pc, base, o) {
    const W = pc.can.width, H = pc.can.height, ctx = pc.ctx;
    const src = base.getContext("2d").getImageData(0, 0, W, H), d = src.data;
    const mask = pc.stencil ? pc.stencil.getContext("2d").getImageData(0, 0, W, H).data : null;
    const hue = o.hue || 0, sat = o.sat || 0, light = o.light || 0, con = o.contrast || 0;
    const cf = con >= 0 ? 1 + con * 2 : 1 + con;         // -1 -> flat, +1 -> x3
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (mask && mask[i + 3] === 0) continue;
      let r = d[i], g = d[i + 1], b = d[i + 2];
      if (hue || sat) [r, g, b] = HP.shiftHsv([r, g, b], hue, sat, 0);
      if (light) { const k = light > 0 ? 255 * light : 0; r = r + (255 - r) * Math.max(0, light) + Math.min(0, light) * r; g = g + (255 - g) * Math.max(0, light) + Math.min(0, light) * g; b = b + (255 - b) * Math.max(0, light) + Math.min(0, light) * b; }
      if (con) { r = (r - 128) * cf + 128; g = (g - 128) * cf + 128; b = (b - 128) * cf + 128; }
      d[i] = r < 0 ? 0 : r > 255 ? 255 : r; d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g; d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
      n++;
    }
    ctx.putImageData(src, 0, 0);
    HP.refresh(pc);
    return n;
  };

  // ---------------- guides (phase 4 of the paint roadmap) ----------------
  // Grease Pencil's parallel / grid guides on the decal plane: g = {kind:
  // "parallel" | "grid", spacing (plane units, metres), angle (deg, the
  // lines' direction), origin: [x, y] a point the lines pass through}.
  HP._guideFrame = function (g) {
    const a = (g.angle || 0) * Math.PI / 180;
    return {c: Math.cos(a), s: Math.sin(a), ox: (g.origin || [0, 0])[0], oy: (g.origin || [0, 0])[1], sp: Math.max(1e-6, g.spacing || 0.1)};
  };
  // plane point -> guide frame (u along the lines, v across them) and back
  HP._toGuide = function (f, p) { const x = p[0] - f.ox, y = p[1] - f.oy; return [x * f.c + y * f.s, -x * f.s + y * f.c]; };
  HP._fromGuide = function (f, q) { return [f.ox + q[0] * f.c - q[1] * f.s, f.oy + q[0] * f.s + q[1] * f.c]; };
  /** The nearest guide line (parallel: v snapped) or intersection (grid). */
  HP.guideSnap = function (p, g) {
    if (!g || !g.kind || g.kind === "off") return p;
    const f = HP._guideFrame(g), q = HP._toGuide(f, p);
    q[1] = Math.round(q[1] / f.sp) * f.sp;
    if (g.kind === "grid") q[0] = Math.round(q[0] / f.sp) * f.sp;
    return HP._fromGuide(f, q);
  };
  /** A stroke's lock: from its first point p0 and the first point that
   *  moved away, p1, choose the line the stroke follows -- parallel: the
   *  line nearest p0; grid: the row or the column, whichever the first
   *  movement runs along. Returns null until p1 has moved. */
  HP.guideLock = function (p0, p1, g) {
    if (!g || !g.kind || g.kind === "off") return null;
    const f = HP._guideFrame(g), a = HP._toGuide(f, p0), b = HP._toGuide(f, p1);
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < f.sp * 0.05) return null;
    const along = g.kind !== "grid" || Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]);
    // along: v fixed (a row); else u fixed (a column)
    return {g, f, axis: along ? "v" : "u", at: along ? Math.round(a[1] / f.sp) * f.sp : Math.round(a[0] / f.sp) * f.sp};
  };
  /** Project a point onto the locked line. */
  HP.guideApply = function (lock, p) {
    if (!lock) return p;
    const q = HP._toGuide(lock.f, p);
    if (lock.axis === "v") q[1] = lock.at; else q[0] = lock.at;
    return HP._fromGuide(lock.f, q);
  };
  /** World segments to draw the guides over a decal's footprint. */
  HP.guideLines = function (decal, g) {
    if (!g || !g.kind || g.kind === "off" || !decal.toWorld) return [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const t of decal.tris) { x0 = Math.min(x0, t.bb[0]); y0 = Math.min(y0, t.bb[1]); x1 = Math.max(x1, t.bb[2]); y1 = Math.max(y1, t.bb[3]); }
    if (x0 === Infinity) return [];
    const f = HP._guideFrame(g), corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(c => HP._toGuide(f, c));
    const umin = Math.min(...corners.map(c => c[0])), umax = Math.max(...corners.map(c => c[0]));
    const vmin = Math.min(...corners.map(c => c[1])), vmax = Math.max(...corners.map(c => c[1]));
    const segs = [], lim = 400;
    for (let k = Math.ceil(vmin / f.sp), n = 0; k * f.sp <= vmax && n < lim; k++, n++)
      segs.push([decal.toWorld(HP._fromGuide(f, [umin, k * f.sp])), decal.toWorld(HP._fromGuide(f, [umax, k * f.sp]))]);
    if (g.kind === "grid")
      for (let k = Math.ceil(umin / f.sp), n = 0; k * f.sp <= umax && n < lim; k++, n++)
        segs.push([decal.toWorld(HP._fromGuide(f, [k * f.sp, vmin])), decal.toWorld(HP._fromGuide(f, [k * f.sp, vmax]))]);
    return segs;
  };

  // ---------------- shape handles (phase 2 of the paint roadmap) ----------------
  /** Draggable handles as DOM dots inside `wrap` (a position:relative
   *  wrapper over a canvas). set(points) takes wrapper-relative px (null
   *  hides one); a drag calls onDrag(i, clientX, clientY) per move and
   *  onEnd(i) on release. The dots take the pointer themselves, so the
   *  canvas under them never sees the press. */
  HP.Handles = function (wrap, opts) {
    const o = opts || {}, els = [];
    const H = {
      set(points) {
        while (els.length > points.length) wrap.removeChild(els.pop());
        while (els.length < points.length) {
          const d = document.createElement("div"), i = els.length;
          d.className = "hp-handle";
          d.style.cssText = "position:absolute;z-index:45;box-sizing:border-box;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;" +
            "background:#ffd166;border:2px solid #08101a;box-shadow:0 0 0 1px #ffd166;cursor:grab;touch-action:none";
          d.title = o.title || "drag to adjust \u00b7 Enter keeps it \u00b7 Esc undoes it";
          d.addEventListener("pointerdown", ev => {
            ev.preventDefault(); ev.stopPropagation();
            d.setPointerCapture(ev.pointerId);
            const move = e => { e.preventDefault(); if (o.onDrag) o.onDrag(i, e.clientX, e.clientY); };
            const up = () => { d.removeEventListener("pointermove", move); d.removeEventListener("pointerup", up); d.removeEventListener("pointercancel", up); if (o.onEnd) o.onEnd(i); };
            d.addEventListener("pointermove", move); d.addEventListener("pointerup", up); d.addEventListener("pointercancel", up);
          });
          wrap.appendChild(d); els.push(d);
        }
        points.forEach((p, i) => { els[i].style.display = p ? "" : "none"; if (p) { els[i].style.left = p[0] + "px"; els[i].style.top = p[1] + "px"; } });
      },
      clear() { H.set([]); },
      get count() { return els.length; },
      el(i) { return els[i]; },
    };
    return H;
  };

  // ---------------- atlas padding (dilation) ----------------
  // The atlas is UV islands with empty padding between them. The renderer
  // samples right at an island's border, so the border texel blends with
  // the padding next to it (bilinear at any zoom; more with mipmaps).
  // Generated atlases ship the padding pre-filled with the border colour,
  // so an untouched texture shows no seams -- but paint writes only ~1.5
  // px into the padding, and everything beyond keeps the OLD colour: a
  // thin line of it at every island border and every join between
  // copies, that no brush, smooth or smudge could ever remove (Hector,
  // 2026-09-25: "no matter how I smudge, smooth or brush, there's always
  // a line"). Real texture painters dilate: after each stroke the border
  // colour is copied outward into the padding. Same here, PAD px deep.
  HP.PAD = 8;

  /** Build the island map for `pc` from `root`'s UV triangles: a byte per
   *  texel, 0 = inside an island, 1..PAD = that many px into the padding,
   *  255 = far from any island. Then dilate the whole atlas once, which
   *  repairs seams already painted in. Call when a texture is taken over
   *  (both pages do). */
  HP.islandMap = function (pc, root) {
    const W = pc.can.width, H = pc.can.height;
    const mk = document.createElement("canvas"); mk.width = W; mk.height = H;
    const c = mk.getContext("2d");
    c.fillStyle = "#fff"; c.strokeStyle = "#fff"; c.lineWidth = 1;
    root.updateMatrixWorld(true);
    root.traverse(n => {
      if (!n.isMesh || !n.geometry.attributes.uv) return;
      const uv = n.geometry.attributes.uv, ix = n.geometry.index, cnt = ix ? ix.count : uv.count;
      for (let i = 0; i < cnt; i += 3) {
        c.beginPath();
        for (let k = 0; k < 3; k++) {
          const j = ix ? ix.getX(i + k) : i + k, x = uv.getX(j) * W, y = uv.getY(j) * H;
          if (k) c.lineTo(x, y); else c.moveTo(x, y);
        }
        c.closePath(); c.fill(); c.stroke();               // stroke: no hairline gaps between triangles
      }
    });
    const md = c.getImageData(0, 0, W, H).data;
    const dist = new Uint8Array(W * H);
    for (let i = 0, j = 0; i < dist.length; i++, j += 4) dist[i] = md[j] > 127 ? 0 : 255;
    for (let r = 1; r <= HP.PAD; r++) {                      // ring r = next to ring r-1
      const prev = r - 1;
      for (let y = 0; y < H; y++) for (let x = 0, i = y * W; x < W; x++, i++) {
        if (dist[i] !== 255) continue;
        if ((x > 0 && dist[i - 1] === prev) || (x < W - 1 && dist[i + 1] === prev) ||
            (y > 0 && dist[i - W] === prev) || (y < H - 1 && dist[i + W] === prev)) dist[i] = r;
      }
    }
    pc._island = {dist, W, H};
    HP.dilateAll(pc);
    return pc._island;
  };

  /** Copy island border colours outward through the padding rings inside
   *  rect [x0,y0,x1,y1] (atlas px; grown by PAD so rings just outside a
   *  touched island are reached). No-op until islandMap has run. */
  HP.dilatePadding = function (pc, rect, ctx) {
    const isl = pc._island; if (!isl) return;
    ctx = ctx || pc.ctx;                                 // a stroke passes its LAYER: compose then carries the padding
    const W = isl.W, H = isl.H, dist = isl.dist;
    const x0 = Math.max(0, Math.floor(rect[0]) - HP.PAD), y0 = Math.max(0, Math.floor(rect[1]) - HP.PAD);
    const x1 = Math.min(W, Math.ceil(rect[2]) + HP.PAD), y1 = Math.min(H, Math.ceil(rect[3]) + HP.PAD);
    const w = x1 - x0, h = y1 - y0; if (w <= 0 || h <= 0) return;
    const img = ctx.getImageData(x0, y0, w, h), d = img.data;
    let any = false;
    for (let r = 1; r <= HP.PAD; r++) {
      const prev = r - 1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const gi = (y0 + y) * W + (x0 + x);
        if (dist[gi] !== r) continue;
        let src = -1;
        if (x > 0 && dist[gi - 1] === prev) src = gi - 1;
        else if (x < w - 1 && dist[gi + 1] === prev) src = gi + 1;
        else if (y > 0 && dist[gi - W] === prev) src = gi - W;
        else if (y < h - 1 && dist[gi + W] === prev) src = gi + W;
        if (src < 0) continue;
        const li = (y * w + x) * 4, si = ((src / W | 0) - y0) * w * 4 + ((src % W) - x0) * 4;
        d[li] = d[si]; d[li + 1] = d[si + 1]; d[li + 2] = d[si + 2]; d[li + 3] = d[si + 3];
        any = true;
      }
    }
    if (any) ctx.putImageData(img, x0, y0);
  };
  HP.dilateAll = function (pc) { HP.dilatePadding(pc, [0, 0, pc.can.width, pc.can.height]); HP.refresh(pc); };

  // ---------------- surface patches ----------------
  // Unwrap a region of the SURFACE (a decal plane, world units) into one
  // continuous plane-space image, operate on it, and project it back
  // through every triangle -- so blurring and moving work ACROSS UV
  // islands. Generated pieces split flat faces into several islands (env
  // wall: 6 on its front face, by shared UV position) and warp the map per
  // triangle, which is why atlas-space smoothing could not blend the seams
  // people actually see.
  // Patch pixel (X,Y) <-> plane point (ox + X/s, oy + Y/s); s = decal
  // pxPerWorld, so patch pixels match the start face's texel density.

  /** patch px -> atlas px, as a canvas transform [a,b,c,d,e,f]. */
  HP._patchAffine = function (t, s, ox, oy) {
    const m = t.m;
    return [m[0] / s, m[1] / s, m[2] / s, m[3] / s,
            m[0] * ox + m[2] * oy + m[4], m[1] * ox + m[3] * oy + m[5]];
  };
  HP._inv = function (A) {
    const det = A[0] * A[3] - A[1] * A[2];
    if (Math.abs(det) < 1e-18) return null;
    return [A[3] / det, -A[1] / det, -A[2] / det, A[0] / det,
            (A[2] * A[5] - A[3] * A[4]) / det, (A[1] * A[4] - A[0] * A[5]) / det];
  };
  const bbOverlap = (t, x0, y0, x1, y1) =>
    !(t.bb[2] < x0 || t.bb[0] > x1 || t.bb[3] < y0 || t.bb[1] > y1);

  /** Atlas canvas `src` -> plane-space canvas of w x h patch px whose
   *  top-left is plane point (ox, oy). */
  HP.unwrap = function (src, decal, ox, oy, s, w, h, which) {
    const out = document.createElement("canvas");
    out.width = w; out.height = h;
    const c = out.getContext("2d");
    const x1 = ox + w / s, y1 = oy + h / s;
    for (const t of decal.tris) {
      if (!bbOverlap(t, ox, oy, x1, y1)) continue;
      const A = HP._patchAffine(t, s, ox, oy), I = HP._inv(A);
      if (!I) continue;
      const from = t.pc ? t.pc[which || "can"] : src;      // a multi-piece surface reads each piece's own texture
      if (!from) continue;
      const P = HP._inflate(t.p.map(q => [(q[0] - ox) * s, (q[1] - oy) * s]), 1);
      c.save();
      c.beginPath();                                          // +1px every edge: no seams
      P.forEach(([x, y], i) => { if (i) c.lineTo(x, y); else c.moveTo(x, y); });
      c.closePath();
      c.clip();
      c.setTransform(I[0], I[1], I[2], I[3], I[4], I[5]);
      const u = t.ub, sw = Math.max(1, u[2] - u[0]), sh = Math.max(1, u[3] - u[1]);
      c.drawImage(from, u[0], u[1], sw, sh, u[0], u[1], sw, sh);
      c.restore();
    }
    return out;
  };

  /** Plane-space `patch` (top-left at plane (ox, oy)) -> drawn into
   *  atlas-space `ctx` through every overlapping triangle, clipped to
   *  each triangle's (inflated) UV footprint. Caller's alpha/composite
   *  apply. Returns the atlas bbox touched, or null. */
  HP.reproject = function (ctx, patch, decal, ox, oy, s, rectsOut) {
    const x1 = ox + patch.width / s, y1 = oy + patch.height / s;
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const t of decal.tris) {
      if (!bbOverlap(t, ox, oy, x1, y1)) continue;
      const A = HP._patchAffine(t, s, ox, oy);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(t.clip[0][0], t.clip[0][1]);
      ctx.lineTo(t.clip[1][0], t.clip[1][1]);
      ctx.lineTo(t.clip[2][0], t.clip[2][1]);
      ctx.closePath();
      ctx.clip();
      ctx.setTransform(A[0], A[1], A[2], A[3], A[4], A[5]);
      ctx.drawImage(patch, 0, 0);
      ctx.restore();
      bx0 = Math.min(bx0, t.ub[0]); by0 = Math.min(by0, t.ub[1]);
      bx1 = Math.max(bx1, t.ub[2]); by1 = Math.max(by1, t.ub[3]);
      if (rectsOut) rectsOut.push(t.ub);
    }
    return bx0 === Infinity ? null : [bx0, by0, bx1, by1];
  };

  /** A full-atlas scratch canvas, reused (masking by the selection). */
  HP._scratch = function (pc) {
    if (!pc._scratch || pc._scratch.width !== pc.can.width || pc._scratch.height !== pc.can.height) {
      pc._scratch = document.createElement("canvas");
      pc._scratch.width = pc.can.width; pc._scratch.height = pc.can.height;
    }
    return pc._scratch;
  };

  /** Surface smooth at plane point `center` [x,y] (from decal.point):
   *  unwrap the surface around the brush, blur it, keep a radial falloff
   *  at opts.alpha strength, project back. opts: {size (px), alpha
   *  0..1, blur 0..1 of brush radius (floor 25%)}. Respects selection. */
  HP.surfaceSmooth = function (pc, decal, center, opts) {
    const s = decal.pxPerWorld;
    const r = Math.max(2, opts.size / 2);
    // blur std-dev: its 3-sigma reach stays INSIDE the ring (blur 100% =
    // the ring's edge). It was blur x the RADIUS -- reaching ~2.7 rings
    // out, so smoothing inside light paint pulled in the dark wall around
    // it and each pass drew a dark band: the cross (2026-09-25)
    const b = Math.max(1, Math.round(r * Math.max(0.25, opts.blur || 0) / 3));
    const halfPx = Math.ceil(r + b * 3 + 2), size = halfPx * 2;   // 3 sigma of surface
    const ox = center[0] - halfPx / s, oy = center[1] - halfPx / s;
    const sharp = HP.unwrap(pc.can, decal, ox, oy, s, size, size);
    const soft = HP._blurred(sharp, 0, 0, size, size, b);
    const wts = HP._weightPatch(size, size, halfPx, halfPx, r, opts.alpha == null ? 1 : opts.alpha);
    HP._blendPatch(pc, decal, soft, wts, ox, oy, s);
    HP._refreshAll(decal, pc);
  };

  /** Project a plane-space TARGET patch and its WEIGHTS patch into atlas
   *  space through every triangle, then blend per pixel in float with
   *  dithered rounding (canvas alpha blending rounds to 8 bits). */
  /** The decal split by texture: [{pc, decal}] -- one entry per piece
   *  whose triangles are in it (untagged triangles belong to `pc`). A
   *  surface op unwraps the WHOLE surface, then writes each piece's
   *  part back into that piece's own texture. Cached on the decal. */
  HP._groups = function (decal, pc) {
    if (decal._groups && decal._groupsPc === pc) return decal._groups;
    const by = new Map();
    for (const t of decal.tris) { const k = t.pc || pc; if (!by.has(k)) by.set(k, []); by.get(k).push(t); }
    decal._groups = [...by].map(([g, tris]) => ({pc: g, decal: Object.assign(Object.create(decal), {tris})}));
    decal._groupsPc = pc;
    return decal._groups;
  };

  HP._blendPatch = function (pc, decal, target, wts, ox, oy, s) {
    for (const g of HP._groups(decal, pc)) {
      const tc = HP._scratchCtx(g.pc, "_smT"), mc = HP._scratchCtx(g.pc, "_smM");
      const rects = [];
      HP.reproject(tc, target, g.decal, ox, oy, s, rects);
      HP.reproject(mc, wts, g.decal, ox, oy, s);
      for (const R of HP._mergeRects(rects, g.pc.can.width, g.pc.can.height)) {
        const w = R[2] - R[0], h = R[3] - R[1];
        HP._ditherBlend(g.pc, R[0], R[1], w, h,
          tc.getImageData(R[0], R[1], w, h).data, mc.getImageData(R[0], R[1], w, h).data);
        tc.clearRect(R[0], R[1], w, h); mc.clearRect(R[0], R[1], w, h);
        HP.dilatePadding(g.pc, R);
      }
    }
  };
  /** refresh every texture a surface op touched */
  HP._refreshAll = function (decal, pc) { for (const g of HP._groups(decal, pc)) HP.refresh(g.pc); };

  /** Advance a surface stroke toward `goal` (plane point) in dabs every
   *  `step` world units, calling dab(point). Spends at most ~20 ms per
   *  call and finishes the rest on later animation frames: a big-brush
   *  smooth dab costs 45-70 ms (measured, size 96-128), and a fast drag
   *  used to run up to 12 in one pointer event -- a half-second freeze.
   *  The stroke trails the cursor instead. st: {last} (null = first
   *  dab); onDab() runs after each batch. */
  HP.pacedStrokeTo = function (st, goal, step, dab, onDab) {
    st.goal = goal;
    st._step = step; st._dab = dab; st._onDab = onDab;
    if (!st.last) {
      dab(goal);
      st.last = goal;
      if (onDab) onDab();
      return;
    }
    // every pointer position is QUEUED and walked in order: chasing only
    // the latest one cut corners whenever the stroke fell behind -- a fast
    // curve left holes that smooth then spread (tests/paint/seamcross)
    (st.queue || (st.queue = [])).push(goal);
    if (!st.raf) HP._pacedPump(st, true);
  };

  HP._pacedPump = function (st, budget) {
    st.raf = 0;
    const t0 = performance.now();
    let did = false;
    while (st.queue && st.queue.length) {
      const L = st.last, p = st.queue[0];
      const dist = Math.hypot(p[0] - L[0], p[1] - L[1]);
      if (dist < st._step) { st.queue.shift(); continue; }
      if (budget && did && performance.now() - t0 > 20) {
        st.raf = requestAnimationFrame(() => HP._pacedPump(st, true));
        break;
      }
      const q = [L[0] + (p[0] - L[0]) * st._step / dist, L[1] + (p[1] - L[1]) * st._step / dist];
      st._dab(q);
      st.last = q; did = true;
    }
    if (did && st._onDab) st._onDab();
  };

  /** Finish a paced stroke NOW (pointer up / tool change): no dab left
   *  for a later frame. A trailing brush pump that ran after the next
   *  operation began would recompose its session over it. */
  HP.pacedFlush = function (st) {
    if (!st) return;
    if (st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; }
    if (st.queue && st.queue.length) HP._pacedPump(st, false);
  };

  /** Surface smooth stroke: dabs spaced 30% of the brush. st: {decal, last}. */
  HP.smoothStrokeTo = function (st, pc, goal, opts, onDab) {
    HP.pacedStrokeTo(st, goal, Math.max(1, opts.size * 0.3) / st.decal.pxPerWorld,
                     q => HP.surfaceSmooth(pc, st.decal, q, opts), onDab);
  };

  // ---------------- surface brush ----------------
  /** The BRUSH on the model: each dab is drawn in the decal's plane and
   *  projected through every triangle, so a stroke runs across UV seams
   *  and across the joins between copies of a piece with no gaps. The
   *  flat-texture brush stamped at the hit UV, so a dab only reached the
   *  UV island under the cursor: slivers of the old colour survived along
   *  every seam and join, and smooth/smudge then spread them into a dark
   *  cross (Hector's two walls, 2026-09-25; tests/paint/seamcross).
   *  Same session contract as strokeSession: dabs land on sess.layer at
   *  full strength, opacity / blend / selection apply at _compose.
   *  st: {decal, last} -- build the decal with opts.bandPx = a quarter
   *  of the brush (HP.brushBandPx) so dabs never paint through onto
   *  surfaces just behind. */
  /** Depth band for a surface-brush decal, atlas px: a quarter of the
   *  brush, at least 3 px -- deep enough for a generated wall's few-mm
   *  relief, shallow enough that a dab on an arm stays off the torso. */
  HP.brushBandPx = size => Math.max(3, size * 0.25);

  HP.surfaceStrokeTo = function (st, sess, goal, onDab) {
    // one stroke session per TEXTURE the decal touches (the clicked
    // piece's `sess`, others made lazily with the same opts); kept on st
    // and carried across a re-plane by the page
    const ms = st._ms || (st._ms = {pc: sess.pc, opts: sess.opts, sessions: new Map([[sess.pc, sess]])});
    const o = ms.opts;
    const stepPx = o.pixel > 0 ? o.pixel : Math.max(1, o.size * (o.spacing > 0 ? o.spacing : 1 / 3));
    HP.pacedStrokeTo(st, goal, stepPx / st.decal.pxPerWorld,
      q => HP._surfaceDab(ms, st.decal, q),
      () => { for (const se of ms.sessions.values()) HP._compose(se); if (onDab) onDab(); });
  };
  HP._sessFor = function (ms, pc) {
    let se = ms.sessions.get(pc);
    if (!se) { se = HP.beginStroke(pc, ms.opts); ms.sessions.set(pc, se); }
    return se;
  };

  HP._surfaceDab = function (ms, decal, cIn) {
    const o = ms.opts, s = decal.pxPerWorld;
    // per-dab variation (seeded), then the tip's turn
    const vr = HP._vary(ms, o);
    const c = [cIn[0] + vr.dx / s, cIn[1] + vr.dy / s];
    if (o.pixel > 0) { HP._pixelDab(ms, decal, c, o.pixel, vr.rgb); ms._lastDab = c; return; }
    const tip = o.tip && o.tip.img ? o.tip : null;
    let ang = 0;
    if (tip && tip.rotate === "follow" && ms._lastDab) ang = Math.atan2(c[1] - ms._lastDab[1], c[0] - ms._lastDab[0]);
    else if (tip && tip.rotate === "random") ang = ms.rng() * Math.PI * 2;
    else if (tip && tip.angle) ang = tip.angle;
    ms._lastDab = c;
    // the dab's COVERAGE as an opaque patch (R = coverage). Drawing the
    // patch through each triangle overlaps at shared edges (the clips are
    // grown so no hairline gaps appear); a semi-transparent image drawn
    // twice there came out brighter -- a lattice along every triangle
    // edge. An opaque patch drawn twice is unchanged, and the coverage is
    // then added to the stroke's layer ONCE per pixel below. RGBA tips
    // carry their colours in a second opaque patch for the same reason.
    const P = HP._dabPatches(ms, o, vr.size, tip, ang), half = P.half;
    const [cr, cg, cb] = vr.rgb;
    for (const g of HP._groups(decal, ms.pc)) {
      const pc = g.pc, sess = HP._sessFor(ms, pc);
      const mc = HP._scratchCtx(pc, "_brM"), rects = [];
      HP.reproject(mc, P.cov, g.decal, c[0] - half / s, c[1] - half / s, s, rects);
      let cc = null;
      if (P.col) { cc = HP._scratchCtx(pc, "_brC"); HP.reproject(cc, P.col, g.decal, c[0] - half / s, c[1] - half / s, s); }
      else if (o.clone) {
        // clone stamp (phase 6): the colours come from the stroke's base
        // snapshot at the source offset, unwrapped into plane space around
        // the shifted dab and reprojected like an RGBA tip
        const src = HP.unwrap(sess.base, g.decal, c[0] + o.clone.dx - half / s, c[1] + o.clone.dy - half / s, s, P.size, P.size);
        cc = HP._scratchCtx(pc, "_brC"); HP.reproject(cc, src, g.decal, c[0] - half / s, c[1] - half / s, s);
      }
      // history eraser (phase 6): the colours come from the kept texture
      // (as loaded / last saved) at the same atlas texel
      const hist = o.history && o.history.width === pc.can.width ? o.history.getContext("2d") : null;
      for (const R of HP._mergeRects(rects, pc.can.width, pc.can.height)) {
        const w = R[2] - R[0], h = R[3] - R[1];
        const md = mc.getImageData(R[0], R[1], w, h).data;
        const cd = cc ? cc.getImageData(R[0], R[1], w, h).data : null;
        const hd = hist ? hist.getImageData(R[0], R[1], w, h).data : null;
        const L = sess.lctx.getImageData(R[0], R[1], w, h), ld = L.data;
        let any = false;
        for (let i = 0; i < ld.length; i += 4) {
          const k = (md[i] / 255) * (md[i + 3] / 255);
          if (k <= 0) continue;
          if (cd && o.clone && cd[i + 3] === 0) continue;         // no source there
          const a = ld[i + 3] / 255, na = a + k * (1 - a);          // source-over coverage, like stamps
          if (hd) { ld[i] = hd[i]; ld[i + 1] = hd[i + 1]; ld[i + 2] = hd[i + 2]; }
          else if (cd) { ld[i] = cd[i]; ld[i + 1] = cd[i + 1]; ld[i + 2] = cd[i + 2]; }
          else { ld[i] = cr; ld[i + 1] = cg; ld[i + 2] = cb; }
          ld[i + 3] = Math.min(255, Math.round(na * 255));
          any = true;
        }
        if (any) sess.lctx.putImageData(L, R[0], R[1]);
        mc.clearRect(R[0], R[1], w, h);
        if (cc) cc.clearRect(R[0], R[1], w, h);
        // the dab's paint continues into the padding on the LAYER: the
        // compose that follows rewrites the atlas from its pre-stroke
        // snapshot, so padding dilated into the atlas mid-stroke was lost
        HP.dilatePadding(pc, R, sess.lctx);
      }
    }
  };

  /** Pixel mode: an N x N texel square, axis-aligned on the atlas grid, at
   *  the texel under the dab in every triangle (island) the point lies in.
   *  Hard edge, no soft falloff: pixel art on the model. */
  HP._pixelDab = function (ms, decal, c, N, rgb) {
    const o = ms.opts, off = Math.floor((N - 1) / 2), fill = "rgb(" + rgb.join(",") + ")";
    const n64 = !!(o.perfect || o.shade || o.quant5);     // N64 mode: the pencil rules of the flat path, on the model
    for (const g of HP._groups(decal, ms.pc)) {
      const pc = g.pc, sess = HP._sessFor(ms, pc), ctx = sess.lctx, rects = [];
      for (const t of g.decal.tris) {
        if (!HP._inTri(t.p, c)) continue;
        const m = t.m, ax = m[0] * c[0] + m[2] * c[1] + m[4], ay = m[1] * c[0] + m[3] * c[1] + m[5];
        const x0 = Math.floor(ax) - off, y0 = Math.floor(ay) - off;
        if (n64) {
          // walk the texels between this dab and the last (the paced steps are
          // a texel apart, so this closes rounding gaps); a jump of more than
          // 3 texels is a UV seam -- start afresh there, never bridge islands
          const X = Math.floor(ax), Y = Math.floor(ay), L = sess._lastPx;
          if (L && L[0] === X && L[1] === Y) continue;
          if (L && Math.abs(L[0] - X) <= 3 && Math.abs(L[1] - Y) <= 3) { const pts = HP.pixLine(L[0], L[1], X, Y); for (let i = 1; i < pts.length; i++) HP._pixelPut(sess, pts[i][0], pts[i][1]); }
          else { sess._pxs = []; HP._pixelPut(sess, X, Y); }
          sess._lastPx = [X, Y];
        } else { ctx.fillStyle = fill; ctx.fillRect(x0, y0, N, N); }
        rects.push([x0, y0, x0 + N, y0 + N]);
      }
      for (const R of HP._mergeRects(rects, pc.can.width, pc.can.height)) HP.dilatePadding(pc, R, ctx);
    }
  };

  // ---------------- smudge (Photoshop's) ----------------
  // Hector, 2026-09-24: smooth could not blend "two similar colours in a
  // line" the way Photoshop can -- blur only ever averages in place.
  // Smudge picks up the colour under the brush at the stroke start and
  // lays it down along the stroke, mixing in what it passes over:
  // strength = how much of the carried colour survives each step (100% =
  // drags forever), soft = brush edge. Surface-space like smooth, so it
  // crosses UV islands; float + dithered like smooth.

  /** Surface smudge stroke: dabs every 20% of the brush. st: {decal,
   *  last, carry} -- carry survives a re-plane at a corner. opts: {size,
   *  alpha (strength 0..1), soft 0..1}. */
  HP.smudgeStrokeTo = function (st, pc, goal, opts, onDab) {
    HP.pacedStrokeTo(st, goal, Math.max(1, opts.size * 0.2) / st.decal.pxPerWorld,
                     q => { HP._smudgeDab(pc, st, q, opts); HP._refreshAll(st.decal, pc); }, onDab);
  };

  HP._smudgeDab = function (pc, st, center, opts) {
    const s = st.decal.pxPerWorld, r = Math.max(2, opts.size / 2);
    const half = Math.ceil(r + 2), size = half * 2;
    const ox = center[0] - half / s, oy = center[1] - half / s;
    const ud = HP.unwrap(pc.can, st.decal, ox, oy, s, size, size)
      .getContext("2d").getImageData(0, 0, size, size).data;
    if (!st.carry || st.carry.length !== ud.length) {        // first dab: pick up
      st.carry = Float32Array.from(ud);
      return;
    }
    const core = 1 - 0.9 * Math.max(0, Math.min(1, opts.soft || 0));
    const wts = HP._weightPatch(size, size, half, half, r, opts.alpha == null ? 1 : opts.alpha, core);
    const wd = wts.getContext("2d").getImageData(0, 0, size, size).data;
    const c = st.carry;
    const tgt = document.createElement("canvas");
    tgt.width = tgt.height = size;
    const tx = tgt.getContext("2d"), img = tx.createImageData(size, size);
    img.data.set(c);                                          // clamps + rounds
    tx.putImageData(img, 0, 0);
    HP._blendPatch(pc, st.decal, tgt, wts, ox, oy, s);
    // the brush now holds what is on the surface there: under + (carry -
    // under) * weight, kept in float so strength 100% never decays
    for (let i = 0; i < c.length; i += 4) {
      if (!ud[i + 3]) continue;                               // off the surface
      const w = (wd[i] / 255) * (c[i + 3] / 255);
      for (let k = 0; k < 3; k++) c[i + k] = ud[i + k] + (c[i + k] - ud[i + k]) * w;
      c[i + 3] = Math.max(c[i + 3], ud[i + 3]);
    }
  };

  /** Atlas-space smudge (the Paint page's flat panel): st = {last, carry}
   *  in atlas px. Interpolates dabs every 20% of the brush from the last
   *  point to (u, v). */
  HP.smudgeFlatTo = function (pc, st, u, v, opts) {
    const x = u * pc.can.width, y = v * pc.can.height;
    const r = Math.max(2, opts.size / 2), step = Math.max(1, opts.size * 0.2);
    if (!st.last) { HP._smudgeFlatDab(pc, st, x, y, r, opts); st.last = [x, y]; return; }
    const L = st.last, dist = Math.hypot(x - L[0], y - L[1]);
    const n = Math.min(64, Math.floor(dist / step));
    if (!n) return;
    for (let i = 1; i <= n; i++) {
      const q = [L[0] + (x - L[0]) * i / n, L[1] + (y - L[1]) * i / n];
      HP._smudgeFlatDab(pc, st, q[0], q[1], r, opts);
      st.last = q;
    }
    HP.refresh(pc);
  };

  HP._smudgeFlatDab = function (pc, st, cx, cy, r, opts) {
    const half = Math.ceil(r + 2), size = half * 2;
    const x0 = Math.round(cx) - half, y0 = Math.round(cy) - half;
    const cur = pc.ctx.getImageData(x0, y0, size, size), cd = cur.data;
    if (!st.carry || st.carry.length !== cd.length) { st.carry = Float32Array.from(cd); return; }
    const sd = pc.stencil
      ? pc.stencil.getContext("2d").getImageData(x0, y0, size, size).data : null;
    const k = opts.alpha == null ? 1 : Math.max(0, Math.min(1, opts.alpha));
    const core = 1 - 0.9 * Math.max(0, Math.min(1, opts.soft || 0));
    const c = st.carry;
    let any = false;
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const i = (py * size + px) * 4;
        if (!cd[i + 3]) continue;                             // outside the atlas
        const d = Math.hypot(x0 + px + 0.5 - cx, y0 + py + 0.5 - cy) / r;
        if (d >= 1) continue;
        const t = d <= core ? 0 : (d - core) / (1 - core);
        let w = k * (1 - t * t * (3 - 2 * t)) * (c[i + 3] / 255);
        if (sd) w *= sd[i + 3] / 255;
        if (w <= 0) continue;
        any = true;
        for (let ch = 0; ch < 3; ch++) {
          const v = cd[i + ch] + (c[i + ch] - cd[i + ch]) * w;
          c[i + ch] = v;                                      // what the brush holds now
          cd[i + ch] = Math.min(255, Math.max(0, Math.floor(v + Math.random())));
        }
      }
    }
    if (any) pc.ctx.putImageData(cur, x0, y0);
  };

  /** Lift the selected surface into a plane-space FLOAT so it can be
   *  dragged across the face (Hector: "once I select some faces, how can
   *  I move them around?"). Only the selection that lies ON this face's
   *  plane moves; selected faces elsewhere on the model stay selected and
   *  untouched. The float is sized to the selected triangles, not the
   *  whole plane. Cuts a hole (filled with `bg`) unless `copy`. While
   *  moving there is no veil, so the texture underneath stays readable;
   *  dropLifted moves the selection with the pixels. Returns {float,
   *  mask, rest, ox, oy, s} or null when nothing selected is on the face. */
  HP.liftSelection = function (pc, decal, copy, bg) {
    if (!pc.stencil) return null;
    const W = pc.stencil.width, H = pc.stencil.height;
    const sd = pc.stencil.getContext("2d").getImageData(0, 0, W, H).data;
    const touched = t => {                          // any selected texel in its footprint
      const x0 = Math.max(0, t.ub[0]), y0 = Math.max(0, t.ub[1]);
      const x1 = Math.min(W, t.ub[2]), y1 = Math.min(H, t.ub[3]);
      for (let y = y0; y < y1; y++)
        for (let x = x0, i = (y * W + x0) * 4 + 3; x < x1; x++, i += 4)
          if (sd[i]) return true;
      return false;
    };
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const t of decal.tris) {
      if (!touched(t)) continue;
      bx0 = Math.min(bx0, t.bb[0]); by0 = Math.min(by0, t.bb[1]);
      bx1 = Math.max(bx1, t.bb[2]); by1 = Math.max(by1, t.bb[3]);
    }
    if (bx0 === Infinity) return null;
    let s = decal.pxPerWorld;
    let w = Math.ceil((bx1 - bx0) * s) + 4, h = Math.ceil((by1 - by0) * s) + 4;
    const cap = 4096;                                  // keep the float sane
    if (w > cap || h > cap) {
      const k = cap / Math.max(w, h);
      s *= k; w = Math.ceil(w * k); h = Math.ceil(h * k);
    }
    const ox = bx0 - 2 / s, oy = by0 - 2 / s;
    const float = HP.unwrap(pc.can, decal, ox, oy, s, w, h);
    const mask = HP.unwrap(pc.stencil, decal, ox, oy, s, w, h);
    const fc = float.getContext("2d");
    fc.globalCompositeOperation = "destination-in";
    fc.drawImage(mask, 0, 0);
    fc.globalCompositeOperation = "source-over";
    // `here` = the on-plane selection as it maps back to the atlas; the
    // hole and the selection that stays behind are both cut by IT, not
    // by the whole stencil (which may cover other faces)
    const here = document.createElement("canvas");
    here.width = W; here.height = H;
    const hc = here.getContext("2d");
    HP.reproject(hc, mask, decal, ox, oy, s);
    hc.globalCompositeOperation = "destination-in";
    hc.drawImage(pc.stencil, 0, 0);
    hc.globalCompositeOperation = "source-over";
    const rest = document.createElement("canvas");
    rest.width = W; rest.height = H;
    const rc = rest.getContext("2d");
    rc.drawImage(pc.stencil, 0, 0);
    rc.globalCompositeOperation = "destination-out";
    rc.drawImage(here, 0, 0);
    rc.globalCompositeOperation = "source-over";
    if (!copy) {
      hc.globalCompositeOperation = "source-in";
      hc.fillStyle = bg || "#000";
      hc.fillRect(0, 0, W, H);
      hc.globalCompositeOperation = "source-over";
      pc.ctx.drawImage(here, 0, 0);
    }
    pc.stencil = null; pc.stencilVisible = false;
    HP.refresh(pc);
    return {float, mask, rest, ox, oy, s};
  };

  /** Preview the float at plane offset (dx, dy) in a session made AFTER
   *  lifting (beginStroke with alpha 1, normal blend). */
  HP.placeLifted = function (sess, lifted, decal, dx, dy) {
    const c = sess.lctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, sess.layer.width, sess.layer.height);
    HP.reproject(c, lifted.float, decal, lifted.ox + dx, lifted.oy + dy, lifted.s);
    HP._compose(sess);
  };

  /** Array (phase 5 of the paint roadmap): the float at every plane
   *  offset in `offsets` ([dx, dy] pairs), then one compose -- a
   *  selection repeated across the face (brick courses, rivets). */
  HP.placeLiftedMany = function (sess, lifted, decal, offsets) {
    const c = sess.lctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, sess.layer.width, sess.layer.height);
    for (const [dx, dy] of offsets) HP.reproject(c, lifted.float, decal, lifted.ox + dx, lifted.oy + dy, lifted.s);
    HP._compose(sess);
  };
  /** The offsets of a cols x rows array with steps (sx, sy) in plane
   *  units; `bond` shifts every other row by half a step (brick bond). */
  HP.arrayOffsets = function (cols, rows, sx, sy, bond) {
    const out = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([c * sx + (bond && r % 2 ? sx / 2 : 0), r * sy]);
    return out;
  };

  /** Finish a move: the moved part of the selection follows the pixels
   *  to (dx, dy); selected faces elsewhere keep their selection. */
  HP.dropLifted = function (pc, lifted, decal, dx, dy) {
    const st = document.createElement("canvas");
    st.width = pc.can.width; st.height = pc.can.height;
    const c = st.getContext("2d");
    if (lifted.rest) c.drawImage(lifted.rest, 0, 0);
    HP.reproject(c, lifted.mask, decal, lifted.ox + dx, lifted.oy + dy, lifted.s);
    pc.stencil = st; pc.stencilVisible = true;
    HP.refresh(pc);
  };

  // ---------------- pop-out tool palette ----------------
  /** Lift a tool dock out of the page into a floating, draggable,
   *  resizable panel that remembers where it was put (Hector: "maybe it
   *  needs its own sub menu that can be popped out and put beside
   *  things"). The panel is appended to BODY on purpose: some themes
   *  rotate every .card by a fraction of a degree, and a transformed
   *  ancestor turns position:fixed into card-relative (the same trap
   *  that offset the brush cursor). Moving the dock node keeps every
   *  listener on its controls. Returns {popOut, dockIn, isOut,
   *  setVisible, restore}. */
  HP.popout = function (dock, opts) {
    const o = opts || {};
    const key = o.key || "paint.dock";
    let panel = null, holder = null, visible = true;
    const load = () => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { return null; } };
    const save = st => { try { localStorage.setItem(key, JSON.stringify(st)); } catch (e) {} };
    function clamp() {
      if (!panel) return;
      const r = panel.getBoundingClientRect();
      const x = Math.min(Math.max(0, r.left), Math.max(0, innerWidth - 80));
      const y = Math.min(Math.max(0, r.top), Math.max(0, innerHeight - 44));
      panel.style.left = x + "px"; panel.style.top = y + "px";
    }
    function persist() {
      if (!panel) return;
      const r = panel.getBoundingClientRect();
      save({out: true, x: Math.round(r.left), y: Math.round(r.top),
            w: Math.round(r.width), h: Math.round(r.height)});
    }
    function popOut() {
      if (panel) return;
      holder = document.createComment("tool-dock");
      dock.parentNode.insertBefore(holder, dock);
      panel = document.createElement("div");
      panel.className = "hp-float";
      panel.style.cssText = "position:fixed;z-index:60;left:16px;top:90px;" +
        "width:min(94vw,540px);max-height:calc(100vh - 8px);overflow:auto;resize:both;" +
        "background:#151027;border:1px solid rgba(255,255,255,.16);border-radius:12px;" +
        "box-shadow:0 14px 48px rgba(0,0,0,.65);padding:0 10px 10px;box-sizing:border-box";
      const bar = document.createElement("div");
      bar.style.cssText = "display:flex;align-items:center;gap:8px;cursor:move;" +
        "user-select:none;touch-action:none;position:sticky;top:0;z-index:1;" +
        "background:#151027;padding:7px 0 6px;margin-bottom:2px;" +
        "border-bottom:1px solid rgba(255,255,255,.08)";
      const title = document.createElement("span");
      title.textContent = "≡ " + (o.title || "TOOLS");
      title.style.cssText = "color:#a78bfa;font-size:12px;letter-spacing:.06em";
      const grow = document.createElement("span"); grow.style.flex = "1";
      const back = document.createElement("button");
      back.textContent = "⇲ dock";
      back.title = "put the tools back where they came from";
      back.style.cssText = "padding:3px 9px;font-size:12px";
      back.onclick = dockIn;
      bar.append(title, grow, back);
      panel.append(bar, dock);
      document.body.appendChild(panel);
      const st = load();
      if (st && st.x != null) {
        panel.style.left = st.x + "px"; panel.style.top = st.y + "px";
        if (st.w) panel.style.width = st.w + "px";
        if (st.h) panel.style.height = st.h + "px";
      }
      clamp();
      let drag = null;
      bar.addEventListener("pointerdown", ev => {
        if (ev.target.closest("button")) return;
        const r = panel.getBoundingClientRect();
        drag = {dx: ev.clientX - r.left, dy: ev.clientY - r.top};
        bar.setPointerCapture(ev.pointerId);
      });
      bar.addEventListener("pointermove", ev => {
        if (!drag) return;
        panel.style.left = (ev.clientX - drag.dx) + "px";
        panel.style.top = (ev.clientY - drag.dy) + "px";
        clamp();
      });
      const endDrag = () => { if (drag) { drag = null; persist(); } };
      bar.addEventListener("pointerup", endDrag);
      bar.addEventListener("pointercancel", endDrag);
      panel.addEventListener("mouseup", persist);          // after a resize
      addEventListener("resize", clamp);
      panel.style.display = visible ? "" : "none";
      persist();
      if (o.onChange) o.onChange(true);
    }
    function dockIn() {
      if (!panel) return;
      holder.parentNode.insertBefore(dock, holder);
      holder.remove(); holder = null;
      panel.remove(); panel = null;
      const st = load() || {};
      st.out = false; save(st);
      if (o.onChange) o.onChange(false);
    }
    return {
      popOut, dockIn,
      isOut: () => !!panel,
      toggle: () => (panel ? dockIn() : popOut()),
      setVisible: v => { visible = !!v; if (panel) panel.style.display = visible ? "" : "none"; },
      restore: () => { const st = load(); if (st && st.out) popOut(); },
    };
  };

  // ---------------- drafts (IndexedDB) ----------------
  // Unsaved paint must survive a reload. localStorage caps at ~5 MB and a
  // 2048 atlas PNG often does not fit, so the Paint page's draft was
  // silently dropped -- and the environment page had no draft at all:
  // Hector lost a session of in-place paint to a reload (2026-09-24).
  // IndexedDB stores blobs of any size. Keys are free-form strings
  // ("paint:<file>", "env:<file>"); every call returns a Promise and may
  // reject (private windows), so callers .catch.
  const DRAFT_DB = "hedgy-paint-drafts", DRAFT_STORE = "drafts";
  let draftDb = null;
  const openDrafts = () => draftDb || (draftDb = new Promise((res, rej) => {
    const r = indexedDB.open(DRAFT_DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(DRAFT_STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => { draftDb = null; rej(r.error); };
  }));
  const draftTx = (mode, fn) => openDrafts().then(d => new Promise((res, rej) => {
    const t = d.transaction(DRAFT_STORE, mode), req = fn(t.objectStore(DRAFT_STORE));
    t.oncomplete = () => res(req ? req.result : undefined);
    t.onerror = t.onabort = () => rej(t.error);
  }));
  /** Save `canvas` as the draft under `key` (PNG blob + timestamp). */
  HP.draftSave = (key, canvas) =>
    new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error("toBlob failed"))), "image/png"))
      .then(blob => draftTx("readwrite", st => st.put({blob, at: Date.now()}, key)));
  /** any structured-cloneable object (the page's geometry edits: typed arrays) under `key` */
  HP.draftPut = (key, obj) => draftTx("readwrite", st => st.put(Object.assign({at: Date.now()}, obj), key));
  /** -> {blob, at} or undefined */
  HP.draftLoad = key => draftTx("readonly", st => st.get(key));
  HP.draftDelete = key => draftTx("readwrite", st => st.delete(key));
  /** every draft key starting with `prefix` */
  HP.draftKeys = prefix => draftTx("readonly", st => st.getAllKeys())
    .then(ks => (ks || []).map(String).filter(k => k.startsWith(prefix)));

  global.HedgyPaint = HP;
})(typeof window !== "undefined" ? window : this);
