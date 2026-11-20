import { almacen } from "../lib/almacen.mjs";
import { validarPerfil, tokenValido, hmac, correoHtml } from "../lib/avisos.mjs";
import { leerCanales } from "../lib/canales.mjs";
import { actualizar } from "../lib/atomico.mjs";

const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export default async (req, context) => {
  const store = almacen("avisos", context), c = leerCanales(process.env, { limites: almacen("cuentas-limites", context, true) });
  const url = new URL(req.url);

  // Enlace Dejar de recibir correos
  if (req.method === "GET") {
    const id = url.searchParams.get("baja") || "", t = url.searchParams.get("t") || "";
    let ok = false;
    if (/^[a-z0-9]{20}$/.test(id) && c.secreto && hmac(c.secreto, id) === t) {
      await actualizar(store, id, (p) => { if (!p) return undefined; p.email = ""; return p; });
      ok = true;
    }
    const msg = ok ? "Listo: ya no te enviaremos correos. Si quieres, puedes volver a activarlos desde la app." : "El enlace no es válido.";
    return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Finti</title><body style="font-family:Arial,sans-serif;max-width:480px;margin:60px auto;padding:0 20px;color:#141b2d"><h1 style="font-size:22px">Finti</h1><p>${msg}</p><p><a href="/">Abrir la app</a></p></body>`,
      { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const raw = await req.text();
  if (raw.length > 40000) return json({ error: "Datos demasiado grandes." }, 413);
  let body; try { body = JSON.parse(raw); } catch { return json({ error: "Datos inválidos." }, 400); }

  if (req.method === "DELETE") {
    if (!/^[a-z0-9]{20}$/.test(body.id || "")) return json({ error: "Identificador inválido." }, 400);
    const prev = await store.get(body.id, { type: "json" });
    if (prev && !tokenValido(prev, body.token)) return json({ error: "No autorizado." }, 403);
    if (prev) await store.delete(body.id);
    return json({ ok: true });
  }
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  const v = validarPerfil(body);
  if (v.error) return json({ error: v.error }, 400);
  const perfil = v.perfil;
  const prev = await store.get(perfil.id, { type: "json" });
  if (prev && prev.tokenHash !== perfil.tokenHash) return json({ error: "No autorizado." }, 403);
  if (perfil.push && !c.push) return json({ error: "Las notificaciones aún no están configuradas en este sitio." }, 503);
  if (perfil.email) {
    if (!c.premiumValido(perfil.licencia)) return json({ error: "Los avisos por correo son parte de Premium." }, 403);
    if (!c.correo) return json({ error: "El correo aún no está configurado en este sitio." }, 503);
  }
  perfil.enviados = (prev && prev.enviados) || {};
  perfil.hoyEnviados = prev && prev.hoyEnviados;
  perfil.actualizado = new Date().toISOString();

  // Confirmaciones solo cuando el canal es nuevo
  if (perfil.push && (!prev || !prev.push || prev.push.endpoint !== perfil.push.endpoint)) {
    const r = await c.enviarPush(perfil.push, JSON.stringify({ title: "Avisos activados", body: "Te avisaremos de tus pagos y, si un día no registras nada, te lo recordaremos con calma.", url: "/#inicio", tag: "bienvenida" }));
    if (r.status >= 300) return json({ error: "No pudimos enviar la notificación de prueba. Intenta activarlas de nuevo." }, 502);
  }
  if (perfil.email && (!prev || prev.email !== perfil.email)) {
    const baja = `${c.sitio}/api/avisos?baja=${perfil.id}&t=${hmac(c.secreto, perfil.id)}`;
    const ok = await c.enviarCorreo({ to: perfil.email, subject: "Activaste los avisos de Finti", html: correoHtml({ titulo: "¡Avisos por correo activados!", cuerpo: "Te escribiremos antes de que venzan tus pagos y cada domingo con un consejo para tu plata. Nada más.", sitio: c.sitio + "/", baja }) });
    if (!ok) return json({ error: "No pudimos enviar el correo de confirmación. Revisa la dirección." }, 502);
  }
  await store.setJSON(perfil.id, perfil);
  return json({ ok: true, push: !!perfil.push, email: !!perfil.email });
};
export const config = { path: "/api/avisos" };
