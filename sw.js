'use strict';
/* 煎心鍋貼 PWA Service Worker
 * - 核心檔案安裝時預先快取；頁面「網路優先」，離線退回快取或離線頁
 * - 圖片／字型／CDN 於成功請求後快取（stale-while-revalidate）
 * - 新版本不會自動接管：頁面顯示「更新」列，使用者按下後才切換，避免打斷填單
 * 發新版時請把 VERSION 加 1。
 */
const PREFIX = 'jianxin-' + encodeURIComponent(self.registration.scope) + '-';
const VERSION = 'v2';
const CORE = PREFIX + VERSION + '-core';
const RUNTIME = PREFIX + VERSION + '-runtime';
const scoped = p => new URL(p, self.registration.scope).href;
const SHELL = scoped('index.html');
const OFFLINE = scoped('offline.html');
const ASSETS = ['index.html', 'offline.html', 'manifest.webmanifest', 'images/hero-poster.webp',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'].map(scoped);
const CDN_HOSTS = ['images.unsplash.com', 'cdn.tailwindcss.com', 'unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  // 核心檔案全部成功才算安裝完成，避免留下不完整的離線版本
  e.waitUntil(caches.open(CORE).then(c => c.addAll(ASSETS)));
});
self.addEventListener('message', e => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CORE && k !== RUNTIME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function saveRuntime(req, res) {
  const cache = await caches.open(RUNTIME);
  await cache.put(req, res);
  const keys = await cache.keys();                       // 限制數量，避免佔用過多空間
  await Promise.all(keys.slice(0, Math.max(0, keys.length - 50)).map(k => cache.delete(k)));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                      // 訂單 POST（Apps Script）一律直連網路
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;

  if (req.mode === 'navigate' && same && url.href.startsWith(self.registration.scope)) {
    e.respondWith((async () => {
      const core = await caches.open(CORE);
      try {
        const res = await fetch(req);
        if (res.ok && (url.pathname === new URL(self.registration.scope).pathname || url.pathname === new URL(SHELL).pathname)) core.put(SHELL, res.clone());
        return res;
      } catch {
        const isHome = url.pathname === new URL(self.registration.scope).pathname || url.pathname === new URL(SHELL).pathname;
        return (isHome && (await core.match(SHELL))) || (await core.match(OFFLINE)) || Response.error();
      }
    })());
    return;
  }

  if (!same && !CDN_HOSTS.includes(url.hostname)) return;
  e.respondWith((async () => {
    const core = await caches.open(CORE), runtime = await caches.open(RUNTIME);
    const cached = (await core.match(req)) || (await runtime.match(req));
    const net = fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') e.waitUntil(saveRuntime(req, res.clone()).catch(() => {}));
      return res;
    }).catch(() => null);
    if (cached) { e.waitUntil(net); return cached; }
    return (await net) || Response.error();
  })());
});
