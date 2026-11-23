# Google Play: textos y respuestas listos para la ficha de Finti

Revisar antes de enviar: Google cambia los formularios con frecuencia. Estas respuestas describen lo que hace la versión 1.6 de la app.

## Direcciones que pide la consola

| Campo | Dirección |
|---|---|
| Política de privacidad | `https://finti.francisco-jzx14.workers.dev/privacidad` |
| Eliminación de cuenta (Seguridad de los datos → Eliminación de datos) | `https://finti.francisco-jzx14.workers.dev/eliminar-cuenta` |
| Términos (opcional, en la descripción) | `https://finti.francisco-jzx14.workers.dev/terminos` |

## Público objetivo y contenido

- **Grupos de edad:** 13 a 15 (la app exige 14 como mínimo), 16 a 17 y 18 o más. No marcar menores de 13: así no aplica la política de Familias.
- **Anuncios:** la app no tiene anuncios.
- **App financiera (declaración de funciones financieras):** "Otra" → herramienta de presupuesto personal. No ofrece préstamos, inversión, criptomonedas ni pagos entre personas.
- **Acceso a la app para revisión:** la app se puede usar sin cuenta (botón Probar sin cuenta). Para revisar la cuenta, dar un correo de prueba o indicar que se entra con Google.

## Aviso destacado y permiso de notificaciones

La app usa `NotificationListenerService` (lectura de notificaciones) solo para su función principal: registrar los pagos que avisan los bancos.

- **Aviso dentro de la app:** aparece en la pantalla de bienvenida, antes de pedir el permiso. Dice qué lee, para qué, que el texto no se envía a servidores y cómo quitar el permiso. Tiene un enlace a la política.
- **Aceptación:** la persona toca Activar lectura automática. También puede seguir con Entrar sin activarla.
- **Video para revisión:** mostrar la bienvenida, el aviso, el permiso del sistema, un pago de prueba que llega a Por confirmar y cómo se desactiva.

## Seguridad de los datos (formulario)

**¿La app recopila o comparte datos?** Sí, recopila. No comparte con terceros, en el sentido de Google: los proveedores que procesan datos por cuenta de la app no cuentan como "compartir".

**¿Los datos se cifran en tránsito?** Sí.

**¿Se puede pedir que se borren?** Sí, desde la app (Tu cuenta) o en la dirección de eliminación.

| Tipo de dato (Google) | ¿Se recopila? | Obligatorio u opcional | Finalidad |
|---|---|---|---|
| Información personal → Dirección de correo electrónico | Sí | Opcional (solo con cuenta, recordatorios por correo o compra de Premium) | Funcionalidad de la app; administración de la cuenta |
| Información personal → Nombre | Sí | Opcional (si entra con Google) | Administración de la cuenta |
| Información financiera → Otra información financiera (presupuesto, movimientos, metas y deudas) | Sí | Opcional (solo con cuenta, en la copia cifrada) | Funcionalidad de la app |
| Información financiera → Historial de compras (compra de Premium) | Sí | Opcional | Funcionalidad de la app; administración de la cuenta |
| Mensajes → Otros mensajes en la app (texto de avisos del banco en el buzón de iPhone o correo) | Sí, de forma temporal y cifrada | Opcional | Funcionalidad de la app |
| Mensajes → Otros mensajes en la app (formulario de PQR: lo que la persona escribe, con su nombre y correo) | Sí | Opcional (solo si radica una PQR) | Atención al cliente |
| Identificadores de dispositivo u otros (identificador de recordatorios, suscripción de notificaciones) | Sí | Opcional | Funcionalidad de la app |
| Ubicación, contactos, fotos, audio, salud, navegación | No | | |

Respuestas sobre la lectura de notificaciones en Android: el texto de las notificaciones se procesa **solo en el dispositivo** y no sale de él. Según la guía de Google, lo que no sale del dispositivo no se declara como recopilado. El movimiento que la persona confirma sí entra en "Otra información financiera", si tiene cuenta.

Respuestas sobre el micrófono (Cuéntame un gasto, versión 1.8): la app pide `RECORD_AUDIO` solo al tocar el micrófono o el botón Efectivo. La voz se reconoce con el reconocimiento **dentro del teléfono** (`createOnDeviceSpeechRecognizer`), el audio no se guarda ni sale del dispositivo, y a la página solo pasa el texto, que también se interpreta en el dispositivo. Por eso "audio" sigue en No. Si Google pregunta por el permiso, explicar que es para registrar gastos con la voz y que es opcional (se puede escribir).

Widget y foto de tirilla (versión 1.8): el widget de la pantalla de inicio no muestra cifras. La foto de una tirilla se lee en el dispositivo con un lector descargado del propio sitio; no se envía ni se guarda, así que "fotos" sigue en No.

Versión 1.9: segundo widget, "Hoy puedes gastar", que solo abre la app (no muestra cifras). El escáner de recibos usa la cámara desde la parte web para leer el código de barras en el dispositivo; la imagen no se guarda ni se envía, así que "fotos" sigue en No. Los retos con amigos guardan un apodo elegido por la persona y los días cumplidos (sin montos): revisar si Google Play pide declararlo como "Otro contenido generado por el usuario" en la sección de seguridad de los datos.

**Datos de tarjetas:** la app no los recopila; el pago lo procesa Wompi en su propia página.

## Descripción corta sugerida (80 caracteres)

Tu presupuesto en orden: registra gastos solos desde los avisos de tu banco.

## Pagos dentro de la app (política de pagos de Google Play)

- La app de Android **no vende Premium**: no muestra el pago con Wompi ni enlaza a la web para pagar. Solo permite activar una compra hecha antes (con la referencia) o un código de regalo.
- En Colombia, la opción de medios de pago alternativos dentro de las apps de Google Play llega el 30 de septiembre de 2027. Antes de esa fecha, vender Premium dentro de la app exige la facturación de Google Play.
- Al declarar la app en la consola: no ofrece compras dentro de la app (mientras no se integre la facturación de Google Play).

## Recordatorio

- Si la cuenta de desarrollador es personal y nueva, Google exige una prueba cerrada con 12 personas durante 14 días antes de publicar en producción. Una cuenta de organización (por ejemplo, a nombre de una SAS) no tiene ese requisito.
- Cada vez que cambie lo que hace la app con los datos, hay que actualizar la política, este formulario y subir `version` en `legal/datos.json`.
