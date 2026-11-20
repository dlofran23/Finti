-- Datos de Finti en Cloudflare D1. Una sola tabla con la misma forma que Netlify Blobs: almacén, clave, valor y etiqueta.
-- Los valores grandes (más de 1,5 MB, por ejemplo los precios del DANE o un respaldo) se parten en la tabla partes.
CREATE TABLE IF NOT EXISTS blobs (
  tienda TEXT NOT NULL,
  clave TEXT NOT NULL,
  valor TEXT,
  tipo TEXT NOT NULL DEFAULT 't',      -- t: texto, b: binario en base64
  partes INTEGER NOT NULL DEFAULT 0,
  meta TEXT,
  etag TEXT NOT NULL,
  cambiado INTEGER NOT NULL,
  PRIMARY KEY (tienda, clave)
);
CREATE TABLE IF NOT EXISTS partes (
  tienda TEXT NOT NULL,
  clave TEXT NOT NULL,
  n INTEGER NOT NULL,
  valor TEXT NOT NULL,
  PRIMARY KEY (tienda, clave, n)
);
