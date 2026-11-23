// Finti: notificaciones y copia básica para abrir sin conexión.
const CACHE = "fintelligente-v4";
self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/manifest.webmanifest", "/icon-192.png", "/fuentes/fuentes.css", "/fuentes/manrope.woff2", "/fuentes/unbounded.woff2", "/fuentes/jakarta.woff2"])).catch(() => {})); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/")) return;
  // Las letras no cambian: primero la copia guardada.
  if (u.pathname.startsWith("/fuentes/") || u.pathname.startsWith("/historia/")) { e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((x) => { if (x.ok) { const c = x.clone(); caches.open(CACHE).then((k) => k.put(e.request, c)); } return x; }))); return; }
  // Primero la red (siempre la versión más nueva); sin conexión, la copia guardada.
  // El script principal (/app.js?v=…) también se guarda, para abrir sin conexión; solo la última versión.
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok && (u.pathname === "/" || u.pathname === "/index.html")) { const c = r.clone(); caches.open(CACHE).then((x) => x.put("/", c)); }
    if (r.ok && u.pathname === "/app.js") { const c = r.clone(); caches.open(CACHE).then((x) => x.keys().then((ks) => Promise.all(ks.filter((k) => new URL(k.url).pathname === "/app.js" && k.url !== e.request.url).map((k) => x.delete(k)))).then(() => x.put(e.request, c))); }
    return r;
  })
    .catch(() => caches.match(u.pathname === "/index.html" ? "/" : e.request).then((r) => r || caches.match("/"))));
});
// Aviso de la mañana: el servidor no conoce ninguna cifra. Aquí, en el celular, se lee lo que la app dejó guardado
// (plan y gasto del día a día del mes) y se calcula cuánto se puede gastar hoy. Solo se muestra si la persona lo pidió.
function leerCupo() {
  return new Promise((res) => {
    let r; try { r = indexedDB.open("fintelligente-datos", 1); } catch { return res(null); }
    r.onupgradeneeded = () => { r.result.createObjectStore("estado"); };
    r.onerror = () => res(null);
    r.onsuccess = () => {
      try { const q = r.result.transaction("estado", "readonly").objectStore("estado").get("cupo"); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }
      catch { res(null); }
    };
  });
}
const pesos = (n) => "$ " + Math.round(n).toLocaleString("es-CO");
function cupoDeHoy(c, ahora = new Date()) {
  const k = ahora.getFullYear() + "-" + String(ahora.getMonth() + 1).padStart(2, "0");
  if (!c || c.mes !== k || !(c.P > 0)) return null;
  const quedan = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate() - ahora.getDate() + 1;
  const v = Math.max(0, (c.P - c.R) / quedan);
  return Math.floor(v / 1000) * 1000;
}
async function cuerpoManana(d) {
  const c = await leerCupo(), v = cupoDeHoy(c);
  if (v == null) return d;
  if (!c.cifra) return { ...d, title: "Tu día empieza", body: "Tu cupo de hoy está listo. Toca para verlo." };
  return { ...d, title: "Hoy puedes gastar " + pesos(v), body: v > 0 ? "Para el día a día. ¡Que tengas un buen día!" : "Lo del día a día ya se usó este mes. Toca y lo cuadramos juntos." };
}
// Preguntas pendientes: el servidor solo sabe que hay alguna; la pregunta se lee aquí, de lo que la app guardó en el celular.
function leerClave(k) {
  return new Promise((res) => {
    let r; try { r = indexedDB.open("fintelligente-datos", 1); } catch { return res(null); }
    r.onupgradeneeded = () => { r.result.createObjectStore("estado"); };
    r.onerror = () => res(null);
    r.onsuccess = () => {
      try { const q = r.result.transaction("estado", "readonly").objectStore("estado").get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }
      catch { res(null); }
    };
  });
}
async function cuerpoDudas(d) {
  const x = await leerClave("dudas");
  if (!x || !x.n || !x.txt) return d;
  return { ...d, title: x.n === 1 ? "Me quedó una duda" : "Me quedaron " + x.n + " dudas", body: x.txt + " Toca y me cuentas." };
}
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil((d.tag === "manana" ? cuerpoManana(d).catch(() => d) : d.tag === "dudas" ? cuerpoDudas(d).catch(() => d) : Promise.resolve(d)).then((x) => self.registration.showNotification(x.title || "Finti", {
    body: x.body || "", icon: "/icon-192.png", badge: "/badge-96.png", tag: x.tag || "fintelligente", renotify: false, data: { url: x.url || "/" }, lang: "es",
  })));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    for (const c of cs) { if (c.url.startsWith(self.location.origin) && "focus" in c) { c.navigate(url).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
