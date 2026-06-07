/* ─────────────────────────────────────────────────────────
   L.A.N.A. — Service Worker
   Maneja push notifications cuando la app está cerrada
───────────────────────────────────────────────────────── */

const CACHE_NAME = 'lana-v1';

// ── Install & Activate ───────────────────────────────────
self.addEventListener('install', function(e){
  self.skipWaiting();
});

self.addEventListener('activate', function(e){
  e.waitUntil(clients.claim());
});

// ── Push event — muestra la notificación ─────────────────
self.addEventListener('push', function(e){
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch(err){}

  const title  = data.title  || '⏰ L.A.N.A.';
  const body   = data.body   || 'Tienes un recordatorio pendiente.';
  const tag    = data.tag    || 'lana-reminder';
  const url    = data.url    || '/';

  e.waitUntil(
    self.registration.showNotification(title, {
      body:              body,
      icon:              '/icon.svg',
      badge:             '/icon.svg',
      tag:               tag,
      renotify:          true,
      requireInteraction: true,
      vibrate:           [300, 100, 300, 100, 300],
      data:              { url: url }
    })
  );
});

// ── Notification click — abre/enfoca la app ──────────────
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || '/';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list){
      // Si ya hay una pestaña abierta, la enfoca
      for (let i = 0; i < list.length; i++){
        if (list[i].url.startsWith(self.location.origin)){
          return list[i].focus();
        }
      }
      // Si no, abre una nueva
      return clients.openWindow(target);
    })
  );
});
