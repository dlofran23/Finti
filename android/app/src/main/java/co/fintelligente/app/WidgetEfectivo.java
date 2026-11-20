package co.fintelligente.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

/**
 * Widget de la pantalla de inicio: el micrófono abre Cuéntame un gasto con la voz (reconocimiento dentro del teléfono)
 * y Escribir abre la charla para escribirlo. No muestra cifras: el widget se ve aunque el celular esté en manos de otro.
 */
public class WidgetEfectivo extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, vista(c));
    }

    static RemoteViews vista(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_efectivo);
        int f = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        Intent voz = new Intent(c, VozActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent pv = PendingIntent.getActivity(c, 41, voz, f);
        v.setOnClickPendingIntent(R.id.widget_mic, pv);
        v.setOnClickPendingIntent(R.id.widget_raiz, pv);
        PendingIntent pe = PendingIntent.getActivity(c, 42, InicioActivity.abrirAccion(c, "charla"), f);
        v.setOnClickPendingIntent(R.id.widget_escribir, pe);
        return v;
    }
}
