# Kit del cambio a Finti

Íconos nuevos (la F blanca sobre azul eléctrico #2E5BFF, en degradado, con la moneda #FFC53D; el dueño aprobó el azul el 17 de noviembre de 2026). Se regeneran con `node herramientas/iconos-finti.cjs` y la herramienta que cambia el nombre visible.
No se aplica hasta que la consulta en la SIC salga bien. Probado en una copia: con todo aplicado, la app se construye y
las pruebas pasan.

- `web/`: icon-192, icon-512, icon-maskable-512 (símbolo dentro de la zona segura), apple-touch-icon, badge-96
  (silueta blanca para notificaciones) y favicon.svg.
- `android/`: ic_launcher en las cinco densidades, ic_notif (silueta blanca) y play-icono-512 para la ficha de Google Play.
- Herramienta: `python3 herramientas/cambiar-a-finti.py` (sin opciones solo muestra qué cambiaría).
  `--aplicar iconos` sirve también con el nombre Fintelligente; `--aplicar nombre` cambia el nombre visible.

Lo que el cambio de nombre no toca a propósito: el paquete `co.fintelligente.app`, el dominio, las claves guardadas en el
navegador (`fintelligente-…`), los almacenes y las direcciones de la API. Cambiarlos haría perder los datos de la gente.

Para revisar a mano al cambiar:
- Documentos legales (términos, privacidad, empresas, eliminar cuenta): se cambian solo con `--legal`, después de revisarlos.
- El atajo de iPhone: quien ya lo instaló lo tiene con el nombre Fintelligente; las instrucciones nuevas dirán Finti.
- Google Play: nombre de la ficha, ícono de 512, capturas y gráfico destacado (están en `material-tienda/`).
- Android: subir versionCode y versionName, compilar y firmar.
