  // ===================== El sol de Finti en 3D =====================
  // En el celular, el punto de la F grande de Inicio es un sol en 3D de día y la luna de noche
  // (public/historia/astro3d.js, con three.js propio, cargado aparte y solo si hay WebGL). Si no carga, queda el
  // sol de CSS de siempre. Con "reducir movimiento" se pinta quieto.
  (function () {
    var banda = $("banda"), hecho = false;
    function webgl() { try { var c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"))); } catch (e) { return false; } }
    function cargar() {
      if (hecho || !banda || !banda.offsetParent || !webgl()) return;
      hecho = true;
      var lienzo = document.createElement("canvas"); lienzo.className = "astro3d"; lienzo.setAttribute("aria-hidden", "true");
      banda.appendChild(lienzo);
      import("/historia/astro3d.js").then(function (m) { m.iniciar(lienzo, banda); banda.classList.add("con-3d"); })
        .catch(function (e) { lienzo.remove(); reportarError("astro3d: " + (e && e.message), e && e.stack, "inicio"); });
    }
    // Después del primer dibujo, para no demorar el arranque
    setTimeout(cargar, 900);
    window.addEventListener("resize", function () { setTimeout(cargar, 300); });
    document.addEventListener("click", function () { setTimeout(cargar, 400); }, true);
  })();
