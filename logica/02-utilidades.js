  // ===================== Utilidades =====================
  var $ = function (id) { return document.getElementById(id); };
  // Edición gratis (pública, se guarda en el navegador) o completa (por invitación, se guarda en la cuenta)
  var FREE = document.documentElement.getAttribute("data-edition") === "free";
  var WEB = document.documentElement.getAttribute("data-edition") === "web";   // sitio propio con pagos de Wompi
  var LIC_KEY = "presupuesto-licencia", PAGO_KEY = "presupuesto-pago-pendiente";
  var licencia = null;
  if (WEB) { try { var lj = JSON.parse(localStorage.getItem(LIC_KEY) || "null"); if (lj && /^PRE-[A-Z2-9]{12}$/.test(lj.ref) && lj.token) licencia = lj; } catch (e) {} }
  var fmt = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
  var pct = new Intl.NumberFormat("es-CO", { style: "percent", maximumFractionDigits: 1 });
  var compact = new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 });
  function pctf(x) { return pct.format(x).replace(/\s?%/, "\u00a0%"); }
  function money(n) { return fmt.format(Math.round(n || 0)); }
  function signed(n) { n = Math.round(n || 0); return (n > 0 ? "+" : n < 0 ? "−" : "") + fmt.format(Math.abs(n)); }
  function num(v) { var x = parseFloat(String(v == null ? "" : v).replace(/[^\d.-]/g, "")); return isFinite(x) ? x : 0; }
  function rid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

