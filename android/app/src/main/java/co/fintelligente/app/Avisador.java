package co.fintelligente.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/** Notificación propia: Nuevo movimiento · $45.900 · Bancolombia. Al tocarla se abre la app con el movimiento. */
final class Avisador {
    static final String CANAL = "movimientos";
    static final int ID = 7;

    private Avisador() {}

    static void mostrar(Context c, String texto, String app) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CANAL) == null) {
            NotificationChannel ch = new NotificationChannel(CANAL, "Movimientos detectados", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("Avisa cuando un pago o transferencia llega a Por confirmar.");
            ch.setShowBadge(true);
            nm.createNotificationChannel(ch);
        }
        int n = Cola.contar(c);
        String monto = Filtro.montoVisible(texto);
        String titulo = n > 1 ? n + " movimientos por confirmar"
            : "Nuevo movimiento" + (monto.isEmpty() ? "" : " de " + monto) + (app == null || app.isEmpty() ? "" : " en " + app);
        String cuerpo = n > 1 ? "Toca para revisarlos en Finti." : "Toca para confirmarlo en Finti.";

        Intent abrir = InicioActivity.abrir(c);
        PendingIntent pi = PendingIntent.getActivity(c, 0, abrir, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CANAL) : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_notif)
            .setColor(0xFF6A4AF0)
            .setContentTitle(titulo)
            .setContentText(cuerpo)
            .setNumber(n)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .setCategory(Notification.CATEGORY_STATUS)
            .setVisibility(Notification.VISIBILITY_PRIVATE);
        try { nm.notify(ID, b.build()); } catch (SecurityException ignorada) { /* sin permiso de notificaciones: queda en la cola igual */ }
    }

    static final String CANAL_CUIDADO = "cuidado";
    static final int ID_ESTAFA = 8;

    /** Llegó un mensaje que pide confirmar un pago por un enlace: no se registra y se avisa a la persona. */
    static void alertaEstafa(Context c, String app) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CANAL_CUIDADO) == null) {
            NotificationChannel ch = new NotificationChannel(CANAL_CUIDADO, "Posibles estafas", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Avisa cuando llega un mensaje que pide confirmar un pago por un enlace.");
            nm.createNotificationChannel(ch);
        }
        Intent abrir = new Intent(c, PrivacidadActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent pi = PendingIntent.getActivity(c, 1, abrir, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String cuerpo = "Llegó un mensaje" + (app == null || app.isEmpty() ? "" : " en " + app)
            + " que pide confirmar un pago por un enlace. Los bancos y Bre-B nunca lo hacen. No lo abras; revisa en la app de tu banco.";
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CANAL_CUIDADO) : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_notif)
            .setColor(0xFFC2410C)
            .setContentTitle("Cuidado: parece una estafa")
            .setContentText(cuerpo)
            .setStyle(new Notification.BigTextStyle().bigText(cuerpo))
            .setAutoCancel(true)
            .setContentIntent(pi)
            .setCategory(Notification.CATEGORY_STATUS);
        try { nm.notify(ID_ESTAFA, b.build()); } catch (SecurityException ignorada) { }
    }

    static void quitar(Context c) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(ID);
    }
}
