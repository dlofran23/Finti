# Fintelligente: sitio propio con Premium automático (Wompi)

Este paquete es tu sitio web: Fintelligente, la app de presupuesto (gratis y Premium), y un pequeño servidor que habla con Wompi.
Cuando alguien paga, Wompi avisa al servidor y Premium se activa solo en el dispositivo de esa persona.
Además puede **registrar solos los movimientos** a partir de los avisos de los bancos y las facturas electrónicas, sin pedir claves bancarias, y envía **avisos**: notificaciones al celular, correos (Premium) y un calendario descargable con los pagos.

## Qué hay en la carpeta

| Archivo | Para qué sirve |
|---|---|
| `public/index.html` | La app que ven tus usuarios. **No se edita a mano:** se construye desde `fuente/` con `python3 herramientas/construir.py`. |
| `fuente/` | El código de la app por partes (estilos, pantallas, lógica). Aquí se hacen los cambios. |
| `ARQUITECTURA.md` | Documento técnico: cómo está armada la app, la API, la seguridad y los datos. |
| `pruebas/` | Pruebas automáticas. `npm test` las corre todas; GitHub las corre solo en cada cambio. |
| `herramientas/` | Construir la página, revisar la CSP y manejar respaldos. |
| `android/` | Código de la app Android (sin la llave de firma). |
| `netlify/functions/crear-pago.mjs` | Crea cada pago con su referencia única y la **firma de integridad** que exige Wompi. |
| `netlify/functions/wompi-webhook.mjs` | Recibe los avisos de Wompi y verifica que sean auténticos (checksum con tu secreto de eventos). |
| `netlify/functions/licencia.mjs` | Entrega y valida la licencia Premium de cada comprador. |
| `netlify/functions/config.mjs` | Le dice a la app el precio. |
| `netlify/lib/pagos.mjs` | La lógica común de pagos. |
| `netlify/functions/avisos.mjs` | Guarda o borra los avisos de cada persona (solo nombre, monto y fecha de sus cuentas por pagar). |
| `netlify/functions/avisos-cron.mjs` | Corre cada hora y envía los avisos que tocan según la hora local de cada persona. |
| `netlify/lib/avisos.mjs`, `netlify/lib/canales.mjs` | Las reglas de los avisos y el envío por notificación (Web Push) y por correo (Resend). |
| `netlify/functions/bandeja.mjs`, `netlify/lib/bandeja.mjs` | Buzón cifrado: recibe avisos (correo, Atajos de iPhone, Android) y los guarda cifrados con la llave del celular de cada persona. |
| `correo-worker/` | Trabajador de Cloudflare que recibe los correos reenviados, saca el texto del aviso o el XML de la factura y descarta lo demás. Se publica aparte (paso 8). |
| `public/sw.js`, `public/manifest.webmanifest`, íconos | Permiten instalar la app en el celular y recibir notificaciones. |
| `netlify.toml`, `package.json` | Configuración para Netlify. |

## Cómo funciona

1. El usuario escribe su correo y pulsa **Pagar con Wompi**.
2. El servidor crea una referencia (por ejemplo `PRE-7K2M9QX4ABCD`), la firma y lo envía al checkout de Wompi.
3. El usuario paga con tarjeta, PSE, Nequi o Bancolombia y Wompi lo devuelve a tu sitio.
4. La app consulta el pago y, si está **APROBADO** por el valor correcto, guarda la licencia: Premium queda activo.
5. Aunque el usuario cierre la pestaña antes de volver, el aviso (webhook) de Wompi deja el pago aprobado. Puede activarlo después con su referencia y su correo.

Las cifras de cada persona se guardan en su propio dispositivo. Pueden pasarlas a otro con **Exportar respaldo / Importar respaldo**.

## Paso a paso para publicarlo

Necesitas tres cuentas: **GitHub** (gratis), **Netlify** (tiene plan gratuito; revisa sus límites actuales) y tu **cuenta de comercio en Wompi**.

### 1. Sube la carpeta a GitHub
1. En github.com crea un repositorio nuevo, por ejemplo `fintelligente`. Puede ser privado.
2. Elige **uploading an existing file** y arrastra **todo el contenido** de esta carpeta (no la carpeta `node_modules`, si existe).
3. Confirma con **Commit changes**.

### 2. Conecta el repositorio a Netlify
1. En netlify.com: **Add new project → Import an existing project → GitHub** y elige el repositorio.
2. No cambies nada de la configuración de compilación: el archivo `netlify.toml` ya la trae. Pulsa **Deploy**.
3. Anota la dirección que te asigna, por ejemplo `https://fintelligente.netlify.app`. Puedes cambiar el nombre en la configuración del proyecto.

### 3. Escribe tus llaves en Netlify (variables de entorno)
En Netlify: **Project configuration → Environment variables**. Crea estas variables. Los valores de Wompi están en su panel, sección de desarrolladores (**Secretos para integración técnica**).

| Variable | Valor |
|---|---|
| `WOMPI_PUBLIC_KEY` | Llave pública. Para probar: la que empieza por `pub_test_`. |
| `WOMPI_INTEGRITY_SECRET` | Secreto de **integridad**. Para probar: `test_integrity_…`. |
| `WOMPI_EVENTS_SECRET` | Secreto de **eventos**. Para probar: `test_events_…`. |
| `PRECIO_COP` | Precio de Premium en pesos, sin puntos. Ejemplo: `15000`. |
| `LICENSE_SECRET` | Una frase larga y aleatoria inventada por ti (40 caracteres o más). Firma las licencias. |
| `SITE_URL` | La dirección de tu sitio, por ejemplo `https://fintelligente.netlify.app`. |

Para los **avisos** (opcional, puedes hacerlo después):

| Variable | Valor |
|---|---|
| `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` | Llaves para las notificaciones al celular. Créalas una sola vez (ver paso 3.1). |
| `VAPID_SUBJECT` | Tu correo de contacto con `mailto:` adelante. Ejemplo: `mailto:tucorreo@gmail.com`. |
| `RESEND_API_KEY` | Llave de tu cuenta en resend.com, para enviar correos. |
| `AVISOS_REMITENTE` | Quién envía los correos. Ejemplo: `Fintelligente <avisos@tudominio.com>`. |

Después ve a **Deploys → Trigger deploy** para que el sitio tome las variables.

#### 3.1 Crear las llaves de notificaciones (una sola vez)
En un computador con Node.js instalado, abre una terminal y ejecuta:

```
npx web-push generate-vapid-keys
```

Copia la **Public Key** en `VAPID_PUBLIC_KEY` y la **Private Key** en `VAPID_PRIVATE_KEY`. Si las cambias después, todos tendrán que activar de nuevo las notificaciones.

#### 3.2 Correo con Resend
1. Crea una cuenta en resend.com y una llave en **API Keys**: va en `RESEND_API_KEY`.
2. Verifica tu dominio en **Domains**. Sin dominio verificado, Resend solo deja enviar correos a tu propia dirección, así que sirve para probar pero no para tus usuarios.
3. El plan gratis de Resend tiene un límite diario y mensual de correos; revisa el actual en su página de precios. Los correos son solo para Premium, lo que ayuda a no pasarte.

**Nunca** pongas estos secretos dentro de `index.html`, en un mensaje de chat ni en GitHub. Solo van en Netlify.
Si cambias `LICENSE_SECRET`, todas las licencias existentes dejan de valer.

### 4. Dile a Wompi a dónde avisar
En el panel de Wompi, sección de desarrolladores, en **URL de eventos**, escribe:

```
https://TU-SITIO.netlify.app/api/wompi-webhook
```

Wompi pide una URL para **pruebas (Sandbox)** y otra para **producción**. Pon la misma en ambas.

### 5. Prueba en modo pruebas
1. Abre tu sitio, pulsa **★ Premium**, escribe un correo y **Pagar con Wompi**.
2. Paga con los datos de prueba que Wompi publica para su modo Sandbox (tarjetas y números de Nequi de prueba).
3. Al volver a tu sitio debe decir ****¡Pago aprobado! Premium ya está activo****.
4. Prueba también un pago rechazado: Premium debe seguir bloqueado.

### 6. Pasa a producción
1. En Netlify reemplaza las tres variables de Wompi por las de producción (`pub_prod_…`, `prod_integrity_…`, `prod_events_…`).
2. Revisa que la URL de eventos de **producción** esté configurada en Wompi.
3. **Trigger deploy**. Desde ese momento los pagos son reales.

### 7. Prueba los avisos
1. Abre tu sitio en el celular. En **iPhone**, primero instálalo: En Safari, **Compartir → Agregar a inicio**, y ábrelo desde ese ícono (Apple solo permite notificaciones a apps instaladas). En Android funciona desde Chrome.
2. Menú **⋮ → Avisos y recordatorios → Activar notificaciones**. Debe llegarte **¡Avisos activados! 🔔**.
3. Con Premium activo, escribe tu correo y pulsa **Activar correo**: llega un correo de confirmación.
4. **Descargar calendario (.ics)**: Al abrirlo en el celular se agregan tus pagos con alarma.

**Reglas para no cansar a nadie** (están en `netlify/lib/avisos.mjs`):
- Nada entre las 9 p. m. y las 7 a. m. (hora local de cada persona).
- Máximo 2 notificaciones al día; los avisos de pago siempre pasan.
- Pagos: a las 8 a. m., los días de aviso que eligió la persona, el día del vencimiento y el día siguiente si no lo marcó pagado.
- **¿Gastaste algo hoy?**: a la hora que elija (6, 7 u 8 p. m.), solo si no registró nada ese día. Si lleva más de 3 días sin entrar, día de por medio; si lleva más de 14, solo los domingos.
- Un consejo de buenos hábitos los domingos a las 10 a. m. (se puede apagar).
- Cada correo trae un enlace para dejar de recibirlos.

### 8. Registro automático de movimientos (opcional)
Funciona por tres vías: **reenvío de correos** (alertas del banco y facturas electrónicas), **Atajos de iPhone** y **MacroDroid en Android**. Las dos últimas no necesitan este paso: solo la variable `ENTRADA_SECRET`. El correo sí necesita un dominio propio en Cloudflare.

**Cómo protege la privacidad:** Cada celular crea una llave que nunca sale de él. El servidor guarda los avisos cifrados con esa llave, así que ni tú como dueño del sitio puedes leerlos. El celular los descarga, los descifra, los lee y los borra del servidor. Nadie entrega claves del banco.

1. En Netlify crea dos variables:

| Variable | Valor |
|---|---|
| `ENTRADA_SECRET` | Una frase larga y aleatoria inventada por ti (40 caracteres o más). La comparten Netlify y el trabajador de correo. |
| `ENTRADA_DOMINIO` | El dominio que recibirá los correos, por ejemplo `entrada.tudominio.com`. |

2. **Dominio en Cloudflare:** Agrega tu dominio a Cloudflare (plan gratis) y deja que maneje sus DNS. Puede ser el mismo que verificaste en Resend.
3. **Publica el trabajador:** En un computador con Node.js, entra a la carpeta `correo-worker`, cambia `SITIO` en `wrangler.toml` por tu dirección de Netlify y ejecuta:

```
npm install
npx wrangler login
npx wrangler secret put ENTRADA_SECRET
npx wrangler deploy
```

En `secret put` pega la misma frase que pusiste en Netlify.

4. **Enrutamiento de correo:** En Cloudflare, en tu dominio: **Email → Email Routing → Enable**. En **Routing rules**, activa **Catch-all** con la acción **Send to a Worker** y elige `fintelligente-correo`. Si usas un subdominio como `entrada.tudominio.com`, actívalo también en Email Routing.
5. **Prueba:** En la app, **⋮ → Conectar bancos → Crear mi buzón**. Desde tu Gmail, agrega la dirección que aparece como dirección de reenvío. El código de confirmación de Gmail debe aparecer en **⋮ → Por confirmar**.

**Qué reconoce el lector** (`lector.js`, dentro de la app): Avisos de Bancolombia, Nequi, Daviplata, Davivienda, BBVA, Banco de Bogotá, Nu y el formato general de compras, pagos, transferencias, retiros, abonos de nómina y pagos de tarjeta. También las facturas electrónicas de la DIAN, en el archivo XML. Si un banco cambia el formato de sus avisos, ajusta los patrones en ese archivo.

### 9. Cuentas: guardar en la nube con Google o con el correo
La app ya trae todo: bienvenida, hoja para entrar, código por correo, pantalla **Tu cuenta**, copia automática,
varios dispositivos, aviso de conflictos y clave de cifrado propia (opcional). Se activa sola cuando configuras
al menos una de estas dos formas de entrar:

**Con Google** (variable `GOOGLE_CLIENT_ID`, no es secreta):
1. Entra a https://console.cloud.google.com y crea un proyecto llamado **Fintelligente**.
2. Busca **Google Auth Platform** → **Comenzar**: nombre de la app **Fintelligente**, tu correo de soporte, público **Externo**.
3. En **Clientes** → **Crear cliente** → tipo **Aplicación web**. En **Orígenes autorizados de JavaScript** agrega
   `https://fintelligentx.netlify.app` (y tu dominio propio si algún día lo tienes).
   En **URI de redireccionamiento autorizados** agrega `https://fintelligentx.netlify.app/api/cuenta/google-redirect`
   (lo usa el iPhone cuando la app está en la pantalla de inicio). Crear.
4. Copia el **ID de cliente** (termina en `.apps.googleusercontent.com`) y pégalo en Netlify como `GOOGLE_CLIENT_ID`.
5. En **Público**, publica la app (pasar a producción) para que cualquier persona pueda entrar.

**Con código por correo** (Gmail gratis, sin dominio propio):
1. Crea una cuenta de Gmail para la app (por ejemplo, fintelligente.app@gmail.com) y activa la **Verificación en 2 pasos**.
2. En https://myaccount.google.com/apppasswords crea una contraseña de aplicación llamada **Fintelligente**. Son 16 letras.
3. En Netlify crea `SMTP_USER` = ese correo de Gmail y `SMTP_PASS` = la contraseña de 16 letras (**marca **secreta**** y pégala en Production).
   Gmail permite unos 500 correos al día. La app cuenta los envíos y frena en 450: desde ahí pide entrar con Google
   (por eso Google aparece primero). En `/api/salud` ves cuántos van (`correosHoy`). Con un dominio propio puedes pasar a Resend.

Después de crear las variables: **Deploys → Trigger deploy → Deploy site**.

> **Importante:** la copia en la nube se cifra con una llave derivada de `LICENSE_SECRET`. **No cambies `LICENSE_SECRET`**
> después de lanzar las cuentas: las copias guardadas ya no se podrían abrir. Si algún día necesitas cambiarlo,
> crea antes `CUENTAS_SECRET` con el valor actual de `LICENSE_SECRET`.

Cómo funciona por dentro:
- `netlify/lib/cuentas.mjs`: códigos de 6 números (vencen en 10 minutos, máximo 5 intentos y 5 envíos por hora),
  verificación de la firma de Google, sesiones por dispositivo, copia con versiones (detecta conflictos) y cifrado AES-256-GCM en reposo.
- `netlify/functions/cuenta.mjs` (`/api/cuenta/*`) y `netlify/functions/datos.mjs` (`/api/datos`).
- Con la **clave de cifrado propia**, el celular cifra antes de enviar: el servidor solo guarda texto ilegible. Si la persona olvida la clave, nadie puede recuperar esa copia.
- Google y correo con la misma dirección llegan a la **misma cuenta**. Premium viaja con la cuenta.

## Día a día

- **Ver tus ventas:** en el panel de Wompi. En Netlify, el almacén de datos (Blobs) llamado `pagos` guarda cada referencia con su estado y su correo.
- **Cambiar el precio:** cambia `PRECIO_COP` en Netlify y vuelve a desplegar.
- **Actualizar la app:** reemplaza `public/index.html` en GitHub; Netlify publica solo.
- **Ver los avisos activos:** en Netlify, almacén (Blobs) `avisos`. En **Logs → Functions → avisos-cron** ves cuántos se envían cada hora.
- **Buzones de registro automático:** almacenes (Blobs) `buzones` y `bandeja`. Lo que está en `bandeja` está cifrado y se borra cuando el celular lo recibe.
- **Revisar que todo esté bien:** abre `https://fintelligentx.netlify.app/api/salud`. Si dice `"ok": true`, el servicio funciona.
- **Respaldos:** cada día a las 3:17 a. m. se guarda una copia cifrada de todos los datos (se conservan 30 días). Una vez por semana, descarga una copia a tu computador con `node herramientas/respaldos.mjs descargar` (ver `ARQUITECTURA.md`).
- **Antes de publicar textos nuevos:** corre `python3 herramientas/ortografia.py`. Si encuentra un error de puntuación o de mayúsculas, te dice el archivo y la línea.
- **Un cliente cambió de celular:** que abra ★ Premium → **¿Ya pagaste en otro dispositivo?** y escriba su referencia (viene en el correo de Wompi) y el correo de la compra.

## Seguridad, en corto

- El precio y la firma los pone el servidor: nadie puede cambiar el monto desde el navegador.
- El servidor solo aprueba pagos con estado `APPROVED`, en pesos y por el valor exacto de `PRECIO_COP`.
- Los avisos de Wompi se verifican con tu secreto de eventos; los falsos se rechazan.
- La licencia está firmada y se revalida con el servidor una vez al día.
- Como las cifras viven en el dispositivo, alguien con conocimientos técnicos podría manipular su propia copia de la app. Para este tipo de producto es un riesgo razonable.

### 10. Respaldos, alertas y sitio de pruebas

1. **Alertas por correo:** en Netlify agrega la variable `ALERTAS_CORREO` con tu correo. Si fallan los pagos, las cuentas, los datos o el respaldo diario, te llega un correo (necesita el correo configurado: `SMTP_USER` y `SMTP_PASS`).
2. **Monitor externo (gratis):** crea una cuenta en uptimerobot.com y agrega un monitor HTTP a `https://fintelligentx.netlify.app/api/salud`. Te avisa si el sitio entero se cae.
3. **Sitio de pruebas:**
   - En GitHub crea una rama llamada `pruebas`.
   - En Netlify ve a **Project configuration > Build & deploy > Branches and deploy contexts**, elige **Let me add individual branches** y escribe `pruebas`.
   - Lo que subas a esa rama queda en `https://pruebas--fintelligentx.netlify.app`, con sus propios datos, separados de los reales.
   - Cuando funcione bien, pasa el cambio a `main`.
4. **Llaves:** guarda en un gestor de contraseñas (con copia) `LICENSE_SECRET`, la llave de firma `fintelligente.jks` con su contraseña, y las llaves de Wompi. Sin `LICENSE_SECRET` no se pueden abrir los datos ni los respaldos. Sin la llave de firma no se puede actualizar la app en Play Store.

### 11. Cuando tengas dominio propio: mudanza automática

1. En Netlify, **Domain management → Add a domain** y agrega tu dominio al **mismo** sitio. No borres `fintelligentx.netlify.app`.
2. En Google Cloud agrega el dominio nuevo en **Orígenes autorizados** y `https://TU-DOMINIO/api/cuenta/google-redirect` en **URI de redireccionamiento**.
3. Publica una versión de la app Android con el dominio nuevo en `strings.xml` y en `assetlinks.json` (ver `ARQUITECTURA.md`).
4. En Netlify crea la variable `DIRECCION_NUEVA` = `https://TU-DOMINIO` y vuelve a publicar.

Desde ese momento, quien abra la dirección vieja pasa a la nueva con todos sus datos, cifrados en el camino, sin hacer nada.
Los atajos de iPhone y los correos reenviados siguen funcionando con el mismo código.

### 12. Documentos legales

Las páginas de privacidad, términos y borrar cuenta salen de `legal/`. Para cambiar un dato (dirección, ciudad,
correo de contacto, fecha de vigencia), edita `legal/datos.json` y corre `python3 herramientas/legal.py`.
Si cambias el contenido de los documentos, sube `version` en `legal/datos.json` y `LEGAL_V` en la app:
quienes ya tienen cuenta tendrán que aceptar de nuevo. Las respuestas para Google Play están en `legal/google-play.md`.

### 13. Panel: cómo se usa la app y qué está fallando

1. En Netlify agrega la variable `PANEL_CLAVE` con una clave larga (mínimo 16 caracteres; guárdala en tu gestor de contraseñas).
2. Entra a `https://fintelligentx.netlify.app/panel` y escribe esa clave. Verás:
   - aperturas por día, primer movimiento, bancos conectados, vistas de Premium, pagos iniciados, compras y cuentas nuevas;
   - el embudo de los últimos 30 días y el detalle por tipo de dispositivo;
   - los errores que tuvo la app en los teléfonos durante la última semana.
3. Si ya configuraste `ALERTAS_CORREO`, te llega un correo cuando aparece un error nuevo (máximo uno cada 6 horas).
4. Al publicar una versión, cambia `VERSION_APP` en la app (sección "Salud técnica") para saber en qué versión ocurre cada error.

Nada de esto identifica a nadie: son contadores por día, y los errores llegan sin números, correos ni direcciones.

### 14. Códigos de regalo de Premium

1. Entra al panel (paso 13) y baja hasta **Códigos de regalo de Premium**.
2. Escribe cuántos quieres (de 1 a 200) y una nota para ti, por ejemplo "Familia" o el nombre de una empresa. Toca **Crear códigos**.
3. **Cópialos en ese momento**: es la única vez que se ven completos. "Copiar los enlaces" te da enlaces como
   `https://fintelligentx.netlify.app/#regalo=FIN-XXXXX-XXXXX`, que abren la app con el código puesto.
4. Envía cada código o enlace a una sola persona. Ella escribe su correo y toca **Activar**: Premium queda activo para
   siempre y recibe una referencia para activarlo en otro dispositivo, igual que si hubiera pagado.
5. En la tabla ves cuáles están libres, cuáles se usaron (y cuándo) y puedes **Anular** uno que no se haya usado,
   por ejemplo si lo enviaste a la persona equivocada.

Necesita `PANEL_CLAVE` y `LICENSE_SECRET` configuradas en Netlify. El servidor no guarda los códigos, solo su huella.

### 15. Vender a empresas

1. Comparte `https://fintelligentx.netlify.app/empresas` con el área de talento humano o bienestar.
2. Cuando una empresa compre, crea en el panel un lote con el número de personas y el **nombre de la empresa en la nota**.
3. Toca **Descargar la lista (Excel)** y envíasela a la empresa: trae el código y el enlace de cada persona.
4. Cada mes, en el panel, la tabla **por nota** te dice cuántos códigos de esa empresa se activaron. Envíale ese número;
   no hay ningún otro dato de sus empleados.

### 16. Invita y gana

No hay nada que configurar: usa `LICENSE_SECRET`. En el panel ves cuántas personas crearon su enlace ("Creó su enlace
para invitar") y cuántas compras llegaron por invitación ("Compró por invitación"). Los premios son códigos de regalo
normales: aparecen en la tabla de códigos con la nota "Premio por invitar".
