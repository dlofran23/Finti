// /api/estado: novedades de la nube y del buzón en una sola llamada (ver lib/estado.mjs).
import { almacen } from "../lib/almacen.mjs";
import { depsNetlify, responder } from "../lib/cuentas-deps.mjs";
import { estado } from "../lib/estado.mjs";

export default async (req, context) => {
  const q = new URL(req.url).searchParams;
  const stores = { buzones: almacen("buzones", context), bandeja: almacen("bandeja", context) };
  return responder(await estado({ deps: depsNetlify(context), stores, autorizacion: req.headers.get("authorization"), buzon: q.get("buzon"), token: q.get("token") }));
};
export const config = { path: "/api/estado" };
