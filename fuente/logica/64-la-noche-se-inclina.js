  // ===================== La noche se inclina (28 de noviembre de 2026) =====================
  // En modo oscuro, el fondo de aurora y estrellas se mueve un poco al inclinar el teléfono (o al mover el dedo en el
  // computador): pone --tx y --ty (de -1 a 1) en la raíz. Estilos en fuente/estilos/126-…. Solo cuando cambian y con
  // "reducir movimiento" no se mueve.
  (function () {
    var quieto = false; try { quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
    if (quieto) return;
    var raiz = document.documentElement, ox = 0, oy = 0, tx = 0, ty = 0, andando = false;
    function paso() {
      tx += (ox - tx) * .08; ty += (oy - ty) * .08;
      raiz.style.setProperty("--tx", tx.toFixed(3)); raiz.style.setProperty("--ty", ty.toFixed(3));
      if (Math.abs(ox - tx) > .002 || Math.abs(oy - ty) > .002) requestAnimationFrame(paso); else andando = false;
    }
    function mover(x, y) {
      if (!raiz.hasAttribute("data-modo-oscuro")) return;
      ox = Math.max(-1, Math.min(1, x)); oy = Math.max(-1, Math.min(1, y));
      if (!andando) { andando = true; requestAnimationFrame(paso); }
    }
    window.addEventListener("deviceorientation", function (e) { if (e.gamma != null) mover(e.gamma / 30, ((e.beta || 45) - 45) / 30); }, { passive: true });
    window.addEventListener("pointermove", function (e) { if (e.pointerType === "mouse") mover(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1); }, { passive: true });
  })();
