  // ===================== Categorías propias =====================
  $("btn-cats").addEventListener("click", function () {
    if (!hasPremium()) { openPremium("Las categorías propias son parte de Premium."); return; }
    renderCats(); openDlg("dlg-cats", "#f-cat-nombre");
  });
  function renderCats() {
    $("cat-base").innerHTML = BASE_CATS.map(function (c) { return "<span>" + esc(c.name) + "</span>"; }).join("");
    $("cat-rows").innerHTML = state.categorias.length ? state.categorias.map(function (c) {
      var ic = iconoDeCat(c.id), abierta = iconoAbierto === c.id;
      return '<div class="cat-row' + (abierta ? " con-iconos" : "") + '" data-id="' + esc(c.id) + '" style="--c:' + catColor(c.id) + '"><button type="button" class="cat-ic-btn" data-iconos aria-expanded="' + abierta + '" aria-label="Ícono de ' + esc(c.name) + '"><svg class="ic"><use href="#c-' + ic + '"/></svg></button><input class="field" data-f="name" value="' + esc(c.name) + '" maxlength="40" aria-label="Nombre">' +
        '<select data-f="group" aria-label="Tipo">' + ["nec", "gus", "aho"].map(function (g) { return '<option value="' + g + '"' + (g === c.group ? " selected" : "") + ">" + GROUP_NAME[g] + "</option>"; }).join("") + "</select>" + delBtn(c.name) +
        (abierta ? '<div class="cat-iconos" role="radiogroup" aria-label="Elige el ícono">' + ICONOS_PROPIOS.map(function (x) {
          return '<button type="button" role="radio" aria-checked="' + (x[0] === ic) + '" data-icono="' + x[0] + '" aria-label="' + x[1] + '" title="' + x[1] + '"><svg class="ic"><use href="#c-' + x[0] + '"/></svg></button>';
        }).join("") + "</div>" : "") + "</div>";
    }).join("") : '<p class="empty">Aún no has creado categorías.</p>';
  }
  $("btn-cat-add").addEventListener("click", addCat);
  $("f-cat-nombre").addEventListener("keydown", function (e) { if (e.key === "Enter") addCat(); });
  function addCat() {
    var n = $("f-cat-nombre").value.trim();
    if (!n) { $("f-cat-nombre").focus(); return; }
    if (state.categorias.length >= 40) return;
    state.categorias.push({ id: rid("c_"), name: n.slice(0, 40), group: $("f-cat-grupo").value, ic: adivinarIcono(n) });
    $("f-cat-nombre").value = "";
    changed(); renderCats(); renderGastos(); recompute();
  }
  $("cat-rows").addEventListener("input", function (e) {
    var row = e.target.closest(".cat-row"); if (!row) return;
    var c = state.categorias.find(function (x) { return x.id === row.dataset.id; }); if (!c) return;
    if (e.target.dataset.f === "name") c.name = e.target.value.slice(0, 40) || "Sin nombre";
    if (e.target.dataset.f === "group") c.group = e.target.value;
    changed(); renderGastos(); recompute();
  });
  $("cat-rows").addEventListener("change", function (e) { if (e.target.tagName === "SELECT") e.target.dispatchEvent(new Event("input", { bubbles: true })); });
  var iconoAbierto = "";
  $("cat-rows").addEventListener("click", function (e) {
    var t = e.target.closest("[data-iconos]");
    if (t) { var rid0 = t.closest(".cat-row").dataset.id; iconoAbierto = iconoAbierto === rid0 ? "" : rid0; renderCats(); var nb = document.querySelector('#cat-rows .cat-row[data-id="' + rid0 + '"] ' + (iconoAbierto ? '[aria-checked="true"]' : "[data-iconos]")); if (nb) nb.focus(); return; }
    var ib = e.target.closest("[data-icono]");
    if (ib) { var cc = state.categorias.find(function (x) { return x.id === ib.closest(".cat-row").dataset.id; }); if (cc) { cc.ic = ib.dataset.icono; iconoAbierto = ""; changed(); renderCats(); renderAll(); sonar("gota"); } return; }
    var b = e.target.closest("[data-del]"); if (!b) return;
    var id = b.closest(".cat-row").dataset.id;
    state.categorias = state.categorias.filter(function (c) { return c.id !== id; });
    Object.keys(state.meses).forEach(function (k) { state.meses[k].gastos.forEach(function (r) { if (r.cat === id) r.cat = "otros"; }); });
    changed(); renderCats(); renderGastos(); recompute();
  });

