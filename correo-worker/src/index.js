// Finti · trabajador de correo (Cloudflare Email Workers).
// Cada persona tiene una dirección <buzon>@tu-dominio. Su correo reenvía aquí solo lo que sus filtros eligen.
// Este trabajador extrae el texto del aviso y el XML de las facturas electrónicas, descarta todo lo demás
// (imágenes, PDF, otros adjuntos) y lo entrega al servidor, que lo guarda cifrado para el celular de la persona.
import PostalMime from "postal-mime";
import { unzipSync, strFromU8 } from "fflate";

const MAX_CORREO = 3 * 1024 * 1024;

export function htmlATexto(html) {
  return String(html || "")
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#36;|&dollar;/gi, "$")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
}

function esFactura(xml) { return /<(?:\w+:)?(AttachedDocument|Invoice|CreditNote)\b/.test(xml); }

export async function extraer(raw) {
  const email = await PostalMime.parse(raw);
  const de = (email.from && email.from.address) || "", asunto = email.subject || "";
  const texto = (email.text || htmlATexto(email.html)).slice(0, 4000);
  // Gmail pide confirmar la dirección de reenvío: el código se muestra en la app
  if (/forwarding-noreply@google\.com/i.test(de)) return [{ tipo: "verificacion", asunto, de, contenido: texto.slice(0, 3000) }];
  const xmls = [];
  for (const a of email.attachments || []) {
    const nombre = String(a.filename || "").toLowerCase();
    const bytes = a.content instanceof ArrayBuffer ? new Uint8Array(a.content) : new Uint8Array(a.content || []);
    try {
      if (nombre.endsWith(".zip") || a.mimeType === "application/zip") {
        const archivos = unzipSync(bytes, { filter: (f) => f.name.toLowerCase().endsWith(".xml") && f.originalSize < 2000000 });
        for (const k of Object.keys(archivos)) { const x = strFromU8(archivos[k]); if (esFactura(x)) xmls.push(x); }
      } else if (nombre.endsWith(".xml")) {
        const x = strFromU8(bytes); if (esFactura(x)) xmls.push(x);
      }
    } catch { /* adjunto dañado: se ignora */ }
  }
  if (xmls.length) return xmls.slice(0, 3).map((x) => ({ tipo: "xml", asunto, de, contenido: x.slice(0, 400000) }));
  return texto ? [{ tipo: "texto", asunto, de, contenido: texto }] : [];
}

export default {
  async email(message, env) {
    const buzon = String(message.to || "").toLowerCase().split("@")[0].split("+")[0];
    if (!/^[a-z0-9]{10}$/.test(buzon)) { message.setReject("Dirección desconocida"); return; }
    if (message.rawSize > MAX_CORREO) { message.setReject("Correo demasiado grande"); return; }
    const raw = await new Response(message.raw).arrayBuffer();
    const partes = await extraer(raw);
    if (!partes.length) return;
    const r = await fetch(env.SITIO.replace(/\/$/, "") + "/api/entrada", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-entrada-secreto": env.ENTRADA_SECRET },
      body: JSON.stringify({ buzon, partes }),
    });
    if (r.status === 404) message.setReject("Ese buzón ya no existe");
  },
};
