package co.fintelligente.app;

import android.net.Uri;
import android.util.Base64;

import com.google.androidbrowserhelper.trusted.LauncherActivity;

import java.nio.charset.StandardCharsets;

/**
 * Abre Finti a pantalla completa. Si hay avisos esperando, se los pasa a la página
 * en la parte de la dirección que va después de #, que el navegador nunca envía a ningún servidor.
 */
public class InicioActivity extends LauncherActivity {
    /** Máximo de caracteres por aviso que viajan a la página (los avisos de banco caben de sobra). */
    private static final int MAX_TEXTO = 600;

    /**
     * Intención correcta para abrir la página desde cualquier parte de la app.
     * - FLAG_ACTIVITY_NEW_TASK: evita que la librería se reinicie en una tarea nueva, que dejaba dos
     *   copias vivas a la vez; la segunda creía que ya había una abierta y se cerraba (la app se cerraba sola).
     * - Datos (la dirección del sitio): si la página ya está abierta, igual se vuelve a abrir con los
     *   avisos nuevos en vez de ignorar el toque.
     */
    private static int vivas = 0;
    /** true si la página ya está abierta en este proceso (para no recargarla sin necesidad). */
    static boolean abierta() { return vivas > 0; }

    @Override
    protected void onCreate(android.os.Bundle s) { vivas++; super.onCreate(s); }

    @Override
    protected void onDestroy() { vivas--; super.onDestroy(); }

    static android.content.Intent abrir(android.content.Context c) { return abrir(c, true); }

    /** Abre la página y le pide una acción, por ejemplo efectivo-gasto (registro con la cuenta de efectivo). */
    static android.content.Intent abrirAccion(android.content.Context c, String accion) {
        android.content.Intent i = abrir(c, true);
        i.putExtra(EXTRA_ACCION, accion);
        return i;
    }
    static final String EXTRA_ACCION = "co.fintelligente.app.ACCION";
    /** Lo que la persona dijo en VozActivity (texto, nunca audio). */
    static final String EXTRA_DICHO = "co.fintelligente.app.DICHO";

    /** conDatos=false: si la página ya está abierta, solo la trae al frente (sin recargarla). */
    static android.content.Intent abrir(android.content.Context c, boolean conDatos) {
        android.content.Intent i = new android.content.Intent(c, InicioActivity.class);
        if (conDatos) i.setData(Uri.parse(c.getString(R.string.sitio)));
        i.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
        return i;
    }

    @Override
    protected Uri getLaunchingUrl() {
        Uri base = Uri.parse(getString(R.string.sitio));
        Uri.Builder b = base.buildUpon()
            .clearQuery()
            .appendQueryParameter("app", "android")
            .appendQueryParameter("lectura", Acceso.lecturaActiva(this) && !Registro.pausada(this) ? "1" : "0")
            .appendQueryParameter("v", String.valueOf(version()));
        String lote = recortar(Cola.tomarTodo(this));
        String accion = getIntent() != null ? getIntent().getStringExtra(EXTRA_ACCION) : null;
        if (accion != null && !accion.matches("efectivo-(gasto|ingreso)|charla")) accion = null;
        String dicho = "charla".equals(accion) && getIntent() != null ? getIntent().getStringExtra(EXTRA_DICHO) : null;
        StringBuilder frag = new StringBuilder();
        if (lote != null) {
            String cod = Base64.encodeToString(lote.getBytes(StandardCharsets.UTF_8), Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
            frag.append("importar-lote=").append(cod);   // sin codificar el =: la página lo busca tal cual
        }
        if (accion != null) frag.append(frag.length() > 0 ? "&" : "").append("accion=").append(accion);
        if (dicho != null && !dicho.trim().isEmpty()) {
            String d = dicho.trim(); if (d.length() > 800) d = d.substring(0, 800);
            frag.append("&dicho=").append(Base64.encodeToString(d.getBytes(StandardCharsets.UTF_8), Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING));
        }
        if (frag.length() > 0) b.encodedFragment(frag.toString());
        Avisador.quitar(this);
        return b.build();
    }

    @SuppressWarnings("deprecation")
    private int version() {
        try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionCode; } catch (Exception e) { return 0; }
    }

    /** Deja cada aviso en un tamaño razonable para que la dirección no se vuelva gigante. */
    static String recortar(String lote) {
        if (lote == null) return null;
        try {
            org.json.JSONArray a = new org.json.JSONArray(lote), out = new org.json.JSONArray();
            for (int i = 0; i < a.length(); i++) {
                org.json.JSONObject o = a.getJSONObject(i);
                String t = o.optString("t", "");
                if (t.length() > MAX_TEXTO) o.put("t", t.substring(0, MAX_TEXTO));
                out.put(o);
            }
            return out.toString();
        } catch (Exception e) {
            return lote;
        }
    }
}
