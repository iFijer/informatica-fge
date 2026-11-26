/* ==========================================================================
   SERVICE WORKER 100% OFFLINE — REGISTRO INFORMÁTICA FORENSE FGE MORELOS
   Precachea todas las páginas, estilos, fuentes locales y librerías vendor
   ========================================================================== */

const CACHE_NAME = 'fge-informatica-offline-v3';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './dashboard.html',
    './admin.html',
    './manifest.webmanifest',
    './css/styles.css',
    './assets/fonts/rajdhani-latin-400-normal.woff2',
    './assets/fonts/rajdhani-latin-500-normal.woff2',
    './assets/fonts/rajdhani-latin-600-normal.woff2',
    './assets/fonts/rajdhani-latin-700-normal.woff2',
    './vendor/firebase-app-compat.js',
    './vendor/firebase-auth-compat.js',
    './vendor/firebase-firestore-compat.js',
    './vendor/chart.umd.min.js',
    './vendor/exceljs.min.js',
    './js/firebase-config.js',
    './js/seed-data.js',
    './js/ui-common.js',
    './js/db.js',
    './js/charts.js',
    './js/excel-export.js',
    './js/particles.js',
    './js/login.js',
    './js/dashboard.js',
    './js/admin.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    // No interceptar llamadas de API a Firebase / Googleapis (Firestore maneja su propia caché IndexedDB)
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        caches.match(req, { ignoreSearch: true }).then((cached) => {
            const fetchPromise = fetch(req)
                .then((networkRes) => {
                    if (networkRes && networkRes.status === 200) {
                        const clone = networkRes.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
                    }
                    return networkRes;
                })
                .catch(() => cached);
            return cached || fetchPromise;
        })
    );
});
