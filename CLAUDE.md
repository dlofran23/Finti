# Fintelligente: instrucciones para Claude Code

App de finanzas personales para Colombia. Web (PWA) en Netlify (fintelligentx.netlify.app), app de Android (TWA,
`co.fintelligente.app`) y atajo de iPhone. Premium es un pago único con Wompi. El detalle técnico está en
`ARQUITECTURA.md` y los pasos del dueño en `LEEME.md`: léelos antes de cambiar algo grande.

## Cómo se edita la app

- La página es un solo archivo, `public/index.html`, pero **se edita en `fuente/`** (estilos/, pantallas/, logica/,
  datos/; `fuente/plantilla.html` dice el orden). Nunca edites `public/index.html` a mano.
- Después de cambiar `fuente/`: `python3 herramientas/construir.py`. `--revisar` comprueba que estén iguales.
- Páginas legales: se editan en `legal/` y se generan con `python3 herramientas/legal.py`.
- Servidor: Netlify Functions v2 en `netlify/functions/`, lógica compartida en `netlify/lib/`. Datos en Netlify Blobs,
  siempre a través de `netlify/lib/almacen.mjs`, y escrituras con `netlify/lib/atomico.mjs`.
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
  solo en las variables de entorno de Netlify. Nunca en el código, en commits ni en la conversación.
- No cambies `LICENSE_SECRET` (invalidaría las licencias Premium).
- Nunca subas `fintelligente.jks` ni `llave.txt` (firma de Android). Están en `.gitignore`.
- La CSP conserva `'unsafe-inline'` y no se oculta la insignia de Netlify.
- Nada de "Pregúntale" o del asesor sale del dispositivo: no hay IA externa.
- Cada enero, actualiza `SMMLV` y `SMMLV_ANO` (Para independientes, seguridad social) con el decreto del salario mínimo.
- Los premios de "Invita y gana" se entregan en `trasAprobar` (`netlify/lib/referidos.mjs`); nunca pueden hacer fallar un pago.

## Publicar (cuidado con los créditos de Netlify)

- El plan gratis de Netlify da 300 créditos al mes y **cada publicación a producción cuesta 15**. Si se acaban,
  Netlify apaga el sitio hasta el mes siguiente.
- Trabaja siempre en la rama `desarrollo`. **No hagas push a `main`** salvo que el dueño diga "publicar": cada push a
  `main` publica la app. Se publica una vez al mes (la próxima: 11 de diciembre de 2026).
- Al publicar: pruebas en verde, unir `desarrollo` en `main` con un solo commit o merge, y revisar después que Netlify
  muestre todas las funciones y que `/api/salud` responda.
- `package.json` de la raíz debe tener `@netlify/blobs`. Si un archivo de otra carpeta lo reemplaza, se caen todas las
  funciones (pasó el 10 de noviembre de 2026).
