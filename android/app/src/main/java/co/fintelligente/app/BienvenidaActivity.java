package co.fintelligente.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/**
 * Primera vez: explica en una pantalla y activa la lectura con un botón.
 * Si ya está activa (o la persona eligió Ahora no), abre Finti de una vez.
 */
public class BienvenidaActivity extends Activity {
    private SharedPreferences prefs;
    private LinearLayout raiz;
    private boolean abriendo = false;

    private static final int AZUL = 0xFF6A4AF0, TINTA = 0xFF14121F, GRIS = 0xFF5B576B, VERDE = 0xFF0CA678;

    private static final int PEDIR_NOTIF = 2, PEDIR_NOTIF_LISTO = 1;
    private static final long HORAS_12 = 12L * 60 * 60 * 1000;

    @Override
    protected void onCreate(Bundle s) {
        super.onCreate(s);
        prefs = getSharedPreferences("ajustes", MODE_PRIVATE);
        if (Acceso.lecturaActiva(this)) { Acceso.reconectar(this); abrirApp(); return; }
        // Ahora no solo vale por un rato: mientras la lectura no esté activa, la app vuelve a pedirla.
        if (prefs.getLong("omitido_hasta", 0) > System.currentTimeMillis()) { abrirApp(); return; }
        ScrollView sv = new ScrollView(this);
        sv.setFillViewport(true);
        raiz = new LinearLayout(this);
        raiz.setOrientation(LinearLayout.VERTICAL);
        raiz.setPadding(dp(24), dp(40), dp(24), dp(28));
        sv.addView(raiz);
        setContentView(sv);
        pintarInicio();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (raiz == null || abriendo) return;
        if (Acceso.lecturaActiva(this)) { Acceso.reconectar(this); pintarListo(); }
        else if (prefs.getBoolean("intentado", false)) pintarInicio();
    }

    // ---------- Pantallas ----------

    private void pintarInicio() {
        raiz.removeAllViews();
        raiz.setGravity(Gravity.NO_GRAVITY);
        ImageView logo = new ImageView(this);
        logo.setImageResource(R.mipmap.ic_launcher);
        raiz.addView(logo, new LinearLayout.LayoutParams(dp(64), dp(64)));

        boolean intentado = prefs.getBoolean("intentado", false);
        raiz.addView(texto(intentado ? "Falta un paso para activarla" : "Tus pagos se registran solos", 26, TINTA, true, dp(20)));
        raiz.addView(texto("Cada vez que pagues o transfieras, Finti lo anota por ti. Tú solo lo confirmas.", 16, GRIS, false, dp(8)));

        if (!intentado) {
            raiz.addView(paso("💳", "Pagas con Nequi, Bancolombia, Daviplata o tu banco", dp(24)));
            raiz.addView(paso("📲", "Finti lee el aviso que te llega al celular", dp(12)));
            raiz.addView(paso("✅", "Lo confirmas con un toque y queda en tu presupuesto", dp(12)));
        }

        // Aviso destacado (política de Google Play): antes de pedir el permiso se explica qué se lee, para qué
        // y qué se comparte. Tocar Activar lectura automática es la aceptación.
        TextView priv = texto("¿Qué leemos y para qué? Con tu permiso, Finti lee en tu celular las notificaciones de bancos y billeteras "
            + "(por ejemplo, Nequi, Daviplata o Bancolombia) para tomar el valor, el comercio y el medio de pago, y proponerte el movimiento. "
            + "Nunca lee WhatsApp ni tus chats, y los códigos de seguridad se bloquean sin guardarse. Las demás notificaciones se ignoran. "
            + "El texto de los avisos no se envía a ningún servidor: lo que confirmes queda en tu presupuesto (y en tu cuenta, cifrado, si tienes una). "
            + "No pedimos claves del banco. Puedes pausar la lectura, elegir si se leen los mensajes de texto o el correo, y quitar el permiso cuando quieras.", 13, TINTA, false, dp(24));
        priv.setPadding(dp(14), dp(12), dp(14), dp(12));
        priv.setBackground(fondo(0xFFF6F4FA, 0xFFE4E0EE));
        raiz.addView(priv);
        Button politica = boton("Ver la política de datos", false);
        politica.setOnClickListener(v -> abrir(new Intent(Intent.ACTION_VIEW, Uri.parse(getString(R.string.sitio) + "legal/privacidad.html"))));
        raiz.addView(politica, margen(dp(8)));

        Button activar = boton("Activar lectura automática", true);
        activar.setOnClickListener(v -> alActivar());
        raiz.addView(activar, margen(dp(16)));

        Button luego = boton("Entrar sin activarla", false);
        luego.setOnClickListener(v -> { prefs.edit().putLong("omitido_hasta", System.currentTimeMillis() + HORAS_12).apply(); abrirApp(); });
        raiz.addView(luego, margen(dp(10)));

        TextView guia = texto("Te pediremos dos permisos: avisarte cuando llegue un movimiento y leer los avisos de tus bancos. "
            + "En el segundo, busca Finti y actívalo.", 13, GRIS, false, dp(8));
        guia.setGravity(Gravity.CENTER_HORIZONTAL);
        raiz.addView(guia);

        // Android 13 o superior + instalada fuera de Play Store: el interruptor aparece en gris hasta permitirlo.
        if (Build.VERSION.SDK_INT >= 33 && Acceso.instaladaFueraDePlay(this)) {
            TextView ayuda = texto((intentado ? "¿Android dijo Ajuste restringido? Es normal porque la app aún no viene de Play Store. Sigue estos pasos:\n"
                    : "Si Android dice Ajuste restringido, es normal porque la app aún no viene de Play Store:\n")
                + "1. Toca Activar lectura automática y luego el interruptor de Finti. Saldrá el aviso de ajuste restringido: toca Aceptar. Este intento es necesario para que aparezca la opción del paso 2.\n"
                + "2. Vuelve aquí, toca Abrir información de la app, luego los tres puntos de arriba a la derecha y elige Permitir ajustes restringidos. Confirma con tu huella o PIN.\n"
                + "3. Vuelve aquí y toca otra vez Activar lectura automática. Ahora el interruptor sí funciona.", 14, TINTA, false, dp(20));
            ayuda.setPadding(dp(14), dp(12), dp(14), dp(12));
            ayuda.setBackground(fondo(intentado ? 0xFFFFF7E6 : 0xFFF6F4FA, intentado ? 0xFFF2D59B : 0xFFE4E0EE));
            raiz.addView(ayuda);
            Button info = boton("Abrir información de la app", false);
            info.setOnClickListener(v -> abrir(Acceso.infoApp(this)));
            raiz.addView(info, margen(dp(10)));
        }

        TextView despues = texto("Puedes activarla cuando quieras desde Conectar bancos.", 13, GRIS, false, dp(12));
        despues.setGravity(Gravity.CENTER_HORIZONTAL);
        raiz.addView(despues);
    }

    private void alActivar() {
        prefs.edit().putBoolean("intentado", true).apply();
        // Primer permiso (ventana de Android): poder avisarte Nuevo movimiento.
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                && !prefs.getBoolean("pedido_notif", false)) {
            prefs.edit().putBoolean("pedido_notif", true).apply();
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, PEDIR_NOTIF);
            return;
        }
        abrirAjusteLectura();
    }

    /** Segundo permiso: el ajuste de Android donde se activa la lectura de notificaciones. */
    private void abrirAjusteLectura() {
        try { startActivity(Acceso.ajusteLectura(this)); } catch (Exception e) { abrir(Acceso.infoApp(this)); }
    }

    private void abrir(Intent i) {
        try { startActivity(i); } catch (Exception ignorada) { }
    }

    private void pintarListo() {
        raiz.removeAllViews();
        raiz.setGravity(Gravity.CENTER_HORIZONTAL);
        TextView ok = texto("✅", 56, VERDE, false, dp(60));
        ok.setGravity(Gravity.CENTER_HORIZONTAL);
        raiz.addView(ok);
        TextView t = texto("¡Listo!", 28, TINTA, true, dp(12));
        t.setGravity(Gravity.CENTER_HORIZONTAL);
        raiz.addView(t);
        TextView d = texto("Desde ahora, tus pagos y transferencias llegan solos a Por confirmar.\nHaz un pago de prueba y míralo aparecer.", 16, GRIS, false, dp(10));
        d.setGravity(Gravity.CENTER_HORIZONTAL);
        raiz.addView(d);

        boolean estricto = Acceso.fabricanteEstricto();
        if (estricto) {
            TextView bat = texto("Tu celular suele cerrar apps en segundo plano. Para que no se pierda ningún aviso, busca Finti y elige Sin restricciones o No optimizar.", 14, TINTA, false, dp(20));
            bat.setPadding(dp(14), dp(12), dp(14), dp(12));
            bat.setBackground(fondo(0xFFFFF7E6, 0xFFF2D59B));
            raiz.addView(bat);
            Button b = boton("Permitir en segundo plano", false);
            b.setOnClickListener(v -> abrir(Acceso.ajusteBateria()));
            raiz.addView(b, margen(dp(10)));
        }

        Button abrirBtn = boton("Abrir Finti", true);
        abrirBtn.setOnClickListener(v -> abrirApp());
        raiz.addView(abrirBtn, margen(dp(estricto ? 12 : 28)));

        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, PEDIR_NOTIF_LISTO);
        } else if (!estricto) {
            new Handler(Looper.getMainLooper()).postDelayed(this::abrirApp, 1800);
        }
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] permisos, int[] resultados) {
        super.onRequestPermissionsResult(req, permisos, resultados);
        if (req == PEDIR_NOTIF) { abrirAjusteLectura(); return; }
        if (!Acceso.fabricanteEstricto()) new Handler(Looper.getMainLooper()).postDelayed(this::abrirApp, 600);
    }

    private void abrirApp() {
        if (abriendo) return;
        abriendo = true;
        // Con avisos en espera, la página se vuelve a abrir con ellos; si no, solo se trae al frente.
        startActivity(InicioActivity.abrir(this, Cola.contar(this) > 0 || !InicioActivity.abierta()));
        finish();
    }

    // ---------- Piezas de interfaz ----------

    private TextView texto(String s, int sp, int color, boolean negrita, int arriba) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(color);
        t.setLineSpacing(0, 1.15f);
        if (negrita) t.setTypeface(Typeface.DEFAULT_BOLD);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.topMargin = arriba;
        t.setLayoutParams(lp);
        return t;
    }

    private View paso(String icono, String s, int arriba) {
        LinearLayout fila = new LinearLayout(this);
        fila.setOrientation(LinearLayout.HORIZONTAL);
        fila.setGravity(Gravity.CENTER_VERTICAL);
        TextView ic = new TextView(this);
        ic.setText(icono);
        ic.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        ic.setGravity(Gravity.CENTER);
        ic.setBackground(fondo(0xFFEEEAFF, 0xFFEEEAFF));
        fila.addView(ic, new LinearLayout.LayoutParams(dp(44), dp(44)));
        TextView t = texto(s, 16, TINTA, false, 0);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1);
        lp.leftMargin = dp(14);
        fila.addView(t, lp);
        LinearLayout.LayoutParams flp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        flp.topMargin = arriba;
        fila.setLayoutParams(flp);
        return fila;
    }

    private Button boton(String s, boolean principal) {
        Button b = new Button(this);
        b.setText(s);
        b.setAllCaps(false);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setTextColor(principal ? 0xFFFFFFFF : AZUL);
        b.setBackground(fondo(principal ? AZUL : 0xFFFFFFFF, principal ? AZUL : 0xFFC9D0F2));
        b.setPadding(dp(16), dp(14), dp(16), dp(14));
        b.setStateListAnimator(null);
        return b;
    }

    private GradientDrawable fondo(int relleno, int borde) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(relleno);
        g.setCornerRadius(dp(16));
        g.setStroke(dp(1), borde);
        return g;
    }

    private LinearLayout.LayoutParams margen(int arriba) {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.topMargin = arriba;
        return lp;
    }

    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }
}
