package co.fintelligente.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

/** Recibe los enlaces fintelligente:// que vienen de la página (por ejemplo Activar lectura automática). */
public class AccionActivity extends Activity {
    private static final int AJUSTES = 1;

    @Override
    protected void onCreate(Bundle s) {
        super.onCreate(s);
        Uri u = getIntent() != null ? getIntent().getData() : null;
        String que = u != null ? u.getHost() : "";
        if ("ajustes".equals(que)) {
            try { startActivityForResult(Acceso.ajusteLectura(this), AJUSTES); return; } catch (Exception ignorada) { }
        }
        if ("efectivo".equals(que)) {
            String tipo = u.getLastPathSegment();
            startActivity(InicioActivity.abrirAccion(this, "ingreso".equals(tipo) ? "efectivo-ingreso" : "efectivo-gasto"));
            finish();
            return;
        }
        if ("deuda".equals(que)) {
            // Atajos del ícono para deudas con amigos: abren el formulario de Te deben en la página
            startActivity(InicioActivity.abrirAccion(this, "mepagaron".equals(u.getLastPathSegment()) ? "mepagaron" : "preste"));
            finish();
            return;
        }
        if ("boton-efectivo".equals(que)) { pedirBotonEfectivo(); return; }
        if ("voz".equals(que)) { startActivity(new Intent(this, VozActivity.class)); finish(); overridePendingTransition(0, 0); return; }
        if ("privacidad".equals(que)) { startActivity(new Intent(this, PrivacidadActivity.class)); finish(); return; }
        volver();
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        volver();
    }

    /** Pide a Android agregar el botón Finti a la barra de notificaciones (Android 13+); antes, explica cómo. */
    private void pedirBotonEfectivo() {
        if (Build.VERSION.SDK_INT >= 33) {
            try {
                android.app.StatusBarManager sbm = getSystemService(android.app.StatusBarManager.class);
                sbm.requestAddTileService(new android.content.ComponentName(this, EfectivoTile.class), getString(R.string.boton_efectivo),
                    android.graphics.drawable.Icon.createWithResource(this, R.drawable.ic_finti_boton), getMainExecutor(), r -> volverSinRecargar());
                return;
            } catch (Exception ignorada) { }
        }
        android.widget.Toast.makeText(this, "Desliza la barra de notificaciones hacia abajo dos veces, toca el lápiz y arrastra el botón Finti.", android.widget.Toast.LENGTH_LONG).show();
        volverSinRecargar();
    }

    private void volverSinRecargar() { finish(); }

    /** Vuelve a abrir la página para que muestre si la lectura quedó activa. */
    private void volver() {
        startActivity(InicioActivity.abrir(this));
        finish();
    }
}
