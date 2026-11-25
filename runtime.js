/* =====================================================================
   interiors/runtime.js  —  branche le système d'intérieurs sur TON jeu
   Il ne crée AUCUN second système de déplacement :
     - le joueur reste l'objet P et son joystick (boucle principale)
     - index.html lui délègue seulement : canStand(), groundAt(), la
       collision de la caméra et la vitesse tant que INT.active est vrai
   L'intérieur est construit loin au-dessus de la ville (y = CONFIG.originY),
   la ville est masquée pendant la visite, puis tout est rétabli à la sortie.
   API publique : INTERIORS.api.enter(plan, {style}) · .exit() · .addCityDoor({...})
   ===================================================================== */
(function (root) {
  'use strict';
  var NS = root.INTERIORS = root.INTERIORS || {};
  var T = NS.tools, CFG = NS.CONFIG, G = T.geom, m4 = T.m4;
  var api = NS.api = { active: false, k: 1, floorY: 0, cols: [] };

  var X = null, THREE = null, cur = null, busy = false, autoDone = false;
  var prevScale = 1, prevFov = 62, built = {}, matsByStyle = {}, glbCache = {}, cityDoors = [], slots = [], ambient = null, ui = {}, lastZone = -2, titleT = 0, prevView = null;
  var SLOTS = 4;

  function el(tag, css, txt) { var e = document.createElement(tag); e.style.cssText = css; if (txt) e.textContent = txt; return e; }

  /* ---------------------------------------------------------------- interface */
  function buildUI() {
    ui.veil = el('div', 'position:fixed;left:0;top:0;right:0;bottom:0;background:#000;opacity:0;transition:opacity .28s;pointer-events:none;z-index:30');
    ui.act = el('button', 'position:fixed;right:16px;bottom:calc(52px + env(safe-area-inset-bottom));z-index:12;display:none;padding:14px 20px;font-size:16px;font-weight:700;background:rgba(10,40,70,.85);border:2px solid #35e0ff;color:#fff;border-radius:16px;box-shadow:0 0 14px #35e0ff88');
    ui.title = el('div', 'position:fixed;left:50%;top:calc(14px + env(safe-area-inset-top));transform:translateX(-50%);z-index:12;padding:6px 16px;background:#000b;color:#fff;font:600 14px system-ui,sans-serif;border-radius:14px;opacity:0;transition:opacity .5s;pointer-events:none;white-space:nowrap');
    document.body.appendChild(ui.veil); document.body.appendChild(ui.act); document.body.appendChild(ui.title);
    ui.act.addEventListener('click', function () {
      if (busy) return;
      if (api.active) { api.exit(); return; }
      if (ui.target) api.enter(ui.target.layout, { style: ui.target.style, ret: ui.target.ret, retFace: ui.target.face });
    });
    if (CFG.debugButton) {
      var top = document.getElementById('top');
      if (top) {
        var b = document.createElement('button'); b.textContent = '🏠 Appart.';
        b.addEventListener('click', function () { if (api.active) api.exit(); else api.enter('apartment', {}); });
        top.appendChild(b);
      }
    }
    // pendant la visite, les boutons « Départ / Échelle » de la ville ne doivent pas téléporter le joueur
    ['bs', 'bm', 'bp'].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) e.addEventListener('click', function (ev) { if (api.active) { ev.stopImmediatePropagation(); ev.preventDefault(); } }, true);
    });
  }
  function setAct(txt) { if (ui.act.textContent !== txt) ui.act.textContent = txt; ui.act.style.display = 'block'; }
  function hideAct() { ui.act.style.display = 'none'; }
  function showTitle(txt) { ui.title.textContent = txt; ui.title.style.opacity = 1; titleT = 2.2; }
  function fade(to, cb, ms) { ui.veil.style.opacity = to; if (cb) setTimeout(cb, ms || 300); }

  /* ------------------------------------------------------- portes de la ville */
  function makeMarker() {
    var g = new THREE.Group(), mf = new THREE.MeshBasicMaterial({ color: 0x35e0ff });
    var pl = new THREE.MeshBasicMaterial({ color: 0x35e0ff, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
    function box(w, h, d, x, y) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mf); m.position.set(x, y, 0); g.add(m); }
    box(0.1, 2.3, 0.1, -0.6, 1.15); box(0.1, 2.3, 0.1, 0.6, 1.15); box(1.3, 0.1, 0.1, 0, 2.3);
    var p = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.2), pl); p.position.y = 1.1; g.add(p);
    g.userData.panel = pl; return g;
  }
  // Une « porte d'entrée » dans la ville. Appelle-la pour chaque immeuble :
  //   INTERIORS.api.addCityDoor({ x, z, face, layout:'apartment', style:'warm', label:'Immeuble A', ret:{x,z} })
  api.addCityDoor = function (o) {
    var d = { x: o.x, z: o.z, face: o.face || 0, layout: o.layout || 'apartment', style: o.style || CFG.style || 'modern',
              label: o.label || 'Appartement', ret: o.ret || { x: o.x, z: o.z + 1.8 } };
    d.mesh = makeMarker(); d.mesh.position.set(d.x, X.groundAtCity(d.x, d.z), d.z); d.mesh.rotation.y = d.face;
    X.scene.add(d.mesh); cityDoors.push(d); return d;
  };
  function autoPlaceDoorFacade() {      // cherche un mur d'immeuble droit, avec de la place devant
    var P = X.P, S = X.canStandCity, radii = [4, 6, 8, 11, 15, 20, 26], i, k, j, t;
    for (i = 0; i < radii.length; i++) for (k = 0; k < 24; k++) {
      var a = k * Math.PI / 12, cx = P.x + Math.sin(a) * radii[i], cz = P.z + Math.cos(a) * radii[i];
      if (!S(cx, cz)) continue;
      for (j = 0; j < 16; j++) {
        var b = j * Math.PI / 8, dx = Math.sin(b), dz = Math.cos(b), lx = cx, lz = cz, hit = false;
        for (t = 0.25; t <= 3; t += 0.25) { var nx = cx + dx * t, nz = cz + dz * t; if (!S(nx, nz)) { hit = true; break; } lx = nx; lz = nz; }
        if (!hit) continue;
        var ux = -dx, uz = -dz, rx = -uz, rz = ux, px = lx + ux * 0.2, pz = lz + uz * 0.2, ok = true, s;
        if (X.topAt) {                                   // le mur doit être un vrai bâtiment (pas un arbre ou une barrière)
          var tall = false, q;
          for (q = 0.2; q <= 0.9; q += 0.35) if (X.topAt(lx + dx * q, lz + dz * q) > X.groundAtCity(lx, lz) + 3) tall = true;
          if (!tall) continue;
        }
        for (s = -1.2; s <= 1.2 && ok; s += 1.2) {         // mur droit sur ~2,4 m, et place devant
          var qx = px + rx * s, qz = pz + rz * s;
          if (!S(qx, qz) || S(qx + dx * 1.0, qz + dz * 1.0) || !S(qx + ux * 0.9, qz + uz * 0.9)) ok = false;
        }
        if (!ok || !S(px + ux * 1.8, pz + uz * 1.8)) continue;
        api.addCityDoor({ x: px, z: pz, face: Math.atan2(ux, uz), layout: 'apartment', label: 'Appartement', ret: { x: px + ux * 1.8, z: pz + uz * 1.8 } });
        showTitle('🏠 Porte de l\u2019appartement (cyan) à ~' + Math.round(radii[i]) + ' m');
        return true;
      }
    }
    return false;
  }
  function autoPlaceDoor() { if (!autoPlaceDoorFacade()) autoPlaceDoorRoad(); }
  function autoPlaceDoorRoad() {
    var P = X.P, radii = [7, 9, 5, 11, 13], i, k;
    for (i = 0; i < radii.length; i++) for (k = 0; k < 12; k++) {
      var a = k * Math.PI / 6, x = P.x + Math.sin(a) * radii[i], z = P.z + Math.cos(a) * radii[i];
      var dx = P.x - x, dz = P.z - z, l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l, rx = -uz, rz = ux, S = X.canStandCity;
      if (S(x, z) && S(x + rx * 1.2, z + rz * 1.2) && S(x - rx * 1.2, z - rz * 1.2) && S(x + ux * 1.8, z + uz * 1.8) && S(x - ux * 1.2, z - uz * 1.2)) {
        api.addCityDoor({ x: x, z: z, face: Math.atan2(ux, uz), layout: 'apartment', label: 'Appartement', ret: { x: x + ux * 1.8, z: z + uz * 1.8 } });
        showTitle('🏠 Porte de l\u2019appartement (cyan) à ~' + radii[i] + ' m');
        return;
      }
    }
  }

  /* ------------------------------------------------------------ construction */
  function loadGLB(file) {
    if (glbCache[file]) return glbCache[file];
    return (glbCache[file] = new Promise(function (res) {
      X.loader.load((/^https?:/.test(CFG.modelsPath) ? '' : (X.base || '')) + CFG.modelsPath + file, function (g) { res(g.scene); }, undefined, function () { res(null); });
    }));
  }
  function fitGLB(src, D, kind) {
    var o = src.clone(true), bb = new THREE.Box3().setFromObject(o), sz = bb.getSize(new THREE.Vector3());
    var s = Math.min(D.w / (sz.x || 1), D.d / (sz.z || 1), D.h / (sz.y || 1)); o.scale.multiplyScalar(s);
    bb.setFromObject(o); var c = bb.getCenter(new THREE.Vector3()); o.position.sub(new THREE.Vector3(c.x, bb.min.y, c.z));
    var w = new THREE.Group(); w.add(o); w.rotation.y = NS.GLB_ROT[kind] || 0;
    o.traverse(function (n) { if (n.isMesh) { n.castShadow = n.receiveShadow = true; [].concat(n.material).forEach(function (mt) { if (mt && mt.isMeshStandardMaterial) mt.envMapIntensity = CFG.envIntensity; }); } });
    return w;
  }
  function abox(b, mat, axis, at, a, y0, aw, h, dep) {   // boîte posée sur un mur : a = centre le long du mur, aw = longueur, dep = épaisseur
    var w = axis === 'x' ? aw : dep, d = axis === 'x' ? dep : aw;
    b.add(G.box(w, h, d), mat, m4.t(axis === 'x' ? a : at, y0 + h / 2, axis === 'x' ? at : a));
  }
  function wallQuad(b, mat, axis, at, side, a0, a1, y0, y1, t, off) {
    var pc = at + side * (t / 2 + off), P, UV = [[a0, y0], [a1, y0], [a1, y1], [a0, y1]], n = axis === 'x' ? [0, 0, side] : [side, 0, 0];
    P = axis === 'x' ? [[a0, y0, pc], [a1, y0, pc], [a1, y1, pc], [a0, y1, pc]] : [[pc, y0, a0], [pc, y0, a1], [pc, y1, a1], [pc, y1, a0]];
    var e1 = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], e2 = [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]];
    var c = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (c[0] * n[0] + c[1] * n[1] + c[2] * n[2] < 0) { P = [P[0], P[3], P[2], P[1]]; UV = [UV[0], UV[3], UV[2], UV[1]]; }
    b.quad(mat, P[0], P[1], P[2], P[3], n, UV);
  }
  function addLinings(L, b, m) {
    var H = L.ceiling, t = L.wallT, off = 0.004;
    L.walls.forEach(function (w) {
      var ww = {}, k; for (k in w) ww[k] = w[k]; ww.t = t;
      T.splitWall(ww, H).geo.forEach(function (g) {
        var mid = (g.a0 + g.a1) / 2;
        [-1, 1].forEach(function (side) {
          var px = w.axis === 'x' ? mid : w.at + side * (t / 2 + 0.2), pz = w.axis === 'x' ? w.at + side * (t / 2 + 0.2) : mid;
          var ri = T.zoneAt(L, px, pz); if (ri < 0) return;
          var r = L.rooms[ri], lo = w.axis === 'x' ? r.x0 : r.z0, hi = w.axis === 'x' ? r.x1 : r.z1;
          var a0 = Math.max(g.a0, lo), a1 = Math.min(g.a1, hi); if (a1 - a0 < 0.01) return;
          var lab = w.axis === 'x' ? (side < 0 ? 'S' : 'N') : (side < 0 ? 'E' : 'W'), lin = r.lining || [], tiled = false;
          wallQuad(b, m[r.wall], w.axis, w.at, side, a0, a1, g.y0, g.y1, t, off);
          lin.forEach(function (ln) {
            if (ln.sides && ln.sides.indexOf(lab) < 0) return;
            var y0 = Math.max(g.y0, ln.y0), y1 = Math.min(g.y1, ln.y1); if (y1 - y0 < 0.01) return;
            wallQuad(b, m[ln.mat], w.axis, w.at, side, a0, a1, y0, y1, t, off * 2); if (ln.y0 === 0) tiled = true;
          });
          if (g.y0 === 0 && g.y1 > 0.5 && !tiled) abox(b, m.trim, w.axis, w.at + side * (t / 2 + off + 0.008), (a0 + a1) / 2, 0, a1 - a0, 0.09, 0.016);   // plinthe
        });
      });
    });
  }
  function casing(b, m, o, t) {
    var j = 0.06, dep = t + 0.03;
    abox(b, m.trim, o.axis, o.at, o.c - o.w / 2 - j / 2, 0, j, o.h, dep);
    abox(b, m.trim, o.axis, o.at, o.c + o.w / 2 + j / 2, 0, j, o.h, dep);
    abox(b, m.trim, o.axis, o.at, o.c, o.h, o.w + 2 * j, j, dep);
  }
  function windowParts(b, bg, m, w, t) {
    var fb = 0.05, dep = 0.08, y0 = w.sill, h = w.h, c = w.c, W = w.w;
    abox(b, m.frame, w.axis, w.at, c - W / 2 + fb / 2, y0, fb, h, dep);
    abox(b, m.frame, w.axis, w.at, c + W / 2 - fb / 2, y0, fb, h, dep);
    abox(b, m.frame, w.axis, w.at, c, y0 + h - fb, W, fb, dep);
    abox(b, m.frame, w.axis, w.at, c, y0, W, fb, dep);
    if (W > 1.0) abox(b, m.frame, w.axis, w.at, c, y0, 0.035, h, dep);
    abox(b, m.trim, w.axis, w.at, c, y0 - 0.03, W + 0.1, 0.03, t + 0.1);                                      // rebord
    var a0 = c - W / 2 + fb, a1 = c + W / 2 - fb, g0 = y0 + fb, g1 = y0 + h - fb, mat = w.frosted ? m.glassFrost : m.glass;
    if (w.axis === 'x') bg.quad(mat, [a0, g0, w.at], [a1, g0, w.at], [a1, g1, w.at], [a0, g1, w.at], [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    else bg.quad(mat, [w.at, g0, a0], [w.at, g0, a1], [w.at, g1, a1], [w.at, g1, a0], [1, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
  }
  function makeDoor(d, m) {
    var rootG = new THREE.Group(), pivot = new THREE.Group(), min = d.hinge !== 'max', sgn = min ? 1 : -1, hingeA = min ? d.c - d.w / 2 : d.c + d.w / 2;
    rootG.position.set(d.axis === 'x' ? hingeA : d.at, 0, d.axis === 'x' ? d.at : hingeA); rootG.rotation.y = d.axis === 'x' ? 0 : -Math.PI / 2; rootG.add(pivot);
    var lw = d.w - 0.02, lh = d.h - 0.015, leaf = new THREE.Mesh(new THREE.BoxGeometry(lw, lh, 0.04), d.main ? m.doorMain : m.doorWood);
    leaf.position.set(sgn * (lw / 2 + 0.005), lh / 2 + 0.01, 0); leaf.castShadow = leaf.receiveShadow = true; pivot.add(leaf);
    [-1, 1].forEach(function (s) { var h = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 0.03), m.chrome); h.position.set(sgn * (lw - 0.1), 1.0, s * 0.05); pivot.add(h); });
    return { root: rootG, pivot: pivot, sgn: (min ? -1 : 1) * (d.axis === 'x' ? (d.swing || 1) : -(d.swing || 1)) };
  }

  function assemble(L, style, glb) {
    var mk = matsByStyle[style] || (matsByStyle[style] = NS.makeMaterials(THREE, style)), m = mk.m;
    if (CFG.realTextures && !mk.real) { mk.real = true; NS.loadRealTextures(THREE, m); }
    var plan = NS.planCollision(L), C = plan.C, b = new T.Batch(), bg = new T.Batch(), H = L.ceiling, t = L.wallT;
    var ox = CFG.originX, oy = CFG.originY, oz = CFG.originZ, group = new THREE.Group(), lamps = [];

    L.rooms.forEach(function (r) {
      b.floor(m[r.floor], r.x0, r.z0, r.x1, r.z1, 0); b.ceil(m.ceil, r.x0, r.z0, r.x1, r.z1, H);
      var cx = r.lamp ? r.lamp.x : (r.x0 + r.x1) / 2, cz = r.lamp ? r.lamp.z : (r.z0 + r.z1) / 2;
      b.add(G.cyl(0.2, 0.2, 0.035, 16), m.lampGlow, m4.t(cx, H - 0.0175, cz)); lamps.push({ x: cx, z: cz });
    });
    C.geo.forEach(function (r) { b.add(G.box(r.x1 - r.x0, r.y1 - r.y0, r.z1 - r.z0), m.wall, m4.t((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, (r.z0 + r.z1) / 2)); });
    addLinings(L, b, m);
    C.doors.forEach(function (d) {
      casing(b, m, d, t);
      var w = d.axis === 'x' ? { x0: d.c - d.w / 2, x1: d.c + d.w / 2, z0: d.at - t / 2, z1: d.at + t / 2 } : { x0: d.at - t / 2, x1: d.at + t / 2, z0: d.c - d.w / 2, z1: d.c + d.w / 2 };
      b.floor(m.woodDark, w.x0, w.z0, w.x1, w.z1, 0.004);                                                      // seuil
    });
    C.passes.forEach(function (d) { casing(b, m, d, t); });
    C.wins.forEach(function (w) { windowParts(b, bg, m, w, t); });
    L.furniture.forEach(function (f) {
      var def = NS.furniture[f.kind]; if (!def) { console.warn('[INTERIORS] meuble inconnu :', f.kind); return; }
      var D = NS.dimsOf(f);
      if (glb[f.kind]) { var g = fitGLB(glb[f.kind], D, f.kind); g.position.set(f.x, f.y || 0, f.z); g.rotation.y += (f.rot || 0); group.add(g); return; }
      def.build(b, m4.mul(m4.t(f.x, f.y || 0, f.z), m4.ry(f.rot || 0)), m, D, f);
    });
    b.toMeshes(THREE, group); bg.toMeshes(THREE, group);

    // portes battantes
    var doors = [], main = null;
    plan.doors.forEach(function (pd) {
      var d = pd.def, dr = makeDoor(d, m); group.add(dr.root);
      var rec = { o: d, pivot: dr.pivot, sgn: dr.sgn, col: pd.col, t: 0, open: false, wx: d.cx + ox, wz: d.cz + oz, dist: 99 };
      doors.push(rec); if (d.main || d.id === L.exitDoor) main = rec;
    });
    // collisions en coordonnées MONDE (le joueur vit dans le repère du jeu)
    plan.cols.forEach(function (c) { c.x0 += ox; c.x1 += ox; c.z0 += oz; c.z1 += oz; c.y0 += oy; c.y1 += oy; });
    group.position.set(ox, oy, oz); group.visible = false; X.scene.add(group);

    var inst = { L: L, style: style, group: group, cols: plan.cols, doors: doors, main: main, lamps: lamps, ox: ox, oy: oy, oz: oz };
    if (X.applyShadows) X.applyShadows();
    return inst;
  }
  function getInterior(layoutId, style) {
    var key = layoutId + '|' + style;
    if (built[key]) return built[key];
    var L = NS.layouts[layoutId];
    if (!L) return Promise.reject(new Error('Plan inconnu : ' + layoutId));
    var kinds = {}; L.furniture.forEach(function (f) { if (NS.GLB_MAP[f.kind]) kinds[f.kind] = NS.GLB_MAP[f.kind]; });
    return (built[key] = Promise.all(Object.keys(kinds).map(function (k) { return loadGLB(kinds[k]).then(function (o) { return [k, o]; }); })).then(function (res) {
      var glb = {}; res.forEach(function (r) { if (r[1]) glb[r[0]] = r[1]; else console.warn('[INTERIORS] GLB introuvable, meuble procédural gardé :', r[0]); });
      return assemble(L, style, glb);
    }).catch(function (e) { delete built[key]; throw e; }));
  }

  /* ---------------------------------------------------------- entrer / sortir */
  function setCity(vis) {
    var w = X.getWrap(), show = vis || CFG.seeCity;
    if (w) w.visible = show;
    X.ground.visible = show; X.npcGroup.visible = vis; X.FX.position.y = show ? 0 : -6000;
    cityDoors.forEach(function (d) { d.mesh.visible = vis; });
  }
  api.enter = function (layoutId, opts) {
    if (busy || api.active || !X) return false;
    opts = opts || {}; layoutId = layoutId || 'apartment'; busy = true;
    var style = opts.style || CFG.style || 'modern', P = X.P;
    var ret = opts.ret || { x: P.x, z: P.z }, retFace = opts.retFace;
    fade(1, function () {
      placeOrigin(layoutId);
      getInterior(layoutId, style).then(function (inst) {
        cur = inst; inst.ret = ret; inst.retFace = retFace; prevView = X.getView();
        X.setView(0, CFG.camPitch, CFG.camDist);
        prevScale = P.m.scale.x; P.m.scale.setScalar(CFG.playerScale); prevFov = X.cam.fov; X.cam.fov = CFG.fov; X.cam.updateProjectionMatrix();
        var L = inst.L;
        P.x = inst.ox + L.spawn.x; P.z = inst.oz + L.spawn.z; P.y = inst.oy; P.face = L.spawn.face; P.spd = 0;
        api.cols = inst.cols; api.floorY = inst.oy; api.k = CFG.walkSpeedFactor; api.active = true;
        setCity(false); inst.group.visible = true; ambient.visible = true;
        slots.forEach(function (s) { s.light.visible = true; s.light.intensity = 0; s.k = 0; s.room = -1; s.target = -1; });
        inst.doors.forEach(function (d) { d.t = 0; d.open = false; d.pivot.rotation.y = 0; d.col.body = true; });
        lastZone = -2; hideAct();
        try { X.renderer.compile(X.scene, X.cam); } catch (e) { /* sans importance : compilé au 1er rendu */ }
        setTimeout(function () { fade(0); busy = false; }, 450);
      }).catch(function (e) { console.error('[INTERIORS]', e); busy = false; fade(0); if (X.msg) { X.msg.style.opacity = 1; X.msg.textContent = 'Intérieur impossible : ' + e.message; } });
    });
    return true;
  };
  function placeOrigin(layoutId) {       // pose l'appartement face aux immeubles : les fenêtres du nord donnent sur la ville
    var L0 = NS.layouts[layoutId], cs = CFG.seeCity && X.cityStats ? X.cityStats() : null;
    if (!cs || !L0) return;
    var cx = (cs.x0 + cs.x1) / 2, h = Math.min(CFG.viewHeightMax, Math.max(CFG.floorHeight, cs.meanH * CFG.viewHeightFactor));
    CFG.originX = cx - L0.size.w / 2; CFG.originZ = cs.z1 + CFG.edgeGap; CFG.originY = X.groundAtCity(cx, cs.z1) + h;
  }
  api.light = function (sun, hemi) { if (api.active) { sun.intensity *= CFG.sunIndoor; hemi.intensity *= CFG.hemiIndoor; } };
  api.exit = function () {
    if (busy || !api.active) return false;
    busy = true;
    fade(1, function () {
      var inst = cur, P = X.P, r = inst.ret || { x: P.x, z: P.z };
      api.active = false; api.k = 1;
      P.m.scale.setScalar(prevScale); X.cam.fov = prevFov; X.cam.updateProjectionMatrix();
      inst.group.visible = false; ambient.visible = false;
      slots.forEach(function (s) { s.light.visible = false; s.light.intensity = 0; });
      setCity(true);
      P.x = r.x; P.z = r.z; P.y = X.groundAtCity(P.x, P.z); P.spd = 0;
      if (inst.retFace != null) { P.face = inst.retFace; X.setView(inst.retFace + Math.PI, prevView ? prevView.pitch : 0.28, prevView ? prevView.dist : 5.5); }
      else if (prevView) X.setView(prevView.yaw, prevView.pitch, prevView.dist);
      cur = null; ui.title.style.opacity = 0;
      setTimeout(function () { fade(0); busy = false; }, 350);
    });
    return true;
  };

  /* ------------------------------------------------- appelés par le jeu (hooks) */
  api.canStand = function (x, z) { return !T.circleHits(api.cols, x, z, CFG.playerRadius); };
  api.camHit = function (x, y, z) {                       // la caméra est arrêtée par les murs, portes fermées, plafond et grands meubles
    var cols = api.cols, i, c, mg = CFG.camMargin;
    for (i = 0; i < cols.length; i++) {
      c = cols[i]; if (!c.cam || c.door) continue;                  // la caméra traverse les portes
      if (x > c.x0 - mg && x < c.x1 + mg && z > c.z0 - mg && z < c.z1 + mg && y > c.y0 - mg && y < c.y1 + mg) return true;
    }
    return false;
  };
  api.attach = function (c) {
    X = c; THREE = c.THREE; api.camMin = CFG.camMin;
    ambient = new THREE.AmbientLight(CFG.ambientColor, CFG.ambient); ambient.visible = false; X.scene.add(ambient);
    for (var i = 0; i < SLOTS; i++) {
      var l = new THREE.PointLight(0xffe2b8, 0, CFG.lightDistance, CFG.lightDecay); l.visible = false; X.scene.add(l);
      slots.push({ light: l, room: -1, target: -1, k: 0 });
    }
    buildUI();
  };

  function updateLights(dt, inst) {
    var rooms = inst.L.rooms, px = X.P.x - inst.ox, pz = X.P.z - inst.oz, order = [], i, s;
    for (i = 0; i < rooms.length; i++) {
      var r = rooms[i], dx = Math.max(r.x0 - px, 0, px - r.x1), dz = Math.max(r.z0 - pz, 0, pz - r.z1);
      order.push({ i: i, d: dx * dx + dz * dz });
    }
    order.sort(function (a, b) { return a.d - b.d; });
    var want = order.slice(0, SLOTS).map(function (o) { return o.i; });
    slots.forEach(function (sl) { if (want.indexOf(sl.target) < 0) sl.target = -2; });
    want.forEach(function (ri) {
      if (slots.some(function (sl) { return sl.target === ri; })) return;
      for (var q = 0; q < slots.length; q++) if (slots[q].target === -2) { slots[q].target = ri; return; }
    });
    for (i = 0; i < slots.length; i++) {
      s = slots[i];
      if (s.room !== s.target) {
        s.k -= dt * 5;
        if (s.k <= 0) { s.k = 0; s.room = s.target; if (s.room >= 0) { var lp = inst.lamps[s.room]; s.light.position.set(inst.ox + lp.x, inst.oy + inst.L.ceiling - 0.3, inst.oz + lp.z); } }
      } else if (s.room >= 0) s.k = Math.min(1, s.k + dt * 4);
      s.light.intensity = s.room >= 0 ? CFG.lightIntensity * s.k : 0;
    }
  }
  function updateInterior(dt, now) {
    var inst = cur; if (!inst) return;
    var P = X.P;
    inst.doors.forEach(function (d) {
      var dx = P.x - d.wx, dz = P.z - d.wz, dist = Math.sqrt(dx * dx + dz * dz);
      d.dist = dist;
      if (!d.o.main) { if (dist < CFG.doorOpenDist) d.open = true; else if (dist > CFG.doorCloseDist) d.open = false; }
      var tg = d.open ? 1 : 0; d.t += (tg - d.t) * Math.min(1, CFG.doorSpeed * dt); if (Math.abs(tg - d.t) < 0.003) d.t = tg;
      d.pivot.rotation.y = d.sgn * CFG.doorOpenAngle * d.t;
      d.col.body = d.t < 0.45;
    });
    updateLights(dt, inst);
    if (busy) return;
    if (inst.main && inst.main.dist < 1.8) setAct('🚪 Sortir'); else hideAct();
    var z = T.zoneAt(inst.L, P.x - inst.ox, P.z - inst.oz);
    if (z !== lastZone && z >= 0) { lastZone = z; showTitle(inst.L.rooms[z].name); }
    if (titleT > 0) { titleT -= dt; if (titleT <= 0) ui.title.style.opacity = 0; }
    var W = inst.L.size.w, D = inst.L.size.d;                                  // sécurité : joueur sorti de l'enveloppe
    if (P.x < inst.ox - 2 || P.x > inst.ox + W + 2 || P.z < inst.oz - 2 || P.z > inst.oz + D + 2) api.exit();
  }
  function updateCity(now) {
    var P = X.P, best = null, bd = 1e9, i;
    for (i = 0; i < cityDoors.length; i++) {
      var d = cityDoors[i], dist = Math.hypot(P.x - d.x, P.z - d.z);
      d.mesh.userData.panel.opacity = 0.22 + 0.12 * Math.sin(now * 3);
      if (dist < bd) { bd = dist; best = d; }
    }
    if (best && bd < 2.3 && !busy) { ui.target = best; setAct('🚪 Entrer · ' + best.label); } else { ui.target = null; hideAct(); }
  }
  api.frame = function (dt, now) {
    if (!X) return;
    if (!autoDone) {
      autoDone = true; autoPlaceDoor();
      if (CFG.autoEnterHash && String(location.hash).replace('#', '') === CFG.autoEnterHash) api.enter('apartment', {});
    }
    if (api.active) updateInterior(dt, now); else updateCity(now);
  };
})(typeof window !== 'undefined' ? window : globalThis);
