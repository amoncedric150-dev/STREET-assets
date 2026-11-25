/* =====================================================================
   interiors/models.js  —  remplace un meuble procédural par TON modèle GLB
   Dépose le fichier dans  Models/interiors/  (à côté de index.html) puis
   décommente / ajoute une ligne. Le modèle est automatiquement :
     - centré sur l'empreinte du meuble, posé au sol
     - mis à l'échelle pour entrer dans les dimensions du meuble (w × d × h)
   Convention : le DEVANT du modèle doit regarder vers +Z (sinon ajoute
   INTERIORS.GLB_ROT.sofa = Math.PI pour le retourner).
   Si le fichier est absent ou invalide, le meuble procédural est gardé.

   Noms (kind) disponibles : sofa, armchair, tvunit, coffeetable, sidetable,
   floorlamp, plant, bookshelf, fridge, stove, sink, counter, diningtable,
   chair, console, shoecab, bed, nightstand, wardrobe, bathtub, toilet, vanity
   ===================================================================== */
(function (root) {
  'use strict';
  var NS = root.INTERIORS = root.INTERIORS || {};
  NS.GLB_MAP = NS.GLB_MAP || {};
  NS.GLB_ROT = NS.GLB_ROT || {};

  // NS.GLB_MAP.sofa     = 'canape.glb';
  // NS.GLB_MAP.bed      = 'lit.glb';
  // NS.GLB_MAP.wardrobe = 'armoire.glb';
  // NS.GLB_MAP.tvunit   = 'meuble_tv.glb';
  // NS.GLB_MAP.fridge   = 'frigo.glb';
  // NS.GLB_MAP.toilet   = 'wc.glb';
  // NS.GLB_ROT.sofa     = Math.PI;       // si ton canapé regarde dans le mauvais sens
})(typeof window !== 'undefined' ? window : globalThis);
