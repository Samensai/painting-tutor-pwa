const mediumHints = {
  oil: "L'huile favorise les grandes masses d'abord, puis les transitions, puis les accents finaux.",
  acrylic: "L'acrylique seche vite, donc l'app privilegie un ordre clair de couches et de recouvrements."
};

const STORAGE_KEY = "painting-tutor-pwa-state-v3";
const BACKEND_TIMEOUT_MS = 120000;

const starterPalette = [
  { id: crypto.randomUUID(), name: "Blanc de titane", pigment: "PW6", color: "#f4f1e8" },
  { id: crypto.randomUUID(), name: "Bleu outremer", pigment: "PB29", color: "#2342a5" },
  { id: crypto.randomUUID(), name: "Terre de sienne brulee", pigment: "PBr7", color: "#8f4a25" },
  { id: crypto.randomUUID(), name: "Ocre jaune", pigment: "PY43", color: "#c79b32" }
];

const pigmentLibrary = {
  PW6: { name: "Blanc de titane", color: "#f4f1e8" },
  PB29: { name: "Bleu outremer", color: "#2342a5" },
  PB15: { name: "Bleu phtalo", color: "#0d5f91" },
  "PB15:3": { name: "Bleu phtalo nuance verte", color: "#006f8e" },
  PB28: { name: "Bleu cobalt", color: "#4f6fb6" },
  PBR7: { name: "Terre de sienne brulee", color: "#8f4a25" },
  PBR7RAW: { name: "Terre de sienne naturelle", color: "#a66c35" },
  PY43: { name: "Ocre jaune", color: "#c79b32" },
  PY3: { name: "Jaune primaire", color: "#f2cf16" },
  PY35: { name: "Jaune de cadmium", color: "#f3b300" },
  PR108: { name: "Rouge de cadmium", color: "#d4431c" },
  PR101: { name: "Rouge oxyde", color: "#95503a" },
  PR122: { name: "Magenta quinacridone", color: "#a3286c" },
  PR83: { name: "Alizarine cramoisie", color: "#6c1230" },
  PG7: { name: "Vert phtalo", color: "#0c6f48" },
  PG18: { name: "Vert oxyde de chrome", color: "#50734d" },
  PBK7: { name: "Noir de lampe", color: "#1f1b1a" },
  PBK9: { name: "Noir d'ivoire", color: "#2b2623" }
};

const state = {
  medium: "oil",
  tubes: [...starterPalette],
  referenceImage: "",
  extractedColors: [],
  sampledColor: null,
  backendUrl: "",
  analysisSource: "Analyse locale",
  lastBackendError: "",
  plan: null,
  activeStepIndex: 0,
  deferredPrompt: null
};

const elements = {
  projectTitle: document.querySelector("#projectTitle"),
  mediumHint: document.querySelector("#mediumHint"),
  segments: document.querySelectorAll(".segment"),
  referenceInput: document.querySelector("#referenceInput"),
  referencePreview: document.querySelector("#referencePreview"),
  previewPlaceholder: document.querySelector("#previewPlaceholder"),
  pipetteHint: document.querySelector("#pipetteHint"),
  pipetteResult: document.querySelector("#pipetteResult"),
  backendUrl: document.querySelector("#backendUrl"),
  backendStatus: document.querySelector("#backendStatus"),
  generatePlanButton: document.querySelector("#generatePlanButton"),
  resetProjectButton: document.querySelector("#resetProjectButton"),
  downloadStepsButton: document.querySelector("#downloadStepsButton"),
  saveStatus: document.querySelector("#saveStatus"),
  tubeForm: document.querySelector("#tubeForm"),
  tubeName: document.querySelector("#tubeName"),
  tubePigment: document.querySelector("#tubePigment"),
  pigmentLookupStatus: document.querySelector("#pigmentLookupStatus"),
  tubeColor: document.querySelector("#tubeColor"),
  tubeList: document.querySelector("#tubeList"),
  planEmptyState: document.querySelector("#planEmptyState"),
  planContent: document.querySelector("#planContent"),
  overviewTitle: document.querySelector("#overviewTitle"),
  overviewMedium: document.querySelector("#overviewMedium"),
  overviewProgress: document.querySelector("#overviewProgress"),
  overviewSource: document.querySelector("#overviewSource"),
  stepList: document.querySelector("#stepList"),
  stepDetail: document.querySelector("#stepDetail"),
  installButton: document.querySelector("#installButton")
};

init();

function init() {
  hydrateState();
  renderMedium();
  renderTubes();
  renderReferencePreview();
  renderPipetteResult();
  renderBackendStatus();
  bindEvents();
  renderPlanFromState();
  registerServiceWorker();
}

function bindEvents() {
  elements.segments.forEach((button) => {
    button.addEventListener("click", () => {
      state.medium = button.dataset.medium;
      renderMedium();
      persistState("Medium enregistre.");
    });
  });

  elements.referenceInput.addEventListener("change", handleReferenceSelection);
  elements.referencePreview.addEventListener("click", handleReferencePick);
  elements.backendUrl.addEventListener("input", handleBackendUrlChange);
  elements.generatePlanButton.addEventListener("click", generatePlan);
  elements.resetProjectButton.addEventListener("click", resetProject);
  elements.downloadStepsButton.addEventListener("click", downloadAllStepImages);
  elements.tubePigment.addEventListener("input", handlePigmentLookup);
  elements.tubeForm.addEventListener("submit", addTube);
  elements.installButton.addEventListener("click", installApp);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredPrompt = event;
    elements.installButton.classList.remove("hidden");
  });
}

function renderMedium() {
  elements.mediumHint.textContent = mediumHints[state.medium];
  elements.segments.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.medium === state.medium);
  });
}

async function handleReferenceSelection(event) {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    state.referenceImage = reader.result;
    state.extractedColors = await extractDominantColors(state.referenceImage);
    state.sampledColor = null;
    renderReferencePreview();
    renderPipetteResult();
    persistState("Image et palette detectee enregistrees localement.");
  };
  reader.readAsDataURL(file);
}

function addTube(event) {
  event.preventDefault();

  const name = elements.tubeName.value.trim();
  if (!name) {
    return;
  }

  state.tubes.push({
    id: crypto.randomUUID(),
    name,
    pigment: elements.tubePigment.value.trim(),
    color: elements.tubeColor.value
  });

  elements.tubeForm.reset();
  elements.tubeColor.value = "#2342a5";
  elements.pigmentLookupStatus.textContent = "Entre un code pigment connu pour pre-remplir le nom et la couleur.";
  renderTubes();
  renderPipetteResult();
  persistState("Palette enregistree.");
}

async function handleReferencePick(event) {
  if (!state.referenceImage) {
    return;
  }

  const sampledHex = await sampleColorAtPoint(event, elements.referencePreview, state.referenceImage);
  if (!sampledHex) {
    elements.pipetteHint.textContent = "Impossible de lire cette zone de l'image pour l'instant.";
    return;
  }

  state.sampledColor = {
    hex: sampledHex,
    mix: suggestMix("Couleur pipette", sampledHex, state.tubes)
  };
  renderPipetteResult();
  persistState("Couleur pipette enregistree.");
}

function handleBackendUrlChange() {
  state.backendUrl = elements.backendUrl.value.trim();
  state.lastBackendError = "";
  state.analysisSource = state.backendUrl ? "Backend configure, pret a etre utilise" : "Analyse locale";
  renderBackendStatus();
  persistState("Configuration backend enregistree.");
}

function handlePigmentLookup() {
  const normalizedPigment = normalizePigmentCode(elements.tubePigment.value);

  if (!normalizedPigment) {
    elements.pigmentLookupStatus.textContent = "Entre un code pigment connu pour pre-remplir le nom et la couleur.";
    return;
  }

  const match = pigmentLibrary[normalizedPigment];

  if (!match) {
    elements.pigmentLookupStatus.textContent = `Pigment ${normalizedPigment} non trouve dans la base locale pour l'instant.`;
    return;
  }

  if (!elements.tubeName.value.trim()) {
    elements.tubeName.value = match.name;
  }

  elements.tubeColor.value = match.color;
  elements.tubePigment.value = normalizedPigment;
  elements.pigmentLookupStatus.textContent = `${match.name} reconnu, couleur approximate appliquee.`;
}

function removeTube(tubeId) {
  state.tubes = state.tubes.filter((tube) => tube.id !== tubeId);
  renderTubes();
  renderPipetteResult();
  persistState("Palette mise a jour.");
}

function renderTubes() {
  if (!state.tubes.length) {
    elements.tubeList.innerHTML = "<p class=\"support-copy\">Aucun tube pour l'instant.</p>";
    return;
  }

  elements.tubeList.innerHTML = state.tubes.map((tube) => `
    <article class="tube-item">
      <div class="tube-main">
        <span class="swatch" style="background:${tube.color}"></span>
        <div>
          <strong>${escapeHtml(tube.name)}</strong>
          <p class="tube-meta">${tube.pigment ? escapeHtml(tube.pigment) : "Pigment non renseigne"}</p>
        </div>
      </div>
      <button class="ghost-button" type="button" data-remove-tube="${tube.id}">Retirer</button>
    </article>
  `).join("");

  elements.tubeList.querySelectorAll("[data-remove-tube]").forEach((button) => {
    button.addEventListener("click", () => removeTube(button.dataset.removeTube));
  });
}

function renderBackendStatus() {
  if (!state.backendUrl) {
    elements.backendStatus.textContent = "Aucun backend configure. L'analyse reste locale pour l'instant.";
    return;
  }

  if (state.lastBackendError) {
    elements.backendStatus.textContent = `Backend configure sur ${state.backendUrl}, mais la derniere tentative a echoue : ${state.lastBackendError}`;
    return;
  }

  if (state.analysisSource?.startsWith("Backend")) {
    elements.backendStatus.textContent = `Derniere analyse effectuee via ${state.analysisSource} sur ${state.backendUrl}.`;
    return;
  }

  if (state.analysisSource === "Analyse locale (repli)") {
    elements.backendStatus.textContent = `Le backend est configure sur ${state.backendUrl}, mais l'app a utilise l'analyse locale lors de la derniere tentative.`;
    return;
  }

  elements.backendStatus.textContent = `Backend configure sur ${state.backendUrl}. A la prochaine generation, l'app tentera d'utiliser l'analyse serveur avant de retomber sur le mode local.`;
}

async function generatePlan() {
  const title = elements.projectTitle.value.trim() || "Etude de peinture";
  const mediumLabel = state.medium === "oil" ? "Huile" : "Acrylique";
  elements.generatePlanButton.disabled = true;
  elements.generatePlanButton.textContent = "Analyse en cours...";
  if (state.backendUrl) {
    elements.backendStatus.textContent = "Analyse backend en cours. Avec SAM 2 sur CPU, cela peut prendre jusqu'a 1 ou 2 minutes.";
  }
  try {
    const steps = await buildPaintingPlan(state.medium, state.tubes, state.extractedColors, state.referenceImage);

    state.plan = {
      title,
      medium: mediumLabel,
      analysisSource: state.analysisSource,
      extractedColors: state.extractedColors,
      steps
    };
    state.activeStepIndex = 0;
    renderPlan();
    persistState("Projet enregistre sur cet appareil.");
  } finally {
    elements.generatePlanButton.disabled = false;
    elements.generatePlanButton.textContent = "Generer un plan de peinture";
  }
}

async function buildPaintingPlan(medium, tubes, extractedColors = [], referenceImage = "") {
  const colorRoles = buildColorRoles(extractedColors);
  const backendAnalysis = await requestBackendAnalysis(referenceImage, medium, tubes);
  const analysis = backendAnalysis ?? await analyzeImageComposition(referenceImage, extractedColors);
  const visuals = await generateStepVisuals(referenceImage, colorRoles, analysis);

  return createEnhancedPaintingPlan({
    medium,
    colorRoles,
    analysis,
    visuals
  });

  return [
    {
      title: "Bloquer les grandes masses du fond",
      detail: "Grandes masses",
      instruction: "Commence par les zones les plus larges et les moins detaillees pour poser l'atmosphere generale.",
      reasoning: medium === "oil"
        ? "A l'huile, ce blocage permet ensuite de fondre plus facilement les transitions du sujet."
        : "A l'acrylique, poser le fond d'abord evite de casser trop tot les bords du sujet principal.",
      paletteCue: colorRoles.background.label,
      previewImage: visuals.background,
      zones: [
        { title: "Fond et arriere-plan", summary: "Ciel, mur, table ou zone lointaine selon l'image.", coverage: "45 a 60%" }
      ],
      mixes: [mixes.background]
    },
    {
      title: "Poser la silhouette principale",
      detail: "Structure",
      instruction: "Place la forme la plus importante sur le fond avec des bords encore simples.",
      reasoning: "L'image devient lisible rapidement sans se perdre dans les details secondaires.",
      paletteCue: colorRoles.subject.label,
      previewImage: visuals.masses,
      zones: [
        { title: "Sujet principal", summary: "Forme dominante qui passe devant le fond.", coverage: "20 a 35%" }
      ],
      mixes: [mixes.subject]
    },
    {
      title: "Clarifier les recouvrements",
      detail: "Superpositions",
      instruction: "Separe les formes qui passent au-dessus des autres et fixe les grandes ombres.",
      reasoning: "Cette etape donne la profondeur et l'ordre visuel avant les textures.",
      paletteCue: colorRoles.shadow.label,
      previewImage: visuals.nuance,
      zones: [
        { title: "Plans intermediaires", summary: "Objets secondaires, volumes qui se chevauchent, ombres portées.", coverage: "10 a 20%" }
      ],
      mixes: [mixes.shadows]
    },
    {
      title: "Ajouter les details et accents",
      detail: "Finition",
      instruction: "Termine par les petits contrastes, les aretes importantes et les touches qui attirent l'oeil.",
      reasoning: "Les accents sont plus justes lorsque toute la structure est deja en place.",
      paletteCue: colorRoles.accent.label,
      previewImage: visuals.details,
      zones: [
        { title: "Petits details", summary: "Yeux, reflets, contour net, accents sombres ou lumineux.", coverage: "moins de 10%" }
      ],
      mixes: [mixes.accents]
    }
  ];
}

function createEnhancedPaintingPlan({ medium, colorRoles, analysis, visuals }) {
  return [
    {
      title: "Poser le fond sans le personnage",
      detail: "Fond",
      instruction: "Commence par peindre le fond general comme si le personnage n'etait pas encore la, avec une lecture large et douce.",
      reasoning: medium === "oil"
        ? "A l'huile, ce fond donne une base souple pour venir fondre les plans et les bords ensuite."
        : "A l'acrylique, bloquer le fond en premier evite de fragmenter trop tot la lecture.",
      paletteCue: colorRoles.background.label,
      previewImage: visuals.foundation,
      zones: [
        { title: "Fond et lointains", summary: analysis.backgroundSummary, coverage: analysis.backgroundCoverage }
      ]
    },
    {
      title: "Ajouter les nuances du fond",
      detail: "Fond nuance",
      instruction: "Ajoute les zones plus claires ou plus vivantes du fond tout en gardant le personnage absent de cette etape.",
      reasoning: "Le fond gagne en richesse avant que le sujet vienne se poser par-dessus.",
      paletteCue: analysis.midtoneLabel,
      previewImage: visuals.bigMasses,
      zones: [
        { title: "Nuances de fond", summary: "Variations de plantes, de lumiere et de profondeur dans le fond uniquement.", coverage: analysis.backgroundCoverage }
      ]
    },
    {
      title: "Poser le personnage en grandes masses",
      detail: "Sujet",
      instruction: "Installe le personnage par grandes familles de formes simples sans chercher encore les petits détails.",
      reasoning: "Le sujet doit se poser nettement sur le fond avant d'etre affine.",
      paletteCue: colorRoles.subject.label,
      previewImage: visuals.modeledForms,
      zones: [
        { title: "Sujet principal", summary: analysis.subjectSummary, coverage: analysis.subjectCoverage },
        { title: "Formes secondaires", summary: analysis.secondarySummary, coverage: analysis.secondaryCoverage }
      ]
    },
    {
      title: "Finir avec les accents utiles",
      detail: "Finition",
      instruction: "Reserve les rouges les plus vifs, les petits contrastes et quelques arêtes nettes pour la toute fin.",
      reasoning: "Les détails ont plus d'impact quand les masses et les valeurs sont déjà solidement en place.",
      paletteCue: colorRoles.accent.label,
      previewImage: visuals.accents,
      zones: [
        { title: "Ombres structurantes", summary: analysis.shadowSummary, coverage: analysis.shadowCoverage },
        { title: "Zones detaillees", summary: analysis.detailSummary, coverage: analysis.detailCoverage },
        { title: "Accents finaux", summary: "Touches decisives, bords choisis et points d'attention.", coverage: "moins de 10%" }
      ]
    }
  ];
}

async function requestBackendAnalysis(referenceImage, medium, tubes) {
  if (!referenceImage || !state.backendUrl) {
    state.analysisSource = "Analyse locale";
    state.lastBackendError = "";
    renderBackendStatus();
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

  try {
    const response = await fetch(`${state.backendUrl.replace(/\/$/, "")}/api/v1/segment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        imageDataUrl: referenceImage,
        medium,
        palette: tubes.map((tube) => ({
          name: tube.name,
          pigment: tube.pigment,
          color: tube.color
        }))
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (!payload?.analysis) {
      throw new Error("reponse incomplete");
    }

    state.analysisSource = payload.provider
      ? `Backend ${payload.provider}`
      : "Backend segmentation";
    state.lastBackendError = "";
    renderBackendStatus();
    return payload.analysis;
  } catch (error) {
    state.analysisSource = "Analyse locale (repli)";
    state.lastBackendError = error.name === "AbortError"
      ? `delai depasse apres ${Math.round(BACKEND_TIMEOUT_MS / 1000)} secondes`
      : error.message;
    renderBackendStatus();
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function analyzeImageComposition(referenceImage, extractedColors = []) {
  if (!referenceImage) {
    return {
      backgroundSummary: "Grandes zones lointaines et peu detaillees.",
      backgroundCoverage: "45 a 60%",
      subjectSummary: "Forme dominante la plus lisible de l'image.",
      subjectCoverage: "20 a 35%",
      secondarySummary: "Objets d'accompagnement et plans intermediaires.",
      secondaryCoverage: "15 a 25%",
      shadowSummary: "Grandes ombres et rapports de recouvrement.",
      shadowCoverage: "15 a 30%",
      detailSummary: "Petites zones de contraste, aretes et textures.",
      detailCoverage: "moins de 12%",
      secondaryLabel: "Couleur secondaire moyenne",
      midtoneLabel: "Valeur moyenne dominante",
      detailLabel: "Couleur des details structurants",
      secondaryColorHex: extractedColors[1]?.hex ?? extractedColors[0]?.hex ?? "#8f755e",
      midtoneHex: extractedColors[2]?.hex ?? extractedColors[0]?.hex ?? "#9f6846",
      detailColorHex: extractedColors[3]?.hex ?? extractedColors[0]?.hex ?? "#54453f",
      subjectBox: { x: 0.5, y: 0.5, rx: 0.22, ry: 0.28 }
    };
  }

  try {
    const image = await loadImage(referenceImage);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const width = 96;
    const height = Math.max(72, Math.round((image.height / image.width) * width));
    canvas.width = width;
    canvas.height = height;
    context.drawImage(image, 0, 0, width, height);
    const { data } = context.getImageData(0, 0, width, height);

    let totalWeight = 0;
    let sumX = 0;
    let sumY = 0;
    let subjectPixels = 0;
    let detailPixels = 0;
    let shadowPixels = 0;
    let backgroundPixels = 0;
    let secondaryPixels = 0;
    let midtoneRed = 0;
    let midtoneGreen = 0;
    let midtoneBlue = 0;
    let secondaryRed = 0;
    let secondaryGreen = 0;
    let secondaryBlue = 0;
    let detailRed = 0;
    let detailGreen = 0;
    let detailBlue = 0;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        const red = data[index];
        const green = data[index + 1];
        const blue = data[index + 2];
        const luminance = relativeLuminance(red, green, blue);
        const cx = x / width - 0.5;
        const cy = y / height - 0.5;
        const centrality = Math.max(0, 1 - Math.sqrt(cx * cx + cy * cy) * 1.7);
        const edgeStrength = approximateEdgeStrength(data, width, height, x, y);
        const saliency = edgeStrength * 0.7 + centrality * 0.3;

        totalWeight += saliency;
        sumX += x * saliency;
        sumY += y * saliency;

        if (saliency > 0.33) {
          subjectPixels += 1;
          midtoneRed += red;
          midtoneGreen += green;
          midtoneBlue += blue;
        } else if (saliency > 0.2) {
          secondaryPixels += 1;
          secondaryRed += red;
          secondaryGreen += green;
          secondaryBlue += blue;
        } else {
          backgroundPixels += 1;
        }

        if (edgeStrength > 0.34) {
          detailPixels += 1;
          detailRed += red;
          detailGreen += green;
          detailBlue += blue;
        }

        if (luminance < 0.32) {
          shadowPixels += 1;
        }
      }
    }

    const centerX = totalWeight ? sumX / totalWeight / width : 0.5;
    const centerY = totalWeight ? sumY / totalWeight / height : 0.5;
    const subjectShare = subjectPixels / (width * height);
    const secondaryShare = secondaryPixels / (width * height);
    const detailShare = detailPixels / (width * height);
    const shadowShare = shadowPixels / (width * height);
    const backgroundShare = backgroundPixels / (width * height);

    return {
      backgroundSummary: backgroundShare > 0.5
        ? "Grandes zones lointaines peu decoupees qui servent surtout d'appui au sujet."
        : "Fond morcele mais encore secondaire par rapport au centre d'interet.",
      backgroundCoverage: formatCoverage(backgroundShare),
      subjectSummary: `Forme dominante concentree autour du centre d'interet (${percent(subjectShare)} de la surface).`,
      subjectCoverage: formatCoverage(subjectShare),
      secondarySummary: "Masses intermediaires qui accompagnent le sujet et articulent la composition.",
      secondaryCoverage: formatCoverage(secondaryShare),
      shadowSummary: "Grandes zones sombres qui clarifient le relief et les superpositions.",
      shadowCoverage: formatCoverage(shadowShare),
      detailSummary: `Zones a forte densite de contours et de micro-contrastes (${percent(detailShare)} de la surface).`,
      detailCoverage: formatCoverage(detailShare),
      secondaryLabel: "Couleur moyenne des formes secondaires",
      midtoneLabel: "Couleur moyenne du sujet",
      detailLabel: "Couleur des zones les plus contrastees",
      secondaryColorHex: averageHex(secondaryRed, secondaryGreen, secondaryBlue, secondaryPixels) ?? extractedColors[1]?.hex ?? "#8f755e",
      midtoneHex: averageHex(midtoneRed, midtoneGreen, midtoneBlue, subjectPixels) ?? extractedColors[2]?.hex ?? "#9f6846",
      detailColorHex: averageHex(detailRed, detailGreen, detailBlue, detailPixels) ?? extractedColors[3]?.hex ?? "#54453f",
      subjectBox: {
        x: centerX,
        y: centerY,
        rx: clamp(0.14 + subjectShare * 0.45, 0.18, 0.32),
        ry: clamp(0.18 + subjectShare * 0.38, 0.22, 0.36)
      }
    };
  } catch {
    return {
      backgroundSummary: "Grandes zones lointaines et peu detaillees.",
      backgroundCoverage: "45 a 60%",
      subjectSummary: "Forme dominante la plus lisible de l'image.",
      subjectCoverage: "20 a 35%",
      secondarySummary: "Objets d'accompagnement et plans intermediaires.",
      secondaryCoverage: "15 a 25%",
      shadowSummary: "Grandes ombres et rapports de recouvrement.",
      shadowCoverage: "15 a 30%",
      detailSummary: "Petites zones de contraste, aretes et textures.",
      detailCoverage: "moins de 12%",
      secondaryLabel: "Couleur secondaire moyenne",
      midtoneLabel: "Valeur moyenne dominante",
      detailLabel: "Couleur des details structurants",
      secondaryColorHex: extractedColors[1]?.hex ?? extractedColors[0]?.hex ?? "#8f755e",
      midtoneHex: extractedColors[2]?.hex ?? extractedColors[0]?.hex ?? "#9f6846",
      detailColorHex: extractedColors[3]?.hex ?? extractedColors[0]?.hex ?? "#54453f",
      subjectBox: { x: 0.5, y: 0.5, rx: 0.22, ry: 0.28 }
    };
  }
}

function suggestMix(targetName, targetHex, tubes) {
  if (!tubes.length) {
    return {
      name: targetName,
      targetHex,
      confidence: 30,
      parts: ["Ajoute tes tubes pour obtenir une vraie recette"],
      note: "Le moteur de melange utilisera ta palette reelle pour estimer la teinte."
    };
  }

  const ranked = [...tubes]
    .map((tube) => ({ tube, distance: colorDistance(hexToRgb(tube.color), hexToRgb(targetHex)) }))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, Math.min(3, tubes.length));

  const weights = ranked.map((entry) => 1 / Math.max(entry.distance, 0.08));
  const total = weights.reduce((sum, value) => sum + value, 0);
  const parts = ranked.map((entry, index) => {
    const ratio = Math.max(0.1, Math.round((weights[index] / total) * 10) / 10);
    return `${entry.tube.name}: ${ratio} part${ratio > 1 ? "s" : ""}`;
  });

  return {
    name: targetName,
    targetHex,
    confidence: Math.max(45, Math.round((1 - ranked[0].distance) * 100)),
    parts,
    note: `Melange estime a partir des tubes les plus proches de ta palette${ranked.length ? `: ${ranked.map((entry) => entry.tube.name).join(", ")}` : ""}.`
  };
}

function renderPlan() {
  if (!state.plan) {
    return;
  }

  elements.planEmptyState.classList.add("hidden");
  elements.planContent.classList.remove("hidden");
  elements.overviewTitle.textContent = state.plan.title;
  elements.overviewMedium.textContent = state.plan.medium;
  elements.overviewProgress.textContent = `${completedStepCount()} / ${state.plan.steps.length} terminees`;
  elements.overviewSource.textContent = state.plan.analysisSource ?? "Analyse locale";
  elements.downloadStepsButton.disabled = !state.plan.steps.some((step) => step.previewImage);

  elements.stepList.innerHTML = state.plan.steps.map((step, index) => `
    <button class="step-card ${index === state.activeStepIndex ? "is-active" : ""} ${step.completed ? "is-complete" : ""}" type="button" data-step-index="${index}">
      ${step.previewImage ? `<img class="step-thumb" src="${step.previewImage}" alt="Apercu de l'etape ${index + 1}">` : ""}
      <span class="step-index">${index + 1}</span>
      <h3>${escapeHtml(step.title)}</h3>
      <p>${escapeHtml(step.instruction)}</p>
    </button>
  `).join("");

  elements.stepList.querySelectorAll("[data-step-index]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeStepIndex = Number(button.dataset.stepIndex);
      renderPlan();
    });
  });

  renderActiveStep();
}

function renderPlanFromState() {
  if (!state.plan) {
    elements.planEmptyState.classList.remove("hidden");
    elements.planContent.classList.add("hidden");
    elements.downloadStepsButton.disabled = true;
    return;
  }

  renderPlan();
}

function renderActiveStep() {
  const step = state.plan.steps[state.activeStepIndex];

  elements.stepDetail.innerHTML = `
    ${step.previewImage ? `
      <section class="detail-panel">
        <img class="step-visual" src="${step.previewImage}" alt="Apercu visuel de ${escapeHtml(step.title)}">
      </section>
    ` : ""}

    <section class="detail-panel">
      <div class="detail-header">
        <div>
          <p class="eyebrow">Etape ${state.activeStepIndex + 1}</p>
          <h3>${escapeHtml(step.title)}</h3>
        </div>
        <span class="detail-tag">${escapeHtml(step.detail)}</span>
      </div>
      <p class="detail-copy">${escapeHtml(step.instruction)}</p>
      <p class="detail-copy">${escapeHtml(step.reasoning)}</p>
      ${step.paletteCue ? `<p class="detail-copy">Couleur guide: ${escapeHtml(step.paletteCue)}</p>` : ""}
    </section>

    <section class="detail-panel">
      <h3>Zones a peindre</h3>
      <div class="zone-list">
        ${step.zones.map((zone) => `
          <article class="zone-card">
            <h4>${escapeHtml(zone.title)}</h4>
            <p class="zone-meta">${escapeHtml(zone.summary)}</p>
            <p class="zone-meta">Couverture estimee: ${escapeHtml(zone.coverage)}</p>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="detail-panel">
      <div class="detail-actions">
        <button id="markDoneButton" class="primary-button" type="button">
          ${step.completed ? "Marquer comme non terminee" : "Marquer comme terminee"}
        </button>
        <button id="previousStepButton" class="secondary-button" type="button" ${state.activeStepIndex === 0 ? "disabled" : ""}>
          Etape precedente
        </button>
        <button id="nextStepButton" class="secondary-button" type="button" ${state.activeStepIndex === state.plan.steps.length - 1 ? "disabled" : ""}>
          Etape suivante
        </button>
      </div>
    </section>
  `;

  document.querySelector("#markDoneButton").addEventListener("click", toggleActiveStep);

  const previousButton = document.querySelector("#previousStepButton");
  const nextButton = document.querySelector("#nextStepButton");

  previousButton?.addEventListener("click", () => {
    if (state.activeStepIndex > 0) {
      state.activeStepIndex -= 1;
      renderPlan();
    }
  });

  nextButton?.addEventListener("click", () => {
    if (state.activeStepIndex < state.plan.steps.length - 1) {
      state.activeStepIndex += 1;
      renderPlan();
    }
  });
}

function downloadAllStepImages() {
  if (!state.plan?.steps?.length) {
    elements.saveStatus.textContent = "Aucune image d'etape a telecharger pour l'instant.";
    return;
  }

  const projectSlug = slugify(elements.projectTitle.value.trim() || state.plan.title || "etude");
  const downloadableSteps = state.plan.steps.filter((step) => step.previewImage);

  if (!downloadableSteps.length) {
    elements.saveStatus.textContent = "Ce plan ne contient pas encore d'images d'etapes a telecharger.";
    return;
  }

  downloadableSteps.forEach((step, index) => {
    const link = document.createElement("a");
    link.href = step.previewImage;
    link.download = `${projectSlug}-etape-${String(index + 1).padStart(2, "0")}.jpg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  });

  elements.saveStatus.textContent = `${downloadableSteps.length} image(s) d'etape telechargee(s).`;
}

function toggleActiveStep() {
  const step = state.plan.steps[state.activeStepIndex];
  step.completed = !step.completed;
  elements.overviewProgress.textContent = `${completedStepCount()} / ${state.plan.steps.length} terminees`;
  renderPlan();
  persistState("Progression enregistree.");
}

function completedStepCount() {
  return state.plan.steps.filter((step) => step.completed).length;
}

async function installApp() {
  if (!state.deferredPrompt) {
    return;
  }

  state.deferredPrompt.prompt();
  await state.deferredPrompt.userChoice;
  state.deferredPrompt = null;
  elements.installButton.classList.add("hidden");
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        // Offline support is optional in this MVP.
      });
    });
  }
}

function hydrateState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      elements.saveStatus.textContent = "Aucune sauvegarde locale pour l'instant.";
      return;
    }

    const saved = JSON.parse(raw);
    state.medium = saved.medium ?? state.medium;
    state.tubes = Array.isArray(saved.tubes) && saved.tubes.length ? saved.tubes : [...starterPalette];
    state.referenceImage = saved.referenceImage ?? "";
    state.extractedColors = Array.isArray(saved.extractedColors) ? saved.extractedColors : [];
    state.sampledColor = saved.sampledColor ?? null;
    state.backendUrl = saved.backendUrl ?? "";
    state.analysisSource = saved.analysisSource ?? "Analyse locale";
    state.lastBackendError = saved.lastBackendError ?? "";
    state.plan = saved.plan ?? null;
    state.activeStepIndex = Number.isInteger(saved.activeStepIndex) ? saved.activeStepIndex : 0;
    elements.projectTitle.value = saved.projectTitle ?? elements.projectTitle.value;
    elements.backendUrl.value = state.backendUrl;
    elements.saveStatus.textContent = "Projet restaure depuis la sauvegarde locale.";
  } catch {
    elements.saveStatus.textContent = "La sauvegarde locale n'a pas pu etre relue.";
  }
}

function persistState(message = "Sauvegarde locale mise a jour.") {
  try {
    const payload = {
      medium: state.medium,
      tubes: state.tubes,
      referenceImage: state.referenceImage,
      extractedColors: state.extractedColors,
      sampledColor: state.sampledColor,
      backendUrl: state.backendUrl,
      analysisSource: state.analysisSource,
      lastBackendError: state.lastBackendError,
      plan: state.plan,
      activeStepIndex: state.activeStepIndex,
      projectTitle: elements.projectTitle.value.trim() || "Etude de peinture"
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    elements.saveStatus.textContent = message;
  } catch {
    elements.saveStatus.textContent = "Impossible d'enregistrer localement pour l'instant.";
  }
}

function resetProject() {
  const backendUrl = state.backendUrl;
  state.medium = "oil";
  state.tubes = [...starterPalette];
  state.referenceImage = "";
  state.extractedColors = [];
  state.sampledColor = null;
  state.backendUrl = backendUrl;
  state.analysisSource = backendUrl ? "Backend configure, pret a etre utilise" : "Analyse locale";
  state.lastBackendError = "";
  state.plan = null;
  state.activeStepIndex = 0;

  elements.projectTitle.value = "Etude de peinture";
  elements.referenceInput.value = "";
  renderMedium();
  renderTubes();
  renderReferencePreview();
  renderPipetteResult();
  renderBackendStatus();
  renderPlanFromState();
  elements.pigmentLookupStatus.textContent = "Entre un code pigment connu pour pre-remplir le nom et la couleur.";

  persistState("Projet reinitialise. Le reglage backend a ete conserve.");
}

function renderReferencePreview() {
  if (!state.referenceImage) {
    elements.referencePreview.removeAttribute("src");
    elements.referencePreview.style.display = "none";
    elements.previewPlaceholder.classList.remove("hidden");
    elements.referencePreview.style.cursor = "default";
    return;
  }

  elements.referencePreview.src = state.referenceImage;
  elements.referencePreview.style.display = "block";
  elements.previewPlaceholder.classList.add("hidden");
  elements.referencePreview.style.cursor = "crosshair";
}

function renderPipetteResult() {
  if (!state.sampledColor) {
    elements.pipetteResult.innerHTML = "";
    elements.pipetteResult.classList.add("hidden");
    elements.pipetteHint.textContent = state.referenceImage
      ? "Clique sur l'image pour choisir une couleur et voir le melange suggere."
      : "Charge une image puis clique dessus pour activer la pipette.";
    return;
  }

  const { hex, mix } = state.sampledColor;
  elements.pipetteHint.textContent = "La couleur choisie est memorisee localement sur cet appareil.";
  elements.pipetteResult.classList.remove("hidden");
  elements.pipetteResult.innerHTML = `
    <div class="pipette-header">
      <span class="pipette-swatch" style="background:${hex}"></span>
      <div>
        <strong>Couleur selectionnee</strong>
        <div class="tube-meta">${hex.toUpperCase()}</div>
      </div>
    </div>
    <p class="mix-meta">${escapeHtml(mix.note)}</p>
    <ul>
      ${mix.parts.map((part) => `<li>${escapeHtml(part)}</li>`).join("")}
    </ul>
  `;
}

async function generateStepVisuals(referenceImage, colorRoles, analysis = null) {
  if (!referenceImage) {
    return {
      foundation: "",
      bigMasses: "",
      subjectSilhouette: "",
      secondaryMasses: "",
      shadowMap: "",
      modeledForms: "",
      detailMap: "",
      accents: ""
    };
  }

  try {
    const image = await loadImage(referenceImage);
    const width = 640;
    const height = Math.max(360, Math.round((image.height / image.width) * width));
    const baseCanvas = document.createElement("canvas");
    const baseContext = baseCanvas.getContext("2d", { willReadFrequently: true });
    baseCanvas.width = width;
    baseCanvas.height = height;
    baseContext.drawImage(image, 0, 0, width, height);

    const regionMasks = await loadRegionMasks(analysis?.regionMasks, width, height);
    if (regionMasks) {
      const rebuiltBackground = buildReconstructedBackground(baseCanvas, regionMasks);
      return {
        foundation: renderRebuiltFoundationStage(baseCanvas, regionMasks, rebuiltBackground, colorRoles.background.hex),
        bigMasses: renderRebuiltBackgroundNuanceStage(baseCanvas, regionMasks, rebuiltBackground),
        subjectSilhouette: "",
        secondaryMasses: "",
        shadowMap: "",
        modeledForms: renderRebuiltSubjectMassStage(baseCanvas, regionMasks, rebuiltBackground, colorRoles, analysis),
        detailMap: "",
        accents: renderRebuiltAccentStage(baseCanvas, regionMasks, rebuiltBackground)
      };
    }

    const focusBox = analysis?.subjectBox ?? { x: 0.5, y: 0.5, rx: 0.22, ry: 0.28 };

    return {
      foundation: renderFoundationStage(baseCanvas, colorRoles.background.hex),
      bigMasses: renderMassStage(baseCanvas, 5, 10),
      subjectSilhouette: renderSubjectStage(baseCanvas, focusBox),
      secondaryMasses: renderSecondaryStage(baseCanvas, focusBox, analysis?.secondaryColorHex ?? colorRoles.subject.hex),
      shadowMap: renderValueStage(baseCanvas, 5),
      modeledForms: renderModeledStage(baseCanvas, focusBox),
      detailMap: renderDetailStage(baseCanvas, focusBox),
      accents: renderAccentStage(baseCanvas, focusBox)
    };
  } catch {
    return {
      foundation: "",
      bigMasses: "",
      subjectSilhouette: "",
      secondaryMasses: "",
      shadowMap: "",
      modeledForms: "",
      detailMap: "",
      accents: ""
    };
  }
}

async function loadRegionMasks(regionMasks, width, height) {
  if (!regionMasks) {
    return null;
  }

  const entries = await Promise.all(Object.entries(regionMasks).map(async ([key, value]) => {
    if (!value) {
      return [key, null];
    }

    const image = await loadImage(value);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    canvas.width = width;
    canvas.height = height;
    context.drawImage(image, 0, 0, width, height);
    const { data } = context.getImageData(0, 0, width, height);
    return [key, data];
  }));

  return Object.fromEntries(entries);
}

function renderRebuiltFoundationStage(baseCanvas, masks, rebuiltBackground, backgroundHex) {
  const canvas = document.createElement("canvas");
  canvas.width = baseCanvas.width;
  canvas.height = baseCanvas.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.fillStyle = backgroundHex;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.filter = "blur(10px) saturate(0.78)";
  context.drawImage(rebuiltBackground, 0, 0);
  context.filter = "none";
  return canvas.toDataURL("image/jpeg", 0.9);
}

function renderRebuiltBackgroundNuanceStage(baseCanvas, masks, rebuiltBackground) {
  const canvas = document.createElement("canvas");
  canvas.width = baseCanvas.width;
  canvas.height = baseCanvas.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(rebuiltBackground, 0, 0);
  context.filter = "blur(3px)";
  context.drawImage(rebuiltBackground, 0, 0);
  context.filter = "none";
  revealMaskFromBase(context, baseCanvas, masks.background);
  softenForegroundIntoBackground(context, masks, 0.94);
  return canvas.toDataURL("image/jpeg", 0.92);
}

function renderRebuiltSubjectMassStage(baseCanvas, masks, rebuiltBackground, colorRoles, analysis) {
  const canvas = document.createElement("canvas");
  canvas.width = baseCanvas.width;
  canvas.height = baseCanvas.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(rebuiltBackground, 0, 0);

  const subjectBase = analysis?.midtoneHex ?? colorRoles.subject.hex;
  const secondaryBase = analysis?.secondaryColorHex ?? colorRoles.subject.hex;
  const shadowBase = colorRoles.shadow.hex;

  paintMaskColor(context, masks.secondary, secondaryBase, 1);
  paintMaskColor(context, masks.subject, subjectBase, 1);
  paintMaskColor(context, masks.shadows, shadowBase, 0.72);
  softenMaskEdges(context, 12);
  return canvas.toDataURL("image/jpeg", 0.92);
}

function renderRebuiltAccentStage(baseCanvas, masks, rebuiltBackground) {
  const canvas = document.createElement("canvas");
  canvas.width = baseCanvas.width;
  canvas.height = baseCanvas.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(rebuiltBackground, 0, 0);
  revealMaskFromBase(context, baseCanvas, masks.subject);
  revealMaskFromBase(context, baseCanvas, masks.secondary);
  revealMaskFromBase(context, baseCanvas, masks.shadows);
  revealMaskFromBase(context, baseCanvas, masks.details);
  applyMaskContrast(context, masks.details, 1.12);
  applyMaskContrast(context, masks.shadows, 1.08);
  return canvas.toDataURL("image/jpeg", 0.92);
}

function cloneCanvas(sourceCanvas) {
  const canvas = document.createElement("canvas");
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(sourceCanvas, 0, 0);
  return canvas;
}

function buildReconstructedBackground(baseCanvas, masks) {
  const sampleWidth = 160;
  const sampleHeight = Math.max(96, Math.round((baseCanvas.height / baseCanvas.width) * sampleWidth));
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = sampleWidth;
  sampleCanvas.height = sampleHeight;
  const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });
  sampleContext.drawImage(baseCanvas, 0, 0, sampleWidth, sampleHeight);
  const imageData = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight);
  const backgroundMask = resizeMaskData(masks.background, baseCanvas.width, baseCanvas.height, sampleWidth, sampleHeight);
  const foregroundMask = invertMaskData(backgroundMask);
  const filled = inpaintMaskByNeighbors(imageData, foregroundMask, sampleWidth, sampleHeight);
  sampleContext.putImageData(filled, 0, 0);

  const canvas = document.createElement("canvas");
  canvas.width = baseCanvas.width;
  canvas.height = baseCanvas.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.imageSmoothingEnabled = true;
  context.drawImage(sampleCanvas, 0, 0, canvas.width, canvas.height);
  context.filter = "blur(4px)";
  context.drawImage(canvas, 0, 0);
  context.filter = "none";
  return canvas;
}

function maskAlpha(maskData, index) {
  if (!maskData) {
    return 0;
  }
  return maskData[index] / 255;
}

function applyMaskTint(context, maskData, fillStyle) {
  if (!maskData) {
    return;
  }

  const canvas = context.canvas;
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const overlayCanvas = document.createElement("canvas");
  overlayCanvas.width = canvas.width;
  overlayCanvas.height = canvas.height;
  const overlayContext = overlayCanvas.getContext("2d");
  overlayContext.fillStyle = fillStyle;
  overlayContext.fillRect(0, 0, canvas.width, canvas.height);
  const overlayData = overlayContext.getImageData(0, 0, canvas.width, canvas.height).data;

  for (let index = 0; index < imageData.data.length; index += 4) {
    const alpha = maskAlpha(maskData, index);
    if (!alpha) {
      continue;
    }

    imageData.data[index] = clampChannel(imageData.data[index] * (1 - alpha * 0.45) + overlayData[index] * alpha * 0.45);
    imageData.data[index + 1] = clampChannel(imageData.data[index + 1] * (1 - alpha * 0.45) + overlayData[index + 1] * alpha * 0.45);
    imageData.data[index + 2] = clampChannel(imageData.data[index + 2] * (1 - alpha * 0.45) + overlayData[index + 2] * alpha * 0.45);
  }

  context.putImageData(imageData, 0, 0);
}

function paintMaskColor(context, maskData, colorHex, opacity = 1) {
  if (!maskData) {
    return;
  }

  const canvas = context.canvas;
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const rgb = hexToRgb(colorHex);
  const red = Math.round(rgb.r * 255);
  const green = Math.round(rgb.g * 255);
  const blue = Math.round(rgb.b * 255);

  for (let index = 0; index < imageData.data.length; index += 4) {
    const alpha = maskAlpha(maskData, index);
    if (!alpha) {
      continue;
    }

    imageData.data[index] = clampChannel(imageData.data[index] * (1 - alpha * opacity) + red * alpha * opacity);
    imageData.data[index + 1] = clampChannel(imageData.data[index + 1] * (1 - alpha * opacity) + green * alpha * opacity);
    imageData.data[index + 2] = clampChannel(imageData.data[index + 2] * (1 - alpha * opacity) + blue * alpha * opacity);
  }

  context.putImageData(imageData, 0, 0);
}

function muteOutsideMask(context, maskData, muteFactor) {
  if (!maskData) {
    return;
  }

  const canvas = context.canvas;
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < imageData.data.length; index += 4) {
    const alpha = maskAlpha(maskData, index);
    if (alpha > 0.1) {
      continue;
    }
    const grey = Math.round((imageData.data[index] + imageData.data[index + 1] + imageData.data[index + 2]) / 3);
    imageData.data[index] = clampChannel(imageData.data[index] * muteFactor + grey * (1 - muteFactor));
    imageData.data[index + 1] = clampChannel(imageData.data[index + 1] * muteFactor + grey * (1 - muteFactor));
    imageData.data[index + 2] = clampChannel(imageData.data[index + 2] * muteFactor + grey * (1 - muteFactor));
  }
  context.putImageData(imageData, 0, 0);
}

function muteOutsideCombinedMasks(context, masks, muteFactor) {
  const canvas = context.canvas;
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < imageData.data.length; index += 4) {
    const inside = masks.some((maskData) => maskAlpha(maskData, index) > 0.1);
    if (inside) {
      continue;
    }
    const grey = Math.round((imageData.data[index] + imageData.data[index + 1] + imageData.data[index + 2]) / 3);
    imageData.data[index] = clampChannel(imageData.data[index] * muteFactor + grey * (1 - muteFactor));
    imageData.data[index + 1] = clampChannel(imageData.data[index + 1] * muteFactor + grey * (1 - muteFactor));
    imageData.data[index + 2] = clampChannel(imageData.data[index + 2] * muteFactor + grey * (1 - muteFactor));
  }
  context.putImageData(imageData, 0, 0);
}

function softenForegroundIntoBackground(context, masks, keepFactor) {
  const canvas = context.canvas;
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < imageData.data.length; index += 4) {
    const isForeground =
      maskAlpha(masks.subject, index) > 0.1 ||
      maskAlpha(masks.secondary, index) > 0.1 ||
      maskAlpha(masks.details, index) > 0.1 ||
      maskAlpha(masks.shadows, index) > 0.1;

    if (!isForeground) {
      continue;
    }

    imageData.data[index] = clampChannel(imageData.data[index] * keepFactor);
    imageData.data[index + 1] = clampChannel(imageData.data[index + 1] * keepFactor);
    imageData.data[index + 2] = clampChannel(imageData.data[index + 2] * keepFactor);
  }
  context.putImageData(imageData, 0, 0);
}

function fillForegroundWithBase(context, masks, fillHex, opacity) {
  const canvas = context.canvas;
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const rgb = hexToRgb(fillHex);
  const red = Math.round(rgb.r * 255);
  const green = Math.round(rgb.g * 255);
  const blue = Math.round(rgb.b * 255);

  for (let index = 0; index < imageData.data.length; index += 4) {
    const isForeground =
      maskAlpha(masks.subject, index) > 0.1 ||
      maskAlpha(masks.secondary, index) > 0.1 ||
      maskAlpha(masks.details, index) > 0.1;

    if (!isForeground) {
      continue;
    }

    imageData.data[index] = clampChannel(imageData.data[index] * (1 - opacity) + red * opacity);
    imageData.data[index + 1] = clampChannel(imageData.data[index + 1] * (1 - opacity) + green * opacity);
    imageData.data[index + 2] = clampChannel(imageData.data[index + 2] * (1 - opacity) + blue * opacity);
  }

  context.putImageData(imageData, 0, 0);
}

function softenOutsideMask(context, focusMask, keepFactor) {
  const canvas = context.canvas;
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < imageData.data.length; index += 4) {
    if (maskAlpha(focusMask, index) > 0.1) {
      continue;
    }

    const grey = Math.round((imageData.data[index] + imageData.data[index + 1] + imageData.data[index + 2]) / 3);
    imageData.data[index] = clampChannel(imageData.data[index] * keepFactor + grey * (1 - keepFactor));
    imageData.data[index + 1] = clampChannel(imageData.data[index + 1] * keepFactor + grey * (1 - keepFactor));
    imageData.data[index + 2] = clampChannel(imageData.data[index + 2] * keepFactor + grey * (1 - keepFactor));
  }
  context.putImageData(imageData, 0, 0);
}

function desaturateByMask(context, focusMask, outsideFactor, insideFactor) {
  const canvas = context.canvas;
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < imageData.data.length; index += 4) {
    const alpha = maskAlpha(focusMask, index);
    const grey = Math.round((imageData.data[index] + imageData.data[index + 1] + imageData.data[index + 2]) / 3);
    const factor = alpha > 0.1 ? insideFactor : outsideFactor;
    imageData.data[index] = clampChannel(grey * (1 - factor) + imageData.data[index] * factor);
    imageData.data[index + 1] = clampChannel(grey * (1 - factor) + imageData.data[index + 1] * factor);
    imageData.data[index + 2] = clampChannel(grey * (1 - factor) + imageData.data[index + 2] * factor);
  }
  context.putImageData(imageData, 0, 0);
}

function convertToGreyscale(context) {
  const canvas = context.canvas;
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < imageData.data.length; index += 4) {
    const grey = Math.round((imageData.data[index] + imageData.data[index + 1] + imageData.data[index + 2]) / 3);
    imageData.data[index] = grey;
    imageData.data[index + 1] = grey;
    imageData.data[index + 2] = grey;
  }
  context.putImageData(imageData, 0, 0);
}

function revealMaskFromBase(context, baseCanvas, maskData) {
  if (!maskData) {
    return;
  }

  const baseContext = baseCanvas.getContext("2d", { willReadFrequently: true });
  const baseImage = baseContext.getImageData(0, 0, baseCanvas.width, baseCanvas.height);
  const imageData = context.getImageData(0, 0, baseCanvas.width, baseCanvas.height);
  for (let index = 0; index < imageData.data.length; index += 4) {
    const alpha = maskAlpha(maskData, index);
    if (!alpha) {
      continue;
    }
    imageData.data[index] = clampChannel(imageData.data[index] * (1 - alpha) + baseImage.data[index] * alpha);
    imageData.data[index + 1] = clampChannel(imageData.data[index + 1] * (1 - alpha) + baseImage.data[index + 1] * alpha);
    imageData.data[index + 2] = clampChannel(imageData.data[index + 2] * (1 - alpha) + baseImage.data[index + 2] * alpha);
  }
  context.putImageData(imageData, 0, 0);
}

function applyMaskContrast(context, maskData, factor) {
  if (!maskData) {
    return;
  }

  const canvas = context.canvas;
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < imageData.data.length; index += 4) {
    const alpha = maskAlpha(maskData, index);
    if (!alpha) {
      continue;
    }
    imageData.data[index] = clampChannel((imageData.data[index] - 128) * (1 + (factor - 1) * alpha) + 128);
    imageData.data[index + 1] = clampChannel((imageData.data[index + 1] - 128) * (1 + (factor - 1) * alpha) + 128);
    imageData.data[index + 2] = clampChannel((imageData.data[index + 2] - 128) * (1 + (factor - 1) * alpha) + 128);
  }
  context.putImageData(imageData, 0, 0);
}

function outlineMask(context, maskData, strokeStyle, radius) {
  if (!maskData) {
    return;
  }

  const canvas = context.canvas;
  const outlineCanvas = document.createElement("canvas");
  outlineCanvas.width = canvas.width;
  outlineCanvas.height = canvas.height;
  const outlineContext = outlineCanvas.getContext("2d", { willReadFrequently: true });
  const imageData = outlineContext.createImageData(canvas.width, canvas.height);

  for (let y = 1; y < canvas.height - 1; y += 1) {
    for (let x = 1; x < canvas.width - 1; x += 1) {
      const index = (y * canvas.width + x) * 4;
      const center = maskAlpha(maskData, index) > 0.1;
      if (!center) {
        continue;
      }
      const neighborOff =
        maskAlpha(maskData, index - 4) < 0.1 ||
        maskAlpha(maskData, index + 4) < 0.1 ||
        maskAlpha(maskData, index - canvas.width * 4) < 0.1 ||
        maskAlpha(maskData, index + canvas.width * 4) < 0.1;
      if (neighborOff) {
        imageData.data[index] = 255;
        imageData.data[index + 1] = 255;
        imageData.data[index + 2] = 255;
        imageData.data[index + 3] = 255;
      }
    }
  }

  outlineContext.putImageData(imageData, 0, 0);
  const coloredCanvas = document.createElement("canvas");
  coloredCanvas.width = canvas.width;
  coloredCanvas.height = canvas.height;
  const coloredContext = coloredCanvas.getContext("2d");
  coloredContext.drawImage(outlineCanvas, 0, 0);
  coloredContext.globalCompositeOperation = "source-in";
  coloredContext.fillStyle = strokeStyle;
  coloredContext.fillRect(0, 0, canvas.width, canvas.height);

  context.save();
  context.filter = `blur(${radius}px)`;
  context.drawImage(coloredCanvas, 0, 0);
  context.restore();
}

function softenMaskEdges(context, blurPx) {
  const canvas = context.canvas;
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempContext = tempCanvas.getContext("2d");
  tempContext.filter = `blur(${blurPx}px)`;
  tempContext.drawImage(canvas, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(tempCanvas, 0, 0);
}

function resizeMaskData(maskData, sourceWidth, sourceHeight, targetWidth, targetHeight) {
  if (!maskData) {
    return null;
  }

  const resized = new Uint8ClampedArray(targetWidth * targetHeight * 4);
  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(sourceWidth - 1, Math.round((x / Math.max(targetWidth - 1, 1)) * (sourceWidth - 1)));
      const sourceY = Math.min(sourceHeight - 1, Math.round((y / Math.max(targetHeight - 1, 1)) * (sourceHeight - 1)));
      const sourceIndex = (sourceY * sourceWidth + sourceX) * 4;
      const targetIndex = (y * targetWidth + x) * 4;
      resized[targetIndex] = maskData[sourceIndex];
      resized[targetIndex + 1] = maskData[sourceIndex + 1];
      resized[targetIndex + 2] = maskData[sourceIndex + 2];
      resized[targetIndex + 3] = 255;
    }
  }
  return resized;
}

function invertMaskData(maskData) {
  if (!maskData) {
    return null;
  }

  const inverted = new Uint8ClampedArray(maskData.length);
  for (let index = 0; index < maskData.length; index += 4) {
    const value = 255 - maskData[index];
    inverted[index] = value;
    inverted[index + 1] = value;
    inverted[index + 2] = value;
    inverted[index + 3] = 255;
  }
  return inverted;
}

function inpaintMaskByNeighbors(imageData, holeMask, width, height) {
  if (!holeMask) {
    return imageData;
  }

  const result = new ImageData(new Uint8ClampedArray(imageData.data), width, height);
  const unresolved = new Uint8Array(width * height);

  for (let index = 0; index < unresolved.length; index += 1) {
    unresolved[index] = holeMask[index * 4] > 127 ? 1 : 0;
  }

  for (let pass = 0; pass < 80; pass += 1) {
    let changed = false;
    const snapshot = new Uint8ClampedArray(result.data);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixelIndex = y * width + x;
        if (!unresolved[pixelIndex]) {
          continue;
        }

        let red = 0;
        let green = 0;
        let blue = 0;
        let count = 0;

        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            if (!offsetX && !offsetY) {
              continue;
            }

            const neighborX = x + offsetX;
            const neighborY = y + offsetY;
            if (neighborX < 0 || neighborY < 0 || neighborX >= width || neighborY >= height) {
              continue;
            }

            const neighborPixelIndex = neighborY * width + neighborX;
            if (unresolved[neighborPixelIndex]) {
              continue;
            }

            const neighborIndex = neighborPixelIndex * 4;
            red += snapshot[neighborIndex];
            green += snapshot[neighborIndex + 1];
            blue += snapshot[neighborIndex + 2];
            count += 1;
          }
        }

        if (!count) {
          continue;
        }

        const targetIndex = pixelIndex * 4;
        result.data[targetIndex] = Math.round(red / count);
        result.data[targetIndex + 1] = Math.round(green / count);
        result.data[targetIndex + 2] = Math.round(blue / count);
        result.data[targetIndex + 3] = 255;
        unresolved[pixelIndex] = 0;
        changed = true;
      }
    }

    if (!changed) {
      break;
    }
  }

  return result;
}

function renderFoundationStage(baseCanvas, backgroundHex) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = baseCanvas.width;
  canvas.height = baseCanvas.height;

  context.filter = "blur(14px) saturate(0.78) brightness(0.98)";
  context.drawImage(baseCanvas, 0, 0);
  context.filter = "none";
  context.fillStyle = withAlpha(backgroundHex, 0.18);
  context.fillRect(0, 0, canvas.width, canvas.height);

  return canvas.toDataURL("image/jpeg", 0.84);
}

function renderMassStage(baseCanvas, levels, blurAmount) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  canvas.width = baseCanvas.width;
  canvas.height = baseCanvas.height;

  if (blurAmount > 0) {
    context.filter = `blur(${blurAmount}px)`;
  }
  context.drawImage(baseCanvas, 0, 0);
  context.filter = "none";

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const step = 255 / Math.max(levels - 1, 1);

  for (let index = 0; index < data.length; index += 4) {
    data[index] = softenPosterize(data[index], step);
    data[index + 1] = softenPosterize(data[index + 1], step);
    data[index + 2] = softenPosterize(data[index + 2], step);
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.86);
}

function renderSubjectStage(baseCanvas, focusBox) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  canvas.width = baseCanvas.width;
  canvas.height = baseCanvas.height;
  context.drawImage(baseCanvas, 0, 0);

  const muted = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = muted;
  const cx = focusBox.x * canvas.width;
  const cy = focusBox.y * canvas.height;
  const rx = focusBox.rx * canvas.width;
  const ry = focusBox.ry * canvas.height;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const inside = dx * dx + dy * dy;
      const grey = Math.round((data[index] + data[index + 1] + data[index + 2]) / 3);

      if (inside > 1.15) {
        data[index] = Math.round(grey * 0.92);
        data[index + 1] = Math.round(grey * 0.92);
        data[index + 2] = Math.round(grey * 0.92);
      } else {
        data[index] = clampChannel(data[index] * 1.03 + 8);
        data[index + 1] = clampChannel(data[index + 1] * 1.03 + 8);
        data[index + 2] = clampChannel(data[index + 2] * 1.03 + 8);
      }
    }
  }

  context.putImageData(muted, 0, 0);
  context.strokeStyle = "rgba(176, 129, 66, 0.6)";
  context.lineWidth = Math.max(4, canvas.width * 0.006);
  context.beginPath();
  context.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  context.stroke();

  return canvas.toDataURL("image/jpeg", 0.88);
}

function renderValueStage(baseCanvas, levels) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  canvas.width = baseCanvas.width;
  canvas.height = baseCanvas.height;
  context.drawImage(baseCanvas, 0, 0);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const step = 255 / Math.max(levels - 1, 1);

  for (let index = 0; index < data.length; index += 4) {
    const grey = Math.round((data[index] + data[index + 1] + data[index + 2]) / 3);
    const posterized = softenPosterize(grey, step);
    data[index] = posterized;
    data[index + 1] = posterized;
    data[index + 2] = posterized;
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.86);
}

function renderModeledStage(baseCanvas, focusBox) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  canvas.width = baseCanvas.width;
  canvas.height = baseCanvas.height;
  context.filter = "blur(3px)";
  context.drawImage(baseCanvas, 0, 0);
  context.filter = "none";

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const cx = focusBox.x * canvas.width;
  const cy = focusBox.y * canvas.height;
  const rx = focusBox.rx * canvas.width;
  const ry = focusBox.ry * canvas.height;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const inside = dx * dx + dy * dy;
      const focus = inside < 1.2 ? 1.05 : 0.92;
      data[index] = softenPosterize(clampChannel(data[index] * focus), 36);
      data[index + 1] = softenPosterize(clampChannel(data[index + 1] * focus), 36);
      data[index + 2] = softenPosterize(clampChannel(data[index + 2] * focus), 36);
    }
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.88);
}

function renderDetailStage(baseCanvas, focusBox) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  canvas.width = baseCanvas.width;
  canvas.height = baseCanvas.height;
  context.filter = "blur(6px)";
  context.drawImage(baseCanvas, 0, 0);
  context.filter = "none";

  const blurred = context.getImageData(0, 0, canvas.width, canvas.height);
  const sharpCanvas = document.createElement("canvas");
  const sharpContext = sharpCanvas.getContext("2d", { willReadFrequently: true });
  sharpCanvas.width = canvas.width;
  sharpCanvas.height = canvas.height;
  sharpContext.drawImage(baseCanvas, 0, 0);
  const sharp = sharpContext.getImageData(0, 0, canvas.width, canvas.height);

  const cx = focusBox.x * canvas.width;
  const cy = focusBox.y * canvas.height;
  const rx = focusBox.rx * canvas.width;
  const ry = focusBox.ry * canvas.height;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      const edge = approximateEdgeStrength(sharp.data, canvas.width, canvas.height, x, y);
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const inside = dx * dx + dy * dy;
      const detailWeight = edge > 0.18 && inside < 1.6 ? 1 : 0;

      if (detailWeight) {
        blurred.data[index] = sharp.data[index];
        blurred.data[index + 1] = sharp.data[index + 1];
        blurred.data[index + 2] = sharp.data[index + 2];
      }
    }
  }

  context.putImageData(blurred, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.9);
}

function renderFocusedStage(baseCanvas, focusBox, { levels, blur, spotlight }) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  canvas.width = baseCanvas.width;
  canvas.height = baseCanvas.height;

  if (blur > 0) {
    context.filter = `blur(${blur}px)`;
  }
  context.drawImage(baseCanvas, 0, 0);
  context.filter = "none";

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const step = 255 / Math.max(levels - 1, 1);
  const cx = focusBox.x * canvas.width;
  const cy = focusBox.y * canvas.height;
  const rx = focusBox.rx * canvas.width;
  const ry = focusBox.ry * canvas.height;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      data[index] = Math.round(data[index] / step) * step;
      data[index + 1] = Math.round(data[index + 1] / step) * step;
      data[index + 2] = Math.round(data[index + 2] / step) * step;

      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const inside = dx * dx + dy * dy;
      if (inside <= 1) {
        data[index] = Math.min(255, data[index] + 255 * spotlight * (1 - inside));
        data[index + 1] = Math.min(255, data[index + 1] + 255 * spotlight * (1 - inside));
        data[index + 2] = Math.min(255, data[index + 2] + 255 * spotlight * (1 - inside));
      }
    }
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.86);
}

function renderSecondaryStage(baseCanvas, focusBox, secondaryHex) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  canvas.width = baseCanvas.width;
  canvas.height = baseCanvas.height;
  context.drawImage(baseCanvas, 0, 0);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const cx = focusBox.x * canvas.width;
  const cy = focusBox.y * canvas.height;
  const rx = focusBox.rx * canvas.width;
  const ry = focusBox.ry * canvas.height;
  const tint = hexToRgb(secondaryHex);

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const inside = dx * dx + dy * dy;

      if (inside > 1 && inside < 2.4) {
        data[index] = Math.round(data[index] * 0.78 + tint.r * 255 * 0.22);
        data[index + 1] = Math.round(data[index + 1] * 0.78 + tint.g * 255 * 0.22);
        data[index + 2] = Math.round(data[index + 2] * 0.78 + tint.b * 255 * 0.22);
      } else if (inside >= 2.4) {
        const grey = Math.round((data[index] + data[index + 1] + data[index + 2]) / 3);
        data[index] = Math.round(grey * 0.75);
        data[index + 1] = Math.round(grey * 0.75);
        data[index + 2] = Math.round(grey * 0.75);
      }
    }
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.86);
}

function renderShadowStage(baseCanvas, focusBox) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  canvas.width = baseCanvas.width;
  canvas.height = baseCanvas.height;
  context.drawImage(baseCanvas, 0, 0);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const cx = focusBox.x * canvas.width;
  const cy = focusBox.y * canvas.height;
  const rx = focusBox.rx * canvas.width;
  const ry = focusBox.ry * canvas.height;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      const luminance = relativeLuminance(data[index], data[index + 1], data[index + 2]);
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const inside = dx * dx + dy * dy;
      const isShadow = luminance < 0.45 || inside > 1.1;

        if (isShadow) {
          data[index] = Math.round(data[index] * 0.7);
          data[index + 1] = Math.round(data[index + 1] * 0.7);
          data[index + 2] = Math.round(data[index + 2] * 0.7);
        } else {
          const lift = inside < 1 ? 1.06 : 0.98;
          data[index] = Math.min(255, Math.round(data[index] * lift));
          data[index + 1] = Math.min(255, Math.round(data[index + 1] * lift));
          data[index + 2] = Math.min(255, Math.round(data[index + 2] * lift));
        }
      }
    }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.86);
}

function renderDetailMapStage(baseCanvas, focusBox) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  canvas.width = baseCanvas.width;
  canvas.height = baseCanvas.height;
  context.drawImage(baseCanvas, 0, 0);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const cx = focusBox.x * canvas.width;
  const cy = focusBox.y * canvas.height;
  const rx = focusBox.rx * canvas.width;
  const ry = focusBox.ry * canvas.height;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      const edge = approximateEdgeStrength(data, canvas.width, canvas.height, x, y);
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const inside = dx * dx + dy * dy;
      const emphasis = inside < 1.35 ? 1 : 0.55;
      const grey = Math.round((data[index] + data[index + 1] + data[index + 2]) / 3);
      const value = Math.min(255, Math.round(grey * 0.45 + edge * 255 * emphasis));

      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
    }
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.88);
}

function renderAccentStage(baseCanvas, focusBox) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  canvas.width = baseCanvas.width;
  canvas.height = baseCanvas.height;
  context.drawImage(baseCanvas, 0, 0);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const cx = focusBox.x * canvas.width;
  const cy = focusBox.y * canvas.height;
  const rx = focusBox.rx * canvas.width;
  const ry = focusBox.ry * canvas.height;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      const edge = approximateEdgeStrength(data, canvas.width, canvas.height, x, y);
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const inside = dx * dx + dy * dy;
      const accentBoost = inside < 1 ? 1.22 : 0.9;

      if (edge > 0.28) {
        data[index] = clampChannel(data[index] * accentBoost);
        data[index + 1] = clampChannel(data[index + 1] * accentBoost);
        data[index + 2] = clampChannel(data[index + 2] * accentBoost);
      } else {
        data[index] = Math.round(data[index] * 0.985);
        data[index + 1] = Math.round(data[index + 1] * 0.985);
        data[index + 2] = Math.round(data[index + 2] * 0.985);
      }
    }
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.9);
}

async function extractDominantColors(dataUrl) {
  try {
    const image = await loadImage(dataUrl);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const sampleSize = 48;

    canvas.width = sampleSize;
    canvas.height = sampleSize;
    context.drawImage(image, 0, 0, sampleSize, sampleSize);

    const { data } = context.getImageData(0, 0, sampleSize, sampleSize);
    const buckets = new Map();

    for (let index = 0; index < data.length; index += 16) {
      const alpha = data[index + 3] / 255;
      if (alpha < 0.9) {
        continue;
      }

      const red = quantizeChannel(data[index]);
      const green = quantizeChannel(data[index + 1]);
      const blue = quantizeChannel(data[index + 2]);
      const key = `${red}-${green}-${blue}`;
      const current = buckets.get(key) ?? { red: 0, green: 0, blue: 0, count: 0 };

      current.red += data[index];
      current.green += data[index + 1];
      current.blue += data[index + 2];
      current.count += 1;
      buckets.set(key, current);
    }

    const dominant = [...buckets.values()]
      .filter((bucket) => bucket.count > 2)
      .map((bucket) => ({
        red: Math.round(bucket.red / bucket.count),
        green: Math.round(bucket.green / bucket.count),
        blue: Math.round(bucket.blue / bucket.count),
        count: bucket.count
      }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 8);

    const unique = [];
    dominant.forEach((bucket) => {
      const hex = rgbToHex(bucket.red, bucket.green, bucket.blue);
      const duplicate = unique.some((entry) => colorDistance(hexToRgb(entry.hex), hexToRgb(hex)) < 0.14);
      if (!duplicate) {
        unique.push({
          hex,
          label: describeColor(bucket.red, bucket.green, bucket.blue),
          luminance: relativeLuminance(bucket.red, bucket.green, bucket.blue)
        });
      }
    });

    return unique
      .sort((left, right) => right.luminance - left.luminance)
      .slice(0, 5);
  } catch {
    return [];
  }
}

async function sampleColorAtPoint(event, imageElement, source) {
  try {
    const image = await loadImage(source);
    const rect = imageElement.getBoundingClientRect();
    const scaleX = image.naturalWidth / rect.width;
    const scaleY = image.naturalHeight / rect.height;
    const x = Math.max(0, Math.min(image.naturalWidth - 1, Math.round((event.clientX - rect.left) * scaleX)));
    const y = Math.max(0, Math.min(image.naturalHeight - 1, Math.round((event.clientY - rect.top) * scaleY)));

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    context.drawImage(image, 0, 0);

    const radius = 4;
    const startX = Math.max(0, x - radius);
    const startY = Math.max(0, y - radius);
    const width = Math.min(image.naturalWidth - startX, radius * 2 + 1);
    const height = Math.min(image.naturalHeight - startY, radius * 2 + 1);
    const { data } = context.getImageData(startX, startY, width, height);

    let red = 0;
    let green = 0;
    let blue = 0;
    let count = 0;

    for (let index = 0; index < data.length; index += 4) {
      if (data[index + 3] < 220) {
        continue;
      }
      red += data[index];
      green += data[index + 1];
      blue += data[index + 2];
      count += 1;
    }

    if (!count) {
      return null;
    }

    return rgbToHex(
      Math.round(red / count),
      Math.round(green / count),
      Math.round(blue / count)
    );
  } catch {
    return null;
  }
}

function buildColorRoles(extractedColors) {
  if (!extractedColors.length) {
    return {
      background: { hex: "#d2c8b7", label: "Valeur claire d'ambiance" },
      subject: { hex: "#9f6846", label: "Couleur moyenne du sujet" },
      shadow: { hex: "#54453f", label: "Ombre structurelle" },
      accent: { hex: "#261d1b", label: "Accent sombre final" }
    };
  }

  const sorted = [...extractedColors].sort((left, right) => right.luminance - left.luminance);
  const brightest = sorted[0];
  const darkest = sorted[sorted.length - 1];
  const midpoint = sorted[Math.floor(sorted.length / 2)];
  const secondDarkest = sorted[Math.max(sorted.length - 2, 0)];

  return {
    background: { hex: brightest.hex, label: `${brightest.label} pour les masses de fond` },
    subject: { hex: midpoint.hex, label: `${midpoint.label} pour la forme principale` },
    shadow: { hex: secondDarkest.hex, label: `${secondDarkest.label} pour les ombres et recouvrements` },
    accent: { hex: darkest.hex, label: `${darkest.label} pour les accents finaux` }
  };
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

function quantizeChannel(value) {
  return Math.round(value / 32) * 32;
}

function rgbToHex(red, green, blue) {
  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
}

function softenPosterize(value, step) {
  const lower = Math.floor(value / step) * step;
  const upper = Math.min(255, lower + step);
  return Math.round(lower * 0.45 + upper * 0.55);
}

function normalizePigmentCode(value) {
  return value
    .trim()
    .toUpperCase()
    .replaceAll("-", "")
    .replaceAll(" ", "");
}

function averageHex(red, green, blue, count) {
  if (!count) {
    return null;
  }

  return rgbToHex(
    Math.round(red / count),
    Math.round(green / count),
    Math.round(blue / count)
  );
}

function approximateEdgeStrength(data, width, height, x, y) {
  const left = sampleRgb(data, width, height, Math.max(0, x - 1), y);
  const right = sampleRgb(data, width, height, Math.min(width - 1, x + 1), y);
  const top = sampleRgb(data, width, height, x, Math.max(0, y - 1));
  const bottom = sampleRgb(data, width, height, x, Math.min(height - 1, y + 1));

  const horizontal = Math.abs(left.r - right.r) + Math.abs(left.g - right.g) + Math.abs(left.b - right.b);
  const vertical = Math.abs(top.r - bottom.r) + Math.abs(top.g - bottom.g) + Math.abs(top.b - bottom.b);
  return clamp((horizontal + vertical) / (255 * 3 * 2), 0, 1);
}

function sampleRgb(data, width, height, x, y) {
  const safeX = clamp(Math.round(x), 0, width - 1);
  const safeY = clamp(Math.round(y), 0, height - 1);
  const index = (safeY * width + safeX) * 4;
  return {
    r: data[index],
    g: data[index + 1],
    b: data[index + 2]
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function percent(value) {
  return `${Math.round(value * 100)}%`;
}

function formatCoverage(value) {
  if (value < 0.1) {
    return "moins de 10%";
  }
  const rounded = Math.round(value * 100 / 5) * 5;
  const upper = Math.min(100, rounded + 10);
  return `${rounded}% a ${upper}%`;
}

function relativeLuminance(red, green, blue) {
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
}

function describeColor(red, green, blue) {
  const hue = rgbToHue(red, green, blue);
  const luminance = relativeLuminance(red, green, blue);
  const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);

  const lightness = luminance > 0.72 ? "clair" : luminance < 0.28 ? "sombre" : "moyen";
  const saturation = chroma < 20 ? "gris" : "";
  const family = chroma < 20
    ? "neutre"
    : hue < 20 || hue >= 340 ? "rouge"
    : hue < 45 ? "orange"
    : hue < 70 ? "jaune"
    : hue < 165 ? "vert"
    : hue < 255 ? "bleu"
    : hue < 320 ? "violet"
    : "rose";

  return [family, lightness, saturation].filter(Boolean).join(" ");
}

function rgbToHue(red, green, blue) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (delta === 0) {
    return 0;
  }

  let hue;
  if (max === r) {
    hue = ((g - b) / delta) % 6;
  } else if (max === g) {
    hue = (b - r) / delta + 2;
  } else {
    hue = (r - g) / delta + 4;
  }

  const degrees = hue * 60;
  return Math.round(degrees < 0 ? degrees + 360 : degrees);
}

function hexToRgb(hex) {
  const sanitized = hex.replace("#", "");
  const full = sanitized.length === 3
    ? sanitized.split("").map((char) => char + char).join("")
    : sanitized;

  return {
    r: parseInt(full.slice(0, 2), 16) / 255,
    g: parseInt(full.slice(2, 4), 16) / 255,
    b: parseInt(full.slice(4, 6), 16) / 255
  };
}

function colorDistance(left, right) {
  const red = left.r - right.r;
  const green = left.g - right.g;
  const blue = left.b - right.b;
  return Math.sqrt(red * red + green * green + blue * blue);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "etude";
}
