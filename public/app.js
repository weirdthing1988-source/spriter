(() => {
  'use strict';

  const state = {
    step: 1,
    referenceType: 'image',
    imageFile: null,
    modelFile: null,
    modelUrl: null,
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

  function acceptModel(file) {
    if (!/\.(glb|gltf)$/i.test(file.name)) {
      setMessage(elements.referenceMessage, 'Use a GLB or glTF model. GLB is recommended.', 'error');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setMessage(elements.referenceMessage, 'The model must be 50 MB or smaller.', 'error');
      return;
    }
    if (state.modelUrl) URL.revokeObjectURL(state.modelUrl);
    state.modelFile = file;
    state.modelUrl = URL.createObjectURL(file);
    state.modelFrontBlob = null;
    state.modelBackBlob = null;
    elements.modelFrontCapture.removeAttribute('src');
    elements.modelBackCapture.removeAttribute('src');
    elements.modelViewer.src = state.modelUrl;
    elements.modelDropZone.classList.add('hidden');
    elements.modelStage.classList.remove('hidden');
    setMessage(elements.referenceMessage, 'Rotate the model and capture the front and rear reference angles.', 'success');
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
    elements.artProgressTitle.textContent = 'Preparing the character reference…';
    elements.artProgressText.textContent = 'Optimising the reference for FLUX.2 Klein, then generating the front view.';
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
      const referenceFront = await resizeImageForAi(sourceFront, 'reference-front.png');
      const referenceBack = sourceBack ? await resizeImageForAi(sourceBack, 'reference-back.png') : null;

      const frontForm = new FormData();
      addGenerationFields(frontForm);
      frontForm.append('direction', 'front');
      frontForm.append('sourceType', state.referenceType);
      frontForm.append('referenceFront', referenceFront, referenceFront.name);

      const frontPayload = await apiRequest('/api/render', { method: 'POST', body: frontForm });
      if (ticket !== state.renderTicket) return;
      state.artFront = await removeConnectedBackground(base64ToDataUrl(frontPayload.image));
      elements.artFrontImage.src = state.artFront;

      elements.artProgressTitle.textContent = 'Front view complete — matching the rear view…';
      elements.artProgressText.textContent = 'The approved front output is being used with the original reference to preserve the character design.';

      const generatedFront = await resizeImageForAi(dataUrlToBlob(state.artFront), 'generated-front.png');
      const backForm = new FormData();
      addGenerationFields(backForm);
      backForm.append('direction', 'back');
      backForm.append('sourceType', state.referenceType);
      backForm.append('referenceFront', referenceFront, referenceFront.name);
      if (referenceBack) backForm.append('referenceBack', referenceBack, referenceBack.name);
      backForm.append('generatedFront', generatedFront, generatedFront.name);

      const backPayload = await apiRequest('/api/render', { method: 'POST', body: backForm });
      if (ticket !== state.renderTicket) return;
      state.artBack = await removeConnectedBackground(base64ToDataUrl(backPayload.image));
      elements.artBackImage.src = state.artBack;
      setMessage(elements.artMessage, 'Directional art pair generated with transparent backgrounds.', 'success');
      updateStepper();
    } catch (error) {
      const prefix = state.artFront && !state.artBack ? 'The front view was generated, but the rear view failed. ' : '';
      setMessage(elements.artMessage, `${prefix}${friendlyError(error)}`, 'error');
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
      const makeForm = (direction) => {
        const form = new FormData();
        form.append('direction', direction);
        form.append('name', elements.characterName.value.trim() || 'Untitled character');
        form.append('description', elements.descriptionInput.value.trim());
        form.append('treatment', elements.spriteTreatment.value);
        form.append('quality', elements.qualitySelect.value);
        form.append('artFront', artFront, artFront.name);
        if (direction === 'back') form.append('artBack', artBack, artBack.name);
        return form;
      };

      const [frontPayload, backPayload] = await Promise.all([
        apiRequest('/api/sprite', { method: 'POST', body: makeForm('front') }),
        apiRequest('/api/sprite', { method: 'POST', body: makeForm('back') }),
      ]);
      state.spriteFrontRaw = base64ToDataUrl(frontPayload.image);
      state.spriteBackRaw = base64ToDataUrl(backPayload.image);
      await renderSpriteCanvases();
      setMessage(elements.spriteMessage, 'Sprite pair generated. Refine the alpha and scale before exporting.', 'success');
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
    state.imageFile = null;
    state.modelFile = null;
    state.modelFrontBlob = null;
    state.modelBackBlob = null;
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
