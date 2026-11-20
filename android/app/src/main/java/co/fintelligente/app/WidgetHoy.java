package co.fintelligente.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

/**
 * Widget "Hoy puedes gastar": un toque abre la app en el Inicio, donde está la cifra del día.
 * La cifra no se pinta en la pantalla de inicio a propósito: ahí la vería cualquiera que tome el celular.
 * (Además, los datos viven en la parte web de la app y nunca pasan por la parte nativa.)
 */
public class WidgetHoy extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, vista(c));
    }

    static RemoteViews vista(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_hoy);
        int f = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        Intent abrir = new Intent(c, InicioActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent p = PendingIntent.getActivity(c, 43, abrir, f);
        v.setOnClickPendingIntent(R.id.hoy_raiz, p);
        v.setOnClickPendingIntent(R.id.hoy_ver, p);
        return v;
    }
}
