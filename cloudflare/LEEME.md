# Finti en Cloudflare

La misma app y las mismas funciones de `netlify/functions`, sin cambiarlas, corriendo en Cloudflare Workers.

| En Netlify | En Cloudflare |
|---|---|
| `public/` | `dist/` (copia de `public/` que arma `node construir.mjs`, con `_headers` sacado de `netlify.toml`) |
| Funciones v2 (`config.path`) | `src/worker.mjs` lee el `config` de cada función y arma las rutas |
| Funciones programadas (`config.schedule`) | Cron Triggers en `wrangler.jsonc` |
| Netlify Blobs | D1 (`src/blobs-d1.mjs`, misma interfaz, escrituras condicionales atómicas, valores grandes en partes) |
| nodemailer (Gmail por SMTP) | `src/smtp.mjs`: SMTP con sockets de Cloudflare (TLS en 465, STARTTLS en 587) |
| web-push | `src/web-push.mjs`: VAPID y aes128gcm con WebCrypto (comprobado contra la librería original) |
| `[[redirects]]` | `src/worker.mjs` (`/privacidad`, `/terminos`, `/.well-known/assetlinks.json`…) |
| Variables de entorno | `process.env` (nodejs_compat) con secretos de Cloudflare |

Los paquetes se cambian con `alias` en `wrangler.jsonc`, así `netlify/lib` sigue igual y sirve en los dos lados.

## Probar
```
cd cloudflare && npm install
node pruebas/humo.mjs        # motor real de Workers (workerd) con base D1 local y un servidor de correo local
```
La prueba de humo revisa:
- la página y sus encabezados;
- la cuenta con código por correo;
- el presupuesto cifrado;
- que, de cinco guardados a la vez, gane solo uno;
- el buzón cifrado;
- los precios del DANE (incluido un valor de 2 MB en partes);
- las tres tareas programadas, con el respaldo cifrado;
- la ruta y la herramienta de migración.

`npm test` (en `web-pro/`) también la corre si `wrangler` está instalado aquí.

## Publicar
Lo hace Cloudflare desde GitHub (Workers Builds):
- Carpeta raíz: `cloudflare`.
- Construir: `npm ci && node construir.mjs`.
- Publicar: `npx wrangler deploy`.

Los pasos para el dueño están en el documento del proyecto "mudanza-cloudflare".

## Límites del plan gratis
- 100.000 solicitudes al día.
- 10 ms de CPU por solicitud.
- D1: 5 GB, 5 millones de filas leídas y 100.000 escritas al día.

Si en Observability aparecen errores de "CPU time limit", el plan Workers Paid (5 dólares al mes) sube el límite a 30 s.
