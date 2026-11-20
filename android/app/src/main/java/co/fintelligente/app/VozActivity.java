package co.fintelligente.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.ArrayList;

/**
 * Cuéntame un gasto con la voz, desde el botón Finti de la barra de notificaciones o el micrófono de la página.
 * Solo usa el reconocimiento DENTRO del teléfono (createOnDeviceSpeechRecognizer, Android 12 o más): el audio no sale
 * del celular y no se guarda. Lo que se entiende pasa a la página como texto, y ahí se interpreta y se confirma.
 * Si el teléfono no puede reconocer voz sin internet, abre la charla para escribir.
 */
public class VozActivity extends Activity {
    private static final int PEDIR_MIC = 21;
    private static final int TINTA = Color.parseColor("#14121F"), GRIS = Color.parseColor("#5B576B"), VIOLETA = Color.parseColor("#6A4AF0");

    /** Lo que se le puede decir: gastos, ingresos, deudas con amigos y preguntas (estas van a Pregúntale). */
    private static final String[] EJEMPLOS = {
        "Por ejemplo: $ 18.000 en almuerzo",
        "Por ejemplo: le presté $ 50.000 a Juan",
        "Por ejemplo, Caro ya me pagó",
        "Por ejemplo: ¿cuánto puedo gastar hoy?",
        "Por ejemplo: me pagaron la quincena",
        "Por ejemplo: ¿quién me debe plata?"
    };

    private SpeechRecognizer rec;
    private TextView titulo, dicho;
    private View mic;
    private boolean conIdiomaGeneral = false, termino = false;

    @Override
    protected void onCreate(Bundle s) {
        super.onCreate(s);
        if (Build.VERSION.SDK_INT < 31 || !SpeechRecognizer.isOnDeviceRecognitionAvailable(this)) { abrirCharla(null); return; }
        pintar();
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) escuchar();
        else requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, PEDIR_MIC);
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] p, int[] r) {
        super.onRequestPermissionsResult(req, p, r);
        if (req != PEDIR_MIC) return;
        if (r.length > 0 && r[0] == PackageManager.PERMISSION_GRANTED) escuchar(); else abrirCharla(null);
    }

    @Override
    protected void onDestroy() {
        if (rec != null) { try { rec.destroy(); } catch (Exception ignorada) { } rec = null; }
        super.onDestroy();
    }

    // ---------- Pantalla: una tarjeta abajo, como la charla de la página ----------
    private void pintar() {
        FrameLayout fondo = new FrameLayout(this);
        fondo.setBackgroundColor(Color.parseColor("#66000000"));
        fondo.setOnClickListener(v -> cancelar());

        LinearLayout tarjeta = new LinearLayout(this);
        tarjeta.setOrientation(LinearLayout.VERTICAL);
        tarjeta.setGravity(Gravity.CENTER_HORIZONTAL);
        tarjeta.setPadding(dp(24), dp(24), dp(24), dp(28));
        GradientDrawable g = new GradientDrawable();
        g.setColor(Color.WHITE);
        g.setCornerRadii(new float[]{dp(28), dp(28), dp(28), dp(28), 0, 0, 0, 0});
        tarjeta.setBackground(g);
        tarjeta.setClickable(true);

        titulo = texto("Cuéntale a Finti", 22, TINTA, true);
        tarjeta.addView(titulo);
        tarjeta.addView(texto(EJEMPLOS[(int) (System.currentTimeMillis() / 1000 % EJEMPLOS.length)], 15, GRIS, false));

        mic = new View(this);
        GradientDrawable c = new GradientDrawable();
        c.setShape(GradientDrawable.OVAL);
        c.setColor(VIOLETA);
        mic.setBackground(c);
        mic.setContentDescription("Escuchando");
        LinearLayout.LayoutParams lm = new LinearLayout.LayoutParams(dp(76), dp(76));
        lm.topMargin = dp(22); lm.bottomMargin = dp(16);
        tarjeta.addView(mic, lm);
        mic.animate().scaleX(1.12f).scaleY(1.12f).setDuration(650).withEndAction(this::latir).start();

        dicho = texto("", 17, TINTA, false);
        tarjeta.addView(dicho);
        tarjeta.addView(texto("Tu voz se entiende aquí en el teléfono y no se guarda.", 13, GRIS, false));

        LinearLayout fila = new LinearLayout(this);
        fila.setGravity(Gravity.CENTER);
        fila.addView(boton("Escribirlo", v -> abrirCharla(null)));
        fila.addView(boton("Cancelar", v -> cancelar()));
        LinearLayout.LayoutParams lf = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lf.topMargin = dp(16);
        tarjeta.addView(fila, lf);

        FrameLayout.LayoutParams lt = new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM);
        fondo.addView(tarjeta, lt);
        setContentView(fondo);
    }

    private void latir() {
        if (mic == null || termino) return;
        float a = mic.getScaleX() > 1.05f ? 1f : 1.12f;
        mic.animate().scaleX(a).scaleY(a).setDuration(650).withEndAction(this::latir).start();
    }

    // ---------- Reconocimiento en el dispositivo ----------
    private Intent pedido() {
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, conIdiomaGeneral ? "es" : "es-CO");
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        // Una historia de mercado tiene pausas: se espera un poco más antes de cortar
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2500);
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 2000);
        return i;
    }

    private void escuchar() {
        if (Build.VERSION.SDK_INT < 31) { abrirCharla(null); return; }
        try {
            if (rec == null) {
                rec = SpeechRecognizer.createOnDeviceSpeechRecognizer(this);
                rec.setRecognitionListener(new Oyente());
            }
            titulo.setText("Te escucho…");
            rec.startListening(pedido());
        } catch (Exception e) {
            abrirCharla(null);
        }
    }

    private class Oyente implements RecognitionListener {
        @Override public void onReadyForSpeech(Bundle b) { }
        @Override public void onBeginningOfSpeech() { }
        @Override public void onRmsChanged(float v) { }
        @Override public void onBufferReceived(byte[] b) { }
        @Override public void onEndOfSpeech() { titulo.setText("Un momento…"); }
        @Override public void onEvent(int t, Bundle b) { }

        @Override public void onPartialResults(Bundle b) {
            String t = primero(b);
            if (t != null && !t.isEmpty()) dicho.setText(t);
        }

        @Override public void onResults(Bundle b) {
            String t = primero(b);
            if (t == null || t.trim().isEmpty()) { noEscuche(); return; }
            abrirCharla(t.trim());
        }

        @Override public void onError(int e) {
            if (termino) return;
            // 12 = idioma no soportado, 13 = idioma sin descargar (Android 12+)
            if ((e == 12 || e == 13) && !conIdiomaGeneral) { conIdiomaGeneral = true; escuchar(); return; }
            if (e == 13 && Build.VERSION.SDK_INT >= 33) {
                try { rec.triggerModelDownload(pedido()); } catch (Exception ignorada) { }
                titulo.setText("Descargando el español");
                dicho.setText("Tu teléfono está bajando el español para entenderte sin internet. Mientras tanto, puedes escribirlo.");
                return;
            }
            if (e == 12 || e == 13) { abrirCharla(null); return; }
            if (e == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) { abrirCharla(null); return; }
            noEscuche();
        }
    }

    private void noEscuche() {
        titulo.setText("No te escuché bien");
        dicho.setText("Toca el círculo para intentarlo otra vez.");
        mic.setOnClickListener(v -> { dicho.setText(""); escuchar(); });
    }

    private static String primero(Bundle b) {
        ArrayList<String> l = b != null ? b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) : null;
        return l != null && !l.isEmpty() ? l.get(0) : null;
    }

    // ---------- Salidas ----------
    private void abrirCharla(String texto) {
        if (termino) return;
        termino = true;
        Intent i = InicioActivity.abrirAccion(this, "charla");
        if (texto != null) i.putExtra(InicioActivity.EXTRA_DICHO, texto.length() > 800 ? texto.substring(0, 800) : texto);
        startActivity(i);
        finish();
        overridePendingTransition(0, 0);
    }

    private void cancelar() {
        termino = true;
        finish();
        overridePendingTransition(0, 0);
    }

    // ---------- Ayudas ----------
    private TextView texto(String t, int sp, int color, boolean negrita) {
        TextView v = new TextView(this);
        v.setText(t);
        v.setTextSize(sp);
        v.setTextColor(color);
        v.setGravity(Gravity.CENTER);
        if (negrita) v.setTypeface(Typeface.DEFAULT_BOLD);
        v.setPadding(0, dp(4), 0, dp(4));
        return v;
    }

    private Button boton(String t, View.OnClickListener l) {
        Button b = new Button(this);
        b.setText(t);
        b.setAllCaps(false);
        b.setTextColor(VIOLETA);
        b.setBackgroundColor(Color.TRANSPARENT);
        b.setOnClickListener(l);
        return b;
    }

    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }
}
