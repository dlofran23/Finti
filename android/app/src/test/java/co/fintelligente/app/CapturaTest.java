package co.fintelligente.app;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.view.View;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;

import java.io.FileOutputStream;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 34, qualifiers = "w393dp-h852dp-xxhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class CapturaTest {
    @Test public void captura() throws Exception {
        BienvenidaActivity a = Robolectric.buildActivity(BienvenidaActivity.class).setup().get();
        View v = a.getWindow().getDecorView();
        int w = 1080, h = 2340;
        v.measure(View.MeasureSpec.makeMeasureSpec(w, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(h, View.MeasureSpec.EXACTLY));
        v.layout(0, 0, w, h);
        Bitmap b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(b); c.drawColor(0xFFF5F6FA); v.draw(c);
        java.io.File dir = new java.io.File(System.getProperty("user.dir"), "build/capturas"); dir.mkdirs();
        try (FileOutputStream o = new FileOutputStream(new java.io.File(dir, "app-permisos.png"))) { b.compress(Bitmap.CompressFormat.PNG, 100, o); }
    }

    @Test public void capturaPrivacidad() throws Exception {
        android.content.Context app = androidx.test.core.app.ApplicationProvider.getApplicationContext();
        android.provider.Settings.Secure.putString(app.getContentResolver(), "enabled_notification_listeners",
            new android.content.ComponentName(app, LectorNotificaciones.class).flattenToString());
        long ahora = System.currentTimeMillis();
        for (int i = 0; i < 37; i++) Registro.contar(app, Registro.OTRAS);
        for (int i = 0; i < 2; i++) Registro.contar(app, Registro.CODIGOS);
        for (int i = 0; i < 4; i++) Registro.contar(app, Registro.SIN_DINERO);
        Registro.guardado(app, "Bancolombia", "$45.900", ahora - 7_200_000);
        Registro.guardado(app, "Nequi", "$8.500", ahora - 3_600_000);
        Registro.guardado(app, "Daviplata", "$120.000", ahora - 600_000);
        PrivacidadActivity a = Robolectric.buildActivity(PrivacidadActivity.class).setup().get();
        View v = a.getWindow().getDecorView();
        int w = 1080, h = 4200;
        v.measure(View.MeasureSpec.makeMeasureSpec(w, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(h, View.MeasureSpec.EXACTLY));
        v.layout(0, 0, w, h);
        Bitmap b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(b); c.drawColor(0xFFFFFFFF); v.draw(c);
        java.io.File dir = new java.io.File(System.getProperty("user.dir"), "build/capturas"); dir.mkdirs();
        try (FileOutputStream o = new FileOutputStream(new java.io.File(dir, "app-privacidad.png"))) { b.compress(Bitmap.CompressFormat.PNG, 100, o); }
    }
}
