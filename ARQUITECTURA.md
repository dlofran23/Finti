# Finti (antes Fintelligente): arquitectura técnica

Documento para quien mantenga, audite o compre la app. La guía paso a paso para publicar está en `LEEME.md`.

## Resumen

| Parte | Tecnología | Dónde vive |
|---|---|---|
| App web (PWA) | HTML, CSS y JavaScript sin frameworks, en un solo archivo publicado | `public/index.html`, construido desde `fuente/` |
| Servidor | Netlify Functions (Node 20+, módulos ES) | `netlify/functions/` (entradas) y `netlify/lib/` (lógica) |
| Datos | Netlify Blobs (clave y valor) | Ver "Almacenes de datos" |
| Pagos | Wompi (checkout de redirección y webhook firmado) | `netlify/lib/pagos.mjs` |
| App Android | Trusted Web Activity con lector de notificaciones (Java) | `android/` |
| iPhone | Atajo de la app Atajos que envía avisos al buzón cifrado | Guía en la app, `pasosIos()` |
| Correo entrante (opcional) | Cloudflare Email Worker | `correo-worker/` |

## Estructura del repositorio

```
fuente/            Código de la app web, por partes (aquí se edita)
  plantilla.html     Orden en que se unen las partes
  estilos/           CSS por sección
  pantallas/         HTML de cada ventana
  logica/            JavaScript por módulo (+ lector-de-avisos.js)
  datos/             Presupuesto de ejemplo y plantilla de Excel
public/            Lo que se publica (index.html y app.js construidos, íconos, sw.js, vendor/)
netlify/functions/ Una función por ruta de la API o tarea programada
netlify/lib/       Lógica del servidor, sin dependencias de Netlify (se prueba sola)
herramientas/      construir.py, csp.py, respaldos.mjs, cambiar-a-finti.py, material-tienda.cjs, videos-tienda.cjs
pruebas/           Pruebas del servidor (*.test.mjs) y del navegador (navegador/*.test.js)
android/           App Android (sin la llave de firma)
marca-finti/       Íconos nuevos para el cambio a Finti (sin aplicar; ver su LEEME.md)
material-tienda/   Capturas, gráfico destacado, videos y texto de la ficha de Google Play
correo-worker/     Trabajador de correo entrante (Cloudflare)
.github/workflows/ Pruebas automáticas en GitHub
```

## Cómo hacer un cambio

1. Edita los archivos de `fuente/` (o de `netlify/`).
2. `npm run construir`: une `fuente/` en `public/index.html` y saca el script principal a `public/app.js?v=<huella>`.
3. `npm test`: corre todas las pruebas (servidor y navegador).
4. Sube a GitHub en la rama `pruebas`, revisa el sitio de pruebas y luego pasa el cambio a `main`.

GitHub Actions corre lo mismo en cada cambio y además comprueba que `public/index.html` y `public/app.js` correspondan a `fuente/`.

## API

| Ruta | Método | Para qué | Protección |
|---|---|---|---|
| `/api/config` | GET | Configuración pública (precio, Google, atajo iPhone) | Sin datos secretos |
| `/api/crear-pago` | POST | Crea la referencia y el enlace de Wompi | Firma de integridad |
| `/api/wompi-webhook` | POST | Wompi confirma el pago y se activa Premium | Firma `x-event-checksum` |
| `/api/licencia` | POST | Valida la licencia Premium del dispositivo | HMAC con `LICENSE_SECRET` |
| `/api/cuenta/*` | varios | Código por correo, Google, sesión, licencia, borrar cuenta | Límites por correo e IP; sesiones con hash; cupo diario de correos |
| `/api/cuenta/google-redirect` | POST | Google vuelve aquí en modo redirección (iPhone con la app en el inicio) | Marca CSRF en cookie y en el formulario; entrega un código de un solo uso |
| `/api/cuenta/canjear` | POST | Cambia ese código de un solo uso por la sesión | Vence en 2 minutos; se borra al usarlo |
| `/api/datos` | GET, PUT | Copia del presupuesto en la nube | Sesión; versión con escritura condicional; AES-256-GCM en reposo |
| `/api/estado` | GET | Novedades en una sola llamada: versión de la nube, datos de la cuenta y avisos del buzón | Sesión y token del buzón |
| `/api/mudanza` | POST, GET | Paquete cifrado para pasar los datos a una dirección nueva | El servidor no ve la llave; se lee una sola vez; vence en 30 minutos |
| `/api/bandeja/llave` | PUT | Cambia la llave pública del buzón (al mudarse de dirección) | Token del dueño; 10 por hora por IP |
| `/api/bandeja/registro` | POST | Crea un buzón cifrado | 10 por hora por IP |
| `/api/entrada` | POST | Recibe avisos de atajos (código `FT-…`) o del trabajador de correo | 30 por minuto por IP; clave del buzón o secreto del trabajador |
| `/api/bandeja` | GET, DELETE | El dispositivo dueño lee y borra sus avisos | Token del dispositivo |
| `/api/avisos` | varios | Suscripción a notificaciones y correos de recordatorio | Token por dispositivo |
| `/api/regalo`, `/api/regalos` | POST, GET | Canjear un código de regalo; crear, ver y anular (panel) | 10 intentos por hora por IP; `PANEL_CLAVE` |
| `/api/invita` | POST, GET | Crear tu código de invitación; ver tus premios | 5 por hora por IP; llave HMAC con `LICENSE_SECRET` |
| `/api/salud` | GET | Estado del servicio para un monitor externo | Solo responde sí o no por componente |

Tareas programadas: `avisos-cron` (cada hora, recordatorios), `respaldo-cron` (diario, 3:17 a. m. hora Colombia) y `vigia-cron` (cada hora, alertas).

## Almacenes de datos (Netlify Blobs)

Todos se abren con `netlify/lib/almacen.mjs`. La lista `ALMACENES` es la única fuente de verdad.

| Almacén | Contenido | ¿Se respalda? |
|---|---|---|
| `cuentas-usuarios` | Correo, nombre, licencia vinculada | Sí |
| `cuentas-sesiones` | Hash de cada sesión y dispositivo | Sí |
| `cuentas-datos` | Presupuestos cifrados (AES-256-GCM; opcionalmente también con la clave del usuario) | Sí |
| `pagos` | Referencias y estado de pagos de Wompi (y el código de invitación, si lo hubo) | Sí |
| `regalos` | Huellas de los códigos de regalo de Premium | Sí |
| `invitaciones` | Códigos de invitación, compras hechas con ellos y premios entregados | Sí |
| `avisos` | Perfiles de recordatorios por dispositivo | Sí |
| `buzones` | Llave pública RSA y hash de la clave de cada buzón | Sí |
| `cuentas-codigos`, `cuentas-limites`, `bandeja`, `mudanzas` | Códigos temporales, límites de uso (y el cupo diario de correos), avisos cifrados aún no entregados y paquetes de mudanza | No (son temporales) |
| `respaldos` | Un archivo cifrado por día, últimos 30 días | Es el respaldo |

**Sitio de pruebas:** cualquier publicación que no sea la de producción (rama `pruebas`, vistas previas) usa los mismos nombres con el prefijo `pruebas-`. Nunca toca datos reales.

## Escrituras seguras (varios dispositivos al mismo tiempo)

Toda operación que lee un registro, lo cambia y lo vuelve a guardar usa `netlify/lib/atomico.mjs`:
lee el registro con su etiqueta (ETag) y guarda con `onlyIfMatch` (o `onlyIfNew` si es nuevo). Si otro proceso
lo cambió entre medio, se vuelve a leer y se reintenta. Así:

- Dos dispositivos que guardan a la vez sobre la misma versión: uno gana y el otro recibe `409` (la app pregunta cuál conservar).
- Dos entradas al mismo tiempo no se borran la sesión una a la otra.
- Los límites de uso y los intentos de un código no se pueden saltar con solicitudes simultáneas.
- Un evento `PENDIENTE` de Wompi nunca pisa un pago ya `APROBADO`.
- Una sesión cerrada no revive aunque ese dispositivo esté haciendo una solicitud en ese momento.

Las pruebas lo comprueban con un almacén en memoria con demoras al azar (`pruebas/memoria.mjs`) y con Netlify Blobs
local (`pruebas/blobs-local.mjs`, que agrega las etiquetas al leer, como hace Netlify en producción).

## Consumo del servidor

La app ya no pregunta cada minuto. Pide `/api/config` una vez y `/api/estado` (nube y buzón juntos) al abrir,
al volver a la app tras más de 3 segundos fuera, al recuperar internet y, si sigue en primer plano, cada 10 minutos.
La licencia se confirma una vez al día y los avisos solo se envían al servidor si cambiaron. Una apertura normal
con cuenta y buzón son **2 invocaciones** (antes eran 6 o 7, más 1 cada minuto con la app abierta).

## Cupo diario de correos

Gmail permite unos 500 correos al día. `netlify/lib/cupo-correo.mjs` cuenta todos los envíos (códigos y avisos) y
frena en 450 (cambiable con `CORREO_TOPE_DIA`). Los avisos dejan 100 libres para los códigos de entrada. Si se llega
al tope, la app pide entrar con Google y resalta ese botón. `/api/salud` muestra `correosHoy` y el vigía avisa al pasar del 80 %.

## Almacenamiento en el navegador

El presupuesto se guarda en IndexedDB (`fintelligente-datos`), con mucho más espacio que localStorage, y mientras quepa
también en localStorage como copia. Al abrir se usa la más reciente. Los datos de versiones anteriores pasan solos a
IndexedDB sin borrar la copia original. Si hay varias pestañas abiertas, la que estaba atrás recarga los datos al volver a ella.

En iPhone, Safari puede borrar los datos de una página que no se abre en 7 días (no pasa con el ícono de la pantalla de
inicio ni con los datos en la nube). Por eso, en iPhone y sin cuenta, la app muestra un aviso con dos salidas: crear la
cuenta o agregarla al inicio (con los pasos y la advertencia de que el ícono empieza vacío).

## Mudanza a un dominio propio

Cada navegador guarda los datos por dirección. Para que nadie pierda nada al pasar a un dominio propio:

1. Se agrega el dominio nuevo al mismo sitio de Netlify (la dirección `fintelligentx.netlify.app` sigue funcionando).
2. Se crea la variable `DIRECCION_NUEVA` (por ejemplo `https://fintelligente.co`) y se vuelve a publicar.
3. Quien abra la dirección vieja ve "Fintelligente cambió de dirección": la app cifra sus datos en el navegador con
   una llave al azar (AES-256-GCM), sube solo el paquete cifrado y abre la dirección nueva con el número del paquete y
   la llave después del `#` (esa parte nunca llega al servidor).
4. La dirección nueva recoge el paquete (una sola vez), muestra qué trae (meses, cuenta, buzón) y pregunta antes de usarlo.
   Si ya había datos ahí, quedan como copia. La sesión sigue iniciada.
5. El buzón sigue siendo el mismo: el navegador nuevo crea su llave y se la entrega al servidor (`/api/bandeja/llave`).
   El código del atajo de iPhone y el del correo no cambian.
6. Las siguientes veces, la dirección vieja solo redirige (conserva `?app=android` y los demás parámetros).

Lo que no se puede llevar: la clave de cifrado propia (si la persona la activó, la app la pide otra vez).
La app Android necesita una versión nueva con el dominio en `asset_statements` antes del cambio (ver Android).

## Marco legal (Ley 1581 de 2012 y Estatuto del Consumidor)

- **Documentos:** `legal/privacidad.html` (política de tratamiento y aviso de privacidad), `legal/terminos.html`
  (términos de uso y condiciones de compra de Premium) y `legal/eliminar-cuenta.html`. Los datos de los
  responsables (nombres, dirección, teléfonos, correo, fecha de vigencia, versión) están solo en `legal/datos.json`.
  `python3 herramientas/legal.py` genera `public/legal/`; GitHub Actions comprueba que esté al día.
- **Direcciones cortas:** `/privacidad`, `/terminos`, `/eliminar-cuenta` (redirecciones en `netlify.toml`).
- **Aceptación al crear la cuenta:** fecha de cumpleaños en ruedas tipo Instagram (`pintarAcepto`, con la edad mínima a la vista);
  la fecha se queda en `sessionStorage` y al servidor solo va el rango (mínimo 14; de 14 a 17 con autorización del representante) y aceptación de
  términos y política. El servidor no crea cuentas nuevas sin ella (`necesitaConsentimiento`) y la guarda con fecha en
  `consentimientos` del usuario. Las cuentas que ya existían, o cuando sube la versión (`LEGAL_V` en la app y `version` en
  `datos.json`), aceptan una vez desde la app (`/api/cuenta/acepto`). En Google por redirección viaja en la cookie `ft_acepto`.
- **Compra de Premium:** casilla de mayoría de edad y condiciones de compra; el pago guarda `aceptoCompra`.
- **Android:** aviso destacado antes de pedir la lectura de notificaciones, con enlace a la política.
- **Google Play:** respuestas del formulario de seguridad de datos en `legal/google-play.md`.
- **Asesor:** modelo predictivo en el dispositivo, sin enviar datos a terceros ni a IA (ver Asesor predictivo).
- **Limpieza diaria:** `respaldo-cron` borra huellas de límites con más de 24 horas y códigos vencidos (`lib/limpieza.mjs`).

## Asesor predictivo (Premium)

Todo corre en el navegador (`renderIA`, `cierreMes`, `baseMensual`, `simular`, `calcularAsesor`):

1. **Cierre del mes:** gastos variables según el ritmo diario mezclado con el plan (al principio pesa el plan, al final lo real;
   si ya se pasó del plan se espera solo un 30 % más), gastos fijos por su plan, ingresos pendientes al 92 %. Da rango y
   probabilidad de terminar en rojo.
2. **Base mensual:** promedio ponderado de hasta 12 meses (los recientes pesan más), su variación real y la tendencia
   (regresión lineal, amortiguada a la mitad y limitada a ±2 % mensual). Las cuotas de las deudas registradas se sacan de la base.
3. **Monte Carlo:** 1.000 escenarios a 6, 12 o 24 meses, con generador repetible (mismas cifras, mismo resultado):
   inflación (`SUPUESTOS.inflacion`, DANE), ajuste de ingresos en enero, temporadas de Colombia (diciembre +18 %, enero +8 %,
   febrero +3 %, junio +4 %), imprevistos (12 % de probabilidad al mes, 10 a 50 % del gasto), cada deuda con su tasa y su cuota,
   abono extra por avalancha o bola de nieve, y faltantes cubiertos con crédito a la tasa de usura (`SUPUESTOS.usura`).
4. **Resultados:** escenario más probable (mediana) y rango del 80 % del patrimonio (cuentas sin tarjetas menos deudas), fecha
   probable de cada deuda saldada, intereses, probabilidad de cada meta a su fecha, colchón final y riesgo de pedir prestado.
5. **Recomendaciones medidas:** cada sugerencia (recortar 15 % de gustos, abonar 100.000 más) se simula con los mismos
   escenarios para mostrar su efecto en pesos.
6. **¿Y si…?:** controles de recorte de gustos, abono extra, ingreso extra, prima de junio y diciembre, y horizonte.
7. **Para disfrutar sin culpa (`paraDisfrutar`):** lo que se puede gastar en gustos de hoy a fin de mes y cerrar en cero
   (cierre más probable más lo que falta proyectado en gustos), por día y por semana.
8. **Lo que aprendí de ti (`aprenderPatrones`):** sobre `state.movs` (cada movimiento con fecha, hora, categoría, valor y
   comercio; `anotarMov`/`quitarMov`, tope 1.500) de los últimos 120 días: día de la semana con más gasto, compras de noche,
   compras pequeñas, gasto en los días de pago, pagos que se repiten cada mes, lo que más disfruta, categorías cuyo plan se
   queda corto (con botón para ajustarlo) y la racha. Necesita 12 movimientos en 14 días; antes muestra el avance.
9. **Tono:** primero lo que va bien (`logros`), ideas en positivo, nada en rojo. Cada idea tiene una `clave`; "Me sirve" la
   sube y "No es para mí" la oculta (`state.asesor.si` / `state.asesor.no`, viajan en la copia cifrada).

Actualizar `SUPUESTOS` (inflación y usura) cada pocos meses con los datos del DANE y la Superfinanciera.

## Seguridad

- **Llaves secretas:** solo en variables de entorno de Netlify, nunca en el código. Netlify revisa cada publicación en busca de secretos expuestos.
- **Datos en reposo:** AES-256-GCM con una llave derivada (HKDF) de `CUENTAS_SECRET` o `LICENSE_SECRET`. Si el usuario activa su clave propia, el servidor solo guarda texto cifrado en el navegador (PBKDF2 con 310.000 iteraciones y AES-GCM).
- **Buzón de avisos:** cada aviso se cifra en el servidor con la llave pública RSA del dispositivo. Solo ese dispositivo puede leerlo.
- **Sesiones y códigos:** se guardan solo como hash. Los códigos vencen en 10 minutos y tienen límites de intentos (el intento se cuenta antes de comparar).
- **Google:** con ventana emergente en general; por redirección en iPhone con la app en el inicio (allí la ventana no puede volver a la app). La sesión nunca viaja en la dirección: se entrega un código de un solo uso.
- **Encabezados:** CSP, `X-Frame-Options: DENY`, HSTS, `Permissions-Policy`, `COOP` y `nosniff` (ver `netlify.toml`).
  - La CSP solo permite código del propio sitio y del inicio de sesión de Google.
  - `'unsafe-inline'` sigue en `script-src` porque Netlify inyecta la marca "Powered by Netlify" como script en línea en el plan gratis. Con un plan sin marca, reemplázalo por los hashes que imprime `python3 herramientas/csp.py`.
- **Librerías externas:** JSZip se sirve desde `public/vendor/`. No se carga código de CDN de terceros.
- **Dependencias:** `npm audit` corre en cada cambio y falla si hay vulnerabilidades altas.
- **Lectura de avisos (confianza):**
  - Códigos de seguridad: un número suelto de 4 a 8 cifras cerca de "código", "clave", "OTP" o "token" descarta el aviso entero,
    aunque mencione una compra (`esCodigoSeguridad` en la página y `Filtro.esCodigoSeguridad` en Android, con la misma regla).
    No cuentan montos, finales de tarjeta o cuenta, fechas ni teléfonos. En Android, `Filtro.tapar` además tapa números sueltos
    en avisos que hablan de claves.
  - Del aviso no se guarda el texto: cada movimiento en Por confirmar solo conserva valor, comercio, fecha, medio y una `pista`
    (palabras como Nequi o el nombre de una cuenta tuya) para sugerir la cuenta de un traslado. Los datos viejos se limpian al cargar.
  - Android 1.7: nunca lee apps de chat (`Filtro.CHAT`); la persona puede pausar la lectura y apagar SMS o correo (`Registro`);
    la pantalla **Tu privacidad** (`PrivacidadActivity`, enlace `fintelligente://privacidad` y acceso directo del ícono) muestra
    cuántos avisos se guardaron, cuántos códigos se bloquearon y cuántas notificaciones ni se abrieron, sin guardar textos.
  - Conectar bancos muestra "Cómo cuidamos tus avisos" (`tarjetaConfianza`); con la app 1.7 o superior (`?v=8`) enlaza a Tu privacidad.

## Bre-B

- El lector reconoce los pagos inmediatos de Bre-B (`esBreB`): envíos y pagos por llave, recibidos por llave y pagos con QR.
  El medio queda como "Bre-B" y el comercio es el nombre enmascarado (JUA*** PER***), la llave alfanumérica (@juanp),
  la llave de comercio ("Llave 0012345678") o el origen ("Bre-B desde Davivienda").
- El banco es el que avisa: primero el remitente o la app, después el prefijo "Banco X:" y al final el resto del texto.
- **Mensajes falsos (`esEstafa`, igual en la página y en `Filtro.esEstafa` de Android):** anuncian plata recibida o
  pendiente y piden entrar a un enlace. Un enlace con http, www, acortador, ruta, o un dominio que imita a un banco
  (bancolombia-seguro.com) cuenta como fuerte; los dominios oficiales (`DOMINIOS_OFICIALES`) no cuentan, y un dominio
  suelto de comercio (amazon.com) no basta. No se registran: la página muestra un aviso y Android 1.7 manda la
  notificación "Cuidado: parece una estafa" y lo cuenta en Tu privacidad.

## Salud técnica (errores y métricas)

- **Errores:** la página escucha `error` y `unhandledrejection` (sin contar fallas de red ni extensiones) y envía con
  `sendBeacon` a `/api/errores` el mensaje, las primeras líneas de la pila, la versión (`VERSION_APP`), el tipo de
  dispositivo y la pantalla. Máximo 5 por visita y uno por mensaje. El servidor (`netlify/lib/telemetria.mjs`) borra
  números, correos y lo que va después de ? en las direcciones, agrupa por huella (mensaje + función) y cuenta por día
  (`errores/AAAA-MM-DD` en el almacén `salud-app`, hasta 100 huellas por día).
- **Métricas:** `metrica(evento, "una" | "dia")` en la página, con un registro local para no repetir. Eventos: abrir,
  inicio, inicio_omitido, registro, aviso_auto, conecto, extracto, vio_premium, inicio_pago, asesor. Las cuentas nuevas y las compras aprobadas las cuenta
  solo el servidor (`alCrearCuenta` en cuentas y `alAprobar` en pagos), una vez y sin afectar el proceso. Con "No
  rastrear" o el Control Global de Privacidad no se envía nada. Se guardan contadores por día y tipo de dispositivo, sin IP
  ni identificadores (la IP solo se usa como huella para los límites de abuso).
- **Panel:** `/panel` (página `public/panel.html`, sin indexar) pide la clave `PANEL_CLAVE` y llama a `/api/panel`.
- **Avisos:** `vigia-cron` manda un correo cuando aparece un error nuevo (máximo uno cada 6 horas); `/api/salud` informa
  `erroresHoy`.
- **Limpieza:** `respaldo-cron` borra errores de más de 30 días y métricas de más de 400.

## Inicio guiado

- Quien llega por primera vez (con el ejemplo cargado y sin la bienvenida abierta) ve `dlg-inicio`: lo que le entra al mes,
  lo fijo (vivienda, servicios, deudas) y si quiere que los pagos se anoten solos. `repartoInicio` aplica 50/30/20; si lo
  fijo pasa del 50 %, reparte lo que queda 60/40 entre gustos y ahorro ("ajustado") o deja ambos en cero ("justo").
- Desde el 16 de noviembre de 2026 es a pantalla completa, igual al prototipo aprobado (`.inicio-full`): puntos de
  avance, flecha para volver (`#inicio-atras`) y "Saltar" (`#inicio-omitir`, "Cerrar" al rehacer). Pasos: 0 saludo con
  el logo y la moneda que cae (solo la primera vez; `inicioSaluda`), 1 cifra con − y + de a $ 100.000, cifras rápidas y
  perfil, 2 metas con casillas (varias; `inicioMetas` → `prefs.metasInicio`, la primera de ahorro nombra el ahorro o
  "Ahorro para mis metas" si son varias; `prefs.enfoque` es la primera), 3 lo fijo, 4 anotar solos, 5 "Así queda tu
  mes" con el anillo junto al reparto y el botón "Ver mi Finti" (o "Conectar mi banco"). Botones de 58 px abajo.
- `aplicarInicio` reemplaza el ejemplo por el presupuesto armado. La marca `fintelligente-inicio` ("hecho" u "omitido")
  evita que vuelva a aparecer; la tarjeta del ejemplo tiene el botón "Armar mi presupuesto".

## Importar el extracto

- `dlg-extracto` (menú lateral y Conectar bancos) lee un CSV o un Excel (.xlsx) **en el dispositivo**; no se sube nada.
  CSV: detecta el separador (; , tabulador o |) y respeta comillas. XLSX: JSZip + `sharedStrings` + la primera hoja.
  El .xls antiguo y el PDF se rechazan con instrucciones.
- `tablaExtracto` busca la fila de títulos en las primeras 40 filas: fecha, descripción y valor (o débito y crédito,
  o tipo D/C). Montos colombianos y de otros formatos (`montoExtracto`), fechas dd/mm/aaaa, aaaa-mm-dd, número de
  Excel y "5 nov. 2026" (`fechaExtracto`). Si una sola columna de valor viene sin signos, decide por la descripción.
- `analizarExtracto` salta lo ya registrado (huella o fecha + valor en `movs`), los traslados propios y pagos de
  tarjeta (`esTrasladoPropio`) y los retiros de cajero; limpia la descripción ("COMPRA EN", "PAGO PSE"…) y sugiere la
  categoría con el lector. `importarExtracto` anota cada movimiento en `movs`, suma al real de su mes (crea el mes si
  falta) y no toca saldos. En la versión gratis solo crea los últimos 3 meses; lo anterior queda en `movs` para el asesor.
  Si estaba el ejemplo, lo borra primero. Deshacer restaura la copia previa. `importados` guarda hasta 3.000 huellas.

## Códigos de regalo

- `netlify/lib/regalos.mjs` y `functions/regalos.mjs`. Almacén `regalos` (respaldado): clave `c/<sha256("regalo:"+código)>`
  con `{ id, pista (últimos 4), nota, creado, estado: libre | usado | anulado, usado: { t, ref } }`. El código no se guarda.
- `POST /api/regalos` (crear 1 a 200, `MAX_LOTE`, en grupos de 20 a la vez), `GET /api/regalos` (lista) y `POST /api/regalos/anular` piden `PANEL_CLAVE`
  (mismo control y límites que `/api/panel`). Formato `FIN-XXXXX-XXXXX` sin O, 0, I ni 1.
- `POST /api/regalo { codigo, email }` (público, 10 intentos por hora por IP): marca el código como usado con escritura
  condicional, crea en `pagos` un registro `{ estado: "APROBADO", origen: "regalo", monto: 0, email }` con una referencia
  `PRE-…` nueva y devuelve `{ ref, token }`. Desde ahí todo funciona como una compra (revisión diaria, guardar en la
  cuenta, activar en otro dispositivo con referencia y correo). Si falla el registro del pago, el código vuelve a libre.
  Métrica `regalo` (solo el servidor).
- En la app: `#web-regalo` dentro de Premium y el enlace `/#regalo=FIN-…` (`regaloDelEnlace`), que abre Premium con el
  código puesto. El inicio guiado no se abre encima.

- El panel agrupa por nota (útil para empresas: cuántos de sus códigos se activaron) y descarga la lista de un lote
  nuevo en CSV para Excel (código, enlace y nota).

## Invita y gana

- `netlify/lib/referidos.mjs` y `functions/invita.mjs`. Almacén `invitaciones` (respaldado): clave `i/AMIGO-XXXXXX`
  con `{ creado, ventas, refs: [referencias de pago], premios: [{ codigo, creado, ref }] }`.
- `POST /api/invita` crea el código y devuelve `{ codigo, llave }`; la llave es `HMAC(LICENSE_SECRET, "invita:"+código)`.
  `GET /api/invita?codigo=&llave=` muestra ventas y premios (con el estado de cada código de regalo). No se pide correo.
- La app guarda `{ codigo, llave }` en `state.invita` (viaja en la copia cifrada). Quien llega con `/#invita=AMIGO-…`
  queda marcado 60 días (`fintelligente-invita-de`) y `crear-pago` envía el código; si no existe, se ignora.
- Al quedar APROBADO un pago (`alAprobar(registro, ref)` en `pagos.mjs`, desde el webhook o la consulta de licencia),
  `trasAprobar` cuenta `premium_aprobado` y, si hay `invita`, `premiarInvitacion` crea un código de regalo
  (`crearRegaloInterno`) y lo agrega a los premios. Cada referencia de pago premia una sola vez; máximo `MAX_PREMIOS` (20)
  por código. Si dos procesos compiten, el código sobrante se anula. Métricas `invita` y `referido` (solo el servidor).
- Quien invitó ve sus premios en "Invita y gana Premium": "Activar para mí" (si no tiene Premium) o "Copiar" para regalar.

## Plantillas, independientes y Mi negocio

- Inicio guiado, paso 1: "¿Para quién es este presupuesto?" (`PLANTILLAS`: personal, estudiante, pareja, familia,
  independiente, negocio). Cambia los renglones de necesidades, gustos y ahorro. `state.prefs.perfil` la recuerda.
  "Rehacer mi presupuesto" (menú) vuelve a abrir el inicio sin perder lo gastado: lo real se conserva por categoría.
- Para independientes (`dlg-indep`): sueldo fijo (promedio de la mitad más floja de hasta 12 meses anteriores; colchón
  de 3 meses de necesidades), seguridad social (`calcSeguridad`: IBC 40 %, mínimo 1 y máximo 25 salarios mínimos; salud
  12,5 %, pensión 16 %, solidaridad 1 % desde 4 salarios, ARL riesgo I 0,522 %; constantes `SMMLV` y `SMMLV_ANO`, que hay
  que **actualizar cada enero**) y cuenta de cobro (se arma en `#informe` y se imprime o guarda en PDF; datos en
  `fintelligente-cobro`, solo en el dispositivo; cifra en letras con `enLetras`). Métrica `cobro`.
- Mi negocio (`dlg-negocio`): `state.negocio = { sueldo, movs: [{ id, f, t: v | g, cat, c, m }] }`, aparte de los
  movimientos personales. Ventas, gastos por categoría del negocio, ganancia, comparación con el mes anterior y sueldo
  sugerido (promedio de los meses más flojos). "Pasar mi sueldo a mi presupuesto" crea o actualiza el ingreso
  `neg-sueldo` del mes. Tarjeta `#trabajo-card` en Inicio para los perfiles independiente y negocio. Métrica `negocio`.
- Pregúntale entiende "¿cuánto vendí?" y "¿cuánto pago de seguridad social?"; la guía `trabajo` recorre las tres partes.

## Privacidad en el dispositivo, informe y alertas

- Modo discreto (`#btn-discreto`, el ojo): `marcarCifras` marca las cifras con `.cifra` y el CSS las difumina; se recuerda.
- Bloqueo con PIN (`dlg-privado`): `fintelligente-pin = { sal, h, min, largo, huella }`, con PBKDF2-SHA256 de 150.000
  iteraciones. Pantalla `#bloqueo` al abrir y al volver tras `min` minutos; tras 5 intentos fallidos, espera creciente.
  Huella opcional con WebAuthn (credencial del propio dispositivo). "Olvidé mi PIN" borra los datos de este dispositivo
  (la copia de la cuenta queda). Un script en línea al inicio de `<body>` pone `html.con-pin` para no mostrar nada antes.
- Informe del mes (`armarInforme`, `imprimirInforme`): se arma en `#informe` y `@media print` oculta todo lo demás.
  Métricas `pin` e `informe`.
- Alertas (`calcularAlertas`, tarjeta `#alertas-card`): suscripción que subió, cobro duplicado, categoría disparada,
  cobro mensual nuevo y gasto fuera de lo normal, con `recurrentes()` sobre `state.movs`. Las descartadas se guardan en
  `fintelligente-alertas-vistas`. Pregúntale responde "¿hay algo raro?" y "¿qué suscripciones tengo?".

## Para empresas

- Página `/empresas` (`legal/empresas.html`, generada con `herramientas/legal.py`): beneficio de bienestar financiero.
  Se venden lotes de códigos de regalo con el nombre de la empresa en la nota; el panel muestra la activación por nota.
  La empresa nunca recibe datos de sus empleados.

## Notas a la vista

- `#notas-vista` va después del resumen en Inicio (en celular también, con `order: 2`): muestra hasta 3 notas del mes
  (alertas y recordatorios primero), "Ver las N notas" y "+ Nota", que llevan al panel de notas.
- Ofrece los recordatorios e ideas del mes anterior que no están en este (`notasPasadas`): Traer los copia; × los descarta
  en este dispositivo (`fintelligente-notas-descartadas`, máximo 100).

## Pregúntale a Finti

- Conversación local, sin IA externa ni red (`dlg-preguntas`, tarjeta `#preg-card` en Inicio y menú lateral). Gratis.
- `prEntender`: normaliza la frase y saca intención (lista `PR_INT`: gasto, top, disponible, alcanza, cierre, comparar,
  ahorro, metas, deudas, pagos, hormiga, hábitos, salud, ingresos, ayuda, saludo), categoría (`PR_SIN`: sinónimos como
  comida, uber, luz, rappi…; nombres de categorías y conceptos del mes), comercio (de `movs`), periodo (`prPeriodo`: hoy,
  ayer, esta semana, últimos N días, mes pasado, nombres de meses, el año) y monto (`prMonto`: $ 300.000, 300 mil,
  1,5 millones, medio palo, lucas).
- Contexto: `PR.ctx` guarda la última intención para seguimientos ("¿y en transporte?", "¿y el mes pasado?").
  `PR.espera` guarda lo que se preguntó (un monto, un sí o no). Preguntas de uso de la app (`PR_COMO`) responden y ofrecen
  la guía. Si no entiende, propone las preguntas de `PR_EJ` más parecidas.
- Los cálculos reutilizan `totalsOf`, `cierreMes`, `paraDisfrutar`, `estadoPago`, `aprenderPatrones` y `puntaje`; cada
  respuesta con cifras muestra "Así lo calculé". `window.FinPreguntas.entender` existe para las pruebas. Métrica `pregunta`.

## Guías (Aprende a usar la app)

- `GUIAS`: 13 guías cortas (lo básico, registrar, presupuesto, notas, bancos, extracto, pagos, metas, análisis,
  preguntas, Excel y cuenta, Premium, independientes y negocio). Cada paso: selector (o lista, se usa el primero visible), vista a la que va,
  `antes` (abre una ventana) y `cierra` (ventanas que se cierran al terminar o salir).
- `#guia-capa` (z-index 120) con `#guia-luz` (recorte con sombra) y `#guia-globo`. Teclado: flechas y Escape (en fase de
  captura, para que no cierre otras ventanas). Las vistas se guardan en `fintelligente-guias`. Métricas `guia` y
  `guia_completa`. Al terminar el inicio guiado se ofrecen las guías.

## Identidad visual (etapa 1 de Finti)

- Letras: Unbounded (títulos y cifras, `--font-display`) y Manrope (texto, `--font-body`), desde Google Fonts. Unbounded es
  más ancha que la anterior (Outfit), así que los tamaños grandes bajaron cerca de 14 %.
- Cifras que caben: `ajustarCifras()` encoge el tamaño de `.tile .value`, `.hero-amount`, `.stk b` y `.acct .bal` cuando la
  cifra no cabe (mínimo 10 px). Se recalcula al cambiar el texto (MutationObserver), el ancho (ResizeObserver) y al cargar las letras.
- Temas: Vibrante (por defecto), Eléctrico, Jade y Lima nocturna, gratis, primeros en `THEMES`. Cobalto sigue disponible.
  `prefs.idv = 2` marca la identidad nueva: quien tenía Cobalto sin esa marca pasa una sola vez a Vibrante; quien elige
  Cobalto después lo conserva. El color propio (Premium) parte de Vibrante.
- `CAT_COLOR` y `EXTRA_COLORS` usan los colores de identidad (validados para daltonismo). En modo claro, el ícono de
  categoría mezcla su color con la tinta (62 %) para que el amarillo, la lima y el cielo se vean sobre fondo claro.
- Resorte al tocar: Web Animations en `pointerdown` (se hunde a 0,94; 0,98 en elementos de más de 240 px) y al soltar rebota
  (420 ms, `cubic-bezier(.34,1.56,.64,1)`). No se activa con "reducir movimiento"; `data-sin-resorte` lo apaga en un bloque.
  Marca `data-resorte` en `<html>`.
- Desde el 16 de noviembre de 2026 el nombre visible es Finti (pedido del dueño). Siguen igual el paquete de Android
  (co.fintelligente.app), el dominio, las claves del navegador (fintelligente-…), los almacenes y la API.
- Prueba: `pruebas/navegador/identidad.test.js`.

## Inicio nuevo y Cuéntame un gasto (etapa 2 de Finti)

- Saludo en primera persona (`renderSaludo`): hora del día y ritmo del mes. Con plan del día a día compara lo que queda de él
  con lo proporcional a los días que faltan; sin ese plan, el gasto frente a lo que entró.
- Hoy puedes gastar (`hoyPuedes`): gastos sin día fijo y que no son ahorro. (plan − (real − gastado hoy)) ÷ días que faltan
  contando hoy, menos lo gastado hoy (movimientos de hoy de esas categorías). Solo en el mes actual. Barra verde, ámbar desde
  el 85 % y rosa al pasarse.
- Anillo de "¿En qué se va tu plata?": puntas redondeadas (cada tramo descuenta el grosor y 4 de respiro), se dibuja al
  abrir. Debajo, tarjetas de color por categoría con lo gastado y una barra contra lo planeado.
- Pasarse se ve rojo con rayas (anillo, tarjetas, tablas y Análisis) para no confundirlo con colores cálidos.
- Movimientos: cada fila lleva `--c` de su categoría (ingresos en verde) y una barra de uso en la diferencia.
  Metas: anillo de avance en amarillo moneda, verde al cumplirse. Pagos: la cajita de la fecha en el color de la categoría.
- Cuéntame un gasto (`#dlg-charla`, `abrirCharla`): entiende "$ 18.000 en almuerzo", "pagué un taxi de doce mil",
  "cinco lucas", "me pagaron 50.000" (`chNumeros` pasa números en palabras a cifras; luego `prMonto` y `prCat` de Pregúntale,
  más el vocabulario `CH_VOCAB`). Pide lo que falte (monto o categoría), muestra lo que entendió y anota al confirmar:
  suma al concepto del mes (el que se llame igual o el primero sin día fijo de esa categoría), registra el movimiento con
  el texto dicho y mueve la cuenta (Efectivo por defecto). Se puede deshacer. `window.FinCharla.entender` para pruebas.
- Categoría (`chCategoria`), en este orden: palabras que aprendió de la persona (`state.reglas`, las mismas que usan los
  avisos del banco), `CH_VOCAB` (unas 600 palabras y comercios de Colombia por categoría, en minúsculas y sin tildes; cada
  una vale en plural y gana la coincidencia más larga), la lista de comercios del lector (`COMERCIOS`) y por último `prCat`
  (nombres de categorías y conceptos del mes). Si tuvo que preguntar la categoría o la persona la corrigió, guarda
  palabra → categoría en `state.reglas` y lo dice ("Aprendí algo"). Pregúntale usa el mismo vocabulario solo cuando la
  pregunta habla de plata (gasté, pagué, cuánto…), para no adivinar en frases sueltas.
- Charla, versión 2 (`chEntender`, `chEntenderTodo`, `chUsuario`): cada gasto es un ítem `{t, m, cat, c, f, cuenta, comp, quien}`.
  - Fecha (`chFecha`): hoy, ayer, antier, hace N días, el sábado, el 10 (de noviembre). Nunca futura ni de hace más de 60 días;
    el gasto va a la tabla del mes de esa fecha si existe.
  - Cuenta (`chCuentaDe`): "con Nequi", "con la tarjeta", "en efectivo"; gana el nombre de una cuenta propia. "de"/"en" solo
    para billeteras, para que "la cuota de la tarjeta" no se tome como medio de pago. Sin cuenta dicha, Efectivo.
  - Varios en una frase (`chPartes`): separa por "y", comas, "más", "también", solo si cada parte trae monto
    ("treinta y cinco" no se parte; "pan y leche 8 mil" es uno). Fecha y cuenta dichas una vez valen para todos.
  - Corregir en la confirmación: "no, el taxi eran 15 mil", "ponlo en transporte", "fue con Nequi", "fue ayer", "es un ingreso".
    Con varios, se corrige el que se nombra (o el último). Corregir la categoría también la aprende.
  - Compartidos (`chCompartido`): "la mitad es de Juan", "entre tres con Ana y Luis", "a medias con Camila". Se anota tu parte
    como gasto, la cuenta baja por el total y el resto queda en `state.meDeben` ({id, quien, m, c, f}). "Le presté 50 mil a
    Pedro" (sale de la cuenta, sin gasto) y "Pedro me debe 20 mil" (sin mover cuentas) también van ahí. "Juan me pagó"
    (`chMePago`) suma a la cuenta y salda lo de esa persona (parcial si dice un monto menor). Panel Te deben en Cuentas.
  - Cuadre de billetera (`chCuadre`): "tengo 45 mil en la billetera" compara con Efectivo; si falta plata pide en qué se fue
    (lo que se anote cuenta), o "No me acuerdo" (gasto en Otros) o "Solo ajustar el saldo"; si sobra, ingreso o ajuste.
  - Gastos de siempre (`chFrecuentes`): mismo concepto y valor dos o más veces en 90 días; botones al abrir y "Como siempre"
    al pedir el monto. "Lo mismo de ayer" repite los gastos de ayer con fecha de hoy.
  - Deshacer revierte todo lo del último guardado (filas, cuentas, movimientos, palabras aprendidas, Te deben, ajustes).
  - Si el efectivo queda en negativo, lo dice y ofrece cuadrar.
- Palabras que aprendí (`#dlg-aprendidas`, menú): lista de `state.reglas` con su categoría; se puede cambiar o borrar.
- Pregunta de cada noche por el efectivo: casilla en Avisos (`avDev.efectivo` → perfil `efectivo`). El servidor
  (`planificar` en `netlify/lib/avisos.mjs`) la manda una vez al día a la hora elegida, solo por notificación (nunca por
  correo), con `url: "/#accion=charla"`, y en esos días reemplaza el recordatorio general de registro. La charla la ofrece
  después del primer registro. En la app de Android llega por las notificaciones web de Chrome, como los demás avisos.
- Foto de la tirilla: botón de cámara en la charla (`<input type=file capture>`), lector Tesseract.js 7 alojado en
  `public/ocr/` (worker, núcleo LSTM con y sin SIMD, español `best_int`, cerca de 8 MB; se descarga solo al usarlo y queda
  en caché). La imagen se achica a 1600 px y se pasa a grises en un canvas. `leerTirilla` toma el comercio (primeras líneas
  sin NIT ni dirección), el total (prioridad: total a pagar > total > pago; ignora subtotal, IVA, cambio) y la fecha
  (dd/mm/aaaa). Requiere `'wasm-unsafe-eval'` en el CSP y `application/wasm` para `/ocr/*.wasm` (netlify.toml).
- Widget de Android (`WidgetEfectivo`, `res/layout/widget_efectivo.xml`): micrófono (VozActivity) y Escribir
  (accion=charla). No muestra cifras.
- `Permissions-Policy` permite el micrófono solo al propio sitio (`microphone=(self)`), para la voz en el navegador.
- Voz, solo en el dispositivo: en la app de Android 1.8 (versión 9 o más) el micrófono abre `fintelligente://voz` →
  `VozActivity` (`SpeechRecognizer.createOnDeviceSpeechRecognizer`, Android 12+). En el navegador, solo con
  `SpeechRecognition` y `processLocally = true` (si el español no está descargado, se ofrece descargarlo). Si no hay
  reconocimiento en el dispositivo, no se muestra el micrófono. Nunca se usa el reconocimiento por servidor.
- Desde Android, la página recibe `#accion=charla&dicho=<base64url>`; `leerDicho` lo lee y se borra de la dirección.
- Prueba: `pruebas/navegador/charla.test.js`.

## Registro rápido y sonidos (etapa 3 de Finti)

- Registro rápido (`#dlg-add`): campo "Escríbelo" que usa `chEntender` (monto, concepto, categoría, cuenta, fecha) y llena el
  formulario; muestra "Entendí: …". Si detecta un gasto compartido, ofrece pasarlo a la charla. El movimiento guarda el
  concepto escrito (`addDicho`) y la fecha dicha (`addFecha`); la fila es la del mes que se está viendo.
- En celulares (`pointer: coarse`) hay teclado grande propio (`#add-teclado`: 1–9, 000, 0, borrar) y el campo del monto
  usa `inputmode="none"`; en computador se escribe con el teclado. Botones con los gastos de siempre (`chFrecuentes`).
  Conceptos y categorías son burbujas (`.pick.burbuja`) con el color de la categoría.
- Sonidos (`sonar(que)`): Web Audio generado, sin archivos; vibración con `navigator.vibrate`. gota = gasto, monedas =
  ingreso, meta = arpegio (dentro de `celebrar`, con el confeti), cerca = dos notas (categoría desde 85 %), calma = acorde
  lento (categoría pasada), soplo = abrir registro o charla, soplo-inv = deshacer en la charla, nota = tocar una categoría
  del anillo (pentatónica). Suenan desde `anotarMov` (todo movimiento nuevo), con un mínimo de 260 ms entre iguales.
  Preferencia `prefs.sonidos` (por defecto sí), interruptor en Colores y modo. No suenan con la página oculta.
- Concepto de la charla: se conservan los conectores entre palabras con sentido ("corte de pelo", "mercado en el Éxito").
- Prueba: `pruebas/navegador/registro-sonidos.test.js` (anota las vibraciones para saber qué sonó).

## Calendario de pagos, bienvenida animada y paleta propia (etapa 4 de Finti)

- Calendario (`#calpag`, `renderCalPagos`) arriba de Cuentas por pagar: mes con semana desde el lunes, un punto del color de
  la categoría por cada pago (`venceEnMes`: mensual, anual o única; como `estadoPago`, no cuenta lo que vencía antes de crear
  la cuenta), hoy marcado, día pagado con chulo y vencido con borde rojo. Tocar un día filtra la lista (`calDia`, "Ver
  todos"); flechas para otros meses. Resumen del mes y aviso anticipado si una categoría se pasaría con los pagos que faltan
  (no cuenta dos veces un pago cuyo gasto ya se anotó con el mismo nombre).
- Bienvenida animada: logo en línea (`.logo-vivo`) en la pantalla de entrada; en el inicio guiado, el logo F con
  `iniLogo` e `iniMoneda`; el cuadro entra con resorte y la moneda cae (`lvResorte`, `lvMoneda`); textos en cascada. Los pasos del inicio guiado se deslizan hacia
  adelante o hacia atrás (`.va`, `.vuelve`). En "Así queda tu mes" el anillo (necesidades violeta, gustos rosa, ahorro
  amarillo) se dibuja tramo por tramo, las barras crecen, la cifra de hoy rueda y hay confeti con su sonido.
  Con "reducir movimiento" no hay animaciones (regla global).
- Colores de tus categorías (Colores y modo): `prefs.catColores` {categoría: color}; `catColor` lo usa primero. 14 muestras;
  aviso si dos categorías quedan a menos de 22 de distancia de color (CIE Lab), solo si al menos una la eligió la persona.
  "Volver a los colores de la app" lo borra. Gratis.
- Prueba: `pruebas/navegador/etapa4.test.js`.

## Detalle de categoría, pestañas y gestos (tanda 1)

- `#dlg-cat` (`abrirCategoria(id, desde)`): crece desde lo que se tocó (WAAPI), historial de 6 meses en SVG, filas y
  movimientos del mes. Se abre desde la leyenda del anillo del Inicio y desde `#cat-list` en Análisis.
- Pestañas: `irA` guarda `vistaActual` y `body[data-vista]`; la vista entra por la derecha o por la izquierda (`entra-der`,
  `entra-izq`). En el Inicio se oculta el título del presupuesto.
- Por confirmar: deslizar a la derecha (más de un tercio del ancho) confirma, a la izquierda descarta (pointer events sobre
  `#bandeja-lista`). Letra grande: `prefs.letraGrande` (Colores y modo), `:root.letra-grande { zoom: 1.16 }`.
- Prueba: `pruebas/navegador/tanda1.test.js`.

## Tu mes contado y Tu año (etapa 5 de Finti)

- `#dlg-historia`: historias a pantalla completa con barras de avance; avanzan solas cada 5,5 s (no con "reducir
  movimiento"), se tocan los lados para ir y volver, mantener presionado pausa, Escape cierra y el foco vuelve a donde estaba.
- `resumenPeriodo(keys)` calcula todo en el dispositivo: categorías, estrella (la que dejó más plata sin gastar frente al plan,
  sin contar Otros), ahorro, días anotados y racha. Tu año usa todos los meses del año y nombra el mejor mes.
- "Compartir sin montos": imagen de 1080 × 1920 en canvas solo con porcentajes y logros; `navigator.share` con archivo o descarga.
- Entradas: tarjeta del Inicio (`#hist-play`: desde el día 20 o en meses pasados; en diciembre y hasta el 15 de enero ofrece
  el año) y el menú. Ver la última historia gana el logro "Tu mes contado".
- Prueba: `pruebas/navegador/historias.test.js`.

## Inicio con ánimo, Tu día, pronóstico, ¿Y si…?, carta del domingo y temporada (tanda 3)

- Saludo con `data-animo` (bien, calma, rápido, neg, nuevo) y mascota: la F con su moneda, que crece del 0 al 30 % de ahorro
  (`renderMascota`). En diciembre y hasta el 6 de enero (`esTemporada`) la F lleva gorro y cae nieve; `prefs.temporada` lo apaga.
- Tu día (`renderTuDia`): lo anotado hoy en orden con la hora (`horaTxt`: "8:00 a. m.", "12:00 m.") y los pagos que vencen hoy.
- Pronóstico (`pronostico`): gasto real + ritmo del día a día × días que faltan + lo que falta de los gastos con día y del
  ahorro. Gráfica SVG con lo acumulado, la proyección punteada y la línea de lo que entra; al tocarla muestra cada día.
- ¿Y si…? (`#dlg-ysi`): recortar una categoría (ahorro a 3, 6 y 12 meses, nuevo porcentaje y cuándo se completaría una meta)
  o una compra (cómo queda el día a día y una idea para apartarla en cuotas). No cambia los datos.
- Carta del domingo (`cartaSemana`): domingo y lunes, la semana contada (gasto frente a la anterior, categoría principal, días
  anotados). "Gracias" la guarda en `prefs.cartaVista`; el menú muestra la de la semana pasada cuando sea.
- Prueba: `pruebas/navegador/tanda3.test.js` (con el reloj fijado en un domingo de diciembre y en un miércoles de noviembre).

## Quincena, redondeo, recibos, retos con amigos, aviso de la mañana y medallas (tanda 4)

- Quincena: `prefs.diasPago` (hasta 3 días; `[0]` = no quiere). `proxPago` busca la próxima fecha (el 30 en febrero cae el
  último día) y el anillo muestra el avance desde el pago anterior. No aparece con datos de ejemplo.
- Ahorro por redondeo: `prefs.redondeo`, `prefs.redondeoA` (1.000, 5.000 o 10.000). `anotarMov` guarda la diferencia en el
  movimiento (`rd`) y en `state.alcancia[mes] = { j: juntado, p: pasado }`; `quitarMov` la devuelve. "Ya lo pasé a mi ahorro"
  suma lo juntado a la fila de ahorro del mes (o crea "Ahorro por redondeo"). La plata de verdad la mueve la persona.
- Escanear recibo (`#dlg-recibo`): `BarcodeDetector` (code_128, itf, ean_13) con la cámara trasera; sin él, se escriben los
  números. `leerGS1` entiende el formato de las facturas de servicios: (415) empresa, (8020) referencia, (3900) valor y
  (96) fecha límite, con o sin paréntesis (separador GS). Crea una cuenta por pagar única en Servicios y recuerda el nombre de
  la empresa por su número (`localStorage` `fintelligente-empresas`). Permissions-Policy: `camera=(self)`.
- Retos con amigos: `/api/retos` (`netlify/lib/retos.mjs`, almacén `retos`). Lista fija de retos (domicilios 7 días, anotar 14,
  antojos 7, café 10). Se guardan apodos, inicio y días marcados; la llave de cada quien solo como huella. Máximo 12 personas,
  10 retos por hora por conexión, la fecha del celular debe estar a un día o menos de la del servidor. `limpiarRetos` (en el
  respaldo diario) borra los que terminaron hace más de 30 días. En la app: `fintelligente-retos` en `localStorage`, enlace
  `/#reto=RETO-XXXXXX`. Prueba: `pruebas/retos.test.mjs`.
- Aviso de la mañana: `avDev.manana` viaja al perfil de avisos (`manana: true`); a las 7 a. m. locales (`HORA_MANANA`) el servidor
  manda un push genérico con `tag: "manana"`, sin cifra, que no gasta el cupo del día ni va por correo. El service worker lee
  `cupo` en IndexedDB (`fintelligente-datos`, lo escribe `guardarCupo` en cada guardado: plan y gasto del día a día del mes) y,
  solo si la persona marcó `av-cifra`, muestra "Hoy puedes gastar $ …". Pruebas: `avisos.test.mjs` y `sw.test.mjs`.
- Medallas: `medalla(l, ganado)` dibuja cada logro (cinta y disco con sus colores en `MEDALLA`; candado si falta). Logros nuevos:
  Centavo a centavo (pasar $ 20.000 del redondeo), Tu mes contado y Mejor en equipo (cumplir todos los días de un reto).
- Prueba: `pruebas/navegador/tanda4.test.js` (con `/api/retos` simulado).

## Buscar, informe, velocidad y accesibilidad (tanda 5)

- Buscar movimientos (`#dlg-buscar`, `buscarMovs`): palabras en concepto, comercio y categoría; valor con tolerancia del 2 %
  (mínimo $ 500); mes por su nombre; filtro de gastos o ingresos. Desde el menú y desde Movimientos (`#bs-entrada`).
- Informe del mes (`armarInforme`): identidad nueva, "Lo mejor del mes" (de `resumenPeriodo`), gráfica de real frente a lo
  planeado por categoría y ahorro de los últimos 6 meses. Se imprime o se guarda como PDF desde el navegador.
- Velocidad: las cifras que se encogen para caber (`ajustarLote`) se miden en lote y, mientras una cifra se anima, se espera a
  que se quede quieta (140 ms) en vez de recalcular la página en cada cuadro. Con la CPU 4 veces más lenta, el primer
  contenido aparece en unos 0,5 s. Lo que más pesa es el script principal (unos 680 KB sin comprimir).
- Accesibilidad: `pruebas/navegador/accesibilidad.test.js` corre axe-core (WCAG 2.1 A y AA) en las vistas y ventanas nuevas,
  en modo claro y oscuro. Ajustes: contraste de los chips ámbar y Premium, fondo del día en el calendario de pagos
  (`--c-cal`), y nombres accesibles que coinciden con el texto visible (categorías de Análisis y temas).
- Script aparte: `construir.py` publica el script principal como `/app.js?v=<huella de 12 caracteres>` (caché de un año en
  `netlify.toml`, la huella cambia con cada versión). Así Chrome guarda el código ya compilado entre visitas: con la CPU 4 veces
  más lenta, la carga bajó de unos 0,9 s a 0,7 s y la tarea larga del arranque, de unos 400 ms a 220 ms. El service worker
  guarda la última versión de `app.js` para abrir sin conexión (`pruebas/navegador/sin-conexion.test.js`).
- Widget de Android "Hoy puedes gastar" (`WidgetHoy`): abre el Inicio de un toque. No muestra la cifra: los datos viven en la
  parte web y no deben quedar a la vista en la pantalla de inicio.

## Ortografía

`python3 herramientas/ortografia.py` revisa los textos de la página, las páginas legales, los correos y la app de Android con las
normas de la RAE que más se equivocan: minúscula después de dos puntos, abreviaturas con punto (E. A., nov., a. m.), sin "mil"
ni "M" junto a cifras, porcentaje con espacio, sin punto después de ? o !, tildes que ya no van y comillas dobles. Corre en
`npm test` y en GitHub Actions. La guía completa está en el documento del proyecto `guia-ortografia.md`.

## Variables de entorno

| Variable | Obligatoria | Para qué |
|---|---|---|
| `SITE_URL` | Sí | Dirección pública del sitio |
| `LICENSE_SECRET` | Sí | Firma de licencias; también cifra los datos si no hay `CUENTAS_SECRET`. **No cambiarla:** los datos cifrados dejarían de abrirse. |
| `CUENTAS_SECRET` | No | Llave propia para cifrar cuentas (si se define antes de tener usuarios) |
| `RESPALDO_SECRET` | No | Llave de los respaldos (si no existe, usa la de cuentas) |
| `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET` | Sí | Pagos |
| `PRECIO_COP` | Sí | Precio de Premium |
| `GOOGLE_CLIENT_ID` | No | Inicio de sesión con Google |
| `SMTP_USER`, `SMTP_PASS` (`SMTP_HOST`, `SMTP_PORT`) | No | Correos (códigos, recordatorios, alertas) con Gmail u otro SMTP |
| `RESEND_API_KEY`, `AVISOS_REMITENTE` | No | Alternativa a SMTP (requiere dominio) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | No | Notificaciones push |
| `ENTRADA_SECRET`, `ENTRADA_DOMINIO` | No | Correo entrante con el trabajador de Cloudflare |
| `ATAJO_IOS_URL` | No | Enlace de iCloud del atajo de iPhone |
| `ALERTAS_CORREO` | No | A quién avisar si algo falla |
| `PANEL_CLAVE` | No | Clave del panel (/panel) y de los códigos de regalo; mínimo 16 caracteres |
| `CORREO_TOPE_DIA` | No | Tope de correos por día (por defecto 450 con Gmail) |
| `DIRECCION_NUEVA` | No | Dominio nuevo al que se muda la app (activa la mudanza automática) |
| `PRECIOS_CLAVE` | No | GitHub Actions la usa para mandar los precios del DANE a `/api/precios`; el mismo valor va como secreto `PRECIOS_CLAVE` en GitHub. Mínimo 16 caracteres |

## Respaldos

- `respaldo-cron` guarda cada día un archivo cifrado (gzip + AES-256-GCM, formato `FTR1`) en el almacén `respaldos` y conserva 30 días.
- Desde un computador, con `NETLIFY_SITE_ID`, `NETLIFY_AUTH_TOKEN` y la llave del respaldo:
  - `node herramientas/respaldos.mjs listar`
  - `node herramientas/respaldos.mjs descargar`: copia fuera de Netlify. Se recomienda una vez por semana.
  - `node herramientas/respaldos.mjs ver archivo.ftr`
  - `node herramientas/respaldos.mjs restaurar archivo.ftr --confirmar [--solo cuentas-datos]`
- **Límite conocido:** las funciones programadas tienen 30 segundos. Con miles de usuarios, conviene pasar el respaldo a una función en segundo plano (hasta 15 minutos) o respaldar por almacén.

## Monitoreo

- `/api/salud` responde 200 si pagos, cuentas y datos funcionan, y 503 si no. Conéctalo a un monitor gratuito (por ejemplo UptimeRobot) para saber si el sitio entero se cae.
- `vigia-cron` revisa cada hora y escribe a `ALERTAS_CORREO` si fallan los pagos, las cuentas, los datos o el respaldo diario (máximo un correo cada 6 horas por la misma falla).

## Android

- Paquete `co.fintelligente.app`, firmado con `fintelligente.jks` (alias `fintelligente`). La llave **no** está en el repositorio.
- SHA-256 del certificado: `A8:4B:E5:CE:1D:18:F9:A6:35:77:DC:B4:94:7B:88:41:D9:FD:D5:1E:A5:B2:7F:DA:DC:E8:55:E9:12:D3:02:74`. Debe coincidir con `public/assetlinks.json`.
- Compilar firmado: `FIN_KEYSTORE=/ruta/fintelligente.jks FIN_KS_PASS=… ./gradlew :app:assembleRelease :app:bundleRelease`.
- Simulación: `./gradlew -Psim :app:testReleaseUnitTest` (Robolectric, 23 escenarios).
- Avisos que no supimos leer: si una app de banco (nunca SMS ni correo) manda un aviso con dinero que `Filtro.motivo`
  descarta como "sin-dinero" y no es saldo, recordatorio, publicidad ni código (`Filtro.noEntendido`), se guarda tapado
  (`Filtro.ocultar`: sin claves y con los números largos reducidos a los últimos 4) en `Registro`, máximo 10 y 30 días.
  Tu privacidad los muestra con Compartir (menú de Android) y Borrar. Nada se envía solo.
- Botón Efectivo (ajustes rápidos, `EfectivoTile`) y micrófono de la página: abren `VozActivity`, que escucha con el
  reconocimiento del teléfono (permiso `RECORD_AUDIO`, el audio no se guarda ni sale) y pasa el texto a la página en
  `accion=charla`. Sin reconocimiento en el dispositivo (Android 11 o menos), abre la charla para escribir.
- Widgets: Cuéntame un gasto (`WidgetEfectivo`, micrófono y Escribir) y Hoy puedes gastar (`WidgetHoy`, sin cifra). Versión 1.9 (10).
- La dirección del sitio está en `android/app/src/main/res/values/strings.xml` (`sitio` y `asset_statements`). Si cambia el dominio, hay que cambiarla ahí, en `assetlinks.json` y publicar una versión nueva.

## Pendientes conocidos

- Dominio propio: al cambiarlo hay que actualizar `SITE_URL`, los orígenes y la URL de redirección de Google, la URL de Wompi, la app Android y `assetlinks.json`, y luego activar `DIRECCION_NUEVA` (ver Mudanza).
- Copia de los respaldos fuera de Netlify: hoy es manual (`herramientas/respaldos.mjs descargar`).
- Revisión de seguridad externa (pentest) antes de una venta o de manejar volumen alto.

## Material para la tienda y cambio a Finti

- `herramientas/material-tienda.cjs`: con el servidor de pruebas corriendo, toma capturas con datos de muestra y arma las seis
  piezas de 1080 × 1920 y el gráfico destacado de 1024 × 500 en `material-tienda/`. `videos-tienda.cjs` filma la app (screencast
  de Chrome) y arma dos videos verticales de 30 cuadros por segundo con ffmpeg. Los dos toman el nombre de `manifest.webmanifest`.
- `herramientas/cambiar-a-finti.py`: sin opciones solo muestra qué cambiaría. `--aplicar iconos` (sirve también con el nombre
  actual), `--aplicar nombre`, `--aplicar todo`; `--legal` incluye los documentos legales. No toca el paquete de Android, el
  dominio, las claves del navegador, los almacenes ni la API. Probado en una copia: construye y las pruebas pasan.


## Diseño de Finti (16 de noviembre de 2026)

- Nombre: se aplicó `cambiar-a-finti.py --aplicar nombre --legal` (también a la fuente y a `legal/*.html`; `legal/datos.json`
  tiene `"marca": "Finti"`). Ficha de Google Play, capturas y videos de la tienda regenerados con el nombre nuevo.
- Modo oscuro por defecto: `prefs.modo` vale "oscuro" si no hay elección guardada (quien ya eligió "auto" lo conserva).
  `manifest.webmanifest` usa fondo #0f0f14. Pantalla de carga `#arranque` (la F y la moneda); se quita en `finishLoad` y,
  si algo falla, se esconde sola a los 3 s. No recibe toques.
- Íconos a dos tonos: cada símbolo tiene el trazo y un relleno suave (`fill-opacity=".28"`). 26 íconos nuevos para las
  categorías propias (`ICONOS_PROPIOS`: mascotas, viajes, regalos, belleza, gimnasio, hijos, café, gasolina, tecnología,
  ropa, impuestos, seguros, donaciones, juegos, música, libros, carro, arreglos, domicilios, parqueadero, droguería,
  trabajo, celular, bebé, lavandería, celebraciones). `adivinarIcono(nombre)` lo elige por el nombre; se cambia en
  Categorías propias (`categorias[].ic`). `iconoDeCat(id)` decide el ícono en toda la app.
- Barra de abajo (`#barra`, solo hasta 760 px): Inicio, Movimientos, registrar (botón central, `#barra-registrar`), Metas
  y Más (abre el menú lateral; queda marcado en Cuentas y Análisis). La luz de la pestaña (`#barra-luz`) se mueve con
  resorte; se mide con `getBoundingClientRect` después de dos cuadros. En celular se ocultan ☰ y + de arriba.
  `navigator.vibrate` corto al tocar (respeta sonidos apagados). La barra sube si aparece la marca de Netlify.
- Inicio: "Tus categorías" (`renderTarjetasCat`), tarjetas del color de cada categoría con lo que queda o cuánto se pasó;
  `fondoLegible` oscurece el fondo si ni la tinta oscura ni la blanca llegan a 4,5 : 1. La leyenda del anillo pasó a
  píldoras.
- Movimientos: "Lo que anotaste" (`renderPorDia`), los `movs` del mes por día con el total de cada día.
- Metas: cada meta es una alcancía (`.goal-jar`) que se llena con una ola; la primera vez sube y cae una moneda (`jarVisto`).
- Pantallas vacías: todo `p.empty` muestra la F flotando.
- Transiciones: las vistas entran con resorte y desenfoque, y sus bloques suben en cascada; las hojas suben desde abajo;
  las ventanas del centro aparecen con resorte; el menú entra con sus opciones en cascada; botones y teclas se hunden.
  `html, body` y `.wrap` usan `overflow-x: clip`: antes, la animación de entrada ensanchaba la página y el celular
  achicaba la vista. Con "reducir movimiento" no hay animaciones.
- Ventanas: botón principal `.btn.primary.big` de 58 px como el setup; teclado del registro con teclas redondeadas y la
  cifra que salta al escribir.
- Pruebas: `finti-diseno.test.js` (nueva), `barra-lateral` (parte de celular reescrita), `identidad` (oscuro por defecto),
  `ancho-celular` (no mide lo que está dentro de la barra fija). Las pruebas que abrían ☰ o + en celular usan la barra.

## Parte legal de Finti (16 de noviembre de 2026)

- Paquete para el abogado: documento "Finti: paquete legal para el abogado" (https://claude.ai/artifact/Un1d3H1nwwtryoUA2xGn3G), con
  pestaña de borradores (acuerdo entre socios, manual interno de datos, protocolo de incidentes, contrato para empresas).
- Documentos legales en la versión 1.1 (`legal/datos.json`); `LEGAL_V = "1.1"` en la app, así que quien aceptó la 1.0 vuelve a aceptar.
  `datos.json` tiene `nit` (uno por responsable, en el mismo orden): mientras esté vacío, `legal.py --revisar` avisa "Faltan datos: nit".
  El contacto dice "Dirección de notificación judicial" y enlaza al formulario de PQR (Ley 1480, artículo 50).
- PQR con radicado (Ley 1480, art. 50, literal g, modificado por la Ley 2439 de 2024): `netlify/lib/pqr.mjs` y
  `netlify/functions/pqr.mjs` (`/api/pqr` POST radica, GET con radicado y correo consulta; `/api/pqr/panel` con PANEL_CLAVE lista
  y responde). Radicado `PQR-AAAAMMDD-XXXXXX` con fecha de Colombia; vence a 15 días hábiles (10 si es de datos personales),
  sin descontar festivos. Correo de recibo a la persona y aviso a `PQR_AVISO` (o `SMTP_USER`). Límite: 5 por hora por IP; trampa
  para robots (`web`). Almacén `pqr` (respaldado); `respaldo-cron` borra las PQR sin actuaciones en 3 años.
  En la app: menú, Ayuda y PQR (`#dlg-pqr`, enlace `/#pqr`), con consulta del estado y las solicitudes del dispositivo
  (`fintelligente-pqr` en el almacenamiento local). El panel (`/panel`) lista, responde, marca en trámite o cierra.
- Premium en la app de Android: `APP_ANDROID.activa` oculta `#web-buy` y el precio, y muestra `#tienda-nota`; quedan restaurar
  y códigos de regalo. Motivo: la política de pagos de Google Play exige su facturación para contenido digital; en Colombia los
  medios alternativos llegan el 30 de septiembre de 2027. En el navegador se sigue vendiendo con Wompi.
- Términos: compras en tiendas (9.4.1), Invita y gana (9.8), códigos de regalo (9.9), apodos de los retos (5), PQR (14).
  Política: fila de PQR, Resend como encargado opcional, conservación de PQR por 3 años.
- Pruebas: `pruebas/pqr.test.mjs` y `pruebas/navegador/pqr.test.js`.

## Letras dentro de la app e iPhone (16 de noviembre de 2026)
- Unbounded y Manrope (variables, solo latín) están en `public/fuentes/` con `fuentes.css` y sus licencias OFL; ya no se cargan de Google Fonts
  en ninguna página (app, panel, legales). La CSP ya no permite `fonts.googleapis.com` ni `fonts.gstatic.com`. El trabajador las guarda
  al instalarse y las sirve primero desde la copia. Prueba: `finti-diseno.test.js` (ningún pedido a Google) e `identidad.test.js`.
- iPhone: `viewport-fit=cover` (los `env(safe-area-inset-*)` ya actúan), pantallas de arranque en `public/inicio-ios/` (11 tamaños),
  `theme-color` que `applyTheme()` actualiza con el fondo, y `apple-mobile-web-app-title`.
- App Store: decidido cuenta de persona y primera versión gratis, sin Premium en la app de iPhone (regla 3.1.3(b)); ver el documento del proyecto `app-store.md`.

## El prototipo pasado a la app (16 de noviembre de 2026)
El prototipo interactivo aprobado ("Prototipo de la nueva identidad", lienzo de diseño) ya se ve en la app:
- **Inicio** en el orden del prototipo: saludo, Hoy puedes gastar, "Cuéntame un gasto" como caja para escribir (`#hoy-registrar`,
  clase `ini-cuentame`), ¿En qué se va tu plata?, Próximos pagos (tarjetas que se deslizan de lado), Por confirmar (tarjeta punteada),
  Tus categorías y Tu mes contado (`#hist-play`), que en el celular flota sobre la barra de abajo como un reproductor y muestra el
  avance del mes; antes del día 20 avisa cuándo estará listo. Los avisos condicionales (carta, recordatorios, alertas) siguen ahí.
- **Análisis** recibe lo que salió de Inicio, en `.home-grid.mes-grid`: disponible (`#t-hero`), resumen, pronóstico, Tu día, quincena,
  notas, salud financiera, rachas y logros, Ojo con estas, Pregúntale y Mi negocio. Luego, lo de siempre (`.ana-grid`).
- **Movimientos**: título, resumen (`#mv-resumen`) y filtros por categoría (`#mv-filtros`, `pdFiltro` en `renderPorDia()`); la
  tabla del presupuesto ya no está aquí.
- **Tu presupuesto** (vista nueva `presupuesto`, en `VIEWS`, en el menú y con "Tu presupuesto" en Movimientos): ingresos y gastos
  planeados (`#tb-ing`, `#tb-gas`). El título "Presupuesto de" solo se ve aquí; el aviso del ejemplo, aquí y en Inicio.
- **Metas**: título y resumen (`#mt-resumen`: cuánto falta entre todas); primero las metas, el reto de las 52 semanas y las deudas;
  después el redondeo y los retos con amigos.
- Las vistas animan con `backwards` (no dejan un `transform` puesto, que rompía lo fijo dentro de ellas).
- Pruebas: `finti-diseno.test.js` revisa el orden y las secciones; `titulo.js` y `almacenamiento` escriben el título en Tu presupuesto;
  `ancho-celular` ignora lo que va dentro de un carrusel que cabe; accesibilidad y ancho revisan también Tu presupuesto.
- Menú lateral más liviano (16 de noviembre de 2026, noche): a la vista quedan las seis secciones y Por confirmar, Conectar bancos,
  Avisos y Pregúntale. Lo demás va en grupos `details.lat-grupo` (Herramientas, Tus historias, Ayuda y privacidad), que se ven
  también en el computador y recuerdan si quedaron abiertos (`fintelligente-lat-grupos`). Más opciones (`#lat-mas`) sigue igual.

## Cuéntame un gasto entiende historias; preguntas pendientes; el banco se une con lo contado (16 de noviembre de 2026, noche)
- **Historias** (`chHistoria(texto)`, en la charla; `window.FinHistoria` para pruebas). Se activa con 3 o más montos, o 2 con un lugar,
  una compra o un texto largo, o un lugar con 3 productos; lo corto lo sigue entendiendo `chEntender`.
  - `hiFichas`: palabras a fichas con números ("dos mil quinientos", "18 lucas", "4.500", "medio", "un par").
  - `hiPartes`: frases por puntuación, "y", "después", "también".
  - `hiLugar`: tiendas conocidas (D1, Ara, Éxito, Carulla, Olímpica…), genéricos (tienda, plaza, droguería…) y "la tienda de don José".
  - `hiProducto`: cantidad, unidad (kg, lb, docena, bolsa…), nombre y precio por unidad ("de", "a", "cada una", "el kilo") o total ("por", "en").
  - Por lugar: total ("fueron", "me cobraron"; con "como" manda la suma si está cerca), vueltas y billete, descuento, lo que puso otra
    persona (se resta), "la mitad la paga…" (Te deben), medio de pago ("todo con Nequi"). Si sobra plata, "Otros (bolsa, redondeo…)";
    si falta un precio y hay total, se deduce; si no, se pregunta. Si la suma y el total no cuadran, se pregunta cuál anotar.
  - Un movimiento por categoría en cada lugar (el mercado aparte de la comida del perro). Gastos aparte (`HI_APARTE`): taxi, bus,
    parqueadero, peaje, gasolina, propina, domicilio, almuerzo afuera; no heredan el medio de pago del mercado.
  - Los movimientos guardan `det` (hasta 25 productos: nombre, cantidad, valor), `o: "ch"` y `cu` (la cuenta usada).
  - En la charla: `chHistoriaEmpezar`, `chHistoriaSiguiente` (pregunta lo que falta, con "Te digo después" y "No me acuerdo"), tarjeta
    con el detalle (`.ch-det`). El texto admite hasta 800 caracteres (también desde el micrófono de Android, que espera 2,5 s de silencio).
- **Preguntas pendientes** (`state.dudas`, máximo 20, vencen a los 10 días): precio de un producto (`precio`, se suma al movimiento,
  a su fila y a la cuenta) o compra entera (`nuevo`). Tarjeta en Inicio (`#dudas-card`), chip en la charla y enlace `/#accion=dudas`.
  El texto de la primera pregunta se guarda en IndexedDB (`dudas`) para el service worker. Al servidor solo va cuántas hay (`dudas`,
  0 a 9) y si se pueden hacer (`preguntar`, en Avisos y recordatorios). `planificar()` avisa a las 13:00, nunca dos días seguidos, solo
  si ese día no registró nada y nunca por correo. Pruebas: `avisos.test.mjs`, `sw.test.mjs`.
- **El banco se une con lo contado** (`yaContado`, `unirContado`): un aviso de gasto que coincide con algo dicho en la charla (±1 día,
  valor igual o hasta 5 % / $ 5.000 de diferencia, mismo lugar si los dos lo dicen) pregunta "¿Es lo mismo que me contaste?". Si sí,
  no se anota de nuevo: queda el valor del banco, se ajusta la fila y la cuenta (la del banco manda) y el movimiento queda `o: "aviso"`.
- **Lector de avisos**: entradas claras antes que traslados ("te envió… a tu Nequi"), devoluciones, "transferencia recibida", "pago
  exitoso de tu tarjeta", montos sin signo ("por valor de 75000"), fechas "15-11-2026", "14 nov 2026" y "16 de noviembre de 2026",
  quién envía ("Juan Pérez te envió"), recargas ("Recarga Claro"), sucursales con número ("Carulla 85") y dominios ("Netflix.com").
  Banco de pruebas: `pruebas/lector-avisos.test.mjs` (48 avisos de 20 entidades).
- Pruebas: `pruebas/navegador/cuentame-historias.test.js`.
- Micrófono del navegador (`chEscuchar`): `continuous`, junta las frases finales y se detiene tras 3,5 s de silencio o al tocar el
  micrófono otra vez, para que una historia con pausas llegue completa. Prueba con un reconocimiento falso en `cuentame-historias.test.js`.

## Lenguaje libre, banco de frases y asesor del mercado (noviembre de 2026)

- **Antes de leer (`chPrevio`)**: los tres lectores (gasto suelto `chEntenderTodo`, historia `chHistoria` y pregunta
  `prEntender`) pasan primero la frase por `chPrevio`, que arregla lo que deja el dictado y el afán:
  miles con espacio ("18 000"), "d uno" → D1, "un millón doscientos", "2 palos y medio", un número corto donde va la
  plata ("taxi de 12", "gasté 15 en…", "pagué con 250": son miles) y errores de escritura (`chArreglarEscritura`).
  El corrector solo cambia una palabra desconocida por una única palabra del vocabulario muy parecida (misma primera
  letra; distancia 1, o 2 si tiene 8 letras o más). Nunca toca las palabras reales del español que se parecen a una del
  vocabulario ("tanto" y "tinto"): están en `CH_REALES`, que se genera con `herramientas/palabras-reales.cjs` a partir
  de la lista an-array-of-spanish-words (MIT). Si se agregan palabras al vocabulario, vuelve a generarla.
- Historias dictadas sin comas: después de un precio, lo que no lo complementa empieza otra parte (`HI_SIGUE`).
  "porque" también separa. "El taxi de vuelta" no son vueltas. En la droguería el champú va con la compra.
  `HI_APARTE` incluye "me tomé" y "me comí" (el nombre sale del producto: "Tinto").
- **Banco de frases** (`pruebas/navegador/banco-de-frases.test.js`): 122 frases de gente real (jerga, dictado,
  errores). Imprime la nota por grupo y falla si alguna deja de entenderse. Con `VER=1` muestra todas las fallas sin
  detenerse. 32 de ellas se escribieron después de ajustar el lector y la primera vez entendió 26: esa es la medida
  honesta para frases nuevas. Cada frase que mande un probador se agrega aquí.
- **Frases que Finti no entendió** (`state.noEntendi`, máximo 40): chip "No me entendiste" en la charla (tarjeta,
  pregunta del monto y "No te entendí") y "Guardar la pregunta para que Finti aprenda" en Pregúntale. Se ven en
  Palabras que aprendí (`#ne-sec`), se borran una a una o todas, y solo salen con "Compartir las frases"
  (`navigator.share` o portapapeles), que la persona toca y dirige.
- **Lector de avisos**: "ESTABLECIMIENTO: D1 SAS", "por NOMINA EMPRESA en tu cuenta", "a 3 cuotas", recargas con número
  de celular ("Recarga Tigo") y se quita "SAS" del comercio (salvo "Empresa SAS"). Un recordatorio de factura
  ("vence el 25") no es un movimiento (`motivo: "factura"`). 58 avisos en `lector-avisos.test.mjs`.
- **Tu canasta** (`canRegistros`, `canResumen`): los productos con precio de las historias (`det`) y los gastos sueltos
  de comida que nombran un producto. Clave por producto en singular (`canClave`), precio por unidad, kilo, libra o
  litro (`canCantidad`), lugares ordenados por precio y cambio desde la primera compra.
  - Al guardar una historia (`canNotaGuardado`): el cambio de precio más notorio frente a la última compra del mismo
    producto (5 % o más y al menos $ 100), con el lugar donde ha salido más barato. Y cuánto lleva en alimentación
    frente a lo planeado.
  - Pregúntale: intenciones `producto` (se detecta antes que las demás: un producto ya comprado o un alimento conocido,
    con palabras de plata o de precio), `productos` (lo que más compra y cómo van los precios) y `consejo`
    (mercado, crédito con la regla del 30 %, cuánto ahorrar entre el 10 % y el 20 % con el colchón de 3 meses, y en
    general las ideas de `analizarMes`). Los consejos de crédito y ahorro aclaran que es una guía, no asesoría
    profesional.
  - `analizarMes` suma dos ideas: dónde sale más barato lo que repite (peso 55) y muchas compras pequeñas de comida.
- Ganchos de prueba: `window.FinEntender`, `window.FinIntencion`, `window.FinIdeas`, `window.FinVocabulario`.
  Prueba: `pruebas/navegador/asesor-canasta.test.js`.

## Diseño "amigo financiero" de Claude Design (17 de noviembre de 2026)

Lo que se pasó a la app desde el lienzo "Finti: el amigo financiero" (Claude Design). El estilo vive en el bloque
"Diseño Finti de Claude Design" al final de los estilos; la lógica, en las mismas funciones de siempre.

- **Tema Finti** (`THEMES`, primero y por defecto): claro #f3f4f7 / tinta #0b0c10 / azul #2e5bff; oscuro #07080b /
  tinta #f4f5f8 / azul #6f8cff (texto y botones, con letra oscura encima). `prefs.idv` sube a 3: quien venía en
  Vibrante o Cobalto (los temas por defecto anteriores) pasa una sola vez a Finti. `applyTheme` agrega `--fuerte`,
  `--fuerte-2`, `--fuerte-luz` y `--sombra-acento`: el azul de las tarjetas en 3D, que siempre deja leer letra blanca
  (`fuerteDe` lo oscurece hasta 4,6 : 1 con cualquier tema). El violeta fijo (#7c5cff) de botones y avisos pasó a `--fuerte`.
- **Letra:** Plus Jakarta Sans en toda la app (texto, títulos, cifras y la voz de Finti, que va más grande y en 700),
  elegida por el dueño entre siete opciones el 17 de noviembre de 2026. Unbounded queda solo para el nombre Finti.
  Archivo `/fuentes/jakarta.woff2` (licencia OFL, `/fuentes/LICENCIA-plus-jakarta-sans.txt`). Geist y Fraunces se
  probaron y se quitaron.
- **Sin objetos 3D genéricos (18 de noviembre de 2026):** se quitaron los Fluent Emoji (y la carpeta `/3d/`). Por pedido del dueño, la app usa un lenguaje propio: fichas (`ficha()`, `catIcon()`), con el trazo del logo sobre el color de la categoría y grosor de tecla, y la F de Finti como marca de agua (`.marca-agua`) en las tarjetas azules. El oro solo aparece en lo que crece (`CRECE`).
  `catIcon()` pone el objeto de cada categoría (`IMG3D`, también para las categorías propias); solo en la edición web.
- **Inicio:** sin mascota; la frase de Finti grande y gruesa; "Hoy puedes gastar" es una tarjeta azul en 3D con la moneda
  que flota; "Tus categorías" son filas con su objeto, "Vas bien / Casi al límite / Ya está completo / Te pasaste" y la
  barra del color de la categoría.
- **Cuéntame un gasto nunca supone efectivo** (`chItem` deja la cuenta vacía). Si la frase no dice con qué se pagó y hay
  más de una opción, `chSiguiente` repite lo que entendió y pregunta "¿Con qué lo pagaste?" con botones del color de
  cada cuenta (la usada la última vez para esa categoría sale primero, sin elegirla). Con varios gastos pregunta una
  sola vez. "Con llave" o Bre-B se entiende (`r.llave`) y pregunta "¿Desde qué cuenta salió la llave?" solo con bancos
  y billeteras. Se puede responder escribiendo ("nequi", "la tarjeta"). La foto de la tirilla toma "EFECTIVO",
  "CRÉDITO" o "DÉBITO" si lo dice. El registro rápido y la bandeja ahora guardan la cuenta en el movimiento (`cu`).
- **Colores de bancos** (`marcaCuenta`): Nequi, Daviplata, Davivienda, Bancolombia, Nu, BBVA, efectivo y genéricos por
  tipo. Son aproximados, solo color y nombre, sin logos; los términos lo aclaran (sección 10) y debe revisarlo el abogado.
  Se usan en la billetera de Cuentas (tarjetas apiladas con chip, pago sin contacto, cupo de la de crédito; tocar una la
  pasa al frente), en el punto de color de cada movimiento y en los botones de la charla.
- **Análisis sencillo primero** (`renderAnSimple`): "Así va tu mes" (Vas bien, Vas justo u Ojo) con el mismo
  `pronostico()` de la gráfica, y "¿Cómo va cada cosa?" con objeto, frase y estado con ícono y palabra. Las gráficas,
  la salud financiera, las rachas, la tabla por categoría, el historial y el asesor quedan detrás de "Ver el detalle con
  gráficas" (se recuerda en `fintelligente-an-detalle`). Notas, quincena y Pregúntale siguen a la vista.
- **Pregúntale:** `prConCifra` pone el objeto del tema de la pregunta junto a la primera frase, más grande, con las
  cifras resaltadas.
- **Metas gratis con 1 meta:** antes eran solo Premium. Quien no tiene Premium ve y usa su primera meta; agregar otra
  abre Premium y, si ya tenía más, quedan guardadas ("Tus otras N metas siguen guardadas").
- Prueba: `pruebas/navegador/diseno-amigo.test.js`. Las pruebas de la charla responden la pregunta con
  `_pagar-con.js`.
- **Logo azul** (aprobado por el dueño el 17 de noviembre de 2026): la F blanca con la moneda sobre azul #2e5bff en
  degradado. Los íconos del kit (`marca-finti/`, web y Android) se generan con `node herramientas/iconos-finti.cjs`; los
  dibujos del logo dentro de la app, el favicon, los correos, la portada de Tu mes contado y el fondo del widget de Android
  pasaron a azul. Siguen violetas solo los colores de categoría (Vivienda) y las muestras para elegir. El kit se aplica con
  `cambiar-a-finti.py` cuando salga bien la consulta en la SIC.

## Historia de bienvenida (17 de noviembre de 2026)
- **Qué es:** la primera vez que alguien abre la web sin sesión, antes de la puerta (`#dlg-bienvenida`) se ve una historia corta: "Toca para empezar", tres escenas al compás y, al final, cuatro tarjetas en 3D (Clásica, Oro, Platino y Black) con el nombre que la persona escriba. Las tarjetas usan colores de categoría, sin logos ni nombres de franquicias o bancos, y sin números.
- **Dónde vive:** `public/historia/`:
  - `historia.js`: módulo que monta todo dentro de un Shadow DOM, así sus estilos no tocan los de la app.
  - `tarjetas3d.js`: las tarjetas con three.js.
  - `three.module.min.js` y `three.core.min.js`: three.js r176, licencia MIT en `LICENCIA-three.txt`.
  - Se genera desde el prototipo aprobado (`/home/claude/finti-intro/`) con `python3 /home/claude/historia_build.py`. Si se cambia la historia, se cambia el prototipo y se vuelve a generar.
- **Cómo entra:**
  - `mostrarPuerta()` llama a `quizaHistoria(cierre)`.
  - Si `localStorage["fintelligente-historia"]` está vacío y no viene de cerrar sesión, agrega `<script type="module" src="/historia/historia.js">`. Los navegadores viejos lo ignoran, y si no carga, queda la puerta de siempre.
  - Empezar guarda `vista` y Saltar o Escape guardan `saltada`. Luego se quita la capa, se avisa con el evento `finti-historia-fin` y la app pone el foco en el título de la puerta.
- **Nombre:** queda en `localStorage["fintelligente-nombre"]`, solo en el dispositivo, y `nombreLocal()` lo propone como apodo al crear un reto.
- **Sonido y vibración:** todo se sintetiza con Web Audio después del primer toque. La vibración usa `navigator.vibrate`. Hay botón de silencio, y con movimiento reducido no hay animaciones.
- **Detalle de Shadow DOM:** el valor de un campo se lee dentro del evento. Después, `e.target` apunta al contenedor y no al campo.
- **Caché y encabezados:** `sw.js` guarda `/historia/*` al usarlo (primero la copia guardada). `netlify.toml` da a `/historia/*` una semana de caché. La CSP no cambió: `script-src 'self'` ya permite el módulo.
- **Pruebas:**
  - `pruebas/navegador/historia.test.js` cubre aparición, avance, tarjetas, nombre, Empezar, Saltar, Escape y que no vuelva a salir.
  - Los ayudantes `acepto-previo.js`, `inicio-visto.js` y `sin-bienvenida.js` dan la historia por vista, para que no tape lo que prueban las demás.
  - La ortografía revisa `historia.js` y `tarjetas3d.js`.

## Inicio y Pregúntale con identidad propia (18 de noviembre de 2026)
- **Fichas en vez de objetos 3D:** `ficha(icono, color)` dibuja el ícono de línea de la categoría (`#c-*`) en blanco o tinta (según `tintaPara`) sobre su color en degradado.
  - Tiene grosor de tecla (sombra inferior), brillo arriba y se hunde al tocarla.
  - `CRECE` (ahorro, ingreso, meta) le pone el punto dorado del logo.
  - `catIcon()` e `ingIcon()` la usan en toda la app.
  - Se quitaron los Fluent Emoji, la carpeta `/3d/`, su caché en `sw.js`, su encabezado en `netlify.toml` y su crédito en los términos.
- **La F como marca de agua:** `.marca-agua` (el mismo trazo del logo, con el punto que respira) en "Hoy puedes gastar" y en "Así va tu mes" de Análisis, en lugar de la moneda y la gráfica.
- **Dona con grosor:** `renderDonut(t)` dibuja el anillo aplastado (`scale(1 .62)`, vista casi de frente para no deformar las porciones) con 7 capas de costado (`.lado`, más oscuras con `color-mix`) y un brillo arriba.
  - La porción elegida se levanta y sale hacia afuera (`.trozo.on`).
  - `#donut-modo` cambia entre "Esta semana" (`byCatSemana()`, desde el lunes) y "Este mes", y la elección queda en `localStorage["fintelligente-donut"]`.
  - Sin elección guardada, muestra la semana si ya hay gastos de esta semana; si no, el mes.
- **Pregúntale a Finti:**
  - **Diseño:**
    - La cabecera lleva la F de Finti (`.pr-avatar`) y la promesa de privacidad. Reiniciar y Cerrar son botones redondos.
    - Cada respuesta va en `.pr-fila`, con la F al lado; las preguntas van en azul.
    - Los puntos de "pensando" saltan.
    - Al abrir hay cuatro sugerencias en tarjetas con su ficha (`prBienvenida()`); después vuelven a ser botones pequeños en una fila que se desliza.
    - El campo es una píldora con el botón de enviar redondo.
  - **Calidad:** de 50 preguntas comunes, Finti no entendía 9; ahora las entiende todas. Intenciones nuevas:
    - `saldos`: cuánta plata tengo, el saldo de una cuenta por su nombre o tipo, cuánto gasté con una cuenta (`prCuentasEn()`).
    - `medeben`: lo que le deben, por persona.
    - `mayor`: el gasto más grande del mes.
    - `promedio`: gasto diario promedio.
    - `quincena`: por día hasta el 15 o el último día, con la cifra de `hoyPuedes()`.
    - `hoy`: la misma cifra de la tarjeta azul del Inicio.
    - `estado`: "¿cómo voy?", con `asiVaMes()`, el mismo cálculo de Análisis.
  - "Comparar" sin el mes anterior ya no se queda en "todavía no tengo": dice cómo va el mes.
  - Los pagos que nombran uno ("¿cuándo vence la tarjeta?") muestran solo ese.
  - Prueba: `pruebas/navegador/preguntale-calidad.test.js`.

## Pantalla de carga, deudas con amigos, botón Finti y Dónde comprar (19 de noviembre de 2026)
- **Pantalla de carga** (`#arranque`): la F de la marca se dibuja con un lápiz (el punto) y el punto cae con un rebote; dura
  1,9 s como mínimo y se quita sola a los 3,2 s si algo falla. En silencio. No vibra: los navegadores solo dejan vibrar después
  de que la persona toca algo. Las 11 pantallas de arranque del iPhone (`public/inicio-ios/`) se generan con
  `herramientas/arranque-ios.cjs` y muestran lo mismo.
- **Deudas con amigos en todas las versiones:**
  - Te deben (Cuentas) siempre está a la vista, con **Le presté** y **Me pagaron**. Un formulario corto (`#dlg-deuda`,
    `abrirDeuda`) arma la frase ("le presté $ 50.000 a Juan", "Juan me pagó") y se la pasa a Cuéntame, que ya sabe anotarla
    y preguntar de qué cuenta salió o a cuál entró.
  - Enlaces `#accion=preste` y `#accion=mepagaron` (`leerAccion`/`hacerAccion`). Los usan los atajos del manifiesto web
    (`shortcuts`, al dejar el dedo sobre el ícono de la app instalada) y los de Android (`accesos.xml`,
    `fintelligente://deuda/preste|mepagaron` → `AccionActivity` → `InicioActivity.abrirAccion`).
  - Atajo del iPhone: si por `/api/entrada` llega un texto de préstamo o de pago (`esDeuda`), no va a Por confirmar; queda en
    `localStorage["fintelligente-dichos"]` y aparece en Te deben como "Llegó del atajo", con **Anotar** (abre Cuéntame).
    La guía del iPhone tiene el paso "Plata que prestas a amigos"; el atajo necesita las opciones de menú "Le presté a
    alguien" (pide quién y cuánto, manda "le presté $ X a Nombre") y "Me pagaron" (manda "Nombre me pagó").
- **Botón Finti en la barra de notificaciones de Android** (antes "Efectivo"; `EfectivoTile`, ícono `ic_finti_boton` con la
  F y su punto): abre `VozActivity` ("Cuéntale a Finti", ejemplos que rotan). Lo dicho pasa a la página como texto
  (`#accion=charla&dicho=`); `esPreguntaDicha` decide: una pregunta que Pregúntale entiende ("¿cuánto puedo gastar hoy?",
  "¿quién me debe plata?") abre Pregúntale; lo demás (gastos, ingresos, "le presté…", "Caro me pagó") va a Cuéntame. El
  reconocimiento de voz es del teléfono, sin internet cuando el teléfono lo permite.
- **Dónde comprar con precios del DANE (SIPSA), gratis:**
  - **Fuente actual (26 de noviembre de 2026): el boletín diario.** Cada día de mercado (lunes a viernes) el DANE publica
    hacia las 11:45 a. m. un Excel en `www.dane.gov.co` (`/files/operaciones/SIPSA/anex-SIPSADiario-25nov2026.xlsx`,
    enlazado en la página del componente de precios mayoristas) con el precio por kilo de unos 36 alimentos frescos en 12
    centrales (Barranquilla, Bogotá, Cartagena, Medellín, Montería, Pasto, Pereira, Popayán, Santa Marta, Sincelejo,
    Valledupar y Villavicencio) y su variación contra el día de mercado anterior. **GitHub Actions**
    (`.github/workflows/precios-sipsa.yml`, 12:20 p. m. y 2:20 p. m. de Colombia, lunes a viernes) corre
    `herramientas/sipsa-diario.mjs`: busca el anexo más reciente, lo lee sin librerías (un .xlsx es un zip con XML;
    `leerZip` con `node:zlib`, `hojaXlsx`) y arma el resumen con `tipo: "diario"` y `dia` (también en `semana`, para que
    `/api/precios` siga rechazando un día más viejo que el guardado). Por producto: `g` mediana nacional, `v` variación
    mediana (%), `b` central más barata y `c[ciudad] = [precio, central, precio, variación %]`.
  - **Por qué no el servicio web:** el servicio SOAP del DANE (`appweb.dane.gov.co`, `herramientas/sipsa.mjs`, promedios
    semanales de unos 350 productos) corta las conexiones que llegan desde GitHub y otras nubes (`ECONNRESET` antes del
    saludo TLS, visto en noviembre de 2026). `herramientas/sipsa.mjs` sigue sirviendo a mano desde un computador en
    Colombia, y la app entiende los dos formatos.
  - El resumen se manda con `POST /api/precios` y la clave `PRECIOS_CLAVE` (secreto del trabajador de Cloudflare y secreto
    de GitHub con el mismo valor). Se guarda en el almacén `precios` (no se respalda: se vuelve a bajar). La app lo pide
    con `GET /api/precios` (caché de 1 hora), sin datos de la persona, y lo guarda en
    `localStorage["fintelligente-sipsa"]` (se renueva cada 2 horas si es diario y cada 3 días si es semanal; sirve sin
    internet).
  - Pantalla **¿Dónde compro?** (`#dlg-donde`, menú Más): sin nada escrito muestra **"Así amanecieron los precios hoy"**
    (`pintarHoy`): todos los productos del DANE con su precio en la ciudad elegida o en el país, si suben o bajan y el
    mejor precio del país; tocar uno lo busca. Al buscar: lo que pagó la persona (Tu canasta) y la referencia del DANE,
    con la tendencia (de la ciudad si el boletín la trae) y otras variedades. `sipsaFecha` dice "hoy", "ayer" o la
    fecha. La ciudad se guarda en `state.prefs.ciudad`.
  - Pregúntale: "¿cómo está la papa?", "¿a cómo está el tomate?" responden con el DANE aunque la persona nunca lo haya
    comprado (`sipsaProducto`, `sipsaParrafo`); "¿Dónde compro papa?" abre la pantalla.
  - Siempre se aclara que son precios mayoristas por kilo: en la tienda son más altos.
  - **Precios de la gente (26 de noviembre de 2026):** las cadenas (Éxito, Carulla, D1, Ara…) no publican sus precios
    para consultas automáticas (Éxito y Carulla lo prohíben en `robots.txt` y bloquean con 403), así que los aporta la
    gente, con permiso. En ¿Dónde compro? la app pregunta una vez "¿Ayudas a otros a comprar más barato?"
    (`state.prefs.aportar` = "si" o "no", con `aportarFecha`); después queda un enlace para cambiar de opinión.
    - Envío (`genteEnviar`, al abrir la app como mucho cada 6 horas, al aceptar y al cambiar de ciudad): de
      `canRegistros(14)`, las compras cuyo lugar es una cadena (patrones de `CADENAS`) y cuyo producto está en la lista
      cerrada (`PRODUCTOS`; "papa pastusa" cuenta como "papa"). Por cada una: `{ p, c, u, v, d }` (producto, cadena,
      kg/l/u, precio por unidad, día) y la ciudad. Libras y gramos se pasan a kilos. `credentials: "omit"`. Lo enviado
      se recuerda en `localStorage["fintelligente-gente-enviados"]` (30 días) para no repetirlo.
    - Servidor: `POST /api/precios-gente` (`netlify/lib/precios-gente.mjs`, `aportar`): valida contra las listas,
      máximo 40 por envío y 12 envíos por IP al día (`limitar`). No guarda la IP: guarda un código de 4 letras
      (HMAC del día y la IP) para contar personas distintas; la misma persona cuenta una vez por producto, cadena y día.
      Almacén `precios-gente`, un registro por ciudad (`c-bogota`): `a["papa criolla|kg"].d1 = [[día, precio, código]]`,
      últimos 14 días, máximo 60 por celda, escrito con `actualizar`.
    - `GET /api/precios-gente` (público, caché de 30 minutos; resumen en memoria 10 minutos): `lista` (productos,
      cadenas con patrón, ciudades) y `ciudades[ciudad]["producto|unidad"] = [[cadena, mediana, personas, último día]]`,
      de la más barata a la más cara. Una cadena se muestra con al menos 3 personas en 14 días; los precios de menos de
      un tercio o más del triple de la mediana se descartan.
    - Se ve en el detalle de ¿Dónde compro? ("Lo que pagó la gente en Bogotá"), en la lista del día ("En cadenas,
      desde…") y en Pregúntale (`genteFrase`). La lista de ciudades junta las del DANE y las de la gente (Cali no está
      en el boletín del DANE: se muestran los precios del país y lo de la gente).
  - **Precios de las tiendas en línea (se alimenta solo):** `.github/workflows/precios-cadenas.yml` corre cada día a las
    6:40 a. m. `herramientas/precios-cadenas.mjs`: para cada cadena con tienda VTEX (`CADENAS_LINEA`: Olímpica, Jumbo,
    Metro, Éxito, Carulla) lee primero su `robots.txt` (`leerRobots`: reglas de `*` o de Finti, la más específica gana;
    además, lo que prohíba cualquier grupo tampoco se pide; 401/403 al leerlo = no) y solo consulta lo permitido, con
    la forma `?ft=arroz` sin `&` ni `%`, una consulta cada 1,5 s, identificándose como Finti; con un 403 o 429 deja esa
    cadena. En noviembre de 2026: Olímpica sí; Éxito y Carulla no (prohíben `/api/`); Jumbo y Metro no respondían
    desde la nube. Por producto (`BUSQUEDAS`: clave, palabras iniciales, unidad, palabras que lo descartan) toma los
    resultados de categorías de mercado cuyo nombre empieza por el producto y dice su tamaño (`tamano`: "500 G",
    "x 30 Unds", "900ML X6", "X Kg"), sin ofertas tipo "3x2"; con al menos 2 comparables guarda el cuartil bajo del
    precio por kilo, litro o unidad y el nombre del producto más cercano como ejemplo. `POST /api/precios-linea` con
    `PRECIOS_CLAVE` (`guardarLinea`: solo cadenas y productos de las listas) lo guarda en `precios-gente` → `linea`;
    `GET /api/precios-gente` lo entrega como `linea` (no se muestra si tiene más de 7 días). La app lo junta con lo de
    la gente en "Precios en las cadenas" (`genteFilas`, `genteOrigen`: "5 personas en Bogotá" o "tienda en línea, hoy").
  - **Cualquier producto (27 de noviembre de 2026):**
    - Lo compartido por la gente ya no usa una lista cerrada: vale cualquier nombre corto como lo arma `canClave`
      (`productoValido`: una o dos palabras, minúsculas, sin tildes). Como es texto libre, el umbral de 3 personas
      distintas por producto, cadena y ciudad hace que lo que escribe una sola persona nunca se vea. `PRODUCTOS` queda
      solo para los nombres bonitos. La lógica compartida de las tiendas (robots, tamaños, precios) vive en
      `netlify/lib/cadenas.mjs`.
    - El flujo diario busca 113 productos (`BUSQUEDAS` en `herramientas/precios-cadenas.mjs`): despensa, lácteos,
      carnes, frutas y verduras con tamaño, bebidas, aseo y cuidado personal. Las palabras se unen con guion
      (`?ft=jabon-rey`): con "+" la tienda no responde y "%" lo prohíbe su robots.txt.
    - Búsqueda en vivo: `GET /api/precios-buscar?q=…` (`netlify/lib/precios-buscar.mjs`). Limpia la consulta
      (`consultaLimpia`: sin tildes ni símbolos, de 2 a 40 letras, máximo 5 palabras), lee el robots.txt de cada cadena
      una vez al día (`robots-<cadena>` en `precios-gente`), consulta en paralelo las que lo permiten (6 s máximo cada
      una) y devuelve los 5 primeros resultados con precio y, si dicen el tamaño, precio por unidad. Guarda la
      respuesta 12 horas (`b-<consulta>`), 40 búsquedas nuevas por hora por IP, y `limpiarBusquedas` borra las de más
      de 2 días cada vez que llegan los precios diarios. En la app (`buscarLinea`), cada producto buscado en
      ¿Dónde compro? muestra "En las tiendas en línea, ahora"; a Finti solo va el nombre, sin cookies.
    - **Más cadenas y más productos:** `CADENAS_LINEA` (en `netlify/lib/cadenas.mjs`) tiene 14 tiendas VTEX: Olímpica,
      D1 (`www.d1.com.co`), Jumbo (`www.jumbocolombia.com`; `tiendasjumbo.co` no envía el certificado intermedio),
      Mercacentro, Euro, Mercaldas, La Rebaja, Colsubsidio, Megatiendas, Locatel, Droguerías Cafam, Metro, Éxito y
      Carulla; el robots.txt de cada una decide (en noviembre
      de 2026 Éxito, Carulla y Euro no lo permiten). El flujo diario las consulta en paralelo, cada una a su ritmo.
      La lista fija tiene unos 180 productos; además, `GET /api/precios-buscar?populares=1` da los productos buscados
      al menos 3 veces en 2 días (`populares`, con el contador `n` de cada búsqueda guardada) y el flujo los suma con
      unidad automática (`precioDe` con "auto": la unidad que más se repite). Así la lista crece sola con lo que pide
      la gente.
    - **Descubrir productos en las categorías:** además de la lista fija, `descubrirCadena` lee el árbol de categorías de
      cada tienda (`/api/catalog_system/pub/category/tree/3`), toma hasta 160 categorías finales de mercado, aseo,
      bebidas y cuidado personal (`hojasDeMercado`) y pide los 10 productos de cada una (`?fq=C:/1/16/`). Cada producto
      queda con su nombre corto (`claveNombre`: "Arroz Diana x 500 G" → "arroz diana") y su precio por unidad
      (`agruparDescubiertos`). De lo descubierto solo quedan los productos que están en al menos 2 cadenas (hasta
      1.500), para poder comparar. Si una tienda responde 403 o 429, no se le sigue preguntando. Cadenas nuevas:
      Colsubsidio, Megatiendas, Locatel y Droguerías Cafam (14 en total). El flujo tiene 45 minutos.
- Pruebas nuevas: `pruebas/precios.test.mjs` (lector, resumen y `/api/precios`), `pruebas/precios-diario.test.mjs`
  (zip, Excel, resumen del día y enlaces), `navegador/atajos-deudas.test.js`, `navegador/donde-comprar.test.js` y
  `navegador/donde-hoy.test.js`; `pruebas/precios-gente.test.mjs`, `pruebas/precios-cadenas.test.mjs`, `pruebas/precios-buscar.test.mjs` y `navegador/donde-gente.test.js` (precios de la gente y de las cadenas).
- **Versión de los documentos legales:** `LEGAL_V` (la vigente, 1.3, la que se guarda al aceptar) y `LEGAL_MIN` (1.2, la
  más vieja que sigue sirviendo) en `fuente/logica/34-…`. Decreto 1377 de 2013, artículo 13: solo hace falta una
  autorización nueva cuando cambian las finalidades ya autorizadas; los demás cambios se comunican antes de aplicarlos.
  Por eso, con una aceptación igual o posterior a `LEGAL_MIN`, no se vuelve a pedir: se muestra una vez un aviso
  (`avisoCambioLegal`, `localStorage["fintelligente-aviso-legal"]`) con enlace al registro de cambios
  (`/legal/privacidad.html#cambios`). Si un cambio futuro agrega una finalidad para todos, sube `LEGAL_MIN` a la
  versión nueva y todos aceptarán otra vez. La versión de las páginas está en `legal/datos.json`.

## Finti en la noche: base negra, banda azul, sol y luna, barra en isla (19 de noviembre de 2026)
- **Paleta oscura del tema Finti:** fondo #09090B, superficie #141417, línea #24242B, apagado #9C9FAB, acento #7D97FF,
  suave #18203F y fuerte #2E5BFF (en `THEMES` y en las variables `:root` de modo oscuro). En oscuro, `.panel`, `.ct-fila` y
  `.bill` van sin borde y con un filo de luz (`:root[data-modo-oscuro]`).
- **Banda de Inicio (≤ 760 px):** `#banda` es el primer hijo de `body`, va en `position: absolute` con `z-index: -1` y solo
  se ve con `body[data-vista="inicio"]`. `ajustarBanda()` mide hasta el final de `#hoy-registrar` (`--banda-h`) y la
  altura de `#hoy-card` (`--hoy-y`, donde van la F grande `.bf`, el astro y las estrellas). Corre al cambiar de vista,
  al cambiar el tamaño de `main.wrap` (ResizeObserver) y cada 5 minutos. `.dia` de 6 a. m. a 6 p. m. (sol) y `.noche` el
  resto (luna y estrellas). Sobre la banda, `body.sobre-banda` deja la barra de arriba transparente y `colorSistema()`
  pone el azul en `theme-color`.
- **Barra de abajo (≤ 760 px):** una isla flotante (14 px de los bordes, radio 35 px, vidrio). El botón del centro
  `.barra-reg` es el "+." (esfera azul con el punto dorado en `::after`) y la sección activa lleva el punto azul en
  `::after`. `.barra-luz` ya no se muestra. Tu mes contado flota a 100 px del borde.
- Prueba: `diseno-amigo.test.js` revisa la banda, el sol o la luna según la hora y la isla.

## Transiciones premium entre pestañas (19 de noviembre de 2026)
- `irAConTransicion(v)` se usa cuando la persona cambia de pestaña (barra de abajo, menú y botones `data-goto`). Usa
  `document.startViewTransition` y marca `html[data-trans="der|izq"]` y `html.con-vt` mientras dura. `irA()` sigue
  cambiando la vista al instante para el código, los enlaces (`hashchange`) y las acciones.
- Los nombres de las capas existen solo durante la transición (`html.con-vt`), para no cambiar el vidrio
  (`backdrop-filter`) de la app quieta:
  - `topbar` y `barra`: quietas, encima de todo.
  - `vista`: la que sale se hunde (escala 0,94, desenfoque y brillo bajo, 0,3 s) y la que entra llega de lado y se enfoca
    (0,5 s). Sus bloques suben en cascada con la clase `entra-vt`.
  - `banda`: se recoge hacia arriba al salir de Inicio y baja al volver.
  - `reproductor`: Tu mes contado baja y sube.
- La curva de todo es la de iOS, `cubic-bezier(.32,.72,0,1)`, sin rebotes.
- El punto azul de la barra (`#barra-luz`) viaja de una pestaña a otra y se estira en el camino (`.viaja`).
- Sin View Transitions, la vista entra con `entra-der` o `entra-izq` (sin rebote). Con "reducir movimiento", el cambio es
  inmediato.
- Prueba: `pruebas/navegador/transiciones.test.js`.

## Cloudflare (preparado el 20 de noviembre de 2026)
- Carpeta `cloudflare/`: trabajador que sirve `dist/` (copia de `public/`) y corre las mismas funciones de
  `netlify/functions`. Datos en D1, correo SMTP con sockets de Cloudflare y avisos push con WebCrypto. Los paquetes se
  reemplazan con `alias` en `wrangler.jsonc`, sin tocar `netlify/lib`. Detalle en `cloudflare/LEEME.md`.
- Migración de datos: `cloudflare/herramientas/migrar-datos.mjs` lee Netlify Blobs y escribe por lotes en `/api/migrar`
  (solo con el secreto `MIGRAR_CLAVE`). Se corre desde GitHub Actions: `.github/workflows/migrar-a-cloudflare.yml`.
- Prueba: `cloudflare/pruebas/humo.mjs` (workerd real, D1 local y correo local). Además se corrieron diseno-amigo,
  transiciones, identidad e historia en el navegador contra el trabajador local.

## Identidad completa fuera de la app (20 de noviembre de 2026)
- **Cabecera de la web:** `build_all.py` pone el manifiesto, el favicon (`/favicon.svg`, azul) y el ícono de iPhone justo después
  de `<title>Finti</title>` y falla si no lo encuentra. Antes buscaba el título viejo y, desde el cambio de nombre, la web
  salía sin manifiesto (sin instalar con ícono ni atajos). Prueba: `pruebas/cabecera.test.mjs`.
- **Íconos:** se aplicó el kit `marca-finti/` (web, Android y el de 512 de Google Play) con `cambiar-a-finti.py --aplicar iconos`.
  El service worker pasó a `fintelligente-v4` para que los celulares bajen los íconos nuevos.
- **Páginas legales:** `legal/legal.css` usa la noche de la app, la banda azul con la F de marca de agua y el logo nuevo; el
  texto va en una hoja oscura sobre la banda y las tablas son tarjetas en el celular. Versión 1.2 (`LEGAL_V` en la app):
  Cloudflare como alojamiento, Netlify mientras termina el traslado, GitHub para copiar los datos y bajar precios del DANE,
  y ¿Dónde compro?. Los enlaces al formulario ya no llevan la dirección de Netlify.
- **Correos, panel y Android:** el violeta #6a4af0 pasó al azul #2e5bff (correo del código, avisos, panel, colores, widgets y
  atajos de Android).
- **Sin restos del sitio anterior (20 de noviembre de 2026):** la plantilla de Excel dice Finti y usa el azul #2e5bff; la imagen
  para compartir de Tu mes contado usa la noche (banda azul que baja al negro, F de marca de agua y logo nuevo); el informe
  PDF y el confeti usan el azul; los archivos se descargan como `finti-…`. Se quitó el código que dejaba espacio a la marca
  de Netlify (`con-marca`, `--marca-h`). La APK vieja (abría la dirección de Netlify) se borró: `APK_URL` es
  `/descargas/finti.apk` y, si aún no está, el botón lo dice con un aviso. Android, el trabajador de correo, Google Play y
  la tarea de precios apuntan a `https://finti.francisco-jzx14.workers.dev`. En la política, Netlify y la copia por GitHub
  salen solo mientras `legal/datos.json` tenga `"trasladoTerminado": false`.
- **Pendiente técnico, invisible para la gente:** la carpeta `netlify/`, `netlify.toml` (de ahí salen las cabeceras de
  Cloudflare) y las claves del navegador `fintelligente-…` conservan su nombre; cambiarlas no se ve y las claves borrarían
  los datos guardados.

## Arreglos de la auditoría (21 de noviembre de 2026)
Recorrido como persona nueva; prueba: `pruebas/navegador/auditoria.test.js`.
- **Cuéntame en un toque:** al preguntar la cuenta muestra lo que entendió ("Entendí este gasto") y elegir la cuenta ya lo
  anota (`CH.guardarAlFinal`). Si la frase ya trae la cuenta, sigue el "¿Anoto este gasto?" con "Sí, anótalo". Nunca dice
  "Anoto" antes de anotar.
- **Nada se pierde:** un gasto nuevo mientras algo espera se suma (`antes.concat(nuevos)`); una corrección ("no, eran…",
  "ponlo en…") corrige, también mientras pregunta la cuenta; una pregunta ("¿cuánto llevo…?") se responde con
  `prResponder` y lo pendiente sigue ahí.
- **Billeteras nuevas:** "con nequi" o "con daviplata" sin esa cuenta la crea (`chBilleteraNueva`) y la quita de la descripción.
- **Saldo conocido (`ini` en cada cuenta):** las cuentas nuevas nacen sin saldo conocido; al tocarlas por primera vez,
  Cuéntame pregunta "¿Cuánto tenías…?" una vez (paso `saldo-ini`) en vez de mostrar un saldo en rojo. Cuentas muestra "Pon
  cuánto tenías" hasta que se ponga. Las cuentas viejas con saldo distinto de cero cuentan como conocidas.
- **Cifras:** el plan del inicio guiado suma exactamente el ingreso (la diferencia del redondeo va a la fila más grande); el
  inicio guiado muestra la misma cifra de "Hoy puedes gastar" que Inicio y Pregúntale (`hoyPuedes`); Pregúntale habla de
  "día a día", no de "gustos".
- **Primera experiencia:** "Probar sin cuenta" se recuerda 30 días (`localStorage`); "Por ahora los anoto yo" viene marcado;
  la meta elegida (viaje, fondo o compra) se crea como la meta gratis; sin nada anotado, Inicio dice "Tu mes ya está
  armado"; la barra de Tu mes contado sale solo cuando hay qué contar; "Nuevo mes" sale solo cuando sirve.
- **Diseño:** en modo oscuro todo lo relleno usa el azul fuerte con texto blanco (`:root[data-modo-oscuro] :is(...)`); la
  pantalla de cuenta lleva la banda azul y el logo con tamaño (antes salía gigante y cortaba el título); el botón de la
  intro ya no tiene anillo dorado; Metas dice "1 gratis".
- **Material de Google Play y videos** regenerados con la noche y el azul (`herramientas/material-tienda.cjs`, `videos-tienda.cjs`).
- **CSP en Cloudflare sin `'unsafe-inline'` en scripts:** `cloudflare/construir.mjs` calcula la huella sha256 de cada script
  en línea de `index.html` y `panel.html` y la pone en `script-src`. Prueba: `pruebas/csp-cloudflare.test.mjs`.
- **Android para Google Play:** `targetSdk` y `compileSdk` 36 (Google Play exige Android 16 a apps nuevas y
  actualizaciones desde el 31 de agosto de 2026), Android Gradle Plugin 8.11.1. Compila (debug y AAB) con la plataforma 36.
  El flujo "App de Android" entrega la APK (`finti-apk`, para la descarga web) y el AAB (`finti-aab-google-play`, para la
  tienda). Al publicar en Play hay que sumar a `assetlinks.json` la huella SHA-256 de la llave de firma de Google Play.
- **Pruebas:** `acepto-previo.js` usa la versión legal 1.2; `inicio.test.js` y `tanda1.test.js` ajustadas a lo nuevo.

## Sin Netlify (22 de noviembre de 2026)
El dueño borró su cuenta de Netlify: con ella se fueron las llaves, los datos del servidor y los respaldos (vivían en Netlify
Blobs). Finti arranca en Cloudflare desde cero. Las llaves que se inventan se crean en la página privada "Llaves de Finti"
(en el navegador del dueño, sin enviarlas a nadie); las de Wompi, Google y Gmail se copian de cada servicio. Como
`LICENSE_SECRET` es nueva, los códigos de Premium anteriores dejan de servir (se reponen con códigos de regalo desde el
panel). `legal/datos.json` tiene `"trasladoTerminado": true`: la política ya no nombra a Netlify. La migración
(`/api/migrar`, el flujo "Migrar a Cloudflare") queda sin uso.

## Pregúntale entiende más: evaluación y mejoras (27 de noviembre de 2026)
- **Cómo se mide:** `pruebas/navegador/ia-bateria.js` tiene frases como las escribe la gente (sin tildes, jerga, errores
  de dedo, como se dictan) con la intención esperada: `PREGUNTAS` (155), `CHARLA` (49 gastos e ingresos contados, con
  monto, categoría y tipo), `CONTROL` (56), `CIEGA` y `CIEGA2` (39 cada una, escritas sin mirar el motor). Las frases
  fuera de tema ("¿cuál es la capital de Francia?") esperan "" (no inventar). `ia-medir.js` las corre en la app con
  `window.FinPreguntas.entender` y `window.FinEntender`; `ia-evaluacion.test.js` exige 95 % en cada una y cero
  respuestas de plata a preguntas que no son de plata.
- **Antes y después:** Pregúntale 79 % → 100 %; Cuéntame un gasto 81 % → 100 %; control 64 % → 100 %. Las ciegas,
  medidas por primera vez, dieron 67 % y 74 %; esos son los números honestos con frases nuevas (después se ajustó con
  sus errores, así que su 100 % ya no es ciego). Para medir otra vez de forma honesta, escribe una batería nueva sin
  mirar el motor.
- **Qué cambió** (`fuente/logica/43-…`, `44-…`, `45-…`):
  - `prArreglarPregunta`: abreviaturas (`PR_ABREV`: q, ke, xq, dbo, grax…), sinónimos a una forma común (billete,
    lana → plata; resta, sobra → queda; guardado → ahorrado; facturas → pagos pendientes), letras repetidas
    ("cuantoo") y errores de dedo hacia el vocabulario de plata (`PR_VOCAB`). En palabras de hasta 6 letras solo se
    corrigen letras cruzadas o una de más o de menos, nunca una letra por otra ("salgo" no es "saldo", "gusto" no es
    "gasto"); nunca se corrige una palabra real del español ni una de menos de 5 letras.
  - Más formas de decir cada intención en `PR_INT`, y reglas de cuidado: "recomiéndame una película" no es un
    consejo de plata; "saldo" no gana si la pregunta es cómo terminar el mes; "qué día" solo es de hábitos si habla
    de gastos.
  - `prParecido`: si ninguna regla calza, la pregunta se compara con ejemplos de cada intención (`PR_BANCO`, palabras
    en común pesando las raras). Solo responde si el parecido es alto, claramente mejor que el segundo y la pregunta
    habla de plata (`PR_DE_PLATA`).
  - "¿A cómo está la papa?" sin compras ni precios guardados: lleva a ¿Dónde compro?, que busca en las tiendas.
  - Gastos contados: números de tres cifras son miles ("tenis de 250", "la cuota del carro 850") salvo con cosas
    baratas (`CH_BARATOS`: "10 panes de 500", "un tinto de 800" son pesos); más verbos de ingreso (me entraron, me
    devolvieron, me prestaron) y de categoría (almorcé, ahorré).
