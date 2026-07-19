(() => {
  'use strict';

  const state = {
    step: 1,
    referenceType: 'image',
    imageFile: null,
    modelFile: null,
    modelUrl: null,
    modelAssetUrls: [],
    modelImportKind: '',
    modelFrontBlob: null,
    modelBackBlob: null,
    artFront: null,
    artBack: null,
    spriteFrontRaw: null,
    spriteBackRaw: null,
    apiBase: localStorage.getItem('vcs_api_base') || '',
    accessToken: sessionStorage.getItem('vcs_access_token') || '',
    renderTicket: 0,
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const elements = {
    panels: $$('.step-panel'),
    steps: $$('.step'),
    imageTab: $('#imageTab'),
    modelTab: $('#modelTab'),
    imagePanel: $('#imageInputPanel'),
    modelPanel: $('#modelInputPanel'),
    imageInput: $('#imageInput'),
    imageDropZone: $('#imageDropZone'),
    imagePreviewWrap: $('#imagePreviewWrap'),
    imagePreview: $('#imagePreview'),
    replaceImageButton: $('#replaceImageButton'),
    modelInput: $('#modelInput'),
    modelDropZone: $('#modelDropZone'),
    modelStage: $('#modelStage'),
    modelViewer: $('#modelViewer'),
    captureFrontButton: $('#captureFrontButton'),
    captureBackButton: $('#captureBackButton'),
    modelFrontCapture: $('#modelFrontCapture'),
    modelBackCapture: $('#modelBackCapture'),
    descriptionInput: $('#descriptionInput'),
    descriptionCount: $('#descriptionCount'),
    characterName: $('#characterName'),
    poseSelect: $('#poseSelect'),
    artTreatment: $('#artTreatment'),
    qualitySelect: $('#qualitySelect'),
    fidelityRange: $('#fidelityRange'),
    fidelityValue: $('#fidelityValue'),
    lookBackToggle: $('#lookBackToggle'),
    outerGarmentType: $('#outerGarmentType'),
    outerGarmentBack: $('#outerGarmentBack'),
    outerGarmentAttachment: $('#outerGarmentAttachment'),
    garmentSymmetryToggle: $('#garmentSymmetryToggle'),
    generateArtButton: $('#generateArtButton'),
    retryArtButton: $('#retryArtButton'),
    makeSpriteButton: $('#makeSpriteButton'),
    artProgress: $('#artProgress'),
    artProgressTitle: $('#artProgressTitle'),
    artProgressText: $('#artProgressText'),
    artFrontImage: $('#artFrontImage'),
    artBackImage: $('#artBackImage'),
    artMessage: $('#artMessage'),
    referenceMessage: $('#referenceMessage'),
    spriteTreatment: $('#spriteTreatment'),
    generateSpritesButton: $('#generateSpritesButton'),
    spriteProgress: $('#spriteProgress'),
    spriteFrontCanvas: $('#spriteFrontCanvas'),
    spriteBackCanvas: $('#spriteBackCanvas'),
    spriteMessage: $('#spriteMessage'),
    alphaThreshold: $('#alphaThreshold'),
    edgeSoftness: $('#edgeSoftness'),
    overallOpacity: $('#overallOpacity'),
    pixelSize: $('#pixelSize'),
    canvasPadding: $('#canvasPadding'),
    outlineToggle: $('#outlineToggle'),
    resetRefinementsButton: $('#resetRefinementsButton'),
    continueExportButton: $('#continueExportButton'),
    connectionBadge: $('#connectionBadge'),
    settingsButton: $('#settingsButton'),
    settingsPanel: $('#settingsPanel'),
    apiBaseInput: $('#apiBaseInput'),
    accessTokenInput: $('#accessTokenInput'),
    saveSettingsButton: $('#saveSettingsButton'),
    exportCharacterName: $('#exportCharacterName'),
    visualiserScale: $('#visualiserScale'),
    anchorX: $('#anchorX'),
    anchorY: $('#anchorY'),
    exportMessage: $('#exportMessage'),
  };

  function normalizeApiBase(value) {
    const trimmed = String(value || '').trim();
    return trimmed ? trimmed.replace(/\/+$/, '') : '';
  }

  function endpoint(path) {
    return `${normalizeApiBase(state.apiBase)}${path}`;
  }

  function authHeaders() {
    return state.accessToken ? { 'X-App-Token': state.accessToken } : {};
  }

  function setMessage(element, text = '', type = '') {
    element.textContent = text;
    element.classList.remove('error', 'success');
    if (type) element.classList.add(type);
  }

  function setStep(step) {
    state.step = step;
    elements.panels.forEach((panel) => {
      const active = Number(panel.dataset.panel) === step;
      panel.hidden = !active;
      panel.classList.toggle('active', active);
    });
    elements.steps.forEach((button) => {
      const buttonStep = Number(button.dataset.step);
      button.classList.toggle('active', buttonStep === step);
      button.classList.toggle('done', buttonStep < step);
      button.disabled = buttonStep > maxAvailableStep();
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function maxAvailableStep() {
    if (state.spriteFrontRaw && state.spriteBackRaw) return 4;
    if (state.artFront && state.artBack) return 3;
    return 1;
  }

  function updateStepper() {
    elements.steps.forEach((button) => {
      button.disabled = Number(button.dataset.step) > maxAvailableStep();
    });
  }

  function setReferenceType(type) {
    state.referenceType = type;
    const image = type === 'image';
    elements.imageTab.classList.toggle('active', image);
    elements.imageTab.setAttribute('aria-selected', String(image));
    elements.modelTab.classList.toggle('active', !image);
    elements.modelTab.setAttribute('aria-selected', String(!image));
    elements.imagePanel.hidden = !image;
    elements.imagePanel.classList.toggle('active', image);
    elements.modelPanel.hidden = image;
    elements.modelPanel.classList.toggle('active', !image);
    setMessage(elements.referenceMessage);
  }

  function installDropZone(zone, input, handler) {
    ['dragenter', 'dragover'].forEach((name) => zone.addEventListener(name, (event) => {
      event.preventDefault();
      zone.classList.add('dragover');
    }));
    ['dragleave', 'drop'].forEach((name) => zone.addEventListener(name, (event) => {
      event.preventDefault();
      zone.classList.remove('dragover');
    }));
    zone.addEventListener('drop', (event) => {
      const [file] = event.dataTransfer.files;
      if (file) handler(file);
    });
    input.addEventListener('change', () => {
      const [file] = input.files;
      if (file) handler(file);
    });
  }


  function acceptImage(file) {
    if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) {
      setMessage(elements.referenceMessage, 'Use a PNG, JPG or WebP image.', 'error');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setMessage(elements.referenceMessage, 'The reference image must be 20 MB or smaller.', 'error');
      return;
    }
    state.imageFile = file;
    const url = URL.createObjectURL(file);
    elements.imagePreview.src = url;
    elements.imageDropZone.classList.add('hidden');
    elements.imagePreviewWrap.classList.remove('hidden');
    setMessage(elements.referenceMessage, `${file.name} is ready.`, 'success');
  }

  const MODEL_DIRECT_LIMIT = 50 * 1024 * 1024;
  const MODEL_ARCHIVE_LIMIT = 100 * 1024 * 1024;
  let modelToolingPromise = null;

  function revokeModelResources() {
    if (state.modelUrl) {
      URL.revokeObjectURL(state.modelUrl);
      state.modelUrl = null;
    }
    if (Array.isArray(state.modelAssetUrls)) {
      state.modelAssetUrls.forEach((url) => {
        try { URL.revokeObjectURL(url); } catch {}
      });
    }
    state.modelAssetUrls = [];
  }

  function resetModelCaptures() {
    state.modelFrontBlob = null;
    state.modelBackBlob = null;
    elements.modelFrontCapture.removeAttribute('src');
    elements.modelBackCapture.removeAttribute('src');
  }

  function setLoadedModel(file, url, importKind, message) {
    revokeModelResources();
    state.modelFile = file;
    state.modelUrl = url;
    state.modelImportKind = importKind;
    resetModelCaptures();
    elements.modelViewer.src = state.modelUrl;
    elements.modelDropZone.classList.add('hidden');
    elements.modelStage.classList.remove('hidden');
    setMessage(elements.referenceMessage, message, 'success');
  }

  async function loadModelTooling() {
    if (!modelToolingPromise) {
      modelToolingPromise = Promise.all([
        import('https://esm.sh/jszip@3.10.1'),
        import('https://esm.sh/three@0.179.1'),
        import('https://esm.sh/three@0.179.1/examples/jsm/loaders/ColladaLoader.js'),
        import('https://esm.sh/three@0.179.1/examples/jsm/exporters/GLTFExporter.js'),
      ]).then(([zipModule, threeModule, colladaModule, exporterModule]) => ({
        JSZip: zipModule.default,
        LoadingManager: threeModule.LoadingManager,
        ColladaLoader: colladaModule.ColladaLoader,
        GLTFExporter: exporterModule.GLTFExporter,
      }));
    }
    return modelToolingPromise;
  }

  function normalizeAssetPath(value) {
    let path = String(value || '').trim();
    try { path = decodeURIComponent(path); } catch {}
    path = path.replace(/^file:(?:\/\/)?/i, '');
    path = path.replace(/^[A-Za-z]:[\/]/, '');
    path = path.replace(/\+/g, '/');
    path = path.replace(/^\/+/, '');
    const parts = [];
    for (const piece of path.split('/')) {
      const part = piece.trim();
      if (!part || part === '.') continue;
      if (part === '..') {
        if (parts.length) parts.pop();
        continue;
      }
      parts.push(part);
    }
    return parts.join('/').toLowerCase();
  }

  function pathBasename(value) {
    const normalized = normalizeAssetPath(value);
    const pieces = normalized.split('/');
    return pieces[pieces.length - 1] || normalized;
  }

  function pathDirname(value) {
    const normalized = normalizeAssetPath(value);
    const pieces = normalized.split('/');
    pieces.pop();
    return pieces.join('/');
  }

  function createAssetIndex(entries) {
    const assets = entries.map((entry) => ({
      ...entry,
      normalized: normalizeAssetPath(entry.path),
      basename: pathBasename(entry.path),
    }));
    const exact = new Map();
    const byBase = new Map();
    assets.forEach((asset) => {
      exact.set(asset.normalized, asset);
      if (!byBase.has(asset.basename)) byBase.set(asset.basename, []);
      byBase.get(asset.basename).push(asset);
    });
    return { assets, exact, byBase };
  }

  function candidateScore(assetPath, requestedPath, daeDir) {
    const a = assetPath.split('/');
    const b = requestedPath.split('/');
    let suffix = 0;
    while (suffix < a.length && suffix < b.length && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) suffix += 1;
    let prefix = 0;
    const dirParts = daeDir ? daeDir.split('/') : [];
    while (prefix < a.length && prefix < dirParts.length && a[prefix] === dirParts[prefix]) prefix += 1;
    return (suffix * 100) + prefix;
  }

  function matchArchivedAsset(requestedUrl, daeDir, index) {
    const direct = normalizeAssetPath(requestedUrl);
    const joined = daeDir ? normalizeAssetPath(`${daeDir}/${direct}`) : direct;
    const variants = [...new Set([direct, joined].filter(Boolean))];
    for (const variant of variants) {
      if (index.exact.has(variant)) return index.exact.get(variant);
    }
    const basename = pathBasename(requestedUrl);
    const list = index.byBase.get(basename) || [];
    if (!list.length) return null;
    const requested = joined || direct || basename;
    return [...list].sort((left, right) => candidateScore(right.normalized, requested, daeDir) - candidateScore(left.normalized, requested, daeDir))[0] || null;
  }

  async function exportSceneAsGlb(scene, GLTFExporter) {
    const exporter = new GLTFExporter();
    const arrayBuffer = await new Promise((resolve, reject) => {
      exporter.parse(scene, (result) => {
        if (result instanceof ArrayBuffer) return resolve(result);
        try {
          resolve(new TextEncoder().encode(JSON.stringify(result)).buffer);
        } catch (error) {
          reject(error);
        }
      }, (error) => reject(error), {
        binary: true,
        onlyVisible: true,
        trs: false,
        maxTextureSize: 2048,
      });
    });
    return new Blob([arrayBuffer], { type: 'model/gltf-binary' });
  }

  async function loadDirectModel(file) {
    if (file.size > MODEL_DIRECT_LIMIT) {
      setMessage(elements.referenceMessage, 'Direct GLB, glTF, or DAE uploads must be 50 MB or smaller.', 'error');
      return;
    }
    if (/\.dae$/i.test(file.name)) {
      await importStandaloneDae(file);
      return;
    }
    const url = URL.createObjectURL(file);
    setLoadedModel(file, url, /\.gltf$/i.test(file.name) ? 'gltf' : 'glb', 'Model loaded. Rotate it and capture the front and rear reference angles.');
  }

  async function importStandaloneDae(file) {
    setMessage(elements.referenceMessage, 'Converting DAE to GLB in the browser…', 'success');
    const { LoadingManager, ColladaLoader, GLTFExporter } = await loadModelTooling();
    const daeText = await file.text();
    const manager = new LoadingManager();
    const loader = new ColladaLoader(manager);
    const collada = loader.parse(daeText, '');
    const glbBlob = await exportSceneAsGlb(collada.scene, GLTFExporter);
    const converted = new File([glbBlob], `${file.name.replace(/\.dae$/i, '') || 'converted-model'}.glb`, { type: 'model/gltf-binary' });
    const url = URL.createObjectURL(converted);
    setLoadedModel(converted, url, 'dae-converted', 'DAE converted to GLB successfully. Rotate it and capture the front and rear reference angles.');
  }

  async function importModelArchive(file) {
    if (file.size > MODEL_ARCHIVE_LIMIT) {
      setMessage(elements.referenceMessage, 'ZIP model archives must be 100 MB or smaller.', 'error');
      return;
    }
    setMessage(elements.referenceMessage, 'Unpacking ZIP and searching for a DAE model…', 'success');
    const { JSZip, LoadingManager, ColladaLoader, GLTFExporter } = await loadModelTooling();
    const zip = await JSZip.loadAsync(file);
    const entries = Object.values(zip.files).filter((entry) => !entry.dir);
    const daeEntries = entries.filter((entry) => /\.dae$/i.test(entry.name));
    if (!daeEntries.length) throw new Error('The ZIP does not contain a .dae model file.');
    if (daeEntries.length > 1) throw new Error('The ZIP contains multiple .dae files. Please keep one model per ZIP for now.');
    const daeEntry = daeEntries[0];
    const daePath = normalizeAssetPath(daeEntry.name);
    const daeDir = pathDirname(daePath);

    const extracted = [];
    try {
      let extractedBytes = 0;
      for (const entry of entries) {
        const blob = await entry.async('blob');
        extractedBytes += blob.size;
        if (extractedBytes > 250 * 1024 * 1024) throw new Error('The extracted ZIP contents are too large for the in-browser converter.');
        extracted.push({ path: entry.name, blob, url: URL.createObjectURL(blob) });
      }

      const daeBlob = extracted.find((entry) => normalizeAssetPath(entry.path) === daePath);
      if (!daeBlob) throw new Error('The DAE file could not be extracted from the ZIP.');
      const daeText = await daeBlob.blob.text();
      const index = createAssetIndex(extracted.filter((entry) => normalizeAssetPath(entry.path) !== daePath));
      const manager = new LoadingManager();
      manager.setURLModifier((url) => {
        const asset = matchArchivedAsset(url, daeDir, index);
        return asset?.url || url;
      });

      const loader = new ColladaLoader(manager);
      const collada = loader.parse(daeText, daeDir ? `${daeDir}/` : '');
      const glbBlob = await exportSceneAsGlb(collada.scene, GLTFExporter);
      const converted = new File([glbBlob], `${file.name.replace(/\.zip$/i, '') || 'converted-model'}.glb`, { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(converted);
      revokeModelResources();
      state.modelAssetUrls = extracted.map((entry) => entry.url);
      state.modelFile = converted;
      state.modelUrl = url;
      state.modelImportKind = 'zip-collada';
      resetModelCaptures();
      elements.modelViewer.src = state.modelUrl;
      elements.modelDropZone.classList.add('hidden');
      elements.modelStage.classList.remove('hidden');
      setMessage(elements.referenceMessage, `ZIP unpacked and DAE converted to GLB. Found ${index.assets.length} supporting asset${index.assets.length === 1 ? '' : 's'}. Rotate the model and capture the front and rear reference angles.`, 'success');
    } catch (error) {
      extracted.forEach((entry) => {
        try { URL.revokeObjectURL(entry.url); } catch {}
      });
      throw error;
    }
  }

  async function acceptModel(file) {
    if (!/\.(glb|gltf|dae|zip)$/i.test(file.name)) {
      setMessage(elements.referenceMessage, 'Use a GLB, glTF, DAE, or ZIP model package.', 'error');
      return;
    }

    try {
      if (/\.zip$/i.test(file.name)) {
        await importModelArchive(file);
        return;
      }
      await loadDirectModel(file);
    } catch (error) {
      revokeModelResources();
      state.modelFile = null;
      state.modelImportKind = '';
      resetModelCaptures();
      setMessage(elements.referenceMessage, `Model import failed: ${error.message}`, 'error');
    }
  }

  async function captureModel(kind) {
    if (!state.modelFile || !elements.modelViewer.modelIsVisible) {
      setMessage(elements.referenceMessage, 'Wait for the model to finish loading.', 'error');
      return;
    }
    try {
      const blob = await elements.modelViewer.toBlob({ mimeType: 'image/png', idealAspect: true });
      const url = URL.createObjectURL(blob);
      if (kind === 'front') {
        state.modelFrontBlob = blob;
        elements.modelFrontCapture.src = url;
      } else {
        state.modelBackBlob = blob;
        elements.modelBackCapture.src = url;
      }
      setMessage(elements.referenceMessage, `${kind === 'front' ? 'Front' : 'Rear'} model reference captured.`, 'success');
    } catch (error) {
      setMessage(elements.referenceMessage, `Could not capture the model: ${error.message}`, 'error');
    }
  }

  function validateReference() {
    if (state.referenceType === 'image' && !state.imageFile) return 'Upload a character image first.';
    if (state.referenceType === 'model' && !state.modelFrontBlob) return 'Capture at least the model’s front 3/4 reference first.';
    if (!elements.descriptionInput.value.trim()) return 'Add a short description so the renderer knows what must be preserved.';
    return '';
  }

  function addGenerationFields(form) {
    form.append('name', elements.characterName.value.trim() || 'Untitled character');
    form.append('description', elements.descriptionInput.value.trim());
    form.append('pose', elements.poseSelect.value);
    form.append('artTreatment', elements.artTreatment.value);
    form.append('quality', elements.qualitySelect.value);
    form.append('fidelity', elements.fidelityRange.value);
    form.append('lookBack', String(elements.lookBackToggle.checked));
    form.append('outerGarmentType', elements.outerGarmentType.value);
    form.append('outerGarmentBack', elements.outerGarmentBack.value);
    form.append('outerGarmentAttachment', elements.outerGarmentAttachment.value);
    form.append('garmentSymmetry', String(elements.garmentSymmetryToggle.checked));
  }

  async function apiRequest(path, options = {}) {
    const response = await fetch(endpoint(path), {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) },
    });
    let payload = null;
    const text = await response.text();
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = { error: text || `HTTP ${response.status}` }; }
    if (!response.ok) {
      const error = new Error(payload.error || payload.message || `Renderer request failed (${response.status}).`);
      error.status = response.status;
      error.code = payload.code;
      error.retryAttempted = Boolean(payload.retryAttempted);
      throw error;
    }
    return payload;
  }

  function base64ToDataUrl(base64) {
    if (!base64) return null;
    return base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
  }


  async function resizeImageForAi(blob, filename) {
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = await loadImage(objectUrl);
      const maximumSide = 510;
      const sourceWidth = image.naturalWidth || image.width;
      const sourceHeight = image.naturalHeight || image.height;
      const scale = Math.min(1, maximumSide / Math.max(sourceWidth, sourceHeight));
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = maximumSide;
      canvas.height = maximumSide;
      const context = canvas.getContext('2d');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, maximumSide, maximumSide);
      const x = Math.round((maximumSide - width) / 2);
      const y = Math.round((maximumSide - height) / 2);
      context.drawImage(image, x, y, width, height);
      const resized = await canvasToBlob(canvas);
      return new File([resized], filename, { type: 'image/png' });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }


  async function cropImageForAi(blob, filename, mode) {
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = await loadImage(objectUrl);
      const sourceWidth = image.naturalWidth || image.width;
      const sourceHeight = image.naturalHeight || image.height;
      let crop = null;
      if (mode === 'upper') {
        const cropWidth = Math.round(sourceWidth * 0.72);
        const cropHeight = Math.round(sourceHeight * 0.5);
        crop = {
          sx: Math.max(0, Math.round((sourceWidth - cropWidth) / 2)),
          sy: 0,
          sw: Math.max(1, cropWidth),
          sh: Math.max(1, cropHeight),
        };
      } else {
        const cropWidth = Math.round(sourceWidth * 0.86);
        const cropHeight = Math.round(sourceHeight * 0.58);
        crop = {
          sx: Math.max(0, Math.round((sourceWidth - cropWidth) / 2)),
          sy: Math.max(0, Math.round(sourceHeight * 0.38)),
          sw: Math.max(1, cropWidth),
          sh: Math.max(1, Math.min(cropHeight, sourceHeight - Math.round(sourceHeight * 0.38))),
        };
      }
      const maximumSide = 510;
      const scale = Math.min(1, maximumSide / Math.max(crop.sw, crop.sh));
      const width = Math.max(1, Math.round(crop.sw * scale));
      const height = Math.max(1, Math.round(crop.sh * scale));
      const canvas = document.createElement('canvas');
      canvas.width = maximumSide;
      canvas.height = maximumSide;
      const context = canvas.getContext('2d');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, maximumSide, maximumSide);
      const x = Math.round((maximumSide - width) / 2);
      const y = Math.round((maximumSide - height) / 2);
      context.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, x, y, width, height);
      const resized = await canvasToBlob(canvas);
      return new File([resized], filename, { type: 'image/png' });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function splitGeneratedPair(dataUrl) {
    const image = await loadImage(dataUrl);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (width < 2 || height < 2) throw new Error('Generated pair image is too small to split.');

    const source = document.createElement('canvas');
    source.width = width;
    source.height = height;
    const sourceContext = source.getContext('2d', { willReadFrequently: true });
    sourceContext.fillStyle = '#FFFFFF';
    sourceContext.fillRect(0, 0, width, height);
    sourceContext.drawImage(image, 0, 0, width, height);

    // FLUX is instructed to leave a white centre gutter. Locate the quietest
    // vertical band near the middle instead of assuming it obeyed an exact 50/50 split.
    const pixels = sourceContext.getImageData(0, 0, width, height).data;
    const start = Math.max(1, Math.floor(width * 0.38));
    const end = Math.min(width - 2, Math.ceil(width * 0.62));
    const scores = new Float64Array(width);
    const yStep = Math.max(1, Math.floor(height / 256));
    for (let x = start; x <= end; x += 1) {
      let score = 0;
      for (let y = 0; y < height; y += yStep) {
        const index = (y * width + x) * 4;
        const alpha = pixels[index + 3] / 255;
        const colourDistance = Math.abs(255 - pixels[index]) + Math.abs(255 - pixels[index + 1]) + Math.abs(255 - pixels[index + 2]);
        score += colourDistance * alpha;
      }
      scores[x] = score;
    }

    let split = Math.floor(width / 2);
    let bestScore = Number.POSITIVE_INFINITY;
    const radius = Math.max(2, Math.round(width * 0.003));
    for (let x = start + radius; x <= end - radius; x += 1) {
      let smoothed = 0;
      for (let offset = -radius; offset <= radius; offset += 1) smoothed += scores[x + offset];
      // A tiny centre preference avoids selecting a white gap inside flowing hair or a cape.
      smoothed += Math.abs(x - width / 2) * 0.02;
      if (smoothed < bestScore) {
        bestScore = smoothed;
        split = x;
      }
    }

    const halfGutter = Math.max(2, Math.round(width * 0.006));
    const leftWidth = Math.max(1, split - halfGutter);
    const rightStart = Math.min(width - 1, split + halfGutter);
    const rightWidth = Math.max(1, width - rightStart);
    const panelWidth = Math.max(leftWidth, rightWidth);

    const makePanel = (sx, sw) => {
      const panel = document.createElement('canvas');
      panel.width = panelWidth;
      panel.height = height;
      const context = panel.getContext('2d');
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, panelWidth, height);
      const dx = Math.round((panelWidth - sw) / 2);
      context.drawImage(source, sx, 0, sw, height, dx, 0, sw, height);
      return panel.toDataURL('image/png');
    };

    return {
      front: makePanel(0, leftWidth),
      back: makePanel(rightStart, rightWidth),
    };
  }

  async function removeConnectedBackground(dataUrl) {
    const image = await loadImage(dataUrl);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data;

    const samplePixels = [];
    const sample = (x, y) => {
      const index = (y * width + x) * 4;
      if (data[index + 3] > 10) samplePixels.push([data[index], data[index + 1], data[index + 2]]);
    };
    const divisions = 12;
    for (let step = 0; step <= divisions; step += 1) {
      const x = Math.min(width - 1, Math.round((width - 1) * step / divisions));
      const y = Math.min(height - 1, Math.round((height - 1) * step / divisions));
      sample(x, 0); sample(x, height - 1); sample(0, y); sample(width - 1, y);
    }
    const background = samplePixels.length
      ? samplePixels.reduce((sum, pixel) => [sum[0] + pixel[0], sum[1] + pixel[1], sum[2] + pixel[2]], [0, 0, 0]).map((value) => value / samplePixels.length)
      : [255, 255, 255];

    const threshold = 34;
    const softness = 28;
    const cutoff = threshold + softness;
    const pixelCount = width * height;
    const visited = new Uint8Array(pixelCount);
    const queue = new Uint32Array(pixelCount);
    let head = 0;
    let tail = 0;

    const distanceAt = (pixel) => {
      const index = pixel * 4;
      const dr = data[index] - background[0];
      const dg = data[index + 1] - background[1];
      const db = data[index + 2] - background[2];
      return Math.sqrt(dr * dr + dg * dg + db * db);
    };
    const enqueue = (pixel) => {
      if (visited[pixel] || distanceAt(pixel) > cutoff) return;
      visited[pixel] = 1;
      queue[tail++] = pixel;
    };

    for (let x = 0; x < width; x += 1) {
      enqueue(x);
      enqueue((height - 1) * width + x);
    }
    for (let y = 0; y < height; y += 1) {
      enqueue(y * width);
      enqueue(y * width + width - 1);
    }

    while (head < tail) {
      const pixel = queue[head++];
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      const distance = distanceAt(pixel);
      const index = pixel * 4;
      const alphaFactor = distance <= threshold ? 0 : Math.min(1, (distance - threshold) / softness);
      data[index + 3] = Math.round(data[index + 3] * alphaFactor);
      if (x > 0) enqueue(pixel - 1);
      if (x + 1 < width) enqueue(pixel + 1);
      if (y > 0) enqueue(pixel - width);
      if (y + 1 < height) enqueue(pixel + width);
    }

    context.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }

  async function generateArt() {
    const validationError = validateReference();
    if (validationError) {
      setMessage(elements.referenceMessage, validationError, 'error');
      return;
    }

    setMessage(elements.referenceMessage);
    setMessage(elements.artMessage);
    setStep(2);
    elements.artProgress.classList.remove('hidden');
    elements.artProgressTitle.textContent = 'Generating one matched turnaround sheet…';
    elements.artProgressText.textContent = 'FLUX.2 is drawing the front and rear together on one canvas so design decisions are shared. Upper and lower detail crops are also provided to stabilise capes, cloaks, sleeves, and layered hems.';
    elements.generateArtButton.disabled = true;
    elements.retryArtButton.disabled = true;
    elements.makeSpriteButton.disabled = true;
    const ticket = ++state.renderTicket;
    state.artFront = null;
    state.artBack = null;
    state.spriteFrontRaw = null;
    state.spriteBackRaw = null;

    try {
      const sourceFront = state.referenceType === 'image' ? state.imageFile : state.modelFrontBlob;
      const sourceBack = state.referenceType === 'model' ? state.modelBackBlob : null;
      const [referenceFront, referenceFrontUpper, referenceFrontLower, referenceBack] = await Promise.all([
        resizeImageForAi(sourceFront, 'reference-front.png'),
        cropImageForAi(sourceFront, 'reference-front-upper-detail.png', 'upper'),
        cropImageForAi(sourceFront, 'reference-front-lower-detail.png', 'lower'),
        sourceBack ? resizeImageForAi(sourceBack, 'reference-back.png') : Promise.resolve(null),
      ]);

      const pairForm = new FormData();
      addGenerationFields(pairForm);
      pairForm.append('direction', 'pair');
      pairForm.append('sourceType', state.referenceType);
      pairForm.append('referenceFront', referenceFront, referenceFront.name);
      if (referenceBack) pairForm.append('referenceBack', referenceBack, referenceBack.name);
      pairForm.append('referenceFrontUpper', referenceFrontUpper, referenceFrontUpper.name);
      pairForm.append('referenceFrontLower', referenceFrontLower, referenceFrontLower.name);

      const pairPayload = await apiRequest('/api/render', { method: 'POST', body: pairForm });
      if (ticket !== state.renderTicket) return;

      elements.artProgressTitle.textContent = 'Turnaround complete — separating the two views…';
      elements.artProgressText.textContent = 'The centre gutter is being detected, then each panel is cleaned to transparency.';
      const pair = await splitGeneratedPair(base64ToDataUrl(pairPayload.image));
      const [front, back] = await Promise.all([
        removeConnectedBackground(pair.front),
        removeConnectedBackground(pair.back),
      ]);
      if (ticket !== state.renderTicket) return;

      state.artFront = front;
      state.artBack = back;
      elements.artFrontImage.src = state.artFront;
      elements.artBackImage.src = state.artBack;
      setMessage(elements.artMessage, 'Matched directional art generated from one shared turnaround sheet.', 'success');
      updateStepper();
    } catch (error) {
      setMessage(elements.artMessage, friendlyError(error), 'error');
    } finally {
      if (ticket === state.renderTicket) {
        elements.artProgress.classList.add('hidden');
        elements.generateArtButton.disabled = false;
        elements.retryArtButton.disabled = false;
        elements.makeSpriteButton.disabled = !(state.artFront && state.artBack);
      }
    }
  }

  async function generateSprites() {
    if (!state.artFront || !state.artBack) {
      setMessage(elements.spriteMessage, 'Generate the directional art first.', 'error');
      return;
    }
    setStep(3);
    setMessage(elements.spriteMessage);
    elements.spriteProgress.classList.remove('hidden');
    elements.generateSpritesButton.disabled = true;
    elements.continueExportButton.disabled = true;

    try {
      const artFront = await resizeImageForAi(dataUrlToBlob(state.artFront), 'art-front.png');
      const artBack = await resizeImageForAi(dataUrlToBlob(state.artBack), 'art-back.png');
      const form = new FormData();
      form.append('direction', 'pair');
      form.append('name', elements.characterName.value.trim() || 'Untitled character');
      form.append('description', elements.descriptionInput.value.trim());
      form.append('treatment', elements.spriteTreatment.value);
      form.append('quality', elements.qualitySelect.value);
      form.append('artFront', artFront, artFront.name);
      form.append('artBack', artBack, artBack.name);

      const payload = await apiRequest('/api/sprite', { method: 'POST', body: form });
      const pair = await splitGeneratedPair(base64ToDataUrl(payload.image));
      state.spriteFrontRaw = pair.front;
      state.spriteBackRaw = pair.back;
      await renderSpriteCanvases();
      setMessage(elements.spriteMessage, 'Matched sprite pair generated from one shared sprite sheet. Refine the alpha and scale before exporting.', 'success');
      updateStepper();
    } catch (error) {
      setMessage(elements.spriteMessage, friendlyError(error), 'error');
    } finally {
      elements.spriteProgress.classList.add('hidden');
      elements.generateSpritesButton.disabled = false;
      elements.continueExportButton.disabled = !(state.spriteFrontRaw && state.spriteBackRaw);
    }
  }

  function friendlyError(error) {
    if (error.status === 404) return 'Renderer endpoint not found. Open Settings and connect the Cloudflare Pages deployment.';
    if (error.status === 401 || error.status === 403) return 'Renderer access was rejected. Check the optional APP_ACCESS_TOKEN in Settings.';
    if (error.status === 503) return 'Cloudflare Workers AI is not connected. Confirm the [ai] binding is named AI and redeploy.';
    if (error.status === 413) return 'The uploaded files are too large for the renderer.';
    if (error.code === 3030 || error.status === 422) {
      return error.message || 'Cloudflare’s image safety filter rejected this reference after an automatic safer retry. Try a neutral single-character reference and remove anatomy or age wording from the description.';
    }
    return error.message || 'The renderer could not complete the request.';
  }

  function dataUrlToBlob(dataUrl) {
    const [header, data] = dataUrl.split(',');
    const mime = /data:([^;]+)/.exec(header)?.[1] || 'image/png';
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Generated image could not be loaded.'));
      image.src = src;
    });
  }

  function sampleBackground(imageData, width, height) {
    const samplePoints = [
      [2, 2], [width - 3, 2], [2, height - 3], [width - 3, height - 3],
      [Math.floor(width / 2), 2], [2, Math.floor(height / 2)],
    ];
    let r = 0; let g = 0; let b = 0; let count = 0;
    for (const [x, y] of samplePoints) {
      const index = (y * width + x) * 4;
      if (imageData[index + 3] > 10) {
        r += imageData[index]; g += imageData[index + 1]; b += imageData[index + 2]; count += 1;
      }
    }
    return count ? [r / count, g / count, b / count] : [255, 255, 255];
  }

  function applyAlphaAndOutline(imageData, width, height, options) {
    const data = imageData.data;
    const bg = sampleBackground(data, width, height);
    const threshold = options.threshold;
    const softness = Math.max(1, options.softness);
    const opacity = options.opacity / 100;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const dr = data[i] - bg[0];
      const dg = data[i + 1] - bg[1];
      const db = data[i + 2] - bg[2];
      const distance = Math.sqrt(dr * dr + dg * dg + db * db);
      let alphaFactor = 1;
      if (distance <= threshold) alphaFactor = 0;
      else if (distance < threshold + softness) alphaFactor = (distance - threshold) / softness;
      data[i + 3] = Math.round(data[i + 3] * alphaFactor * opacity);
    }

    if (!options.outline) return imageData;
    const original = new Uint8ClampedArray(data);
    const neighbours = [-1, 1, -width, width, -width - 1, -width + 1, width - 1, width + 1];
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const pixel = y * width + x;
        const index = pixel * 4;
        if (original[index + 3] > 18) continue;
        let touches = false;
        for (const offset of neighbours) {
          if (original[(pixel + offset) * 4 + 3] > 95) { touches = true; break; }
        }
        if (touches) {
          data[index] = 28;
          data[index + 1] = 18;
          data[index + 2] = 35;
          data[index + 3] = Math.round(210 * opacity);
        }
      }
    }
    return imageData;
  }

  async function renderSpriteToCanvas(src, canvas) {
    const image = await loadImage(src);
    const width = canvas.width;
    const height = canvas.height;
    const padding = Number(elements.canvasPadding.value) / 100;
    const pixelBlock = Number(elements.pixelSize.value);
    const workCanvas = document.createElement('canvas');
    workCanvas.width = width;
    workCanvas.height = height;
    const ctx = workCanvas.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, width, height);
    const availableWidth = width * (1 - padding * 2);
    const availableHeight = height * (1 - padding * 2);
    const scale = Math.min(availableWidth / image.width, availableHeight / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const x = (width - drawWidth) / 2;
    const y = height - height * padding - drawHeight;
    ctx.drawImage(image, x, y, drawWidth, drawHeight);

    const processed = applyAlphaAndOutline(ctx.getImageData(0, 0, width, height), width, height, {
      threshold: Number(elements.alphaThreshold.value),
      softness: Number(elements.edgeSoftness.value),
      opacity: Number(elements.overallOpacity.value),
      outline: elements.outlineToggle.checked,
    });
    ctx.putImageData(processed, 0, 0);

    const output = canvas.getContext('2d');
    output.clearRect(0, 0, width, height);
    if (pixelBlock <= 1) {
      output.imageSmoothingEnabled = true;
      output.drawImage(workCanvas, 0, 0);
      return;
    }

    const tiny = document.createElement('canvas');
    tiny.width = Math.max(1, Math.floor(width / pixelBlock));
    tiny.height = Math.max(1, Math.floor(height / pixelBlock));
    const tinyCtx = tiny.getContext('2d');
    tinyCtx.imageSmoothingEnabled = true;
    tinyCtx.drawImage(workCanvas, 0, 0, tiny.width, tiny.height);
    output.imageSmoothingEnabled = false;
    output.drawImage(tiny, 0, 0, tiny.width, tiny.height, 0, 0, width, height);
  }

  async function renderSpriteCanvases() {
    if (!state.spriteFrontRaw || !state.spriteBackRaw) return;
    await Promise.all([
      renderSpriteToCanvas(state.spriteFrontRaw, elements.spriteFrontCanvas),
      renderSpriteToCanvas(state.spriteBackRaw, elements.spriteBackCanvas),
    ]);
  }

  let refineFrame = null;
  function scheduleRefinement() {
    updateRangeLabels();
    cancelAnimationFrame(refineFrame);
    refineFrame = requestAnimationFrame(() => renderSpriteCanvases().catch((error) => {
      setMessage(elements.spriteMessage, error.message, 'error');
    }));
  }

  function updateRangeLabels() {
    $('#alphaThresholdValue').textContent = elements.alphaThreshold.value;
    $('#edgeSoftnessValue').textContent = elements.edgeSoftness.value;
    $('#overallOpacityValue').textContent = elements.overallOpacity.value;
    $('#pixelSizeValue').textContent = elements.pixelSize.value;
    $('#canvasPaddingValue').textContent = elements.canvasPadding.value;
    elements.fidelityValue.textContent = ['Flexible', 'Balanced', 'Strict'][Number(elements.fidelityRange.value) - 1];
  }

  function resetRefinements() {
    elements.alphaThreshold.value = 28;
    elements.edgeSoftness.value = 18;
    elements.overallOpacity.value = 100;
    elements.pixelSize.value = 1;
    elements.canvasPadding.value = 6;
    elements.outlineToggle.checked = true;
    scheduleRefinement();
  }

  function safeName(value) {
    return (value || 'character').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'character';
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadDataUrl(dataUrl, filename) {
    downloadBlob(dataUrlToBlob(dataUrl), filename);
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG export failed.')), 'image/png'));
  }

  async function downloadNamedAsset(kind) {
    const name = safeName(elements.characterName.value);
    if (kind === 'art-front' && state.artFront) downloadDataUrl(state.artFront, `${name}-front34-art.png`);
    if (kind === 'art-back' && state.artBack) downloadDataUrl(state.artBack, `${name}-back34-art.png`);
    if (kind === 'sprite-front' && state.spriteFrontRaw) downloadBlob(await canvasToBlob(elements.spriteFrontCanvas), `${name}-front34-sprite.png`);
    if (kind === 'sprite-back' && state.spriteBackRaw) downloadBlob(await canvasToBlob(elements.spriteBackCanvas), `${name}-back34-sprite.png`);
  }

  function createManifest(includeImages = false) {
    const name = elements.characterName.value.trim() || 'Untitled character';
    const manifest = {
      format: 'SMB Visualiser Character Sprite',
      extension: '.smbsprite',
      version: 1,
      createdAt: new Date().toISOString(),
      character: {
        name,
        description: elements.descriptionInput.value.trim(),
        sourceType: state.referenceType,
        pose: elements.poseSelect.value,
      },
      directions: {
        front34: { mirrorFor: 'front34-opposite' },
        back34: { mirrorFor: 'back34-opposite' },
      },
      visualiser: {
        scale: Number(elements.visualiserScale.value),
        anchor: { x: Number(elements.anchorX.value), y: Number(elements.anchorY.value) },
        alpha: {
          threshold: Number(elements.alphaThreshold.value),
          edgeSoftness: Number(elements.edgeSoftness.value),
          opacity: Number(elements.overallOpacity.value) / 100,
        },
        pixelBlock: Number(elements.pixelSize.value),
        paddingPercent: Number(elements.canvasPadding.value),
        outline: elements.outlineToggle.checked,
      },
      generator: {
        application: 'Visualiser Character Studio',
        provider: 'Cloudflare Workers AI',
        model: '@cf/black-forest-labs/flux-2-klein-4b',
        artTreatment: elements.artTreatment.value,
        spriteTreatment: elements.spriteTreatment.value,
      },
    };
    if (includeImages) {
      manifest.images = {
        artFront: state.artFront,
        artBack: state.artBack,
        spriteFront: elements.spriteFrontCanvas.toDataURL('image/png'),
        spriteBack: elements.spriteBackCanvas.toDataURL('image/png'),
      };
    }
    return manifest;
  }

  async function downloadPair(type) {
    const name = safeName(elements.characterName.value);
    if (type === 'art') {
      downloadDataUrl(state.artFront, `${name}-front34-art.png`);
      setTimeout(() => downloadDataUrl(state.artBack, `${name}-back34-art.png`), 350);
    } else {
      downloadBlob(await canvasToBlob(elements.spriteFrontCanvas), `${name}-front34-sprite.png`);
      setTimeout(async () => downloadBlob(await canvasToBlob(elements.spriteBackCanvas), `${name}-back34-sprite.png`), 350);
    }
  }

  function downloadManifest(includeImages) {
    const manifest = createManifest(includeImages);
    const extension = includeImages ? 'smbsprite' : 'json';
    const mime = includeImages ? 'application/vnd.smb.visualiser-sprite+json' : 'application/json';
    downloadBlob(new Blob([JSON.stringify(manifest, null, includeImages ? 0 : 2)], { type: mime }), `${safeName(manifest.character.name)}.${extension}`);
    setMessage(elements.exportMessage, includeImages ? 'Character package downloaded.' : 'Manifest downloaded.', 'success');
  }

  async function checkConnection() {
    elements.connectionBadge.textContent = 'Checking renderer…';
    elements.connectionBadge.classList.remove('online', 'offline');
    try {
      const response = await fetch(endpoint('/api/health'), { headers: authHeaders(), cache: 'no-store' });
      if (!response.ok) throw new Error();
      const data = await response.json();
      elements.connectionBadge.textContent = `Renderer online · ${data.model || 'configured'}`;
      elements.connectionBadge.classList.add('online');
    } catch {
      const githubPages = location.hostname.endsWith('github.io');
      elements.connectionBadge.textContent = githubPages ? 'Static preview · connect API' : 'Renderer not connected';
      elements.connectionBadge.classList.add('offline');
    }
  }

  function resetProject() {
    revokeModelResources();
    state.imageFile = null;
    state.modelFile = null;
    state.modelFrontBlob = null;
    state.modelBackBlob = null;
    state.modelImportKind = '';
    state.artFront = null;
    state.artBack = null;
    state.spriteFrontRaw = null;
    state.spriteBackRaw = null;
    elements.imageInput.value = '';
    elements.modelInput.value = '';
    elements.imagePreview.removeAttribute('src');
    elements.imagePreviewWrap.classList.add('hidden');
    elements.imageDropZone.classList.remove('hidden');
    elements.modelStage.classList.add('hidden');
    elements.modelDropZone.classList.remove('hidden');
    elements.modelViewer.removeAttribute('src');
    elements.modelFrontCapture.removeAttribute('src');
    elements.modelBackCapture.removeAttribute('src');
    elements.characterName.value = '';
    elements.descriptionInput.value = '';
    elements.descriptionCount.textContent = '0';
    setReferenceType('image');
    setStep(1);
    updateStepper();
  }

  function bindEvents() {
    elements.imageTab.addEventListener('click', () => setReferenceType('image'));
    elements.modelTab.addEventListener('click', () => setReferenceType('model'));
    installDropZone(elements.imageDropZone, elements.imageInput, acceptImage);
    installDropZone(elements.modelDropZone, elements.modelInput, acceptModel);
    elements.replaceImageButton.addEventListener('click', () => elements.imageInput.click());
    elements.captureFrontButton.addEventListener('click', () => captureModel('front'));
    elements.captureBackButton.addEventListener('click', () => captureModel('back'));
    elements.descriptionInput.addEventListener('input', () => { elements.descriptionCount.textContent = elements.descriptionInput.value.length; });
    elements.fidelityRange.addEventListener('input', updateRangeLabels);
    elements.generateArtButton.addEventListener('click', generateArt);
    elements.retryArtButton.addEventListener('click', generateArt);
    elements.makeSpriteButton.addEventListener('click', () => { setStep(3); generateSprites(); });
    elements.generateSpritesButton.addEventListener('click', generateSprites);

    ['alphaThreshold', 'edgeSoftness', 'overallOpacity', 'pixelSize', 'canvasPadding'].forEach((key) => {
      elements[key].addEventListener('input', scheduleRefinement);
    });
    elements.outlineToggle.addEventListener('change', scheduleRefinement);
    elements.resetRefinementsButton.addEventListener('click', resetRefinements);

    $('#backToReferenceButton').addEventListener('click', () => setStep(1));
    $('#backToArtButton').addEventListener('click', () => setStep(2));
    $('#backToSpritesButton').addEventListener('click', () => setStep(3));
    elements.continueExportButton.addEventListener('click', () => {
      elements.exportCharacterName.textContent = elements.characterName.value.trim() || 'Untitled character';
      setStep(4);
    });

    elements.steps.forEach((button) => button.addEventListener('click', () => {
      const step = Number(button.dataset.step);
      if (!button.disabled) setStep(step);
    }));

    $$('[data-download]').forEach((button) => button.addEventListener('click', () => downloadNamedAsset(button.dataset.download)));
    $('#downloadArtPairButton').addEventListener('click', () => downloadPair('art'));
    $('#downloadSpritePairButton').addEventListener('click', () => downloadPair('sprite'));
    $('#downloadPackButton').addEventListener('click', () => downloadManifest(true));
    $('#downloadManifestButton').addEventListener('click', () => downloadManifest(false));
    $('#startOverButton').addEventListener('click', resetProject);

    elements.settingsButton.addEventListener('click', () => {
      elements.apiBaseInput.value = state.apiBase;
      elements.accessTokenInput.value = state.accessToken;
      elements.settingsPanel.showModal();
      elements.settingsButton.setAttribute('aria-expanded', 'true');
    });
    elements.settingsPanel.addEventListener('close', () => elements.settingsButton.setAttribute('aria-expanded', 'false'));
    elements.saveSettingsButton.addEventListener('click', (event) => {
      event.preventDefault();
      state.apiBase = normalizeApiBase(elements.apiBaseInput.value);
      state.accessToken = elements.accessTokenInput.value;
      localStorage.setItem('vcs_api_base', state.apiBase);
      sessionStorage.setItem('vcs_access_token', state.accessToken);
      elements.settingsPanel.close();
      checkConnection();
    });
  }

  async function init() {
    bindEvents();
    updateRangeLabels();
    updateStepper();
    setStep(1);
    await checkConnection();
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', async () => {
        try {
          const registration = await navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' });
          await registration.update();
        } catch {
          // The studio remains usable without offline caching.
        }
      });
    }
  }

  init();
})();
