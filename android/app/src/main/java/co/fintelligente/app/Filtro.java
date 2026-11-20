package co.fintelligente.app;

import java.text.Normalizer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Decide si una notificación es un aviso de dinero (compra, pago, transferencia...).
 * Todo lo que no pase este filtro se ignora en el acto y no se guarda.
 * Sin dependencias de Android para poder probarlo aparte.
 */
public final class Filtro {
    private Filtro() {}

    // Apps de bancos y billeteras (por nombre visible o nombre del paquete).
    private static final Pattern FINANCIERA = Pattern.compile(
        "bancolombia|nequi|davi(plata|vienda)?|bbva|bogota|occidente|popular|av ?villas|colpatria|scotiabank|itau|"
        + "nubank|\\bnu\\b|com\\.nu\\.|lulo|falabella|caja ?social|pibank|movii|\\bdale\\b|coomeva|finandina|serfinanza|"
        + "uala|global66|tpaga|powwi|iris|bancamia|mibanco|agrario|confiar|cotrafa|ban100|todo1|banco|\\bbank\\b|billetera|wallet");

    // Apps de chat: nunca se leen, aunque su nombre se parezca al de una app de mensajes.
    private static final Pattern CHAT = Pattern.compile(
        "whatsapp|telegram|signal|messenger|facebook\\.orca|instagram|snapchat|discord|viber|wechat|\\bline\\b|naver\\.line|teams|slack|tiktok|threads");

    // Apps de mensajes de texto (los bancos también avisan por SMS).
    private static final Pattern SMS = Pattern.compile("messag|mms|\\bsms\\b|mensajes|messages|textra|chomp");

    // Apps de correo: solo cuentan los avisos que nombran un banco (alertas por correo).
    private static final Pattern CORREO = Pattern.compile("android\\.gm\\b|gmail|outlook|\\bmail\\b|correo|yahoo");

    private static final Pattern MONTO = Pattern.compile(
        "(\\$|cop|col\\$)\\s?\\d|\\d{1,3}([.,]\\d{3})+([.,]\\d{1,2})?|\\d+\\s?(mil|pesos)\\b");

    private static final Pattern MOVIMIENTO = Pattern.compile(
        "compr|pag[oóaue]|pagaste|transfer|enviaste|envio|te envi|recibiste|recibio|te llego|retir|abono|abonaron|"
        + "consign|debit|debito|cargo|deposit|movimiento|transaccion|giro|avance|cobro");

    private static final Pattern FUERTE = Pattern.compile(
        "compraste|compra (por|de|aprobada|realizada|exitosa|con)|transferencia (exitosa|realizada|de|por|a)|transferiste|"
        + "enviaste|recibiste|pagaste|pago (exitoso|aprobado|realizado|de|por)|retiraste|retiro (de|por)|abono (de|por)|abonaron|consignacion (de|por)");

    // Códigos de seguridad: nunca se guardan.
    private static final Pattern CODIGO = Pattern.compile("codigo|clave|otp|token|contrasena|verificacion|no lo compartas|no la compartas");

    // Promociones y publicidad.
    private static final Pattern PUBLICIDAD = Pattern.compile("aprovecha|promo|descuento de|oferta|gana hasta|participa|sorteo|cashback de hasta|credito preaprobado|tasa especial");

    public static String normalizar(String s) {
        if (s == null) return "";
        String n = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return n.toLowerCase().replace(' ', ' ');
    }

    /** "banco", "sms", "correo" o "" (cualquier otra app: no se lee su texto). */
    public static String tipoDeApp(String paquete, String nombreApp) {
        String p = normalizar(paquete) + " " + normalizar(nombreApp);
        if (CHAT.matcher(p).find()) return "";
        if (FINANCIERA.matcher(p).find()) return "banco";
        if (SMS.matcher(p).find()) return "sms";
        if (CORREO.matcher(p).find()) return "correo";
        return "";
    }

    public static boolean esApp(String paquete, String nombreApp) {
        return !tipoDeApp(paquete, nombreApp).isEmpty();
    }

    // Código de seguridad (OTP): un número suelto de 4 a 8 cifras cerca de "código", "clave", "OTP" o "token".
    // No cuentan los montos ($50.000), los últimos números de una tarjeta o cuenta (*1234, "terminada en 1234"),
    // las fechas ni los teléfonos. Es la misma regla que usa la página.
    private static final Pattern NUMERO = Pattern.compile("(^|[^\\d$*.,/:#])(\\d{4,8})(?![\\d]|[.,:/]\\d|\\s?(?:pesos|cop)\\b)");
    private static final Pattern PALABRA_CODIGO = Pattern.compile("\\b(?:codigo|clave|otp|token|contrasena|pin)\\b");
    private static final Pattern CODIGO_DESPUES = Pattern.compile("^\\W{0,3}(?:es|sera)\\s(?:tu|su)\\s(?:codigo|clave|otp|token)\\b");
    private static final Pattern REFERENCIA = Pattern.compile("termina\\w*\\s(?:en\\s)?$|(?:tarjeta|cuenta|cta|nro|no\\.)\\s*$");

    public static boolean esCodigoSeguridad(String texto) {
        String t = normalizar(texto);
        Matcher m = NUMERO.matcher(t);
        while (m.find()) {
            int ini = m.start(2), fin = m.end(2);
            String antes = t.substring(Math.max(0, ini - 60), ini), despues = t.substring(fin, Math.min(t.length(), fin + 30));
            if (REFERENCIA.matcher(antes).find()) continue;
            if (PALABRA_CODIGO.matcher(antes).find() || CODIGO_DESPUES.matcher(despues).find()) return true;
        }
        return false;
    }

    // ---------- Mensajes falsos (la estafa más común con Bre-B) ----------
    // Anuncian una plata recibida o pendiente y piden entrar a un enlace para confirmarla. Los bancos y Bre-B nunca
    // lo hacen. Es la misma regla que usa la página.
    private static final String[] OFICIALES = {"bancolombia.com", "nequi.com.co", "davivienda.com", "daviplata.com", "bbva.com.co", "bancodebogota.com",
        "bancodeoccidente.com.co", "avvillas.com.co", "bancopopular.com.co", "nu.com.co", "scotiabankcolpatria.com", "bancocajasocial.com", "itau.co",
        "bancofalabella.com.co", "lulobank.com", "banrep.gov.co", "rappipay.co", "movii.com.co", "dale.com.co", "uala.com.co", "bancoagrario.gov.co",
        "bancamia.com.co", "mibanco.com.co"};
    private static final Pattern ENLACE = Pattern.compile("https?://\\S+|www\\.\\S+|\\b(?:bit\\.ly|tinyurl\\.com|cutt\\.ly|t\\.co|is\\.gd|acortar\\.link|rebrand\\.ly)/\\S*|"
        + "\\b[a-z0-9][a-z0-9\\-]*(?:\\.[a-z0-9\\-]+)*\\.(?:co|com|net|org|xyz|info|link|online|site|top|lat|app|me|click|shop)(?:/\\S*)?(?=[\\s.,)]|$)");
    private static final Pattern IMITA = Pattern.compile("bancolombia|nequi|davivienda|daviplata|bbva|bogota|occidente|avvillas|popular|colpatria|cajasocial|falabella|bre-?b|banrep|banco");
    private static final Pattern ACORTADOR = Pattern.compile("^(?:bit\\.ly|tinyurl|cutt\\.ly|t\\.co|is\\.gd|acortar|rebrand)");
    private static final Pattern PIDE_FUERTE = Pattern.compile("pendiente|confirm(?:a|e|ar|alo|ala)\\b|reclam|haz clic|has clic|da clic|dale clic|antes de|\\d+\\s?horas|bloquead|suspendid|urgente|vence hoy");
    private static final Pattern PIDE = Pattern.compile("ingresa|entra (?:a|al|en)|activa|valida|verifica|actualiza|acepta");
    private static final Pattern PLATA_FUERTE = Pattern.compile("bre\\s?-?\\s?b|recibiste una|transferencia (?:pendiente|por recibir|a tu favor)|giro|reembolso|devolucion|pago pendiente");
    private static final Pattern PLATA = Pattern.compile("transferencia|pago|plata|dinero|\\$\\s?\\d");

    public static boolean esEstafa(String texto) {
        String t = normalizar(texto);
        Matcher m = ENLACE.matcher(t);
        boolean fuerte = false, debil = false;
        while (m.find()) {
            String u = m.group();
            String host = u.replaceFirst("^https?://", "").replaceFirst("^www\\.", "").split("[/?#]")[0].replaceAll("[.,)]+$", "");
            boolean oficial = false;
            for (String d : OFICIALES) if (host.equals(d) || host.endsWith("." + d)) { oficial = true; break; }
            if (oficial) continue;
            if (IMITA.matcher(host).find() || u.matches("^(?:https?:|www\\.).*") || u.contains("/") || ACORTADOR.matcher(host).find()) fuerte = true; else debil = true;
        }
        if (!fuerte && !debil) return false;
        if (fuerte) return (PIDE_FUERTE.matcher(t).find() || PIDE.matcher(t).find()) && (PLATA_FUERTE.matcher(t).find() || PLATA.matcher(t).find());
        return PIDE_FUERTE.matcher(t).find() && PLATA_FUERTE.matcher(t).find();
    }

    /** Por qué se acepta o se descarta un aviso: "ok", "estafa", "codigo", "publicidad", "sin-dinero" u "otra-app". */
    public static String motivo(String paquete, String nombreApp, String texto) {
        if (!esApp(paquete, nombreApp)) return "otra-app";
        if (texto == null || texto.trim().length() < 8) return "sin-dinero";
        String t = normalizar(texto);
        if (esEstafa(texto)) return "estafa";
        if (esCodigoSeguridad(texto)) return "codigo";
        if (CODIGO.matcher(t).find() && !FUERTE.matcher(t).find()) return "codigo";
        if (!MONTO.matcher(t).find() || !MOVIMIENTO.matcher(t).find()) return "sin-dinero";
        if (PUBLICIDAD.matcher(t).find()) return "publicidad";
        // Por SMS o correo solo cuentan los que nombran un banco, una tarjeta o una cuenta.
        String p = normalizar(paquete) + " " + normalizar(nombreApp);
        if (!FINANCIERA.matcher(p).find()) {
            if (!(FINANCIERA.matcher(t).find() || t.matches("(?s).*(tarjeta|cuenta|t\\.?\\s?deb|t\\.?\\s?cred|\\*\\d{4}|bre\\s?-?\\s?b|llave).*"))) return "sin-dinero";
        }
        return "ok";
    }

    public static boolean esMovimiento(String paquete, String nombreApp, String texto) {
        return "ok".equals(motivo(paquete, nombreApp, texto));
    }

    // ---------- Avisos que no entendimos ----------
    // Un aviso de una app de banco que trae plata, pero que no supimos leer como movimiento ("Te cayeron $20.000",
    // "Usaste tu tarjeta por $45.000"). No se anota: se guarda tapado en el celular para que la persona decida
    // si nos lo comparte. Saldos, recordatorios y publicidad no cuentan.
    private static final Pattern MONTO_CLARO = Pattern.compile("\\$\\s?\\d|\\b(?:cop|col\\$)\\s?\\d|\\b\\d{1,3}(?:[.,]\\d{3})+(?:[.,]\\d{1,2})?\\b|\\b\\d+\\s?(?:mil|pesos)\\b");
    private static final Pattern NO_ES_MOVIMIENTO = Pattern.compile(
        "saldo (?:disponible|actual|es|de tu|en tu)|tu saldo|cupo disponible|vence|vencimiento|recuerda|recordatorio|proxim[oa] (?:pago|cuota)|fecha limite|"
        + "puedes pedir|solicita|simula|te prestamos|credito de hasta|meta de ahorro|resumen|extracto|estado de cuenta");

    /** ¿Es un aviso de banco con plata que no supimos leer? (Recibe el motivo ya calculado.) */
    public static boolean noEntendido(String paquete, String nombreApp, String texto, String motivo) {
        if (!"sin-dinero".equals(motivo) || texto == null) return false;
        if (!"banco".equals(tipoDeApp(paquete, nombreApp))) return false;   // solo apps de bancos: nunca SMS ni correos personales
        String t = normalizar(texto);
        if (CODIGO.matcher(t).find() || PUBLICIDAD.matcher(t).find() || NO_ES_MOVIMIENTO.matcher(t).find()) return false;
        return MONTO_CLARO.matcher(t).find();
    }

    // Números largos (cuentas, celulares, documentos): quedan solo los últimos 4. Los montos no se tocan.
    private static final Pattern NUMERO_LARGO = Pattern.compile("(?<![\\d.,$*])\\d(?:-?\\d){5,}(?!\\d|[.,]\\d)");

    /** El texto listo para mostrarlo o compartirlo: sin claves ni números largos. */
    public static String ocultar(String texto) {
        String t = tapar(texto);
        Matcher m = NUMERO_LARGO.matcher(t);
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            String antes = normalizar(t.substring(Math.max(0, m.start() - 5), m.start()));
            String dig = m.group().replaceAll("\\D", "");
            boolean monto = antes.matches("(?s).*(?:\\$|cop|col)\\s?$") || t.substring(m.end()).matches("(?s)^\\s?(?:pesos|cop)\\b.*");
            m.appendReplacement(sb, Matcher.quoteReplacement(monto ? m.group() : "••••" + dig.substring(dig.length() - 4)));
        }
        m.appendTail(sb);
        return sb.toString().length() > 400 ? sb.toString().substring(0, 400) + "…" : sb.toString();
    }

    private static final Pattern NUMERO_SUELTO = Pattern.compile("(?<![\\d$*.,/:#])\\d{4,8}(?!\\d|[.,:/]\\d)");

    /** Por si acaso: en avisos que hablan de claves o códigos, tapa los números sueltos que no sean montos ni finales de tarjeta. */
    public static String tapar(String texto) {
        if (texto == null) return "";
        if (!CODIGO.matcher(normalizar(texto)).find()) return texto;
        Matcher m = NUMERO_SUELTO.matcher(texto);
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            String antes = normalizar(texto.substring(Math.max(0, m.start() - 16), m.start()));
            m.appendReplacement(sb, REFERENCIA.matcher(antes).find() ? m.group() : "••••");
        }
        m.appendTail(sb);
        return sb.toString();
    }

    private static final Pattern MONTO_VISIBLE = Pattern.compile("\\$\\s?\\d{1,3}(?:[.,]\\d{3})*(?:[.,]\\d{1,2})?|\\$\\s?\\d+");

    /** El primer monto del aviso, tal como viene (para el título de la notificación). */
    public static String montoVisible(String texto) {
        if (texto == null) return "";
        Matcher m = MONTO_VISIBLE.matcher(texto);
        if (!m.find()) return "";
        String v = m.group().replace(" ", "");
        return v.replaceAll("[.,]\\d{2}$", "");
    }

    /** Huella para no guardar dos veces el mismo aviso (Android repite notificaciones al actualizarlas). */
    public static String huella(String texto) {
        String t = normalizar(texto).replaceAll("\\s+", " ").trim();
        return Integer.toHexString(t.hashCode()) + ":" + t.length();
    }
}
