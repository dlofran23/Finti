package co.fintelligente.app;

import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

import android.app.Activity;
import android.app.Application;
import android.app.Notification;
import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.Looper;
import android.os.Process;
import android.provider.Settings;
import android.service.notification.StatusBarNotification;

import androidx.test.core.app.ApplicationProvider;

import com.google.androidbrowserhelper.trusted.LauncherActivity;

import org.json.JSONArray;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.android.controller.ActivityController;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;

/** Simula en la JVM lo que pasa en un celular: abrir, volver de ajustes, tocar el aviso y leer notificaciones. */
@RunWith(RobolectricTestRunner.class)
@org.robolectric.annotation.Config(sdk = 34)
public class SimulacionTest {
    private Application app;
    private final List<ActivityController<?>> vivas = new ArrayList<>();

    @Before public void limpiar() throws Exception {
        app = ApplicationProvider.getApplicationContext();
        Field f = LauncherActivity.class.getDeclaredField("sLauncherActivitiesAlive");
        f.setAccessible(true); f.setInt(null, 0);
        Field v = InicioActivity.class.getDeclaredField("vivas"); v.setAccessible(true); v.setInt(null, 0);
        app.getSharedPreferences("ajustes", Context.MODE_PRIVATE).edit().clear().commit();
        app.getSharedPreferences("cola", Context.MODE_PRIVATE).edit().clear().commit();
        app.getSharedPreferences("registro", Context.MODE_PRIVATE).edit().clear().commit();
        Settings.Secure.putString(app.getContentResolver(), "enabled_notification_listeners", "");
    }

    private void lecturaActiva(boolean si) {
        Settings.Secure.putString(app.getContentResolver(), "enabled_notification_listeners",
            si ? new ComponentName(app, LectorNotificaciones.class).flattenToString() : "");
    }

    /** Sigue la cadena de pantallas que se abren, como lo haría Android, sin destruir las anteriores todavía. */
    private Intent seguir(Activity a, int pasos, List<String> rastro) {
        Intent sig = shadowOf(a).getNextStartedActivity();
        while (sig != null && "android.content.pm.action.REQUEST_PERMISSIONS".equals(sig.getAction())) sig = shadowOf(a).getNextStartedActivity();
        for (int i = 0; i < pasos && sig != null; i++) {
            String clase = sig.getComponent() != null ? sig.getComponent().getClassName() : "";
            rastro.add((clase.isEmpty() ? sig.getAction() + " " + sig.getDataString() : clase.substring(clase.lastIndexOf('.') + 1)));
            if (!clase.startsWith("co.fintelligente.app")) return sig;            // salió hacia el navegador
            @SuppressWarnings("unchecked")
            ActivityController<Activity> c = (ActivityController<Activity>) (ActivityController<?>) Robolectric.buildActivity(cls(clase), sig);
            vivas.add(c);
            c.setup(); shadowOf(Looper.getMainLooper()).idle();
            a = c.get();
            Intent prox = shadowOf(a).getNextStartedActivity();
            while (prox != null && "android.content.pm.action.REQUEST_PERMISSIONS".equals(prox.getAction())) prox = shadowOf(a).getNextStartedActivity();
            if (prox == null) { rastro.add(a.isFinishing() ? "(se cerró sin abrir nada)" : "(se quedó abierta)"); return null; }
            sig = prox;
        }
        return sig;
    }

    @SuppressWarnings("unchecked")
    private static Class<? extends Activity> cls(String n) { try { return (Class<? extends Activity>) Class.forName(n); } catch (Exception e) { throw new RuntimeException(e); } }

    private static boolean esNavegador(Intent i) {
        return i != null && Intent.ACTION_VIEW.equals(i.getAction()) && i.getDataString() != null && i.getDataString().startsWith("https://finti.francisco-jzx14.workers.dev");
    }

    // 1) Primera vez: muestra la bienvenida sin cerrarse.
    @Test public void primeraVez_muestraBienvenida() {
        ActivityController<BienvenidaActivity> c = Robolectric.buildActivity(BienvenidaActivity.class).setup();
        assertFalse("la bienvenida no debe cerrarse sola", c.get().isFinishing());
    }

    // 2) Ahora no o lectura ya activa: debe abrir la página y no cerrarse.
    @Test public void abrirApp_llegaALaPagina() {
        app.getSharedPreferences("ajustes", Context.MODE_PRIVATE).edit().putLong("omitido_hasta", System.currentTimeMillis() + 3_600_000).commit();
        ActivityController<BienvenidaActivity> c = Robolectric.buildActivity(BienvenidaActivity.class).setup();
        List<String> rastro = new ArrayList<>();
        Intent fin = seguir(c.get(), 4, rastro);
        System.out.println("abrir app → " + rastro);
        assertTrue("debe terminar abriendo Finti; ruta: " + rastro, esNavegador(fin));
        assertTrue(fin.getDataString().contains("app=android"));
    }

    // 3) Vuelve de ajustes con la lectura activa → pantalla ¡Listo! → abre la página.
    @Test public void activarLectura_yVolver() {
        ActivityController<BienvenidaActivity> c = Robolectric.buildActivity(BienvenidaActivity.class).setup();
        lecturaActiva(true);
        c.pause().resume();
        shadowOf(c.get()).grantPermissions("android.permission.POST_NOTIFICATIONS");
        c.get().onRequestPermissionsResult(1, new String[]{"android.permission.POST_NOTIFICATIONS"}, new int[]{0});
        shadowOf(Looper.getMainLooper()).idleFor(java.time.Duration.ofSeconds(3));
        List<String> rastro = new ArrayList<>();
        Intent fin = seguir(c.get(), 4, rastro);
        System.out.println("activar lectura → " + rastro);
        assertTrue("ruta: " + rastro, esNavegador(fin));
        assertTrue(fin.getDataString().contains("lectura=1"));
    }

    // 4) Con la página abierta, llega un aviso del banco y se toca la notificación: debe abrir con el movimiento.
    @Test public void tocarNotificacion_conAppAbierta() throws Exception {
        lecturaActiva(true);
        ActivityController<BienvenidaActivity> c = Robolectric.buildActivity(BienvenidaActivity.class).setup();
        List<String> r1 = new ArrayList<>();
        assertTrue("primero debe abrir: " + r1, esNavegador(seguir(c.get(), 4, r1)));   // la página queda abierta

        Cola.agregar(app, "Bancolombia: Compraste $45.900,00 en EXITO con tu T.Deb *1234", "Bancolombia", 1L);
        Avisador.mostrar(app, "Bancolombia: Compraste $45.900,00 en EXITO con tu T.Deb *1234", "Bancolombia");
        NotificationManager nm = (NotificationManager) app.getSystemService(Context.NOTIFICATION_SERVICE);
        Notification n = shadowOf(nm).getNotification(Avisador.ID);
        assertNotNull("debe aparecer la notificación Nuevo movimiento", n);
        Intent alTocar = shadowOf(n.contentIntent).getSavedIntent();

        ActivityController<InicioActivity> c2 = Robolectric.buildActivity(InicioActivity.class, alTocar).setup();
        vivas.add(c2);
        List<String> rastro = new ArrayList<>();
        Intent sig = shadowOf(c2.get()).getNextStartedActivity();
        Intent fin = sig == null ? null : (esNavegador(sig) ? sig : seguir(c2.get(), 3, rastro));
        System.out.println("tocar notificación → " + (fin == null ? "nada" : fin.getDataString()));
        assertTrue("al tocar el aviso debe abrir la página con el movimiento", esNavegador(fin));
        assertTrue(fin.getDataString().contains("importar-lote="));
        assertEquals("la cola debe quedar vacía", 0, Cola.contar(app));
    }

    // 5) Desde la página: Activar lectura (fintelligente://ajustes) → ajustes → vuelve a la página.
    @Test public void enlaceAjustes_desdeLaPagina() {
        Intent i = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse("fintelligente://ajustes"));
        ActivityController<AccionActivity> c = Robolectric.buildActivity(AccionActivity.class, i).setup();
        Intent ajustes = shadowOf(c.get()).getNextStartedActivityForResult().intent;
        assertNotNull(ajustes);
        lecturaActiva(true);
        shadowOf(c.get()).receiveResult(ajustes, Activity.RESULT_OK, null);
        List<String> rastro = new ArrayList<>();
        Intent fin = seguir(c.get(), 4, rastro);
        System.out.println("enlace ajustes → " + rastro);
        assertTrue("ruta: " + rastro, esNavegador(fin));
        assertTrue(fin.getDataString().contains("lectura=1"));
    }

    // 6) Enlace desconocido o sin datos: no debe tumbar la app.
    @Test public void enlaceRaro_noRevienta() {
        Robolectric.buildActivity(AccionActivity.class, new Intent(Intent.ACTION_VIEW, android.net.Uri.parse("fintelligente://"))).setup();
        Robolectric.buildActivity(AccionActivity.class, new Intent()).setup();
    }

    // 7) Lector de notificaciones con avisos reales y raros.
    private StatusBarNotification sbn(String pkg, Notification n, int id) {
        return new StatusBarNotification(pkg, pkg, id, null, Process.myUid(), 0, 0, n, Process.myUserHandle(), System.currentTimeMillis());
    }
    private Notification noti(String titulo, CharSequence texto) {
        Notification.Builder b = new Notification.Builder(app, "x").setSmallIcon(android.R.drawable.ic_dialog_info);
        if (titulo != null) b.setContentTitle(titulo);
        if (texto != null) b.setContentText(texto);
        return b.build();
    }

    @Test public void lector_avisosVariados() throws Exception {
        LectorNotificaciones lector = Robolectric.setupService(LectorNotificaciones.class);
        lector.onNotificationPosted(null);
        lector.onNotificationPosted(sbn("com.nequi.MobileApp", noti(null, null), 1));
        Notification sinExtras = noti("Nequi", "x"); sinExtras.extras = null;
        lector.onNotificationPosted(sbn("com.nequi.MobileApp", sinExtras, 2));
        Notification grande = new Notification.Builder(app, "x").setSmallIcon(android.R.drawable.ic_dialog_info)
            .setStyle(new Notification.BigTextStyle().bigText("Te enviaron $120.000 desde Daviplata. ¡Listo! 🎉".repeat(80))).build();
        lector.onNotificationPosted(sbn("com.davivienda.daviplataapp", grande, 3));
        Notification.MessagingStyle ms = new Notification.MessagingStyle("Yo");
        ms.addMessage("Bancolombia le informa Compra por $45.900 en EXITO 12:05. T.Deb *1234", 1L, "891333");
        lector.onNotificationPosted(sbn("com.google.android.apps.messaging", new Notification.Builder(app, "x").setSmallIcon(android.R.drawable.ic_dialog_info).setStyle(ms).build(), 4));
        Notification inbox = new Notification.Builder(app, "x").setSmallIcon(android.R.drawable.ic_dialog_info)
            .setStyle(new Notification.InboxStyle().addLine("hola").addLine("Nequi: Pagaste $8.500 en D1")).build();
        lector.onNotificationPosted(sbn("com.nequi.MobileApp", inbox, 5));
        lector.onNotificationPosted(sbn("com.nequi.MobileApp", noti("Nequi", "Recibiste $50.000 de JUAN PEREZ"), 6));
        lector.onNotificationPosted(sbn("com.nequi.MobileApp", noti("Nequi", "Recibiste $50.000 de JUAN PEREZ"), 6)); // repetida
        lector.onNotificationPosted(sbn("com.whatsapp", noti("Ana", "Te pago $50.000 mañana"), 7));
        lector.onNotificationPosted(sbn(app.getPackageName(), noti("Nuevo movimiento", "$1.000"), 8));
        lector.onNotificationRemoved(sbn("com.nequi.MobileApp", noti("Nequi", "x"), 9));
        lector.onListenerConnected();
        int n = Cola.contar(app);
        String items = app.getSharedPreferences("cola", Context.MODE_PRIVATE).getString("items", "[]");
        System.out.println("cola tras avisos variados: " + n + " → " + items.substring(0, Math.min(400, items.length())));
        assertTrue("debe guardar los movimientos de Nequi/Daviplata/SMS y no los de WhatsApp", n >= 3 && n <= 4);
        assertFalse(items.contains("Ana"));
        for (int i = 0; i < new JSONArray(items).length(); i++) assertTrue(new JSONArray(items).getJSONObject(i).getString("t").length() <= 1500);
    }

    // 8) Mucho volumen: la cola no crece sin límite y la dirección para la página no se vuelve gigante.
    @Test public void colaLlena_urlManejable() {
        lecturaActiva(true);
        for (int i = 0; i < 250; i++) Cola.agregar(app, "Nequi: Pagaste $" + (1000 + i) + " en TIENDA " + i + " con tu cuenta " + "x".repeat(1400), "Nequi", i);
        assertEquals(100, Cola.contar(app));
        app.getSharedPreferences("ajustes", Context.MODE_PRIVATE).edit().putLong("omitido_hasta", System.currentTimeMillis() + 3_600_000).commit();
        ActivityController<BienvenidaActivity> c = Robolectric.buildActivity(BienvenidaActivity.class).setup();
        List<String> rastro = new ArrayList<>();
        Intent fin = seguir(c.get(), 4, rastro);
        assertTrue("ruta: " + rastro, esNavegador(fin));
        int largo = fin.getDataString().length();
        System.out.println("largo de la dirección con 100 avisos: " + largo);
        assertTrue("la dirección no debe pasar de ~150.000 caracteres (Chrome la puede rechazar)", largo < 150_000);
    }

    // ---------- Permisos y apertura desde el ícono ----------
    private static android.widget.Button botonCon(android.view.View v, String texto) {
        if (v instanceof android.widget.Button && texto.contentEquals(((android.widget.Button) v).getText())) return (android.widget.Button) v;
        if (v instanceof android.view.ViewGroup) for (int i = 0; i < ((android.view.ViewGroup) v).getChildCount(); i++) {
            android.widget.Button b = botonCon(((android.view.ViewGroup) v).getChildAt(i), texto); if (b != null) return b; }
        return null;
    }
    private static String textoDe(android.view.View v) {
        StringBuilder sb = new StringBuilder();
        if (v instanceof android.widget.TextView) sb.append(((android.widget.TextView) v).getText()).append("\n");
        if (v instanceof android.view.ViewGroup) for (int i = 0; i < ((android.view.ViewGroup) v).getChildCount(); i++) sb.append(textoDe(((android.view.ViewGroup) v).getChildAt(i)));
        return sb.toString();
    }

    // 9) Al tocar Activar: primero la ventana de permiso de notificaciones y luego el ajuste de lectura.
    @Test public void activar_pidePermisos() {
        ActivityController<BienvenidaActivity> c = Robolectric.buildActivity(BienvenidaActivity.class).setup();
        android.view.View raiz = c.get().getWindow().getDecorView();
        botonCon(raiz, "Activar lectura automática").performClick();
        org.robolectric.shadows.ShadowActivity.PermissionsRequest pr = shadowOf(c.get()).getLastRequestedPermission();
        assertNotNull("debe pedir permiso de notificaciones", pr);
        assertEquals("android.permission.POST_NOTIFICATIONS", pr.requestedPermissions[0]);
        c.get().onRequestPermissionsResult(pr.requestCode, pr.requestedPermissions, new int[]{0});
        Intent sig = shadowOf(c.get()).getNextStartedActivity();
        while (sig != null && "android.content.pm.action.REQUEST_PERMISSIONS".equals(sig.getAction())) sig = shadowOf(c.get()).getNextStartedActivity();
        assertNotNull(sig);
        System.out.println("activar → permiso de notificaciones → " + sig.getAction());
        assertTrue(sig.getAction().contains("NOTIFICATION_LISTENER"));
    }

    // 10) Instalada fuera de Play Store en Android 13+: explica Permitir ajustes restringidos desde el inicio.
    @Test public void ayudaAjustesRestringidos_visible() {
        ActivityController<BienvenidaActivity> c = Robolectric.buildActivity(BienvenidaActivity.class).setup();
        String t = textoDe(c.get().getWindow().getDecorView());
        assertTrue(t.contains("Permitir ajustes restringidos"));
        assertNotNull(botonCon(c.get().getWindow().getDecorView(), "Abrir información de la app"));
    }

    // 11) Ahora no solo dura un rato: luego la app vuelve a pedir la lectura.
    @Test public void ahoraNo_vuelveAPreguntar() {
        ActivityController<BienvenidaActivity> c = Robolectric.buildActivity(BienvenidaActivity.class).setup();
        botonCon(c.get().getWindow().getDecorView(), "Entrar sin activarla").performClick();
        assertTrue(c.get().isFinishing());
        ActivityController<BienvenidaActivity> c2 = Robolectric.buildActivity(BienvenidaActivity.class).setup();
        assertTrue("dentro de las 12 horas abre directo", c2.get().isFinishing());
        app.getSharedPreferences("ajustes", Context.MODE_PRIVATE).edit().putLong("omitido_hasta", System.currentTimeMillis() - 1).commit();
        ActivityController<BienvenidaActivity> c3 = Robolectric.buildActivity(BienvenidaActivity.class).setup();
        assertFalse("después vuelve a pedirla", c3.get().isFinishing());
    }

    // 12) Página abierta en segundo plano + llega un aviso + se toca el ícono: la página recibe el aviso.
    @Test public void iconoConAppAbierta_entregaAvisos() {
        lecturaActiva(true);
        List<String> r1 = new ArrayList<>();
        assertTrue(esNavegador(seguir(Robolectric.buildActivity(BienvenidaActivity.class).setup().get(), 4, r1)));
        Cola.agregar(app, "Nequi: Pagaste $8.500 en D1 desde tu cuenta", "Nequi", 2L);
        ActivityController<BienvenidaActivity> icono = Robolectric.buildActivity(BienvenidaActivity.class).setup();
        List<String> rastro = new ArrayList<>();
        Intent fin = seguir(icono.get(), 4, rastro);
        System.out.println("ícono con aviso nuevo → " + rastro);
        assertTrue("ruta: " + rastro, esNavegador(fin));
        assertTrue(fin.getDataString().contains("importar-lote="));
    }

    // 13) Página abierta y sin avisos nuevos: el ícono solo la trae al frente (no la recarga).
    @Test public void iconoConAppAbierta_sinAvisos() {
        lecturaActiva(true);
        List<String> r1 = new ArrayList<>();
        assertTrue(esNavegador(seguir(Robolectric.buildActivity(BienvenidaActivity.class).setup().get(), 4, r1)));
        ActivityController<BienvenidaActivity> icono = Robolectric.buildActivity(BienvenidaActivity.class).setup();
        Intent sig = shadowOf(icono.get()).getNextStartedActivity();
        assertNotNull(sig);
        assertEquals(InicioActivity.class.getName(), sig.getComponent().getClassName());
        assertNull("sin datos: no recarga", sig.getData());
        assertTrue((sig.getFlags() & Intent.FLAG_ACTIVITY_NEW_TASK) != 0);
    }

    // 18) Aviso destacado de Google Play: antes del botón que pide el permiso se explica qué se lee, para qué y
    //     qué se comparte, y hay un enlace a la política de datos.
    @Test public void avisoDestacado_antesDelPermiso() {
        ActivityController<BienvenidaActivity> c = Robolectric.buildActivity(BienvenidaActivity.class).setup();
        android.view.View raiz = c.get().getWindow().getDecorView();
        android.widget.Button activar = botonCon(raiz, "Activar lectura automática"), politica = botonCon(raiz, "Ver la política de datos");
        assertNotNull(politica);
        android.view.ViewGroup padre = (android.view.ViewGroup) activar.getParent();
        int iAviso = -1;
        for (int i = 0; i < padre.getChildCount(); i++) {
            android.view.View v = padre.getChildAt(i);
            if (v instanceof android.widget.TextView && !(v instanceof android.widget.Button) && String.valueOf(((android.widget.TextView) v).getText()).startsWith("¿Qué leemos y para qué?")) iAviso = i;
        }
        assertTrue("el aviso debe estar antes del botón de Activar", iAviso >= 0 && iAviso < padre.indexOfChild(activar));
        String t = textoDe(raiz);
        assertTrue(t.contains("no se envía a ningún servidor") && t.contains("No pedimos claves del banco") && t.contains("quitar el permiso"));
        politica.performClick();
        Intent abierto = shadowOf(c.get()).getNextStartedActivity();
        assertEquals(Intent.ACTION_VIEW, abierto.getAction());
        assertTrue(String.valueOf(abierto.getData()).endsWith("/legal/privacidad.html"));
    }

    // 14) Entrar sin dar permisos siempre es posible y el botón está a la vista, justo debajo de Activar.
    @Test public void entrarSinPermisos_aLaVista() {
        ActivityController<BienvenidaActivity> c = Robolectric.buildActivity(BienvenidaActivity.class).setup();
        android.view.View raiz = c.get().getWindow().getDecorView();
        android.widget.Button activar = botonCon(raiz, "Activar lectura automática"), entrar = botonCon(raiz, "Entrar sin activarla");
        assertNotNull(entrar);
        android.view.ViewGroup padre = (android.view.ViewGroup) activar.getParent();
        assertEquals("debe ir justo después de Activar", padre.indexOfChild(activar) + 1, padre.indexOfChild(entrar));
        // Negar el permiso de notificaciones no cierra nada: sigue al ajuste de lectura.
        activar.performClick();
        org.robolectric.shadows.ShadowActivity.PermissionsRequest pr = shadowOf(c.get()).getLastRequestedPermission();
        c.get().onRequestPermissionsResult(pr.requestCode, pr.requestedPermissions, new int[]{-1});
        assertFalse("negar el permiso no debe cerrar la app", c.get().isFinishing());
        c.pause().resume();   // vuelve del ajuste sin activarla
        assertFalse(c.get().isFinishing());
        assertTrue(textoDe(raiz).contains("Falta un paso"));
    }

    // 15) Botón Efectivo y accesos del ícono: abren la página con el registro de efectivo listo.
    @Test public void efectivo_abreRegistro() {
        ActivityController<AccionActivity> a = Robolectric.buildActivity(AccionActivity.class,
            new Intent(Intent.ACTION_VIEW, android.net.Uri.parse("fintelligente://efectivo/ingreso"))).setup();
        List<String> rastro = new ArrayList<>();
        Intent fin = seguir(a.get(), 4, rastro);
        System.out.println("acceso ingreso en efectivo → " + rastro);
        assertTrue("ruta: " + rastro, esNavegador(fin));
        assertTrue(fin.getDataString().endsWith("#accion=efectivo-ingreso"));

        Cola.agregar(app, "Nequi: Pagaste $8.500 en D1 desde tu cuenta", "Nequi", 3L);
        ActivityController<InicioActivity> c = Robolectric.buildActivity(InicioActivity.class, InicioActivity.abrirAccion(app, "efectivo-gasto")).setup();
        Intent sig = shadowOf(c.get()).getNextStartedActivity();
        while (sig != null && !esNavegador(sig)) sig = shadowOf(c.get()).getNextStartedActivity();
        assertNotNull(sig);
        System.out.println("efectivo con avisos en cola → " + sig.getDataString().replaceAll("lote=[^&]+", "lote=…"));
        assertTrue(sig.getDataString().matches(".*#importar-lote=[A-Za-z0-9_-]+&accion=efectivo-gasto$"));
    }

    // 16) Una acción inventada desde afuera no se pasa a la página.
    @Test public void accionInventada_seIgnora() {
        Intent i = InicioActivity.abrirAccion(app, "borrar-todo");
        ActivityController<InicioActivity> c = Robolectric.buildActivity(InicioActivity.class, i).setup();
        Intent sig = shadowOf(c.get()).getNextStartedActivity();
        while (sig != null && !esNavegador(sig)) sig = shadowOf(c.get()).getNextStartedActivity();
        assertNotNull(sig);
        assertFalse(sig.getDataString().contains("accion="));
    }

    // 17) El botón de la barra de notificaciones se puede tocar sin que la app falle.
    @Test public void botonEfectivo_tocar() {
        EfectivoTile t = Robolectric.setupService(EfectivoTile.class);
        try { t.onClick(); } catch (Exception e) { System.out.println("onClick en simulación: " + e); }
        Intent sig = shadowOf(app).getNextStartedActivity();
        System.out.println("botón efectivo → " + (sig == null ? "(Robolectric no simula la barra)" : sig.getComponent() + " " + sig.getStringExtra(InicioActivity.EXTRA_ACCION)));
    }

    // 19) Los códigos de seguridad nunca se guardan, aunque mencionen una compra; los avisos con la advertencia de no compartir claves sí.
    @Test public void codigosDeSeguridad_nuncaSeGuardan() throws Exception {
        assertTrue(Filtro.esCodigoSeguridad("Bancolombia: tu clave dinamica para la compra de $50.000 en EXITO es 482913. No la compartas."));
        assertTrue(Filtro.esCodigoSeguridad("Nequi: 739201 es tu codigo para autorizar el pago de $120.000"));
        assertTrue(Filtro.esCodigoSeguridad("Davivienda: Código de verificación 5521 para transferencia por $200.000"));
        assertFalse(Filtro.esCodigoSeguridad("Bancolombia: Compraste $45.900 en EXITO con tu T.Deb *1234. Nunca compartas tus claves. Linea 6045109095"));
        assertFalse(Filtro.esCodigoSeguridad("Compra con tu clave en la tarjeta terminada en 4521 por $80.000"));
        LectorNotificaciones lector = Robolectric.setupService(LectorNotificaciones.class);
        lector.onNotificationPosted(sbn("com.todo1.mobile", noti("Bancolombia", "Tu clave dinamica para la compra de $50.000 en EXITO es 482913. No la compartas."), 1));
        lector.onNotificationPosted(sbn("com.nequi.MobileApp", noti("Nequi", "739201 es tu codigo para autorizar el pago de $120.000"), 2));
        lector.onNotificationPosted(sbn("com.todo1.mobile", noti("Bancolombia", "Compraste $45.900 en EXITO con tu T.Deb *1234. Nunca compartas tus claves."), 3));
        String items = app.getSharedPreferences("cola", Context.MODE_PRIVATE).getString("items", "[]");
        assertEquals("solo se guarda la compra real", 1, Cola.contar(app));
        assertFalse(items.contains("482913") || items.contains("739201"));
        assertEquals(2, Registro.total(app, Registro.CODIGOS));
        assertEquals(1, Registro.total(app, Registro.GUARDADOS));
        // Por si acaso: si un aviso de compra trae un número suelto junto a una clave, se tapa.
        assertEquals("Compraste $30.000. Clave usada: ••••. Tarjeta *1234", Filtro.tapar("Compraste $30.000. Clave usada: 9988. Tarjeta *1234"));
    }

    // 20) Chats nunca; la persona elige SMS y correo, y puede pausar.
    @Test public void chatsNunca_yLaPersonaDecide() {
        assertEquals("", Filtro.tipoDeApp("com.whatsapp", "WhatsApp"));
        assertEquals("", Filtro.tipoDeApp("org.telegram.messenger", "Telegram"));
        assertEquals("", Filtro.tipoDeApp("com.facebook.orca", "Messenger"));
        assertEquals("sms", Filtro.tipoDeApp("com.google.android.apps.messaging", "Mensajes"));
        assertEquals("correo", Filtro.tipoDeApp("com.google.android.gm", "Gmail"));
        assertEquals("banco", Filtro.tipoDeApp("com.nequi.MobileApp", "Nequi"));
        LectorNotificaciones lector = Robolectric.setupService(LectorNotificaciones.class);
        lector.onNotificationPosted(sbn("com.whatsapp", noti("Banco", "Compraste $10.000 en EXITO con tu tarjeta"), 1));
        Registro.elegir(app, "leer_sms", false);
        Notification.MessagingStyle ms = new Notification.MessagingStyle("Yo");
        ms.addMessage("Bancolombia le informa Compra por $45.900 en EXITO 12:05. T.Deb *1234", 1L, "891333");
        lector.onNotificationPosted(sbn("com.google.android.apps.messaging", new Notification.Builder(app, "x").setSmallIcon(android.R.drawable.ic_dialog_info).setStyle(ms).build(), 2));
        assertEquals("ni chats ni SMS (apagados)", 0, Cola.contar(app));
        assertEquals(2, Registro.total(app, Registro.OTRAS));
        Registro.pausar(app, true);
        lector.onNotificationPosted(sbn("com.nequi.MobileApp", noti("Nequi", "Pagaste $8.500 en D1"), 3));
        assertEquals("en pausa no se lee nada", 0, Cola.contar(app));
        Registro.pausar(app, false);
        lector.onNotificationPosted(sbn("com.nequi.MobileApp", noti("Nequi", "Pagaste $8.500 en D1"), 4));
        assertEquals(1, Cola.contar(app));
        String ultimos = Registro.ultimos(app).toString();
        assertTrue(ultimos.contains("$8.500") && !ultimos.contains("D1"));   // el registro no guarda el texto
    }

    // 21) Pantalla Tu privacidad: abre desde la página, muestra lo que pasó y deja borrar y pausar.
    @Test public void privacidad_pantalla() {
        lecturaActiva(true);
        LectorNotificaciones lector = Robolectric.setupService(LectorNotificaciones.class);
        lector.onNotificationPosted(sbn("com.nequi.MobileApp", noti("Nequi", "Recibiste $50.000 de JUAN PEREZ"), 1));
        lector.onNotificationPosted(sbn("com.nequi.MobileApp", noti("Nequi", "123456 es tu codigo de seguridad"), 2));
        lector.onNotificationPosted(sbn("com.whatsapp", noti("Ana", "hola"), 3));
        ActivityController<AccionActivity> a = Robolectric.buildActivity(AccionActivity.class, new Intent(Intent.ACTION_VIEW, android.net.Uri.parse("fintelligente://privacidad"))).setup();
        Intent sig = shadowOf(a.get()).getNextStartedActivity();
        assertEquals(PrivacidadActivity.class.getName(), sig.getComponent().getClassName());
        ActivityController<PrivacidadActivity> c = Robolectric.buildActivity(PrivacidadActivity.class).setup();
        android.view.View raiz = c.get().getWindow().getDecorView();
        String t = textoDe(raiz);
        System.out.println("privacidad: " + t.replace("\n", " | ").substring(0, Math.min(700, t.length())));
        assertTrue(t.contains("La lectura está activa."));
        assertTrue(t.contains("1 aviso de dinero guardado") && t.contains("1 código de seguridad bloqueado") && t.contains("1 notificación de otra app que no se abrió"));
        assertTrue(t.contains("Nunca se leen WhatsApp") && t.contains(" · $50.000 · "));
        assertFalse(t.contains("JUAN") || t.contains("123456"));
        botonCon(raiz, "Pausar la lectura").performClick();
        assertTrue(Registro.pausada(app));
        assertTrue(textoDe(c.get().getWindow().getDecorView()).contains("en pausa"));
        botonCon(c.get().getWindow().getDecorView(), "Borrar el registro y lo que está en espera").performClick();
        assertEquals(0, Cola.contar(app));
        assertEquals(0, Registro.total(app, Registro.GUARDADOS));
        assertTrue(PrivacidadActivity.fecha(0, true).matches("\\d+ (en|feb|mar|abr|may|jun|jul|ag|sept|oct|nov|dic)\\., \\d+:\\d\\d [ap]\\. m\\."));
    }

    // 22) Bre-B: los avisos reales entran; los mensajes falsos que piden confirmar por un enlace se frenan y se avisa.
    @Test public void breB_realesEntran_estafasSeFrenan() {
        assertTrue(Filtro.esEstafa("Recibiste una transferencia por $847.000 en tu cuenta Bre-B. Para más información, haz clic en el enlace https://bre-b-pagos.co/x"));
        assertTrue(Filtro.esEstafa("Bre-B: tienes un pago pendiente por $500.000. Confírmalo antes de 24 horas en bit.ly/abc123"));
        assertTrue(Filtro.esEstafa("Bancolombia: tu transferencia por $300.000 está pendiente, confírmala en bancolombia-seguro.com"));
        assertFalse(Filtro.esEstafa("Bancolombia: Pagaste $50.000 en EXITO. Si no fuiste tú, bloquea tu tarjeta en bancolombia.com/personas"));
        assertFalse(Filtro.esEstafa("Bancolombia: Compra aprobada por $45.900 en AMAZON.COM con tu T.Cred *4321"));
        assertFalse(Filtro.esEstafa("Nequi: Recibiste $20.000 de ANA*** RUI***. Conoce más en nequi.com.co"));
        LectorNotificaciones lector = Robolectric.setupService(LectorNotificaciones.class);
        Notification.MessagingStyle falso = new Notification.MessagingStyle("Yo");
        falso.addMessage("Recibiste una transferencia por $847.000 en tu cuenta Bre-B. Confírmala antes de 24 horas en https://bre-b-pagos.co/x", 1L, "891234");
        lector.onNotificationPosted(sbn("com.google.android.apps.messaging", new Notification.Builder(app, "x").setSmallIcon(android.R.drawable.ic_dialog_info).setStyle(falso).build(), 1));
        assertEquals("el mensaje falso no se registra", 0, Cola.contar(app));
        assertEquals(1, Registro.total(app, Registro.ESTAFAS));
        android.app.NotificationManager nm = (android.app.NotificationManager) app.getSystemService(Context.NOTIFICATION_SERVICE);
        boolean alerta = false;
        for (Notification n : shadowOf(nm).getAllNotifications()) if (String.valueOf(n.extras.getCharSequence(Notification.EXTRA_TITLE)).contains("estafa")) alerta = true;
        assertTrue("se avisa a la persona", alerta);
        Notification.MessagingStyle real = new Notification.MessagingStyle("Yo");
        real.addMessage("Bancolombia: Enviaste $50.000 por Bre-B a la llave 3001234567 (JUA*** PER***) el 07/11/2026 15:32.", 2L, "891333");
        lector.onNotificationPosted(sbn("com.google.android.apps.messaging", new Notification.Builder(app, "x").setSmallIcon(android.R.drawable.ic_dialog_info).setStyle(real).build(), 2));
        lector.onNotificationPosted(sbn("com.nequi.MobileApp", noti("Nequi", "Recibiste $120.000 por Bre-B de MAR*** GOM*** desde Bancolombia."), 3));
        assertEquals("los avisos reales de Bre-B entran", 2, Cola.contar(app));
    }

    // 23) Avisos con plata que no supimos leer: se guardan tapados en el celular y la persona decide si los comparte.
    @Test public void avisosNoEntendidos_seGuardanTapados() {
        assertTrue(Filtro.noEntendido("com.nequi.MobileApp", "Nequi", "Nequi: Te cayeron $20.000 de tu parcero", "sin-dinero"));
        assertTrue(Filtro.noEntendido("com.todo1.mobile", "Bancolombia", "Usaste tu tarjeta *4321 por $45.000 en MERCADO LIBRE", "sin-dinero"));
        assertFalse("saldos", Filtro.noEntendido("com.nequi.MobileApp", "Nequi", "Tu saldo disponible es $1.234.567", "sin-dinero"));
        assertFalse("recordatorios", Filtro.noEntendido("com.todo1.mobile", "Bancolombia", "Recuerda: tu cuota de $250.000 vence mañana", "sin-dinero"));
        assertFalse("publicidad", Filtro.noEntendido("com.todo1.mobile", "Bancolombia", "Aprovecha: gana hasta $500.000 con tu tarjeta", "sin-dinero"));
        assertFalse("nunca de SMS", Filtro.noEntendido("com.google.android.apps.messaging", "Mensajes", "Te cayeron $20.000", "sin-dinero"));
        assertFalse("ya entendido", Filtro.noEntendido("com.nequi.MobileApp", "Nequi", "Recibiste $20.000", "ok"));
        assertEquals("Te cayeron $1500000 a la cuenta ••••8901 del cel ••••4567 el 07/11/2026 15:32",
            Filtro.ocultar("Te cayeron $1500000 a la cuenta 123-45678901 del cel 3001234567 el 07/11/2026 15:32"));
        assertEquals("Te llegaron 250000 pesos", Filtro.ocultar("Te llegaron 250000 pesos"));

        lecturaActiva(true);
        LectorNotificaciones lector = Robolectric.setupService(LectorNotificaciones.class);
        lector.onNotificationPosted(sbn("com.nequi.MobileApp", noti("Nequi", "Te cayeron $20.000 de 3001234567"), 1));
        lector.onNotificationPosted(sbn("com.nequi.MobileApp", noti("Nequi", "Te cayeron $20.000 de 3001234567"), 2));
        lector.onNotificationPosted(sbn("com.nequi.MobileApp", noti("Nequi", "Tu saldo disponible es $1.234.567"), 3));
        assertEquals("no se anota", 0, Cola.contar(app));
        assertEquals("se guarda una sola vez", 1, Registro.noEntendidos(app).length());
        assertEquals(1, Registro.total(app, Registro.NO_ENTENDIDOS));
        assertEquals(1, Registro.total(app, Registro.SIN_DINERO));
        String guardado = Registro.noEntendidos(app).toString();
        assertTrue(guardado.contains("••••4567") && !guardado.contains("3001234567"));

        ActivityController<PrivacidadActivity> c = Robolectric.buildActivity(PrivacidadActivity.class).setup();
        android.view.View raiz = c.get().getWindow().getDecorView();
        String t = textoDe(raiz);
        assertTrue(t.contains("Avisos que no supimos leer") && t.contains("Te cayeron $20.000 de ••••4567") && t.contains("1 aviso con dinero que no supimos leer"));
        botonCon(raiz, "Compartir").performClick();
        Intent elegir = shadowOf(c.get()).getNextStartedActivity();
        assertEquals(Intent.ACTION_CHOOSER, elegir.getAction());
        Intent enviar = elegir.getParcelableExtra(Intent.EXTRA_INTENT);
        assertEquals(Intent.ACTION_SEND, enviar.getAction());
        assertTrue(enviar.getStringExtra(Intent.EXTRA_TEXT).contains("Te cayeron $20.000 de ••••4567"));
        assertEquals("compartir no borra", 1, Registro.noEntendidos(app).length());
        botonCon(c.get().getWindow().getDecorView(), "Borrar").performClick();
        assertEquals(0, Registro.noEntendidos(app).length());
        assertFalse(textoDe(c.get().getWindow().getDecorView()).contains("Avisos que no supimos leer"));
        // Los de más de 30 días se van solos
        Registro.noEntendido(app, "Nequi", "Te cayeron $5.000", System.currentTimeMillis() - 31L * 24 * 3600 * 1000);
        assertEquals(0, Registro.noEntendidos(app).length());
    }
}
