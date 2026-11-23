  // ===================== Premium =====================
  function hasPremium() { if (WEB) return !!licencia; return !FREE && (isOwnerFlag || !!state.prefs.premium); }
  function lockCard(text) {
    return '<div class="locked"><p>' + text + '</p><button class="btn premium-btn" type="button" data-open-premium><span class="star">★</span> Desbloquear con Premium</button></div>';
  }

