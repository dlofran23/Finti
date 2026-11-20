package co.fintelligente.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

/** Avisos leídos que esperan a que abras la app. Se guardan solo en este celular. */
final class Cola {
    private static final String PREFS = "cola";
    private static final int MAX = 100, MAX_VISTOS = 300;

    private Cola() {}

    private static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    /** Agrega un aviso. Devuelve false si ya lo habíamos visto (Android repite notificaciones). */
    static synchronized boolean agregar(Context c, String texto, String app, long cuando) {
        SharedPreferences p = prefs(c);
        try {
            String h = Filtro.huella(texto);
            JSONArray vistos = new JSONArray(p.getString("vistos", "[]"));
            for (int i = 0; i < vistos.length(); i++) if (h.equals(vistos.optString(i))) return false;
            JSONArray nuevosVistos = new JSONArray();
            int desde = Math.max(0, vistos.length() - (MAX_VISTOS - 1));
            for (int i = desde; i < vistos.length(); i++) nuevosVistos.put(vistos.optString(i));
            nuevosVistos.put(h);

            JSONArray cola = new JSONArray(p.getString("items", "[]"));
            JSONObject o = new JSONObject();
            o.put("t", texto.length() > 1500 ? texto.substring(0, 1500) : texto);
            o.put("a", app);
            o.put("ts", cuando);
            cola.put(o);
            JSONArray recortada = new JSONArray();
            for (int i = Math.max(0, cola.length() - MAX); i < cola.length(); i++) recortada.put(cola.get(i));

            p.edit().putString("items", recortada.toString()).putString("vistos", nuevosVistos.toString()).apply();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    static synchronized void vaciar(Context c) {
        prefs(c).edit().putString("items", "[]").apply();
        Avisador.quitar(c);
    }

    static synchronized int contar(Context c) {
        try { return new JSONArray(prefs(c).getString("items", "[]")).length(); } catch (Exception e) { return 0; }
    }

    /** Entrega todos los avisos pendientes (JSON) y vacía la cola. Devuelve null si no hay. */
    static synchronized String tomarTodo(Context c) {
        SharedPreferences p = prefs(c);
        String s = p.getString("items", "[]");
        try { if (new JSONArray(s).length() == 0) return null; } catch (Exception e) { return null; }
        p.edit().putString("items", "[]").commit();
        return s;
    }
}
