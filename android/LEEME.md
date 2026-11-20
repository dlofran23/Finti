# Fintelligente para Android

App que abre Fintelligente (https://fintelligentx.netlify.app) a pantalla completa y lee, dentro del celular,
los avisos de bancos y billeteras para dejarlos en **Por confirmar**.

- `BienvenidaActivity`: primera pantalla; activa la lectura con un botón.
- `LectorNotificaciones` + `Filtro`: deciden qué avisos son de dinero. Lo demás se ignora sin guardarse.
- `Cola`: guarda los avisos en el celular hasta que abras la app.
- `InicioActivity`: abre la web y le pasa los avisos en `#importar-lote=` (esa parte de la dirección no se envía a ningún servidor).
- `AccionActivity`: recibe `fintelligente://ajustes` desde la web.

## Compilar
Necesitas el Android SDK (plataforma 35) y Gradle 8.9 o superior.

    export FIN_KEYSTORE=/ruta/fintelligente.jks
    export FIN_KS_PASS=la-contraseña
    gradle assembleRelease

La llave de firma (`fintelligente.jks`) NO va en GitHub. Guárdala en un lugar seguro: sin ella no puedes publicar
actualizaciones con la misma firma, y el sitio (`/assetlinks.json`) solo reconoce esa firma.
