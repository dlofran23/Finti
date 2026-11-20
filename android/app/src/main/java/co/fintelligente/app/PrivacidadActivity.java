package co.fintelligente.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.NumberFormat;
import java.util.Calendar;
import java.util.Locale;

/**
 * Tu privacidad: qué puede leer la app, la pausa, y un registro de lo que pasó con los avisos
 * (cuántos se guardaron, cuántos códigos se bloquearon y cuántas notificaciones ni se abrieron).
 */
public class PrivacidadActivity extends Activity {
    private static final int AZUL = 0xFF6A4AF0, TINTA = 0xFF14121F, GRIS = 0xFF5B576B, VERDE = 0xFF0B8A63;
    private static final String[] MESES = {"en.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ag.", "sept.", "oct.", "nov.", "dic."};
    private LinearLayout raiz;

    @Override
    protected void onCreate(Bundle s) {
        super.onCreate(s);
        ScrollView sv = new ScrollView(this);
        sv.setFillViewport(true);
        raiz = new LinearLayout(this);
        raiz.setOrientation(LinearLayout.VERTICAL);
        raiz.setPadding(dp(24), dp(32), dp(24), dp(28));
        sv.addView(raiz);
        setContentView(sv);
    }

    @Override
    protected void onResume() {
        super.onResume();
        pintar();
    }

    private void pintar() {
        raiz.removeAllViews();
        raiz.addView(texto("Tu privacidad", 26, TINTA, true, 0));
        raiz.addView(texto("Tú decides qué lee Finti. Todo pasa dentro de tu celular.", 16, GRIS, false, dp(6)));

        // Estado
        boolean permiso = Acceso.lecturaActiva(this), pausada = Registro.pausada(this);
        String estado = !permiso ? "La lectura está apagada: Android no le ha dado permiso a Finti."
            : pausada ? "La lectura está en pausa. No se lee ningún aviso hasta que la reanudes."
            : "La lectura está activa.";
        TextView est = texto(estado, 15, TINTA, true, dp(20));
        est.setPadding(dp(14), dp(12), dp(14), dp(12));
        est.setBackground(fondo(!permiso || pausada ? 0xFFFFF7E6 : 0xFFE7F7F0, !permiso || pausada ? 0xFFF2D59B : 0xFFB7E4D2));
        raiz.addView(est);
        if (permiso) {
            Button b = boton(pausada ? "Reanudar la lectura" : "Pausar la lectura", false);
            b.setOnClickListener(v -> { Registro.pausar(this, !pausada); pintar(); });
            raiz.addView(b, margen(dp(10)));
        }

        // Qué puede leer
        raiz.addView(texto("¿Qué puede leer?", 18, TINTA, true, dp(26)));
        raiz.addView(fila("Apps de bancos y billeteras", "Siempre que la lectura esté activa. Es lo que anota tus pagos.", dp(10)));
        raiz.addView(interruptor("Mensajes de texto del banco", "Solo los que nombran un banco, una tarjeta o una cuenta. Los demás mensajes se ignoran sin guardarse.", "leer_sms", Registro.leerSms(this)));
        raiz.addView(interruptor("Alertas del banco en tu correo", "Solo las que nombran un banco o una tarjeta. Los demás correos se ignoran sin guardarse.", "leer_correo", Registro.leerCorreo(this)));
        TextView nunca = texto("Nunca se leen WhatsApp, Telegram, Messenger, Instagram ni otras apps de chat. Los códigos de seguridad y las claves se bloquean y no se guardan. Si llega un mensaje que pide confirmar un pago por un enlace, no se registra y te avisamos: es la estafa más común con Bre-B.", 14, TINTA, false, dp(12));
        nunca.setPadding(dp(14), dp(12), dp(14), dp(12));
        nunca.setBackground(fondo(0xFFF6F4FA, 0xFFE4E0EE));
        raiz.addView(nunca);

        // Lo que pasó
        long desde = Registro.desde(this);
        raiz.addView(texto(desde > 0 ? "Lo que pasó desde el " + fecha(desde, false) : "Lo que pasó", 18, TINTA, true, dp(26)));
        if (desde == 0) {
            raiz.addView(texto("Todavía no ha llegado ningún aviso. Aquí verás cuántos se guardan y cuántos se descartan.", 14, GRIS, false, dp(8)));
        } else {
            raiz.addView(cifra(Registro.total(this, Registro.GUARDADOS), "aviso de dinero guardado", "avisos de dinero guardados"));
            raiz.addView(cifra(Registro.total(this, Registro.CODIGOS), "código de seguridad bloqueado; nunca se guarda", "códigos de seguridad bloqueados; nunca se guardan"));
            int estafas = Registro.total(this, Registro.ESTAFAS);
            if (estafas > 0) raiz.addView(cifra(estafas, "mensaje que parecía estafa, frenado y avisado", "mensajes que parecían estafa, frenados y avisados"));
            int dudas = Registro.total(this, Registro.NO_ENTENDIDOS);
            if (dudas > 0) raiz.addView(cifra(dudas, "aviso con dinero que no supimos leer", "avisos con dinero que no supimos leer"));
            raiz.addView(cifra(Registro.total(this, Registro.SIN_DINERO), "mensaje de banco sin dinero, descartado", "mensajes de bancos sin dinero, descartados"));
            raiz.addView(cifra(Registro.total(this, Registro.OTRAS), "notificación de otra app que no se abrió", "notificaciones de otras apps que no se abrieron"));
        }

        // Últimos guardados (sin el texto: solo app, monto y hora)
        JSONArray u = Registro.ultimos(this);
        if (u.length() > 0) {
            raiz.addView(texto("Últimos avisos guardados", 16, TINTA, true, dp(20)));
            for (int i = u.length() - 1; i >= Math.max(0, u.length() - 8); i--) {
                JSONObject o = u.optJSONObject(i);
                if (o == null) continue;
                String app = o.optString("a"), monto = o.optString("m");
                raiz.addView(texto((app.isEmpty() ? "Banco" : app) + (monto.isEmpty() ? "" : " · " + monto) + " · " + fecha(o.optLong("ts"), true), 14, GRIS, false, dp(6)));
            }
            raiz.addView(texto("Del aviso solo se guardan el valor, el comercio, la fecha y el medio de pago.", 13, GRIS, false, dp(8)));
        }

        // Avisos que no entendimos: la persona decide si nos comparte alguno
        JSONArray dudosos = Registro.noEntendidos(this);
        if (dudosos.length() > 0) {
            raiz.addView(texto("Avisos que no supimos leer", 18, TINTA, true, dp(26)));
            raiz.addView(texto("Traen dinero, pero no entendimos qué movimiento era, así que no se anotaron. Si nos compartes uno, aprendemos a leer los de tu banco. Tapamos las claves y los números largos; revísalo antes de enviarlo. Se borran solos a los 30 días.", 14, GRIS, false, dp(6)));
            for (int i = dudosos.length() - 1; i >= 0; i--) {
                JSONObject o = dudosos.optJSONObject(i);
                if (o == null) continue;
                final String app = o.optString("a").isEmpty() ? "Banco" : o.optString("a"), txt = o.optString("t"), h = o.optString("h");
                LinearLayout caja = new LinearLayout(this);
                caja.setOrientation(LinearLayout.VERTICAL);
                caja.setPadding(dp(14), dp(12), dp(14), dp(12));
                caja.setBackground(fondo(0xFFF6F4FA, 0xFFE4E0EE));
                caja.addView(texto(app + " · " + fecha(o.optLong("ts"), true), 13, GRIS, true, 0));
                caja.addView(texto(txt, 15, TINTA, false, dp(4)));
                LinearLayout acciones = new LinearLayout(this);
                acciones.setOrientation(LinearLayout.HORIZONTAL);
                Button compartir = boton("Compartir", false), quitar = boton("Borrar", false);
                compartir.setContentDescription("Compartir el aviso de " + app);
                quitar.setContentDescription("Borrar el aviso de " + app);
                compartir.setOnClickListener(v -> {
                    Intent i2 = new Intent(Intent.ACTION_SEND).setType("text/plain")
                        .putExtra(Intent.EXTRA_SUBJECT, "Aviso que Finti no supo leer")
                        .putExtra(Intent.EXTRA_TEXT, "Hola, Finti no supo leer este aviso de " + app + ":\n\n" + txt);
                    abrir(Intent.createChooser(i2, "Compartir el aviso"));
                });
                quitar.setOnClickListener(v -> { Registro.quitarNoEntendido(this, h); pintar(); });
                LinearLayout.LayoutParams mitad = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1);
                LinearLayout.LayoutParams mitad2 = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1);
                mitad2.leftMargin = dp(8);
                acciones.addView(compartir, mitad);
                acciones.addView(quitar, mitad2);
                caja.addView(acciones, margen(dp(10)));
                raiz.addView(caja, margen(dp(10)));
            }
        }

        int espera = Cola.contar(this);
        if (espera > 0) raiz.addView(texto(espera == 1 ? "Hay 1 aviso esperando a que abras la app." : "Hay " + espera + " avisos esperando a que abras la app.", 14, TINTA, false, dp(16)));

        Button borrar = boton("Borrar el registro y lo que está en espera", false);
        borrar.setOnClickListener(v -> { Registro.borrar(this); pintar(); });
        raiz.addView(borrar, margen(dp(20)));

        Button quitar = boton(permiso ? "Quitar el permiso de lectura" : "Dar el permiso de lectura", false);
        quitar.setOnClickListener(v -> abrir(Acceso.ajusteLectura(this)));
        raiz.addView(quitar, margen(dp(10)));

        Button politica = boton("Ver la política de datos", false);
        politica.setOnClickListener(v -> abrir(new Intent(Intent.ACTION_VIEW, Uri.parse(getString(R.string.sitio) + "legal/privacidad.html"))));
        raiz.addView(politica, margen(dp(10)));

        Button listo = boton("Listo", true);
        listo.setOnClickListener(v -> finish());
        raiz.addView(listo, margen(dp(16)));
    }

    // ---------- Piezas ----------

    private LinearLayout fila(String titulo, String detalle, int arriba) {
        LinearLayout f = new LinearLayout(this);
        f.setOrientation(LinearLayout.VERTICAL);
        f.addView(texto(titulo, 16, TINTA, true, 0));
        f.addView(texto(detalle, 13, GRIS, false, dp(2)));
        LinearLayout.LayoutParams lp = margen(arriba);
        f.setLayoutParams(lp);
        return f;
    }

    private LinearLayout interruptor(String titulo, String detalle, String clave, boolean valor) {
        LinearLayout f = new LinearLayout(this);
        f.setOrientation(LinearLayout.HORIZONTAL);
        f.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout textos = fila(titulo, detalle, 0);
        f.addView(textos, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        Switch sw = new Switch(this);
        sw.setChecked(valor);
        sw.setContentDescription(titulo);
        sw.setTag(clave);
        sw.setOnCheckedChangeListener((b, si) -> Registro.elegir(this, clave, si));
        f.addView(sw);
        f.setLayoutParams(margen(dp(14)));
        return f;
    }

    private TextView cifra(int n, String uno, String varios) {
        String num = NumberFormat.getIntegerInstance(new Locale("es", "CO")).format(n);
        return texto(num + " " + (n == 1 ? uno : varios), 15, n > 0 ? TINTA : GRIS, false, dp(8));
    }

    /** "5 nov. 2026" o "5 nov., 9:41 a. m." */
    static String fecha(long ms, boolean conHora) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(ms);
        String d = c.get(Calendar.DAY_OF_MONTH) + " " + MESES[c.get(Calendar.MONTH)];
        if (!conHora) return d + " " + c.get(Calendar.YEAR);
        int h = c.get(Calendar.HOUR_OF_DAY), m = c.get(Calendar.MINUTE), h12 = h % 12 == 0 ? 12 : h % 12;
        return d + ", " + h12 + ":" + (m < 10 ? "0" : "") + m + (h < 12 ? " a. m." : " p. m.");
    }

    private void abrir(Intent i) {
        try { startActivity(i); } catch (Exception ignorada) { }
    }

    private TextView texto(String s, int sp, int color, boolean negrita, int arriba) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(color);
        t.setLineSpacing(0, 1.15f);
        if (negrita) t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setLayoutParams(margen(arriba));
        return t;
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
