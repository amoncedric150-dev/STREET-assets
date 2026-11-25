/* =====================================================================
   interiors/layout_apartment.js  —  PLAN de l'appartement moderne (données pures)
   Repère local (mètres) : x vers l'est, z vers le sud, origine = coin nord-ouest.
   Un meuble regarde vers +Z quand rot = 0 ; rot = π/2 → regarde vers +X ;
   rot = π → regarde vers -Z ; rot = -π/2 → regarde vers -X.
   Pour une autre disposition : copie ce fichier, change l'id, enregistre-le
   dans INTERIORS.layouts.<ton_id> — le moteur ne change pas.
   ===================================================================== */
(function (root) {
  'use strict';
  var NS = root.INTERIORS = root.INTERIORS || {};
  NS.layouts = NS.layouts || {};
  var PI = Math.PI;

  NS.layouts.apartment = {
    id: 'apartment',
    name: 'Appartement moderne',
    ceiling: 2.6,
    wallT: 0.12,
    size: { w: 10, d: 10 },
    spawn: { x: 8.5, z: 9.1, face: PI },   // arrivée : juste derrière la porte d'entrée, regard vers le nord
    exitDoor: 'entree',                    // id de la porte d'entrée / sortie

    // Pièces (rectangles mesurés entre les axes des murs)
    // walls = peinture de la pièce (clé de matériau) ; lining = revêtements (carrelage, crédence…)
    rooms: [
      { id: 'salon',   name: 'Salon',          x0: 0,   z0: 0,   x1: 6,  z1: 5,   floor: 'parquet',     wall: 'paintWarm' },
      { id: 'cuisine', name: 'Cuisine',        x0: 6,   z0: 0,   x1: 10, z1: 5,   floor: 'tileKitchen', wall: 'paintLight',
        lining: [{ mat: 'tileSplash', y0: 0.9, y1: 1.45, sides: ['N', 'E'] }] },
      { id: 'couloir', name: 'Couloir',        x0: 0,   z0: 5,   x1: 10, z1: 6.4, floor: 'parquet',     wall: 'paintLight' },
      { id: 'chambre', name: 'Chambre',        x0: 0,   z0: 6.4, x1: 4.8, z1: 10, floor: 'parquet',     wall: 'paintBlue' },
      { id: 'sdb',     name: 'Salle de bain',  x0: 4.8, z0: 6.4, x1: 7,  z1: 10,  floor: 'tileBath',    wall: 'paintLight',
        lining: [{ mat: 'tileWall', y0: 0, y1: 1.3 }] },
      { id: 'entree',  name: 'Entrée',         x0: 7,   z0: 6.4, x1: 10, z1: 10,  floor: 'tileKitchen', wall: 'paintLight' }
    ],

    // Murs : axis 'x' = le mur court le long de x (à z = at) ; axis 'z' = le long de z (à x = at)
    // Ouvertures : door (porte battante) · pass (passage libre) · window
    // swing = côté d'ouverture (+1 vers z+ / x+, -1 vers z- / x-) ; hinge = charnière côté 'min' ou 'max'
    walls: [
      // --- façade nord (fenêtres du salon et de la cuisine)
      { axis: 'x', at: 0, from: 0, to: 10, openings: [
        { type: 'window', c: 1.5, w: 1.5, sill: 0.85, h: 1.35 },
        { type: 'window', c: 4.5, w: 1.5, sill: 0.85, h: 1.35 },
        { type: 'window', c: 8.0, w: 1.2, sill: 1.10, h: 1.00 } ] },
      // --- façade sud (fenêtre chambre, fenêtre dépolie salle de bain, PORTE D'ENTRÉE)
      { axis: 'x', at: 10, from: 0, to: 10, openings: [
        { type: 'window', c: 2.4, w: 1.4, sill: 0.85, h: 1.35 },
        { type: 'window', c: 5.9, w: 0.6, sill: 1.50, h: 0.50, frosted: true },
        { type: 'door',   c: 8.5, w: 0.95, h: 2.1, hinge: 'min', swing: -1, id: 'entree', main: true } ] },
      { axis: 'z', at: 0,  from: 0, to: 10, openings: [] },   // façade ouest
      { axis: 'z', at: 10, from: 0, to: 10, openings: [] },   // façade est
      // --- cloison salon / cuisine  ←→ couloir
      { axis: 'x', at: 5, from: 0, to: 10, openings: [
        { type: 'door', c: 3.0, w: 0.9, hinge: 'min', swing: -1, id: 'porte_salon' },
        { type: 'door', c: 8.0, w: 0.9, hinge: 'max', swing: -1, id: 'porte_cuisine' } ] },
      // --- cloison couloir ←→ chambre / salle de bain
      { axis: 'x', at: 6.4, from: 0, to: 7, openings: [
        { type: 'door', c: 3.6, w: 0.85, hinge: 'min', swing: 1, id: 'porte_chambre' },
        { type: 'door', c: 5.9, w: 0.80, hinge: 'min', swing: 1, id: 'porte_sdb' } ] },
      // --- salon ←→ cuisine : grand passage ouvert
      { axis: 'z', at: 6, from: 0, to: 5, openings: [ { type: 'pass', c: 2.2, w: 2.4, h: 2.2 } ] },
      // --- cloisons pleines de la chambre / salle de bain
      { axis: 'z', at: 4.8, from: 6.4, to: 10, openings: [] },
      { axis: 'z', at: 7,   from: 6.4, to: 10, openings: [] }
    ],

    // Meubles : kind (voir furniture.js), x/z = centre, y = hauteur de pose, rot, w/d/h = tailles optionnelles
    furniture: [
      // ----- SALON
      { kind: 'tvunit',      x: 0.30, z: 2.50, rot:  PI / 2 },
      { kind: 'sofa',        x: 4.45, z: 2.50, rot: -PI / 2 },
      { kind: 'coffeetable', x: 2.55, z: 2.50, rot:  PI / 2 },
      { kind: 'rug',         x: 2.70, z: 2.50, rot:  PI / 2, w: 2.8, d: 2.0, art: 'rugA' },
      { kind: 'armchair',    x: 1.30, z: 4.10, rot:  PI * 0.75 },
      { kind: 'sidetable',   x: 4.65, z: 4.05 },
      { kind: 'floorlamp',   x: 4.75, z: 0.90 },
      { kind: 'plant',       x: 0.40, z: 4.55 },
      { kind: 'plant',       x: 5.50, z: 0.45, h: 1.1 },
      { kind: 'bookshelf',   x: 3.00, z: 0.22, rot: 0 },
      { kind: 'picture',     x: 1.20, z: 4.935, y: 1.35, rot: PI, art: 'art1' },
      // ----- CUISINE (rangée nord, face au sud)
      { kind: 'counter',     x: 6.40, z: 0.36, rot: 0, w: 0.6 },
      { kind: 'stove',       x: 7.00, z: 0.36, rot: 0, w: 0.6 },
      { kind: 'sink',        x: 7.90, z: 0.36, rot: 0, w: 1.2 },
      { kind: 'counter',     x: 8.80, z: 0.36, rot: 0, w: 0.6 },
      { kind: 'fridge',      x: 9.55, z: 0.41, rot: 0 },
      { kind: 'hood',        x: 7.00, z: 0.30, y: 1.55, rot: 0 },
      { kind: 'wallcab',     x: 6.40, z: 0.23, y: 1.45, rot: 0, w: 0.6 },
      { kind: 'wallcab',     x: 8.80, z: 0.23, y: 1.45, rot: 0, w: 0.6 },
      // ----- CUISINE (rangée est, face à l'ouest)
      { kind: 'counter',     x: 9.64, z: 1.10, rot: -PI / 2, w: 0.6 },
      { kind: 'counter',     x: 9.64, z: 1.70, rot: -PI / 2, w: 0.6 },
      { kind: 'counter',     x: 9.64, z: 2.30, rot: -PI / 2, w: 0.6 },
      { kind: 'diningtable', x: 7.60, z: 3.00, rot: 0 },
      { kind: 'chair',       x: 7.20, z: 2.40, rot: 0 },
      { kind: 'chair',       x: 8.00, z: 2.40, rot: 0 },
      { kind: 'chair',       x: 7.20, z: 3.60, rot: PI },
      { kind: 'chair',       x: 8.00, z: 3.60, rot: PI },
      // ----- COULOIR
      { kind: 'console',     x: 1.00, z: 5.22, rot: 0 },
      { kind: 'picture',     x: 1.00, z: 5.075, y: 1.30, rot: 0, w: 0.6, d: 0.03, h: 0.45, art: 'art2' },
      // ----- CHAMBRE
      { kind: 'bed',         x: 1.11, z: 8.20, rot: PI / 2 },
      { kind: 'nightstand',  x: 0.30, z: 7.10, rot: PI / 2 },
      { kind: 'nightstand',  x: 0.30, z: 9.30, rot: PI / 2 },
      { kind: 'wardrobe',    x: 4.44, z: 8.20, rot: -PI / 2 },
      { kind: 'rug',         x: 2.60, z: 8.20, rot: PI / 2, w: 2.3, d: 1.7, art: 'rugB' },
      { kind: 'plant',       x: 4.35, z: 6.85 },
      // ----- SALLE DE BAIN
      { kind: 'bathtub',     x: 6.05, z: 9.565, rot: PI },
      { kind: 'toilet',      x: 6.64, z: 7.50, rot: -PI / 2 },
      { kind: 'vanity',      x: 5.14, z: 7.60, rot: PI / 2 },
      { kind: 'mirror',      x: 4.89, z: 7.60, y: 1.20, rot: PI / 2 },
      // ----- ENTRÉE
      { kind: 'shoecab',     x: 9.64, z: 8.20, rot: -PI / 2 },
      { kind: 'rug',         x: 8.50, z: 9.30, rot: 0, w: 1.0, d: 0.6, art: 'rugB' },
      { kind: 'picture',     x: 7.075, z: 8.30, y: 1.30, rot: PI / 2, w: 0.7, d: 0.03, h: 0.5, art: 'art1' }
    ]
  };
})(typeof window !== 'undefined' ? window : globalThis);
