import * as C from "../lib/cuentas.mjs";
import { tokenLicencia } from "../lib/pagos.mjs";
import { depsNetlify, cuerpo, responder } from "../lib/cuentas-deps.mjs";

export default async (req, context) => {
  const deps = depsNetlify(context), ruta = new URL(req.url).pathname, ip = context && context.ip;
  if (ruta === "/api/cuenta/google-redirect" && req.method === "POST") {
    // Formulario que envía Google (modo redirección). La marca CSRF llega también como cookie.
    const t = await req.text();
    if (t.length > 20_000) return new Response(null, { status: 303, headers: { Location: "/#entrar-error=google" } });
    const f = new URLSearchParams(t), galleta = /(?:^|;\s*)g_csrf_token=([^;]+)/.exec(req.headers.get("cookie") || "");
    const ua = req.headers.get("user-agent") || "", disp = /iphone|ipad|ipod/i.test(ua) ? "iPhone" : /android/i.test(ua) ? "Android" : "Navegador";
    const x = await C.entrarConGoogleRedireccion(deps, { credencial: f.get("credential"), csrfCuerpo: f.get("g_csrf_token"), csrfCookie: galleta && decodeURIComponent(galleta[1]), dispositivo: disp, ip,
      consentimiento: C.consentimientoDeCookie(req.headers.get("cookie")) });
    return new Response(null, { status: x.status, headers: { Location: x.location, "Cache-Control": "no-store" } });
  }
  let b = {};
  if (req.method !== "GET") { try { b = await cuerpo(req, 20_000); } catch { return responder({ status: 400, body: { error: "Solicitud inválida." } }); } }

  if (ruta === "/api/cuenta/codigo" && req.method === "POST") return responder(await C.pedirCodigo(deps, { correo: b.correo, ip }));
  if (ruta === "/api/cuenta/verificar" && req.method === "POST") return responder(await C.verificarCodigo(deps, { correo: b.correo, codigo: b.codigo, dispositivo: b.dispositivo, ip, consentimiento: b.consentimiento }));
  if (ruta === "/api/cuenta/google" && req.method === "POST") return responder(await C.entrarConGoogle(deps, { credencial: b.credencial, dispositivo: b.dispositivo, ip, consentimiento: b.consentimiento }));
  if (ruta === "/api/cuenta/canjear" && req.method === "POST") return responder(await C.canjear(deps, { codigo: b.codigo }));

  const ses = await C.sesionDe(deps, req.headers.get("authorization"));
  if (!ses) return responder({ status: 401, body: { error: "Tu sesión terminó. Vuelve a entrar." } });
  if (ruta === "/api/cuenta" && req.method === "GET") return responder(await C.verCuenta(deps, ses));
  if (ruta === "/api/cuenta" && req.method === "DELETE") return responder(await C.borrarCuenta(deps, ses, b));
  if (ruta === "/api/cuenta/salir" && req.method === "POST") return responder(await C.salir(deps, ses, b));
  if (ruta === "/api/cuenta/acepto" && req.method === "POST") return responder(await C.aceptarTerminos(deps, ses, b));
  if (ruta === "/api/cuenta/licencia" && req.method === "PUT") {
    const secreto = process.env.LICENSE_SECRET || "";
    return responder(await C.guardarLicenciaCuenta(deps, ses, b, (ref, token) => !!secreto && tokenLicencia(ref, secreto) === token));
  }
  return responder({ status: 404, body: { error: "No encontrado." } });
};
export const config = { path: ["/api/cuenta", "/api/cuenta/codigo", "/api/cuenta/verificar", "/api/cuenta/google", "/api/cuenta/google-redirect", "/api/cuenta/canjear", "/api/cuenta/salir", "/api/cuenta/acepto", "/api/cuenta/licencia"] };
