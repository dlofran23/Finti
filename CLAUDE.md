# Finti: instrucciones para Claude Code

App de finanzas personales para Colombia (antes Fintelligente). Web (PWA) en Cloudflare Workers
(finti.francisco-jzx14.workers.dev; Netlify se eliminó el 22 de noviembre de 2026), app de Android (TWA,
`co.fintelligente.app`) y atajo de iPhone. Premium es un pago único con Wompi. El detalle técnico está en
`ARQUITECTURA.md` y los pasos del dueño en `LEEME.md`: léelos antes de cambiar algo grande.

## Cómo se edita la app

- La página es un solo archivo, `public/index.html`, pero **se edita en `fuente/`** (estilos/, pantallas/, logica/,
  datos/; `fuente/plantilla.html` dice el orden). Nunca edites `public/index.html` a mano.
- Después de cambiar `fuente/`: `python3 herramientas/construir.py`. `--revisar` comprueba que estén iguales.
- Páginas legales: se editan en `legal/` y se generan con `python3 herramientas/legal.py`.
- Servidor: las funciones de `netlify/functions/` (el nombre de la carpeta es histórico) corren en el trabajador de
  Cloudflare (`cloudflare/src/worker.mjs`), con la lógica compartida en `netlify/lib/`. Los datos van en D1 mediante el
  adaptador `cloudflare/src/blobs-d1.mjs`, siempre a través de `netlify/lib/almacen.mjs`, y las escrituras con
  `netlify/lib/atomico.mjs`.
- Android: `android/` (Java). Pruebas con Robolectric: `./gradlew -Psim :app:testReleaseUnitTest`.

## Antes de dar algo por terminado

1. `python3 herramientas/ortografia.py` sin errores.
2. `npm test` en verde (servidor y navegador con Playwright). Agrega una prueba para cada función nueva.
3. Actualiza `ARQUITECTURA.md` y, si cambia lo que hace el dueño, `LEEME.md`.
4. Si la app guarda o envía un dato nuevo, actualiza `legal/privacidad.html`.

## Textos (el dueño lo exige)

- Normas de la RAE: ortografía, tildes, puntuación y mayúsculas. Las preguntas y exclamaciones llevan los dos signos
  (¿…?, ¡…!), también en títulos y botones. Un título que empieza con palabra interrogativa se escribe como pregunta.
- La app tutea (nunca "usted"). Montos como `$ 50.000`; con millones, `4,9 millones`. Comillas dobles "…",
  nunca « ». Nada de caracteres que parezcan de IA (rayas largas decorativas, emojis de relleno).
- El asesor y las preguntas son positivos: orientan, nunca regañan.

## Seguridad (no negociable)

- Las llaves secretas (Wompi, VAPID, Resend, `ENTRADA_SECRET`, `LICENSE_SECRET`, `SMTP_PASS`, `PANEL_CLAVE`) viven
  solo en los secretos del trabajador de Cloudflare (y `PRECIOS_CLAVE` también en GitHub). Nunca en el código, en
  commits ni en la conversación. El repositorio es público.
- No cambies `LICENSE_SECRET` (invalidaría las licencias Premium).
- Nunca subas `fintelligente.jks` ni `llave.txt` (firma de Android). Están en `.gitignore`.
- En Cloudflare la CSP no lleva `'unsafe-inline'` en `script-src`: `cloudflare/construir.mjs` firma cada script en
  línea con su huella. Los estilos en línea siguen permitidos.
- Nada de "Pregúntale" o del asesor sale del dispositivo: no hay IA externa.
- Cada enero, actualiza `SMMLV` y `SMMLV_ANO` (Para independientes, seguridad social) con el decreto del salario mínimo.
- Los premios de "Invita y gana" se entregan en `trasAprobar` (`netlify/lib/referidos.mjs`); nunca pueden hacer fallar un pago.

## Publicar

- Cloudflare publica solo y gratis cada push a `main` (Workers Builds: carpeta `cloudflare`, `npm ci && node
  construir.mjs`, `npx wrangler deploy`).
- Trabaja en la rama `desarrollo`. **No hagas push a `main`** salvo que el dueño pida publicar.
- Al publicar: pruebas en verde, unir `desarrollo` en `main`, y revisar después que `/api/salud` responda.
- El nombre del trabajador (`finti`) debe ser igual al de `cloudflare/wrangler.jsonc`, o la publicación falla.
