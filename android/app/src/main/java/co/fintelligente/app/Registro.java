package co.fintelligente.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Lo que la persona decide sobre la lectura (pausa, SMS, correo) y el registro transparente de lo que pasó:
 * cuántos avisos se guardaron y cuántos se descartaron, y por qué. Del registro nunca se guarda el texto:
 * solo la app, el monto y la hora de los avisos guardados. Todo queda en este celular.
 */
final class Registro {
    private static final String PREFS = "registro";
    static final String GUARDADOS = "guardados", CODIGOS = "codigos", SIN_DINERO = "sin_dinero", OTRAS = "otras", ESTAFAS = "estafas", NO_ENTENDIDOS = "no_entendidos";
    private static final int MAX_ULTIMOS = 20, MAX_NO_ENTENDIDOS = 10;
    private static final long VIDA_NO_ENTENDIDOS = 30L * 24 * 3600 * 1000;

    private Registro() {}

    private static SharedPreferences p(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    // ---------- Decisiones de la persona ----------
    static boolean pausada(Context c) { return p(c).getBoolean("pausada", false); }
    static boolean leerSms(Context c) { return p(c).getBoolean("leer_sms", true); }
    static boolean leerCorreo(Context c) { return p(c).getBoolean("leer_correo", true); }
    static void pausar(Context c, boolean si) { p(c).edit().putBoolean("pausada", si).apply(); }
    static void elegir(Context c, String clave, boolean si) { p(c).edit().putBoolean(clave, si).apply(); }

    /** ¿Se puede leer el texto de esta app según lo que eligió la persona? */
    static boolean permitida(Context c, String tipo) {
        if (tipo == null || tipo.isEmpty() || pausada(c)) return false;
        if ("sms".equals(tipo)) return leerSms(c);
        if ("correo".equals(tipo)) return leerCorreo(c);
        return true;
    }

    // ---------- Registro ----------
    static synchronized void contar(Context c, String que) {
        SharedPreferences s = p(c);
        SharedPreferences.Editor e = s.edit().putInt(que, s.getInt(que, 0) + 1);
        if (s.getLong("desde", 0) == 0) e.putLong("desde", System.currentTimeMillis());
        e.apply();
    }

    static int total(Context c, String que) { return p(c).getInt(que, 0); }

    static long desde(Context c) { return p(c).getLong("desde", 0); }

    static synchronized void guardado(Context c, String app, String monto, long cuando) {
        contar(c, GUARDADOS);
        try {
            JSONArray u = new JSONArray(p(c).getString("ultimos", "[]"));
            JSONObject o = new JSONObject();
            o.put("a", app == null ? "" : app);
            o.put("m", monto == null ? "" : monto);
            o.put("ts", cuando);
            u.put(o);
            JSONArray r = new JSONArray();
            for (int i = Math.max(0, u.length() - MAX_ULTIMOS); i < u.length(); i++) r.put(u.get(i));
            p(c).edit().putString("ultimos", r.toString()).apply();
        } catch (Exception ignorada) { }
    }

    static JSONArray ultimos(Context c) {
        try { return new JSONArray(p(c).getString("ultimos", "[]")); } catch (Exception e) { return new JSONArray(); }
    }

    // ---------- Avisos que no entendimos ----------
    // Se guardan tapados (sin claves ni números largos), solo en este celular, como mucho 10 y por 30 días.
    // Nada se envía: la persona decide si comparte alguno.
    static synchronized void noEntendido(Context c, String app, String texto, long cuando) {
        try {
            String limpio = Filtro.ocultar(texto), h = Filtro.huella(limpio);
            JSONArray u = noEntendidos(c);
            for (int i = 0; i < u.length(); i++) if (h.equals(u.optJSONObject(i).optString("h"))) return;
            contar(c, NO_ENTENDIDOS);
            JSONObject o = new JSONObject();
            o.put("a", app == null ? "" : app);
            o.put("t", limpio);
            o.put("ts", cuando);
            o.put("h", h);
            u.put(o);
            JSONArray r = new JSONArray();
            for (int i = Math.max(0, u.length() - MAX_NO_ENTENDIDOS); i < u.length(); i++) r.put(u.get(i));
            p(c).edit().putString("no_entendidos_lista", r.toString()).apply();
        } catch (Exception ignorada) { }
    }

    /** Los avisos que no entendimos, sin los que pasaron de 30 días. */
    static synchronized JSONArray noEntendidos(Context c) {
        JSONArray r = new JSONArray();
        try {
            JSONArray u = new JSONArray(p(c).getString("no_entendidos_lista", "[]"));
            long limite = System.currentTimeMillis() - VIDA_NO_ENTENDIDOS;
            for (int i = 0; i < u.length(); i++) { JSONObject o = u.optJSONObject(i); if (o != null && o.optLong("ts") >= limite) r.put(o); }
        } catch (Exception ignorada) { }
        return r;
    }

    static synchronized void quitarNoEntendido(Context c, String huella) {
        JSONArray u = noEntendidos(c), r = new JSONArray();
        for (int i = 0; i < u.length(); i++) if (!huella.equals(u.optJSONObject(i).optString("h"))) r.put(u.optJSONObject(i));
        p(c).edit().putString("no_entendidos_lista", r.toString()).apply();
    }

    /** Borra el registro y los avisos en espera (no toca lo que la persona eligió). */
    static synchronized void borrar(Context c) {
        p(c).edit().remove(GUARDADOS).remove(CODIGOS).remove(SIN_DINERO).remove(OTRAS).remove(ESTAFAS).remove(NO_ENTENDIDOS).remove("no_entendidos_lista").remove("ultimos").remove("desde").apply();
        Cola.vaciar(c);
    }
}
