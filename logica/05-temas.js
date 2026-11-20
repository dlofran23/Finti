  // ===================== Temas =====================
  var THEMES = [
    // Identidad Finti (17 de noviembre de 2026): azul eléctrico que actúa y moneda amarilla que crece; el resto, blanco y negro.
    { id: "finti", name: "Finti", premium: false,
      light: { bg: "#f3f4f7", surface: "#ffffff", ink: "#0b0c10", muted: "#565b67", line: "#e3e5eb", accent: "#2e5bff", soft: "#e8edff", fuerte: "#2e5bff" },
      dark:  { bg: "#09090b", surface: "#141417", ink: "#f6f7f9", muted: "#9c9fab", line: "#24242b", accent: "#7d97ff", soft: "#18203f", fuerte: "#2e5bff" } },
    { id: "vibrante", name: "Vibrante", premium: false,
      light: { bg: "#f6f4fa", surface: "#ffffff", ink: "#14121f", muted: "#5b576b", line: "#e4e0ee", accent: "#6a4af0", soft: "#eeeaff" },
      dark:  { bg: "#0f0f14", surface: "#1d1b27", ink: "#f4f2ff", muted: "#a9a6bd", line: "#2a2735", accent: "#a08cff", soft: "#2a2445" } },
    { id: "electrico", name: "Eléctrico", premium: false,
      light: { bg: "#f3f5ff", surface: "#ffffff", ink: "#10142b", muted: "#565c78", line: "#dfe3f5", accent: "#3b5bff", soft: "#e6ebff" },
      dark:  { bg: "#0b0e1c", surface: "#161a2e", ink: "#eef0ff", muted: "#a2a8c4", line: "#262b45", accent: "#8197ff", soft: "#1f2648" } },
    { id: "jade", name: "Jade", premium: false,
      light: { bg: "#f1f7f5", surface: "#ffffff", ink: "#0f211c", muted: "#52665f", line: "#d9e6e1", accent: "#007a61", soft: "#ddf2ea" },
      dark:  { bg: "#0b1513", surface: "#14211d", ink: "#e6f4ef", muted: "#95ada5", line: "#233630", accent: "#2ed8a9", soft: "#133a30" } },
    { id: "lima", name: "Lima nocturna", premium: false,
      light: { bg: "#f5f7ef", surface: "#ffffff", ink: "#171c0e", muted: "#5b6450", line: "#e2e6d6", accent: "#4d7c0f", soft: "#eaf3d6" },
      dark:  { bg: "#0e100b", surface: "#191c14", ink: "#f1f5e6", muted: "#a8af98", line: "#2b3022", accent: "#c6f432", soft: "#2c3514" } },
    { id: "cobalto", name: "Cobalto", premium: false,
      light: { bg: "#f2f4f9", surface: "#ffffff", ink: "#141b2d", muted: "#5b6478", line: "#dde2ec", accent: "#2f4bd8", soft: "#e7ebfc" },
      dark:  { bg: "#0f1320", surface: "#181e2e", ink: "#e9edf6", muted: "#9ba5ba", line: "#2a3247", accent: "#8ea2ff", soft: "#222b4a" } },
    { id: "bosque", name: "Bosque", premium: false,
      light: { bg: "#f0f5f2", surface: "#ffffff", ink: "#12241b", muted: "#55675d", line: "#d8e3dc", accent: "#17795a", soft: "#dff0e7" },
      dark:  { bg: "#0d1613", surface: "#15211c", ink: "#e5f0ea", muted: "#92a79b", line: "#25362e", accent: "#5ccfa3", soft: "#183128" } },
    { id: "grafito", name: "Grafito", premium: false,
      light: { bg: "#f4f4f2", surface: "#ffffff", ink: "#1c1c1a", muted: "#63635e", line: "#e1e0dc", accent: "#cf4f1c", soft: "#fbe8de" },
      dark:  { bg: "#121211", surface: "#1c1c1a", ink: "#ededea", muted: "#a3a29c", line: "#30302d", accent: "#ff8b5c", soft: "#3a2419" } },
    { id: "cafe", name: "Café de origen", premium: true,
      light: { bg: "#f6f1ea", surface: "#fffdf9", ink: "#2a1d14", muted: "#74635a", line: "#e6dbcd", accent: "#8a4b22", soft: "#f3e3d3" },
      dark:  { bg: "#17110c", surface: "#211912", ink: "#f1e7dc", muted: "#b3a08f", line: "#3a2c21", accent: "#e3a26b", soft: "#3a2818" } },
    { id: "caribe", name: "Caribe", premium: true,
      light: { bg: "#edf7f8", surface: "#ffffff", ink: "#0f2a33", muted: "#4e6d76", line: "#d2e6ea", accent: "#08879b", soft: "#d9f0f3" },
      dark:  { bg: "#0a191e", surface: "#11252c", ink: "#e2f3f6", muted: "#8eb0b8", line: "#203f49", accent: "#4fd3e6", soft: "#12363f" } },
    { id: "orquidea", name: "Orquídea", premium: true,
      light: { bg: "#f7f2f8", surface: "#ffffff", ink: "#2a1630", muted: "#6e5974", line: "#e8dcec", accent: "#8a3aa6", soft: "#f1e2f6" },
      dark:  { bg: "#150e18", surface: "#201625", ink: "#f1e6f4", muted: "#b19bb8", line: "#3a2a41", accent: "#d59ef1", soft: "#382345" } },
    { id: "medianoche", name: "Medianoche y oro", premium: true,
      light: { bg: "#f5f3ee", surface: "#ffffff", ink: "#141a2c", muted: "#5d6274", line: "#e4e0d6", accent: "#9c7412", soft: "#f5ebd0" },
      dark:  { bg: "#0a0e1b", surface: "#131a2c", ink: "#ece7d9", muted: "#a8a594", line: "#262d44", accent: "#e6b84a", soft: "#2e2a1a" } }
  ];
  var THEME_BY_ID = {};
  THEMES.forEach(function (t) { THEME_BY_ID[t.id] = t; });
  var SEM = {
    light: { good: "#1d7a4e", goodSoft: "#e1f2e9", warn: "#a0640a", warnSoft: "#fbefd9", bad: "#b8322a", badSoft: "#fbe3e1" },
    dark:  { good: "#5fcf98", goodSoft: "#17302a", warn: "#f0b45a", warnSoft: "#362b17", bad: "#ff8a80", badSoft: "#3a1f1f" }
  };

