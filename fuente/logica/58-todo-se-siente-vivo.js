  // ===================== Todo se siente vivo =====================
  // El lado de la lógica del sistema de movimiento (estilos en fuente/estilos/121-todo-se-siente-vivo.css):
  // las barras se llenan al arrancar, las cifras importantes saltan cuando cambian y la tarjeta flotante se aparta al
  // bajar. Nada de esto cambia los números ni los textos: solo cómo se ven al cambiar.
  (function () {
    var quieto = false;
    try { quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
    // Al arrancar, las barras de avance se llenan una vez
    if (!quieto) { document.body.classList.add("vivo-arranque"); setTimeout(function () { document.body.classList.remove("vivo-arranque"); }, 1600); }

    // Las cifras que importan saltan cuando cambian (por ejemplo, al anotar un gasto)
    function saltar(el) {
      if (quieto || !el) return;
      el.classList.remove("cifra-cambia"); void el.offsetWidth; el.classList.add("cifra-cambia");
      clearTimeout(el._vivo); el._vivo = setTimeout(function () { el.classList.remove("cifra-cambia"); }, 700);
    }
    var vigiladas = ["hoy-v", "mv-resumen", "mt-resumen"];
    if (window.MutationObserver) vigiladas.forEach(function (id) {
      var el = document.getElementById(id); if (!el) return;
      var antes = el.textContent;
      new MutationObserver(function () { if (el.textContent !== antes) { antes = el.textContent; saltar(el); } }).observe(el, { childList: true, characterData: true, subtree: true });
    });
    window.FinVivo = { saltar: saltar };

    // La tarjeta flotante se aparta al bajar y vuelve al subir (o al llegar arriba)
    var ultimo = window.scrollY || 0, pendiente = false;
    window.addEventListener("scroll", function () {
      if (pendiente) return; pendiente = true;
      requestAnimationFrame(function () {
        pendiente = false;
        var y = window.scrollY || 0, d = y - ultimo;
        if (Math.abs(d) > 6) { document.body.classList.toggle("va-bajando", d > 0 && y > 120); ultimo = y; }
        if (y < 40) document.body.classList.remove("va-bajando");
      });
    }, { passive: true });
  })();
