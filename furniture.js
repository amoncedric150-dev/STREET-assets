/* =====================================================================
   interiors/furniture.js  —  meubles procéduraux (faible nombre de triangles)
   Chaque meuble : { dims:{w,d,h}, build(batch, M, m, dims, f), collide }
     - origine = centre de l'empreinte au sol, face avant = +Z local
     - M = matrice de pose (position + rotation), m = table des matériaux
   Un meuble peut être remplacé par un GLB : INTERIORS.GLB_MAP.sofa = 'canape.glb'
   (voir models.js). Si le fichier est introuvable, le meuble procédural reste.
   NS.planCollision(layout) : pur (sans Three.js) => murs + meubles + portes.
   ===================================================================== */
(function (root) {
  'use strict';
  var NS = root.INTERIORS = root.INTERIORS || {};
  var T = NS.tools, G = T.geom, m4 = T.m4;
  var F = NS.furniture = NS.furniture || {};

  function bx(b, M, mat, w, h, d, x, y, z) { b.add(G.box(w, h, d), mat, m4.mul(M, m4.t(x, y + h / 2, z))); }
  function cy(b, M, mat, rT, rB, h, x, y, z, seg, ex, ez) { b.add(G.cyl(rT, rB, h, seg || 12, ex, ez), mat, m4.mul(M, m4.t(x, y + h / 2, z))); }
  function sp(b, M, mat, r, x, y, z, sx, sy, sz, seg) { b.add(G.sph(r, seg || 10, sx, sy, sz), mat, m4.mul(M, m4.t(x, y, z))); }
  function def(kind, w, d, h, build, opt) {
    F[kind] = { dims: { w: w, d: d, h: h }, build: build, collide: !(opt && opt.collide === false) };
  }
  // quad vertical collé sur la face avant (+Z) d'un meuble : tableaux, miroirs
  function frontQuad(b, M, mat, w, y0, y1, z) {
    var P = [[-w / 2, y0, z], [w / 2, y0, z], [w / 2, y1, z], [-w / 2, y1, z]].map(function (p) { return m4.pt(M, p[0], p[1], p[2]); });
    b.quad(mat, P[0], P[1], P[2], P[3], m4.dir(M, 0, 0, 1), [[0, 0], [1, 0], [1, 1], [0, 1]]);
  }

  // ---------- SALON ----------
  def('sofa', 2.2, 0.95, 0.85, function (b, M, m, D) {
    var w = D.w, d = D.d, i, cw = (w - 0.44) / 3;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { cy(b, M, m.metal, 0.025, 0.02, 0.12, s[0] * (w / 2 - 0.1), 0, s[1] * (d / 2 - 0.1), 8); });
    bx(b, M, m.fabricGrey, w, 0.30, d - 0.06, 0, 0.12, 0.03);
    bx(b, M, m.fabricGrey, w, 0.46, 0.22, 0, 0.42, -d / 2 + 0.13);
    bx(b, M, m.fabricGrey, 0.22, 0.36, d - 0.06, -(w / 2 - 0.11), 0.42, 0.03);
    bx(b, M, m.fabricGrey, 0.22, 0.36, d - 0.06, (w / 2 - 0.11), 0.42, 0.03);
    for (i = 0; i < 3; i++) {
      var x = -cw + i * cw;
      bx(b, M, m.fabricGrey, cw - 0.015, 0.14, d - 0.34, x, 0.42, 0.12);
      bx(b, M, m.fabricGrey, cw - 0.015, 0.36, 0.15, x, 0.46, -d / 2 + 0.33);
    }
    bx(b, M, m.pillowW, 0.4, 0.38, 0.1, -w / 2 + 0.42, 0.56, -d / 2 + 0.42);
    bx(b, M, m.fabricBlue, 0.38, 0.36, 0.1, w / 2 - 0.42, 0.56, -d / 2 + 0.42);
  });
  def('armchair', 0.85, 0.85, 0.85, function (b, M, m, D) {
    var w = D.w, d = D.d;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { cy(b, M, m.metal, 0.025, 0.02, 0.12, s[0] * (w / 2 - 0.1), 0, s[1] * (d / 2 - 0.1), 8); });
    bx(b, M, m.fabricBlue, w, 0.30, d - 0.04, 0, 0.12, 0.02);
    bx(b, M, m.fabricBlue, w, 0.45, 0.2, 0, 0.42, -d / 2 + 0.12);
    bx(b, M, m.fabricBlue, 0.18, 0.34, d - 0.04, -(w / 2 - 0.09), 0.42, 0.02);
    bx(b, M, m.fabricBlue, 0.18, 0.34, d - 0.04, (w / 2 - 0.09), 0.42, 0.02);
    bx(b, M, m.fabricBlue, w - 0.4, 0.13, d - 0.3, 0, 0.42, 0.1);
  });
  def('tvunit', 1.8, 0.45, 1.27, function (b, M, m, D) {
    var w = D.w, d = D.d;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { bx(b, M, m.woodDark, 0.04, 0.12, 0.04, s[0] * (w / 2 - 0.08), 0, s[1] * (d / 2 - 0.06)); });
    bx(b, M, m.woodDark, w, 0.38, d, 0, 0.12, 0);
    bx(b, M, m.black, 0.01, 0.30, 0.01, 0, 0.16, d / 2 + 0.002);                  // joint des portes
    bx(b, M, m.chrome, 0.12, 0.012, 0.012, -0.12, 0.30, d / 2 + 0.01);
    bx(b, M, m.chrome, 0.12, 0.012, 0.012, 0.12, 0.30, d / 2 + 0.01);
    bx(b, M, m.black, 0.4, 0.015, 0.2, 0, 0.50, -0.04);                            // pied de la TV
    bx(b, M, m.black, 1.25, 0.72, 0.045, 0, 0.52, -0.04);                          // TV
    bx(b, M, m.screen, 1.19, 0.66, 0.01, 0, 0.55, -0.012);                         // dalle noire brillante
  });
  def('coffeetable', 1.2, 0.6, 0.42, function (b, M, m, D) {
    var w = D.w, d = D.d;
    bx(b, M, m.woodLight, w, 0.04, d, 0, 0.38, 0);
    bx(b, M, m.woodDark, w - 0.12, 0.025, d - 0.12, 0, 0.12, 0);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { bx(b, M, m.metal, 0.035, 0.38, 0.035, s[0] * (w / 2 - 0.05), 0, s[1] * (d / 2 - 0.05)); });
  });
  def('rug', 2.8, 2.0, 0.012, function (b, M, m, D, f) {
    var hw = D.w / 2, hd = D.d / 2, y = 0.012;
    var P = [[-hw, y, -hd], [-hw, y, hd], [hw, y, hd], [hw, y, -hd]].map(function (p) { return m4.pt(M, p[0], p[1], p[2]); });
    b.quad(m[f.art || 'rugA'], P[0], P[1], P[2], P[3], [0, 1, 0], [[0, 0], [0, 1], [1, 1], [1, 0]]);
  }, { collide: false });
  def('sidetable', 0.45, 0.45, 0.5, function (b, M, m) {
    cy(b, M, m.woodLight, 0.22, 0.22, 0.03, 0, 0.47, 0, 16);
    cy(b, M, m.metal, 0.02, 0.02, 0.47, 0, 0, 0, 8);
    cy(b, M, m.metal, 0.15, 0.15, 0.015, 0, 0, 0, 14);
    cy(b, M, m.black, 0.05, 0.05, 0.1, 0.05, 0.5, 0, 10);                            // petit vase
    sp(b, M, m.leaf, 0.07, 0.05, 0.66, 0, 1, 0.8, 1, 8);
  });
  def('floorlamp', 0.35, 0.35, 1.6, function (b, M, m) {
    cy(b, M, m.black, 0.14, 0.15, 0.025, 0, 0, 0, 14);
    cy(b, M, m.black, 0.012, 0.012, 1.3, 0, 0.02, 0, 6);
    cy(b, M, m.lampGlow, 0.15, 0.2, 0.3, 0, 1.3, 0, 14);
  });
  def('plant', 0.5, 0.5, 1.3, function (b, M, m, D) {
    var k = D.h / 1.3, i;
    cy(b, M, m.pot, 0.17 * k, 0.12 * k, 0.3 * k, 0, 0, 0, 12);
    cy(b, M, m.soil, 0.155 * k, 0.155 * k, 0.02, 0, 0.29 * k, 0, 10);
    for (i = 0; i < 5; i++) {
      var a = i * 1.256, r = 0.1 * k, hh = (0.55 + (i % 3) * 0.2) * k;
      cy(b, M, m.leaf, 0.008, 0.012, hh, Math.cos(a) * r * 0.5, 0.3 * k, Math.sin(a) * r * 0.5, 5);
      sp(b, M, m.leaf, 0.2 * k, Math.cos(a) * r, (0.3 + 0.2 + hh) * k, Math.sin(a) * r, 1, 0.55, 1, 8);
    }
  });
  def('bookshelf', 0.9, 0.3, 1.9, function (b, M, m, D) {
    var w = D.w, d = D.d, h = D.h, i, j, mats = [m.bookA, m.bookB, m.bookC, m.woodLight];
    bx(b, M, m.woodDark, 0.03, h, d, -w / 2 + 0.015, 0, 0);
    bx(b, M, m.woodDark, 0.03, h, d, w / 2 - 0.015, 0, 0);
    bx(b, M, m.woodDark, w, h, 0.012, 0, 0, -d / 2 + 0.006);
    for (i = 0; i < 6; i++) bx(b, M, m.woodDark, w - 0.06, 0.03, d - 0.01, 0, i * 0.37, 0.0);
    for (i = 0; i < 4; i++) {                                                         // quelques livres
      var x = -w / 2 + 0.07;
      for (j = 0; j < 9; j++) {
        var bw = 0.03 + ((i * 7 + j * 5) % 4) * 0.012, bh = 0.2 + ((i * 3 + j * 2) % 4) * 0.04;
        if (x + bw > w / 2 - 0.05) break;
        bx(b, M, mats[(i + j) % 4], bw, bh, d * 0.7, x + bw / 2, i * 0.37 + 0.03, 0.0);
        x += bw + 0.004;
      }
    }
  });
  def('picture', 0.8, 0.03, 0.6, function (b, M, m, D, f) {
    var y = 0, w = D.w, h = D.h;
    bx(b, M, m.frame, w + 0.04, h + 0.04, 0.03, 0, y - 0.02, 0);
    frontQuad(b, M, m[f.art || 'art1'], w, y, y + h, 0.0165);
  }, { collide: false });

  // ---------- CUISINE ----------
  function cabinetBody(b, M, m, w, d) {
    bx(b, M, m.black, w - 0.04, 0.1, d - 0.06, 0, 0, -0.01);                          // plinthe
    bx(b, M, m.cabWhite, w - 0.004, 0.76, d - 0.02, 0, 0.1, 0);
    bx(b, M, m.counterTop, w + 0.004, 0.04, d + 0.02, 0, 0.86, 0.01);
  }
  def('counter', 0.6, 0.6, 0.9, function (b, M, m, D) {
    var w = D.w, d = D.d, n = Math.max(1, Math.round(w / 0.6)), i;
    cabinetBody(b, M, m, w, d);
    for (i = 0; i < n; i++) {
      var cx = -w / 2 + (i + 0.5) * w / n;
      bx(b, M, m.black, 0.006, 0.72, 0.004, cx - w / (2 * n), 0.12, d / 2 + 0.006);
      bx(b, M, m.chrome, 0.22, 0.014, 0.016, cx, 0.78, d / 2 + 0.016);
    }
  });
  def('stove', 0.6, 0.6, 0.9, function (b, M, m, D) {
    var w = D.w, d = D.d;
    bx(b, M, m.black, w - 0.04, 0.08, d - 0.06, 0, 0, -0.01);
    bx(b, M, m.metal, w - 0.004, 0.78, d - 0.02, 0, 0.08, 0);
    bx(b, M, m.black, w, 0.02, d, 0, 0.86, 0.01);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { cy(b, M, m.metal, 0.085, 0.085, 0.012, s[0] * 0.14, 0.88, s[1] * 0.12 + 0.01, 14); cy(b, M, m.black, 0.05, 0.05, 0.016, s[0] * 0.14, 0.88, s[1] * 0.12 + 0.01, 12); });
    bx(b, M, m.screen, w - 0.12, 0.38, 0.012, 0, 0.22, d / 2 - 0.008);             // porte du four
    bx(b, M, m.chrome, w - 0.2, 0.018, 0.03, 0, 0.64, d / 2 + 0.02);
    [-0.2, -0.07, 0.07, 0.2].forEach(function (x) { cy(b, M, m.chrome, 0.012, 0.012, 0.02, x, 0.76, d / 2 + 0.012, 8); });
  });
  def('sink', 1.2, 0.6, 0.9, function (b, M, m, D) {
    var w = D.w, d = D.d;
    cabinetBody(b, M, m, w, d);
    bx(b, M, m.black, 0.006, 0.72, 0.004, 0, 0.12, d / 2 + 0.006);
    bx(b, M, m.chrome, 0.22, 0.014, 0.016, -w / 4, 0.78, d / 2 + 0.016);
    bx(b, M, m.chrome, 0.22, 0.014, 0.016, w / 4, 0.78, d / 2 + 0.016);
    bx(b, M, m.metal, 0.5, 0.008, 0.38, -0.18, 0.9, 0.0);                          // cuve
    bx(b, M, m.black, 0.42, 0.002, 0.3, -0.18, 0.909, 0.0);
    cy(b, M, m.chrome, 0.014, 0.014, 0.26, 0.14, 0.9, -0.2, 8);                    // robinet
    bx(b, M, m.chrome, 0.012, 0.012, 0.15, 0.14, 1.14, -0.13);
  });
  def('fridge', 0.75, 0.7, 1.85, function (b, M, m, D) {
    var w = D.w, d = D.d, h = D.h;
    bx(b, M, m.metal, w, h, d, 0, 0, 0);
    bx(b, M, m.black, w - 0.02, 0.012, 0.01, 0, 0.64 * h, d / 2 + 0.003);          // séparation congélateur / frigo
    bx(b, M, m.chrome, 0.025, 0.55, 0.03, w / 2 - 0.08, 0.72 * h - 0.2, d / 2 + 0.02);
    bx(b, M, m.chrome, 0.025, 0.4, 0.03, w / 2 - 0.08, 0.64 * h * 0.5 - 0.1, d / 2 + 0.02);
  });
  def('wallcab', 0.6, 0.33, 0.7, function (b, M, m, D) {
    var w = D.w, d = D.d, h = D.h;
    bx(b, M, m.cabWhite, w - 0.004, h, d, 0, 0, 0);
    bx(b, M, m.black, 0.006, h - 0.04, 0.004, 0, 0.02, d / 2 + 0.003);
    bx(b, M, m.chrome, 0.014, 0.18, 0.016, 0.03, 0.06, d / 2 + 0.012);
  }, { collide: false });
  def('hood', 0.6, 0.5, 1.0, function (b, M, m, D) {
    bx(b, M, m.metal, D.w, 0.1, D.d, 0, 0, 0);
    cy(b, M, m.metal, 0.09, 0.09, D.h - 0.1, 0, 0.1, -0.1, 10);
    bx(b, M, m.black, D.w - 0.1, 0.01, D.d - 0.1, 0, -0.003, 0);
  }, { collide: false });
  def('diningtable', 1.4, 0.9, 0.75, function (b, M, m, D) {
    var w = D.w, d = D.d;
    bx(b, M, m.woodLight, w, 0.04, d, 0, 0.71, 0);
    bx(b, M, m.woodDark, w - 0.16, 0.06, d - 0.16, 0, 0.65, 0);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { bx(b, M, m.woodDark, 0.06, 0.71, 0.06, s[0] * (w / 2 - 0.08), 0, s[1] * (d / 2 - 0.08)); });
  });
  def('chair', 0.45, 0.45, 0.9, function (b, M, m, D) {
    var w = D.w, d = D.d;
    bx(b, M, m.woodLight, w, 0.04, d, 0, 0.45, 0);
    bx(b, M, m.woodLight, w, 0.34, 0.03, 0, 0.55, -d / 2 + 0.015);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { bx(b, M, m.woodDark, 0.04, 0.45, 0.04, s[0] * (w / 2 - 0.03), 0, s[1] * (d / 2 - 0.03)); });
    bx(b, M, m.woodDark, 0.04, 0.45, 0.04, -(w / 2 - 0.03), 0.49, -d / 2 + 0.03);
    bx(b, M, m.woodDark, 0.04, 0.45, 0.04, (w / 2 - 0.03), 0.49, -d / 2 + 0.03);
  });

  // ---------- COULOIR / ENTRÉE ----------
  def('console', 0.8, 0.3, 0.8, function (b, M, m, D) {
    var w = D.w, d = D.d;
    bx(b, M, m.woodDark, w, 0.04, d, 0, 0.76, 0);
    bx(b, M, m.woodDark, w - 0.1, 0.02, d - 0.06, 0, 0.25, 0);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { bx(b, M, m.metal, 0.03, 0.76, 0.03, s[0] * (w / 2 - 0.04), 0, s[1] * (d / 2 - 0.04)); });
    cy(b, M, m.pot, 0.06, 0.05, 0.14, -0.2, 0.8, 0, 10);
    sp(b, M, m.leaf, 0.1, -0.2, 1.0, 0, 1, 0.8, 1, 8);
  });
  def('shoecab', 1.0, 0.35, 0.9, function (b, M, m, D) {
    var w = D.w, d = D.d;
    bx(b, M, m.woodLight, w, 0.86, d, 0, 0.04, 0);
    bx(b, M, m.woodDark, w + 0.02, 0.04, d + 0.02, 0, 0.86, 0);
    bx(b, M, m.black, w - 0.06, 0.1, d - 0.06, 0, 0, 0);
    bx(b, M, m.black, 0.006, 0.78, 0.004, 0, 0.08, d / 2 + 0.002);
    bx(b, M, m.chrome, 0.2, 0.012, 0.014, -0.25, 0.7, d / 2 + 0.012);
    bx(b, M, m.chrome, 0.2, 0.012, 0.014, 0.25, 0.7, d / 2 + 0.012);
  });

  // ---------- CHAMBRE ----------
  // lit : tête côté -Z local, pieds côté +Z
  def('bed', 1.6, 2.1, 0.95, function (b, M, m, D) {
    var w = D.w, d = D.d, L = d * 0.66;
    bx(b, M, m.woodDark, w + 0.06, 0.2, d, 0, 0.08, 0);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { bx(b, M, m.woodDark, 0.06, 0.08, 0.06, s[0] * (w / 2 - 0.02), 0, s[1] * (d / 2 - 0.04)); });
    bx(b, M, m.mattress, w, 0.22, d - 0.06, 0, 0.28, 0.02);
    bx(b, M, m.linen, w + 0.05, 0.1, L, 0, 0.45, d / 2 - L / 2 - 0.01);
    bx(b, M, m.linen, w + 0.05, 0.28, 0.1, 0, 0.27, d / 2 - 0.05);                    // retombée au pied du lit
    bx(b, M, m.woodDark, w + 0.12, 0.95, 0.08, 0, 0, -d / 2 + 0.04);
    bx(b, M, m.fabricBlue, w - 0.08, 0.55, 0.05, 0, 0.3, -d / 2 + 0.105);             // tête de lit capitonnée
    bx(b, M, m.pillowW, 0.62, 0.13, 0.4, -0.38, 0.5, -d / 2 + 0.34);
    bx(b, M, m.pillowW, 0.62, 0.13, 0.4, 0.38, 0.5, -d / 2 + 0.34);
    bx(b, M, m.fabricBlue, 0.45, 0.04, 0.9, 0, 0.55, d / 2 - L / 2 + 0.2);             // plaid
  });
  def('nightstand', 0.45, 0.4, 0.5, function (b, M, m, D) {
    var w = D.w, d = D.d;
    bx(b, M, m.woodDark, w, 0.42, d, 0, 0.08, 0);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { bx(b, M, m.metal, 0.025, 0.08, 0.025, s[0] * (w / 2 - 0.04), 0, s[1] * (d / 2 - 0.04)); });
    bx(b, M, m.black, w - 0.06, 0.006, 0.004, 0, 0.3, d / 2 + 0.003);
    bx(b, M, m.chrome, 0.1, 0.012, 0.014, 0, 0.38, d / 2 + 0.012);
    cy(b, M, m.black, 0.07, 0.08, 0.012, 0, 0.5, 0, 12);                              // lampe de chevet
    cy(b, M, m.black, 0.01, 0.01, 0.2, 0, 0.51, 0, 6);
    cy(b, M, m.lampGlow, 0.1, 0.13, 0.17, 0, 0.66, 0, 12);
  }, { collide: true });
  def('wardrobe', 2.0, 0.6, 2.2, function (b, M, m, D) {
    var w = D.w, d = D.d, h = D.h, i;
    bx(b, M, m.black, w - 0.06, 0.06, d - 0.06, 0, 0, 0);
    bx(b, M, m.cabWhite, w, h - 0.06, d, 0, 0.06, 0);
    for (i = 1; i < 4; i++) bx(b, M, m.black, 0.006, h - 0.12, 0.004, -w / 2 + i * w / 4, 0.09, d / 2 + 0.003);
    bx(b, M, m.mirror, w / 4 - 0.06, h - 0.3, 0.008, 3 * w / 8, 0.18, d / 2 + 0.006);   // porte miroir (4e panneau)
    for (i = 1; i < 4; i++) [-1, 1].forEach(function (s) { bx(b, M, m.chrome, 0.014, 0.5, 0.02, -w / 2 + i * w / 4 + s * 0.04, 1.0, d / 2 + 0.014); });
  });

  // ---------- SALLE DE BAIN ----------
  def('bathtub', 1.7, 0.75, 0.55, function (b, M, m, D) {
    var w = D.w, d = D.d, h = D.h, t = 0.07;
    bx(b, M, m.ceramic, t, h, d, -w / 2 + t / 2, 0, 0);
    bx(b, M, m.ceramic, t, h, d, w / 2 - t / 2, 0, 0);
    bx(b, M, m.ceramic, w - 2 * t, h, t, 0, 0, -d / 2 + t / 2);
    bx(b, M, m.ceramic, w - 2 * t, h, t, 0, 0, d / 2 - t / 2);
    bx(b, M, m.ceramic, w - 2 * t, 0.16, d - 2 * t, 0, 0, 0);
    bx(b, M, m.ceramicIn, w - 2 * t, 0.004, d - 2 * t, 0, 0.162, 0);
    cy(b, M, m.chrome, 0.015, 0.015, 0.14, -w / 2 + 0.2, h, -d / 2 + 0.04, 8);
    bx(b, M, m.chrome, 0.012, 0.012, 0.1, -w / 2 + 0.2, h + 0.12, -d / 2 + 0.085);
    cy(b, M, m.chrome, 0.02, 0.02, 0.012, w / 2 - 0.3, 0.165, 0, 10);                 // bonde
  });
  def('toilet', 0.4, 0.7, 0.8, function (b, M, m, D) {
    var d = D.d;
    bx(b, M, m.ceramic, 0.38, 0.4, 0.2, 0, 0.4, -d / 2 + 0.1);                        // réservoir
    cy(b, M, m.chrome, 0.02, 0.02, 0.012, 0, 0.8, -d / 2 + 0.1, 10);
    cy(b, M, m.ceramic, 0.14, 0.12, 0.4, 0, 0, -0.1, 14, 1, 1.0);                     // piédestal
    cy(b, M, m.ceramic, 0.19, 0.17, 0.12, 0, 0.3, 0.02, 16, 1, 1.35);                 // cuvette
    cy(b, M, m.ceramicIn, 0.15, 0.15, 0.012, 0, 0.42, 0.02, 14, 1, 1.35);              // lunette
  });
  def('vanity', 0.8, 0.5, 0.85, function (b, M, m, D) {
    var w = D.w, d = D.d;
    bx(b, M, m.black, w - 0.04, 0.08, d - 0.06, 0, 0, 0);
    bx(b, M, m.cabWhite, w, 0.68, d, 0, 0.08, 0);
    bx(b, M, m.ceramic, w + 0.01, 0.04, d + 0.01, 0, 0.76, 0);
    bx(b, M, m.ceramicIn, 0.38, 0.006, 0.28, 0, 0.8, 0.03);                            // vasque
    cy(b, M, m.chrome, 0.012, 0.012, 0.14, 0, 0.8, -d / 2 + 0.06, 8);
    bx(b, M, m.chrome, 0.012, 0.012, 0.09, 0, 0.92, -d / 2 + 0.1);
    bx(b, M, m.black, 0.006, 0.6, 0.004, 0, 0.12, d / 2 + 0.003);
    bx(b, M, m.chrome, 0.14, 0.012, 0.014, 0.0, 0.62, d / 2 + 0.012);
  });
  def('mirror', 0.7, 0.03, 0.8, function (b, M, m, D) {
    bx(b, M, m.frame, D.w + 0.04, D.h + 0.04, 0.02, 0, -0.02, 0);
    bx(b, M, m.mirror, D.w, D.h, 0.012, 0, 0, 0.007);
  }, { collide: false });

  // ---------- noms de dimensions + plan de collisions (pur, testable sous Node) ----------
  NS.dimsOf = function (f) {
    var d = F[f.kind] ? F[f.kind].dims : { w: 0.5, d: 0.5, h: 0.5 };
    return { w: f.w || d.w, d: f.d || d.d, h: f.h || d.h };
  };
  // Rend { C, cols, doors } : cols = obstacles du corps (body) et de la caméra (cam), repère LOCAL
  NS.planCollision = function (L) {
    var C = T.compile(L), cols = [], doors = [], W = L.size.w, D = L.size.d, H = L.ceiling, t = L.wallT;
    C.cols.forEach(function (c) { cols.push({ x0: c.x0, x1: c.x1, z0: c.z0, z1: c.z1, y0: c.y0, y1: c.y1, body: c.body, cam: true }); });
    C.doors.forEach(function (d) {
      var r = d.axis === 'x'
        ? { x0: d.c - d.w / 2, x1: d.c + d.w / 2, z0: d.at - 0.05, z1: d.at + 0.05, y0: 0, y1: d.h }
        : { x0: d.at - 0.05, x1: d.at + 0.05, z0: d.c - d.w / 2, z1: d.c + d.w / 2, y0: 0, y1: d.h };
      r.body = true; r.cam = true; r.door = true; cols.push(r); doors.push({ def: d, col: r });
    });
    L.furniture.forEach(function (f) {
      var def = F[f.kind]; if (!def || def.collide === false || f.collide === false) return;
      var b = T.pieceBox(f, NS.dimsOf(f)); b.cam = (b.y1 > 1.5); cols.push(b);
    });
    cols.push({ x0: -t, x1: W + t, z0: -t, z1: D + t, y0: H, y1: H + 0.4, body: false, cam: true });     // plafond (caméra)
    cols.push({ x0: -t, x1: W + t, z0: -t, z1: D + t, y0: -0.4, y1: 0, body: false, cam: true });        // sol (caméra)
    return { C: C, cols: cols, doors: doors };
  };
})(typeof window !== 'undefined' ? window : globalThis);
