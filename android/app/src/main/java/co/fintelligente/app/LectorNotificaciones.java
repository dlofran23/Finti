package co.fintelligente.app;

import android.app.Notification;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Parcelable;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

/**
 * Lee los avisos de bancos y billeteras en el momento en que llegan.
 * Lo que no es un aviso de dinero se ignora sin guardarse. Nada se envía a internet desde aquí.
 */
public class LectorNotificaciones extends NotificationListenerService {

    @Override
    public void onListenerConnected() {
        getSharedPreferences("ajustes", MODE_PRIVATE).edit().putLong("conectado", System.currentTimeMillis()).apply();
    }

    @Override
    public void onListenerDisconnected() {
        Acceso.reconectar(this);
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            if (sbn == null || getPackageName().equals(sbn.getPackageName())) return;
            Notification n = sbn.getNotification();
            if (n == null || sbn.isOngoing() || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;

            String paquete = sbn.getPackageName();
            String app = nombreApp(paquete);
            // Otras apps, chats, o lo que la persona decidió no leer (pausa, SMS, correo): ni siquiera se abre el texto.
            if (!Registro.permitida(this, Filtro.tipoDeApp(paquete, app))) { Registro.contar(this, Registro.OTRAS); return; }

            String texto = textoDe(n);
            String motivo = Filtro.motivo(paquete, app, texto);
            if ("estafa".equals(motivo)) { Registro.contar(this, Registro.ESTAFAS); Avisador.alertaEstafa(this, app); return; }
            if (Filtro.noEntendido(paquete, app, texto, motivo)) { Registro.noEntendido(this, app, texto, sbn.getPostTime()); return; }
            if (!"ok".equals(motivo)) { Registro.contar(this, "codigo".equals(motivo) ? Registro.CODIGOS : Registro.SIN_DINERO); return; }

            String limpio = Filtro.tapar(texto);
            if (Cola.agregar(this, limpio, app, sbn.getPostTime())) {
                Registro.guardado(this, app, Filtro.montoVisible(limpio), sbn.getPostTime());
                Avisador.mostrar(this, limpio, app);
            }
        } catch (Exception ignorada) {
            // Nunca dejamos que un aviso raro tumbe el servicio.
        }
    }

    private String nombreApp(String paquete) {
        try {
            PackageManager pm = getPackageManager();
            ApplicationInfo ai = pm.getApplicationInfo(paquete, 0);
            CharSequence l = pm.getApplicationLabel(ai);
            return l == null ? "" : l.toString();
        } catch (Exception e) {
            return "";
        }
    }

    static String textoDe(Notification n) {
        Bundle x = n.extras;
        if (x == null) return "";
        StringBuilder sb = new StringBuilder();
        CharSequence titulo = x.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence cuerpo = x.getCharSequence(Notification.EXTRA_BIG_TEXT);
        if (cuerpo == null) cuerpo = x.getCharSequence(Notification.EXTRA_TEXT);

        // Apps de mensajes (SMS): el último mensaje de la conversación.
        Parcelable[] mensajes = x.getParcelableArray(Notification.EXTRA_MESSAGES);
        if (mensajes != null && mensajes.length > 0 && mensajes[mensajes.length - 1] instanceof Bundle) {
            CharSequence ultimo = ((Bundle) mensajes[mensajes.length - 1]).getCharSequence("text");
            if (ultimo != null) cuerpo = ultimo;
        }
        if (cuerpo == null) {
            CharSequence[] lineas = x.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
            if (lineas != null && lineas.length > 0) cuerpo = lineas[lineas.length - 1];
        }
        if (titulo != null) sb.append(titulo).append(": ");
        if (cuerpo != null) sb.append(cuerpo);
        return sb.toString().trim();
    }
}
