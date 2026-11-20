package co.fintelligente.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

/** Utilidades para saber si la lectura está activa y abrir el ajuste correcto. */
final class Acceso {
    private Acceso() {}

    static boolean lecturaActiva(Context c) {
        String activos = Settings.Secure.getString(c.getContentResolver(), "enabled_notification_listeners");
        if (activos == null) return false;
        ComponentName yo = new ComponentName(c, LectorNotificaciones.class);
        for (String s : activos.split(":")) {
            ComponentName cn = ComponentName.unflattenFromString(s);
            if (yo.equals(cn)) return true;
        }
        return false;
    }

    /** Intención que abre el interruptor de Finti (o la lista, en Android viejo). */
    static Intent ajusteLectura(Context c) {
        if (Build.VERSION.SDK_INT >= 30) {
            Intent i = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS);
            i.putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME,
                new ComponentName(c, LectorNotificaciones.class).flattenToString());
            if (i.resolveActivity(c.getPackageManager()) != null) return i;
        }
        return new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
    }

    /** Pide a Android que vuelva a conectar el lector (tras actualizar la app a veces queda desconectado). */
    static void reconectar(Context c) {
        try {
            android.service.notification.NotificationListenerService.requestRebind(new ComponentName(c, LectorNotificaciones.class));
        } catch (Exception ignorada) { }
    }

    /** true si la app no vino de Play Store: en Android 13+ el ajuste aparece restringido hasta permitirlo. */
    static boolean instaladaFueraDePlay(Context c) {
        try {
            String origen;
            if (Build.VERSION.SDK_INT >= 30) origen = c.getPackageManager().getInstallSourceInfo(c.getPackageName()).getInstallingPackageName();
            else origen = c.getPackageManager().getInstallerPackageName(c.getPackageName());
            return !"com.android.vending".equals(origen);
        } catch (Exception e) {
            return true;
        }
    }

    /** Marcas que suelen cerrar apps en segundo plano y apagan la lectura. */
    static boolean fabricanteEstricto() {
        String m = (Build.MANUFACTURER == null ? "" : Build.MANUFACTURER).toLowerCase(java.util.Locale.ROOT);
        return m.contains("xiaomi") || m.contains("redmi") || m.contains("poco") || m.contains("huawei") || m.contains("honor")
            || m.contains("oppo") || m.contains("realme") || m.contains("vivo") || m.contains("oneplus") || m.contains("tecno") || m.contains("infinix");
    }

    static Intent ajusteBateria() {
        return new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
    }

    /** Información de la app: ahí está Permitir ajustes restringidos cuando se instala fuera de Play Store. */
    static Intent infoApp(Context c) {
        return new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + c.getPackageName()));
    }
}
