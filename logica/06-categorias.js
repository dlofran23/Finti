  // ===================== Categorías =====================
  var BASE_CATS = [
    { id: "vivienda", name: "Vivienda", group: "nec" },
    { id: "servicios", name: "Servicios y conectividad", group: "nec" },
    { id: "alimentacion", name: "Alimentación", group: "nec" },
    { id: "transporte", name: "Transporte", group: "nec" },
    { id: "salud", name: "Salud", group: "nec" },
    { id: "educacion", name: "Educación", group: "nec" },
    { id: "deudas", name: "Deudas y créditos", group: "nec" },
    { id: "ocio", name: "Salidas y ocio", group: "gus" },
    { id: "compras", name: "Compras personales", group: "gus" },
    { id: "suscripciones", name: "Suscripciones", group: "gus" },
    { id: "otros", name: "Otros", group: "gus" },
    { id: "ahorro", name: "Ahorro e inversión", group: "aho" }
  ];
  var GROUP_NAME = { nec: "Necesidad", gus: "Gusto", aho: "Ahorro" };
  function cats() { return BASE_CATS.slice(0, 11).concat(hasPremium() ? state.categorias : [], [BASE_CATS[11]]); }
  function catById(id) {
    for (var i = 0; i < BASE_CATS.length; i++) if (BASE_CATS[i].id === id) return BASE_CATS[i];
    for (var j = 0; j < state.categorias.length; j++) if (state.categorias[j].id === id) return state.categorias[j];
    return null;
  }

