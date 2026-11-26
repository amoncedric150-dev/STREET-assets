/* ============================================================================
   sw.js — cache persistant des ressources lourdes (Service Worker + Cache API)
   À placer À CÔTÉ de index.html (même dossier, même domaine, en HTTPS).

   Principe : cache-first, uniquement pour les ressources listées dans cacheable().
   - en cache      -> servi tout de suite (pas de téléchargement)
   - pas en cache  -> téléchargé normalement ; une copie est rangée en arrière-plan
   - le cache plante (quota Safari, stockage vidé, etc.) -> on retombe sur le réseau
   - le réseau échoue -> l'erreur est transmise telle quelle à la page, donc ton
     système de secours (tryLoad : R2 puis Models/…) continue de fonctionner

   Si tu REMPLACES un fichier (même URL) sur R2 : change CACHE_VERSION ci-dessous
   (v1 -> v2) pour forcer le re-téléchargement chez tout le monde.
   ============================================================================ */
'use strict';

const CACHE_VERSION = 'v1';
const PREFIX = 'ny-cache-';
const CACHE = PREFIX + CACHE_VERSION;

// Garde-fou : un fichier annoncé plus gros que ça n'est pas rangé (il est quand même chargé normalement)
const MAX_ITEM_BYTES = 500 * 1024 * 1024;

// Délai maximum pendant lequel une 2e demande identique attend la 1re avant de se débrouiller seule
const DUP_WAIT_MS = 60000;

// Fichiers du même domaine que ton jeu qui peuvent être mis en cache (jamais .html / .js / .css : le code reste toujours frais)
const SAME_ORIGIN_EXT = /\.(glb|gltf|bin|png|jpe?g|webp|gif|avif|ktx2|basis|hdr|exr|wasm)$/i;

function cacheable(url) {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  const h = url.hostname;
  // Ton propre domaine (ex. Models/new_york_city.glb de secours)
  if (url.origin === self.location.origin) return SAME_ORIGIN_EXT.test(url.pathname);
  // Tes modèles sur Cloudflare R2 (ville, lampadaires, poubelles, bouches d'eau…) : tous les fichiers
  if (/\.r2\.dev$/i.test(h)) return true;
  // three.js & loaders : seulement les versions figées (three@0.147.0), donc jamais périmées
  if (h === 'cdn.jsdelivr.net') return /@\d+\.\d+\.\d+\//.test(url.pathname);
  // Décodeur Draco (version figée 1.5.5)
  if (h === 'www.gstatic.com') return url.pathname.indexOf('/draco/') === 0;
  return false;
}

// On ne range que les réponses complètes et lisibles (pas les 206 partielles, pas les erreurs, pas les "opaques")
function shouldStore(r) {
  if (!r || r.status !== 200) return false;
  if (r.type !== 'basic' && r.type !== 'cors') return false;
  const len = parseInt(r.headers.get('content-length') || '0', 10);
  if (len > MAX_ITEM_BYTES) return false;
  return true;
}

// URL -> promesse « le rangement de cette URL est terminé (ou abandonné) » : évite les téléchargements en double
const pending = new Map();

async function handle(event, req) {
  const key = req.url;

  // Doublon : si cette URL est déjà en cours de traitement, on le sait tout de suite (test synchrone, avant tout await)
  const earlier = pending.get(key);
  const mine = !earlier;
  let done;
  const gate = new Promise(function (r) { done = r; });
  if (mine) pending.set(key, gate);
  const release = function () {
    if (!mine) return;
    if (pending.get(key) === gate) pending.delete(key);
    done();
  };

  // 1) Déjà en cache ? -> on le sert. Toute erreur de cache est ignorée (on continue vers le réseau).
  let cache = null;
  try {
    cache = await caches.open(CACHE);
    if (earlier) {
      // la même URL est en train d'être téléchargée : on attend qu'elle soit rangée plutôt que de la télécharger 2 fois
      await Promise.race([earlier, new Promise(function (r) { setTimeout(r, DUP_WAIT_MS); })]);
    }
    const hit = await cache.match(key, { ignoreVary: true });
    if (hit) { release(); return hit; }
  } catch (e) {
    cache = null;
  }

  // Cache indisponible, ou doublon qui n'a rien pu ranger : téléchargement direct, sans rien ranger
  if (!cache || earlier) {
    release();
    return fetch(req);
  }

  // 2) Pas en cache : téléchargement normal (la page reçoit la réponse d'origine, sans délai)
  let resp;
  try {
    resp = await fetch(req);
  } catch (err) {
    release();
    throw err; // l'erreur réseau remonte à la page -> ton plan B (tryLoad) se déclenche comme avant
  }

  // 3) Copie rangée en arrière-plan ; un échec (quota plein, etc.) est sans conséquence pour le jeu
  try {
    if (shouldStore(resp)) {
      const copy = resp.clone();
      event.waitUntil(
        cache.put(key, copy)
          .catch(function (e) { console.warn('[sw] cache.put impossible :', e && e.name); })
          .then(release)
      );
    } else {
      release();
    }
  } catch (e) {
    release();
  }
  return resp;
}

self.addEventListener('install', function () {
  self.skipWaiting(); // rien à pré-télécharger : on ne crée aucun doublon
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    try {
      const keys = await caches.keys();
      await Promise.all(keys
        .filter(function (k) { return k.indexOf(PREFIX) === 0 && k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    } catch (e) { /* sans importance */ }
    try { await self.clients.claim(); } catch (e) { /* sans importance */ }
  })());
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;                              // jamais d'écriture
  if (req.headers.has('range')) return;                          // requêtes partielles : laissées au navigateur
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (!cacheable(url)) return;                                   // tout le reste (page, JS, etc.) : comportement normal
  event.respondWith(handle(event, req));
});
