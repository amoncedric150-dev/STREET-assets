/* =====================================================================
   interiors/builder.js  —  outils PURS (sans Three.js) du système d'intérieurs
   - CONFIG : réglages globaux
   - géométries (boîte / cylindre / sphère) sous forme de tableaux
   - Batch : fusionne tout par matériau => très peu de draw calls (mobile)
   - découpe des murs autour des portes / fenêtres + collisions
   Chargé en premier. Aucune dépendance : testable sous Node.
   ===================================================================== */
(function (root) {
  'use strict';
  var NS = root.INTERIORS = root.INTERIORS || {};
  NS.layouts = NS.layouts || {};      // plans d'intérieurs enregistrés (voir layout_*.js)
  NS.furniture = NS.furniture || {};  // constructeurs de meubles (voir furniture.js)
  NS.GLB_MAP = NS.GLB_MAP || {};      // kind -> 'fichier.glb' (remplace le meuble procédural)

  NS.CONFIG = NS.CONFIG || {
    // L'intérieur est construit loin au-dessus de la ville (aucune interférence, la ville est masquée dedans)
    originX: 0, originY: 800, originZ: 0,
    camDist: 3.0,            // distance caméra 3e personne à l'intérieur
    camPitch: 0.3,           // inclinaison de la caméra à l'entrée (plus grand = vue plus d'en haut)
    camMin: 1.7,             // distance minimale caméra-joueur quand un mur la gêne (plus grand = caméra moins collée)
    camMargin: 0.1,          // marge de la caméra autour des murs (m)
    walkSpeedFactor: 0.55,   // vitesse du joueur à l'intérieur (1 = vitesse de la rue)
    playerRadius: 0.30,      // rayon de collision du joueur (m)
    ambient: 0.55, ambientColor: 0xfff2e0,          // lumière de base (réglage « trop sombre / trop clair »)
    lightIntensity: 1.25, lightDistance: 7.0, lightDecay: 1.4,   // lampes de plafond
    envIntensity: 0.30,      // reflets du ciel sur les matériaux d'intérieur
    doorOpenAngle: 1.75, doorSpeed: 5.0, doorOpenDist: 1.5, doorCloseDist: 2.3,
    modelsPath: 'Models/interiors/',                // dossier des GLB de meubles (à côté de index.html)
    seeCity: true,           // true = la ville reste visible par les fenêtres (l'appartement flotte au bord de la ville)
    floorHeight: 12,         // hauteur minimale du sol de l'appartement au-dessus de la rue (m), si seeCity
    viewHeightFactor: 0.8,   // hauteur du sol = cette part de la hauteur moyenne des immeubles (pour voir par-dessus la ville)
    viewHeightMax: 60,       // hauteur maximale du sol de l'appartement (m)
    edgeGap: 20,             // distance entre le bord des immeubles et l'appartement (m), si seeCity
    playerScale: 0.8,        // taille du personnage à l'intérieur (1 = taille normale)
    fov: 75,                 // champ de vision de la caméra à l'intérieur (la ville reste à 62)
    sunIndoor: 0.35, hemiIndoor: 0.6,   // part de la lumière du jour qui entre dans l'appartement
    debugButton: true,       // petit bouton « 🏠 Appart. » dans la barre du haut
    autoEnterHash: 'appart'  // ouvrir le jeu avec  index.html#appart  => entre direct dans l'appartement
  };

  var T = NS.tools = {};

  /* ---------- matrices 4x4 minimalistes (colonne-major, comme Three.js) ---------- */
  var m4 = T.m4 = {
    id: function () { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; },
    mul: function (a, b) {
      var o = new Array(16), c, r, k, s;
      for (c = 0; c < 4; c++) for (r = 0; r < 4; r++) { s = 0; for (k = 0; k < 4; k++) s += a[k*4+r] * b[c*4+k]; o[c*4+r] = s; }
      return o;
    },
    t:  function (x, y, z) { var m = m4.id(); m[12] = x; m[13] = y; m[14] = z; return m; },
    ry: function (a) { var c = Math.cos(a), s = Math.sin(a), m = m4.id(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; },
    rx: function (a) { var c = Math.cos(a), s = Math.sin(a), m = m4.id(); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; },
    rz: function (a) { var c = Math.cos(a), s = Math.sin(a), m = m4.id(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; },
    pt:  function (m, x, y, z) { return [m[0]*x+m[4]*y+m[8]*z+m[12], m[1]*x+m[5]*y+m[9]*z+m[13], m[2]*x+m[6]*y+m[10]*z+m[14]]; },
    dir: function (m, x, y, z) { return [m[0]*x+m[4]*y+m[8]*z, m[1]*x+m[5]*y+m[9]*z, m[2]*x+m[6]*y+m[10]*z]; }
  };

  /* ---------- géométries (triangles non indexés, centrées sur l'origine) ---------- */
  var geom = T.geom = {};
  function GM() { return { p: [], n: [], u: [], metric: false }; }
  function tri(g, a, b, c, na, nb, nc, ua, ub, uc) {
    g.p.push(a[0],a[1],a[2], b[0],b[1],b[2], c[0],c[1],c[2]);
    g.n.push(na[0],na[1],na[2], nb[0],nb[1],nb[2], nc[0],nc[1],nc[2]);
    g.u.push(ua[0],ua[1], ub[0],ub[1], uc[0],uc[1]);
  }
  function nrm3(v) { var l = Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]) || 1; return [v[0]/l, v[1]/l, v[2]/l]; }

  var FACES = [ // [normale, axe u, axe v] avec  u × v = normale  (sens anti-horaire vu de l'extérieur)
    [[1,0,0],[0,0,-1],[0,1,0]], [[-1,0,0],[0,0,1],[0,1,0]],
    [[0,1,0],[1,0,0],[0,0,-1]], [[0,-1,0],[1,0,0],[0,0,1]],
    [[0,0,1],[1,0,0],[0,1,0]], [[0,0,-1],[-1,0,0],[0,1,0]]
  ];
  // Boîte : UV en MÈTRES (le matériau divise par sa taille de motif => texture à l'échelle réelle)
  geom.box = function (w, h, d) {
    var g = GM(); g.metric = true; var half = [w/2, h/2, d/2];
    FACES.forEach(function (F) {
      var n = F[0], a = F[1], b = F[2];
      var hn = Math.abs(n[0])*half[0] + Math.abs(n[1])*half[1] + Math.abs(n[2])*half[2];
      var ua = Math.abs(a[0])*w + Math.abs(a[1])*h + Math.abs(a[2])*d;
      var vb = Math.abs(b[0])*w + Math.abs(b[1])*h + Math.abs(b[2])*d;
      var C = function (sa, sb) { return [n[0]*hn + a[0]*ua/2*sa + b[0]*vb/2*sb, n[1]*hn + a[1]*ua/2*sa + b[1]*vb/2*sb, n[2]*hn + a[2]*ua/2*sa + b[2]*vb/2*sb]; };
      var c0 = C(-1,-1), c1 = C(1,-1), c2 = C(1,1), c3 = C(-1,1);
      tri(g, c0, c1, c2, n, n, n, [0,0], [ua,0], [ua,vb]);
      tri(g, c0, c2, c3, n, n, n, [0,0], [ua,vb], [0,vb]);
    });
    return g;
  };
  // Cylindre / cône tronqué (rT = rayon haut, rB = rayon bas), ex/ez = aplatissement elliptique
  geom.cyl = function (rT, rB, h, seg, ex, ez) {
    seg = seg || 14; ex = ex || 1; ez = ez || 1;
    var g = GM(), y0 = -h/2, y1 = h/2, sl = (rB - rT) / h, i;
    var N = function (a) { return nrm3([Math.cos(a)/ex, sl, Math.sin(a)/ez]); };
    for (i = 0; i < seg; i++) {
      var a0 = 2*Math.PI*i/seg, a1 = 2*Math.PI*(i+1)/seg;
      var b0 = [rB*Math.cos(a0)*ex, y0, rB*Math.sin(a0)*ez], b1 = [rB*Math.cos(a1)*ex, y0, rB*Math.sin(a1)*ez];
      var t0 = [rT*Math.cos(a0)*ex, y1, rT*Math.sin(a0)*ez], t1 = [rT*Math.cos(a1)*ex, y1, rT*Math.sin(a1)*ez];
      var n0 = N(a0), n1 = N(a1), u0 = i/seg, u1 = (i+1)/seg;
      tri(g, b0, t1, b1, n0, n1, n1, [u0,0], [u1,1], [u1,0]);
      if (rT > 1e-4) tri(g, b0, t0, t1, n0, n0, n1, [u0,0], [u0,1], [u1,1]);
      if (rT > 1e-4) tri(g, [0,y1,0], t1, t0, [0,1,0], [0,1,0], [0,1,0], [.5,.5], [.5+.5*Math.cos(a1), .5+.5*Math.sin(a1)], [.5+.5*Math.cos(a0), .5+.5*Math.sin(a0)]);
      if (rB > 1e-4) tri(g, [0,y0,0], b0, b1, [0,-1,0], [0,-1,0], [0,-1,0], [.5,.5], [.5+.5*Math.cos(a0), .5+.5*Math.sin(a0)], [.5+.5*Math.cos(a1), .5+.5*Math.sin(a1)]);
    }
    return g;
  };
  // Sphère / ellipsoïde
  geom.sph = function (r, seg, sx, sy, sz) {
    seg = seg || 10; sx = sx || 1; sy = sy || 1; sz = sz || 1;
    var g = GM(), la = Math.max(4, Math.round(seg * 0.6)), i, j;
    var V = function (i, j) {
      var th = Math.PI*i/la, ph = 2*Math.PI*j/seg;
      var x = Math.sin(th)*Math.cos(ph), y = Math.cos(th), z = Math.sin(th)*Math.sin(ph);
      return { p: [r*sx*x, r*sy*y, r*sz*z], n: nrm3([x/sx, y/sy, z/sz]), u: [j/seg, 1 - i/la] };
    };
    for (i = 0; i < la; i++) for (j = 0; j < seg; j++) {
      var a = V(i,j), b = V(i+1,j), c = V(i+1,j+1), d = V(i,j+1);
      tri(g, a.p, c.p, b.p, a.n, c.n, b.n, a.u, c.u, b.u);
      tri(g, a.p, d.p, c.p, a.n, d.n, c.n, a.u, d.u, c.u);
    }
    return g;
  };

  /* ---------- Batch : accumule tout, regroupé par matériau ---------- */
  T.Batch = function () { this.map = new Map(); };
  T.Batch.prototype._b = function (mat) {
    var b = this.map.get(mat);
    if (!b) { b = { pos: [], nor: [], uv: [] }; this.map.set(mat, b); }
    return b;
  };
  T.Batch.prototype.add = function (g, mat, m) {
    var b = this._b(mat), tile = (mat.userData && mat.userData.tile) || 1, k = g.metric ? 1 / tile : 1, i, v, nn, l;
    for (i = 0; i < g.p.length; i += 3) {
      v = m4.pt(m, g.p[i], g.p[i+1], g.p[i+2]); b.pos.push(v[0], v[1], v[2]);
      nn = m4.dir(m, g.n[i], g.n[i+1], g.n[i+2]); l = Math.sqrt(nn[0]*nn[0]+nn[1]*nn[1]+nn[2]*nn[2]) || 1;
      b.nor.push(nn[0]/l, nn[1]/l, nn[2]/l);
    }
    for (i = 0; i < g.u.length; i++) b.uv.push(g.u[i] * k);
  };
  // quad : 4 points (anti-horaire vu de la face visible), normale, uv en mètres
  T.Batch.prototype.quad = function (mat, p0, p1, p2, p3, n, uv) {
    var g = GM(); g.metric = true;
    tri(g, p0, p1, p2, n, n, n, uv[0], uv[1], uv[2]);
    tri(g, p0, p2, p3, n, n, n, uv[0], uv[2], uv[3]);
    this.add(g, mat, m4.id());
  };
  T.Batch.prototype.floor = function (mat, x0, z0, x1, z1, y) {   // face visible vers le haut
    this.quad(mat, [x0,y,z0], [x0,y,z1], [x1,y,z1], [x1,y,z0], [0,1,0], [[x0,z0],[x0,z1],[x1,z1],[x1,z0]]);
  };
  T.Batch.prototype.ceil = function (mat, x0, z0, x1, z1, y) {    // face visible vers le bas
    this.quad(mat, [x0,y,z0], [x1,y,z0], [x1,y,z1], [x0,y,z1], [0,-1,0], [[x0,z0],[x1,z0],[x1,z1],[x0,z1]]);
  };
  T.Batch.prototype.triCount = function () { var n = 0; this.map.forEach(function (b) { n += b.pos.length / 9; }); return n; };
  T.Batch.prototype.meshCount = function () { return this.map.size; };
  // Convertit en vrais Mesh Three.js (un par matériau)
  T.Batch.prototype.toMeshes = function (THREE, parent) {
    this.map.forEach(function (b, mat) {
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(b.pos), 3));
      g.setAttribute('normal',   new THREE.BufferAttribute(new Float32Array(b.nor), 3));
      g.setAttribute('uv',       new THREE.BufferAttribute(new Float32Array(b.uv), 2));
      var mesh = new THREE.Mesh(g, mat);
      mesh.name = 'int_' + (mat.name || 'mat');
      if (mat.transparent) { mesh.renderOrder = 2; mesh.castShadow = false; mesh.receiveShadow = false; }
      else { mesh.castShadow = true; mesh.receiveShadow = true; }
      parent.add(mesh);
    });
  };

  /* ---------- murs : découpe autour des ouvertures + collisions ---------- */
  // wall = {axis:'x'|'z', at, from, to, t, openings:[{type:'door'|'pass'|'window', c, w, h, sill, hinge, id, frosted, main}]}
  T.splitWall = function (w, H) {
    var t = w.t, ops = (w.openings || []).slice().sort(function (a, b) { return a.c - b.c; });
    var geo = [], cols = [], doors = [], wins = [], passes = [], cur = w.from - t/2, end = w.to + t/2;
    function solid(a0, a1) {
      if (a1 - a0 > 1e-4) { geo.push({ a0: a0, a1: a1, y0: 0, y1: H }); cols.push({ a0: a0, a1: a1, y0: 0, y1: H, body: true }); }
    }
    ops.forEach(function (o) {
      var a0 = o.c - o.w/2, a1 = o.c + o.w/2;
      solid(cur, a0);
      if (o.type === 'window') {
        var sill = o.sill == null ? 0.9 : o.sill, wh = o.h == null ? 1.3 : o.h;
        geo.push({ a0: a0, a1: a1, y0: 0, y1: sill });
        geo.push({ a0: a0, a1: a1, y0: sill + wh, y1: H });
        cols.push({ a0: a0, a1: a1, y0: 0, y1: H, body: true });   // on ne passe pas par la fenêtre
        wins.push({ c: o.c, w: o.w, sill: sill, h: wh, frosted: !!o.frosted });
      } else {
        var dh = o.h == null ? (o.type === 'door' ? 2.05 : 2.2) : o.h;
        geo.push({ a0: a0, a1: a1, y0: dh, y1: H });                // linteau
        cols.push({ a0: a0, a1: a1, y0: dh, y1: H, body: false }); // linteau : bloque seulement la caméra
        if (o.type === 'door') doors.push({ c: o.c, w: o.w, h: dh, hinge: o.hinge || 'min', swing: o.swing == null ? 1 : o.swing, id: o.id || null, main: !!o.main });
        else passes.push({ c: o.c, w: o.w, h: dh });
      }
      cur = a1;
    });
    solid(cur, end);
    return { geo: geo, cols: cols, doors: doors, wins: wins, passes: passes };
  };

  T.compile = function (L) {
    var H = L.ceiling, t = L.wallT, out = { geo: [], cols: [], doors: [], wins: [], passes: [] };
    L.walls.forEach(function (w) {
      var ww = {}; for (var k in w) ww[k] = w[k]; ww.t = t;
      var s = T.splitWall(ww, H);
      var rect = function (b) {
        return w.axis === 'x'
          ? { x0: b.a0, x1: b.a1, z0: w.at - t/2, z1: w.at + t/2, y0: b.y0, y1: b.y1 }
          : { x0: w.at - t/2, x1: w.at + t/2, z0: b.a0, z1: b.a1, y0: b.y0, y1: b.y1 };
      };
      var place = function (o) { o.axis = w.axis; o.at = w.at; o.cx = w.axis === 'x' ? o.c : w.at; o.cz = w.axis === 'x' ? w.at : o.c; return o; };
      s.geo.forEach(function (b) { out.geo.push(rect(b)); });
      s.cols.forEach(function (b) { var r = rect(b); r.body = b.body; out.cols.push(r); });
      s.doors.forEach(function (d) { out.doors.push(place(d)); });
      s.wins.forEach(function (d) { out.wins.push(place(d)); });
      s.passes.forEach(function (d) { out.passes.push(place(d)); });
    });
    return out;
  };

  // Boîte de collision (AABB) d'un meuble de dimensions {w,d,h} posé en (x,z) avec rotation rot
  T.pieceBox = function (f, dims) {
    var c = Math.abs(Math.cos(f.rot || 0)), s = Math.abs(Math.sin(f.rot || 0));
    var hw = (c * dims.w + s * dims.d) / 2, hd = (s * dims.w + c * dims.d) / 2;
    return { x0: f.x - hw, x1: f.x + hw, z0: f.z - hd, z1: f.z + hd, y0: f.y || 0, y1: (f.y || 0) + dims.h, body: true };
  };

  // Vrai si le cercle (x,z,r) touche un obstacle qui bloque le corps du joueur
  T.circleHits = function (cols, x, z, r) {
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i]; if (!c.body) continue;
      var nx = x < c.x0 ? c.x0 : (x > c.x1 ? c.x1 : x), nz = z < c.z0 ? c.z0 : (z > c.z1 ? c.z1 : z);
      var dx = x - nx, dz = z - nz;
      if (dx*dx + dz*dz < r*r) return true;
    }
    return false;
  };
  // Vrai si le point 3D est dans un obstacle (sert à raccourcir la caméra)
  T.pointBlocked = function (cols, x, y, z, m) {
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i];
      if (x > c.x0 - m && x < c.x1 + m && z > c.z0 - m && z < c.z1 + m && y > c.y0 - m && y < c.y1 + m) return true;
    }
    return false;
  };
  T.zoneAt = function (L, x, z) {
    for (var i = 0; i < L.rooms.length; i++) { var r = L.rooms[i]; if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return i; }
    return -1;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = NS;
})(typeof window !== 'undefined' ? window : globalThis);
