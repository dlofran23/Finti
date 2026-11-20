package co.fintelligente.app;

import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;

/** Botón Finti en la barra de notificaciones: gastos, ingresos, deudas con amigos o preguntas, con la voz (en el teléfono) o para escribir. */
public class EfectivoTile extends TileService {

    @Override
    public void onStartListening() {
        Tile t = getQsTile();
        if (t == null) return;
        t.setLabel(getString(R.string.boton_efectivo));
        if (Build.VERSION.SDK_INT >= 29) t.setSubtitle(getString(R.string.boton_efectivo_sub));
        t.setState(Tile.STATE_INACTIVE);
        t.updateTile();
    }

    @Override
    public void onClick() {
        if (isLocked()) unlockAndRun(this::abrir); else abrir();
    }

    private void abrir() {
        Intent i = new Intent(this, VozActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                PendingIntent pi = PendingIntent.getActivity(this, 11, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
                startActivityAndCollapse(pi);
            } else {
                startActivityAndCollapseCompat(i);
            }
        } catch (Exception e) {
            // Algunos fabricantes no permiten abrir desde la barra con este método: se abre directo.
            try { startActivity(i); } catch (Exception ignorada) { }
        }
    }

    @SuppressWarnings("deprecation")
    private void startActivityAndCollapseCompat(Intent i) { startActivityAndCollapse(i); }
}
