import { register } from "node:module";
register("data:text/javascript," + encodeURIComponent(`export async function resolve(s, c, n) { if (s === "@netlify/blobs") return { url: "${new URL("./netlify-blobs-falso.mjs", import.meta.url).href}", shortCircuit: true }; return n(s, c); }`));
