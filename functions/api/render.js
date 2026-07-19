import {
  authorize,
  editImage,
  errorResponse,
  jsonResponse,
  optionalImageFile,
  optionsResponse,
  safeText,
  validateImageFile,
} from '../_shared.js';

const artLabels = {
  'match-source': 'Match image 0’s visual style while cleaning it into polished character art.',
  'clean-anime': 'Use polished clean anime character illustration with crisp linework and controlled shading.',
  'painted-fantasy': 'Use elegant painted fantasy character art with readable forms and restrained detail.',
  'cel-shaded': 'Use polished cel-shaded game character art with strong shapes and readable fabric folds.',
};

const SAFETY_FRAME = 'This is a family-friendly, non-sexual game-asset task. Use a neutral professional character-turnaround presentation suitable for a general audience, and preserve the source costume without making it more revealing.';

const poseLabels = {
  walking: 'a natural graceful walking pose with visible forward motion',
  neutral: 'a relaxed neutral standing pose',
  'battle-ready': 'a readable battle-ready stance without exaggerated foreshortening',
  casting: 'a controlled spellcasting pose with a clear silhouette',
  custom: 'the custom pose described by the user',
};

function fidelityInstruction(level) {
  if (level === '1') return 'You may simplify minor details, but preserve the character’s identity and overall outfit.';
  if (level === '2') return 'Preserve the character’s identity, palette, major accessories, garment construction, and silhouette.';
  return 'Use strict design fidelity. Do not remove, relocate, recolour, multiply, or invent clothing, hair, accessories, markings, weapons, horns, tails, wings, or body features.';
}

function pairPrompt(fields, hasRearReference) {
  const lookBack = fields.lookBack === 'true'
    ? 'The right-hand back view may turn the head slightly to glance back, but the torso and hips must remain clearly back-facing.'
    : 'The right-hand back view must keep the face turned away from the viewer.';
  const rearReferenceLine = hasRearReference
    ? '- Image 1 is an authoritative user-provided back-view reference. Use it for all hidden rear construction.'
    : '- No dedicated rear reference is supplied. Infer genuinely hidden rear construction conservatively; never alter features already visible in image 0.';

  return `
Create ONE matched two-view character turnaround sheet in a single image.
${SAFETY_FRAME}

REFERENCE PRIORITY
- Image 0 is the authoritative character reference.
${rearReferenceLine}
- ${fidelityInstruction(fields.fidelity)}

SHEET LAYOUT
- Place exactly two isolated full-body views of the SAME character on one wide canvas.
- LEFT PANEL: readable three-quarter FRONT view.
- RIGHT PANEL: readable three-quarter BACK view.
- Leave a clean vertical white gutter between the panels.
- Do not add labels, arrows, text, borders, scenery, props, floor lines, or shadows.
- Both figures must use the same camera height, body proportions, head size, pose phase, baseline, scale, lighting, line weight, shading, and colour treatment.
- Keep every part of both silhouettes visible with generous outer padding.

CONSISTENCY IS THE PRIMARY REQUIREMENT
- Treat the two figures as two camera views of one fixed model, not two redesigns.
- Match the exact horn count, horn shape and placement; facial and hair construction; hair length and strand masses; shoulder pieces; glove length; neckline; garment seams and hem; cape outer shape, gold edging and inner lining; tail thickness, route and tip; boot height, heel and armour panels; weapons, wings, jewellery, markings, and all asymmetrical details.
- A feature visible in the left panel must not vanish, multiply, change colour, move, or change shape in the right panel unless perspective alone hides it.
- Hidden rear details should be simple and mechanically plausible extensions of the visible design.

POSE
- Use ${poseLabels[fields.pose] || poseLabels.walking} in both panels, showing the same instant from opposite viewpoints.
- ${lookBack}
- Avoid extreme perspective and exaggerated foreshortening.

ART DIRECTION
- ${artLabels[fields.artTreatment] || artLabels['match-source']}
- Make the figures readable when reduced to game sprites.
- Use a perfectly uniform pure white (#FFFFFF) background across the entire sheet.

USER DESCRIPTION
${fields.description}

Return one wide two-panel turnaround sheet only.`.trim();
}

function pairRetryPrompt(fields, hasRearReference) {
  const rearLine = hasRearReference
    ? '- Image 1 is the approved rear construction reference.'
    : '- Infer only hidden rear construction conservatively.';
  return `
Create a safe, family-friendly two-view game-character turnaround sheet.
- Image 0 is the authoritative character reference.
${rearLine}
- Place exactly two complete views of the same character: front three-quarter on the left and back three-quarter on the right.
- Preserve the visible costume, colours, hairstyle, exact number and shape of horns or other features, cape, tail, footwear, accessories, proportions, and silhouette.
- Both views must use identical scale, pose phase, camera height, lighting, and art style.
- Use ${poseLabels[fields.pose] || poseLabels.neutral}, presented neutrally for a general audience.
- ${artLabels[fields.artTreatment] || artLabels['match-source']}
- Keep a blank white gutter between the figures and generous padding around them.
- Use a uniform pure white (#FFFFFF) background with no scenery, text, shadow, floor, particles, or border.
- Preserve the source clothing without making it more revealing and omit violent detail.

SAFE DESIGN NOTES
${fields.description}

Return one wide two-panel turnaround sheet only.`.trim();
}

// Legacy single-view prompts are kept so older cached clients fail gracefully while
// the current browser uses the consistency-first single-sheet pair route.
function frontPrompt(fields) {
  return `
Create one isolated complete character in a readable three-quarter front view.
${SAFETY_FRAME}
- Image 0 is authoritative. ${fidelityInstruction(fields.fidelity)}
- Use ${poseLabels[fields.pose] || poseLabels.walking}.
- ${artLabels[fields.artTreatment] || artLabels['match-source']}
- Keep the full silhouette visible on a uniform pure white (#FFFFFF) background with no scenery, text, border, floor, or shadow.

USER DESCRIPTION
${fields.description}

Return one polished character render only.`.trim();
}

function backPrompt(fields, hasRearReference) {
  const generatedFrontIndex = hasRearReference ? 2 : 1;
  return `
Create one isolated three-quarter back view of exactly the same character.
${SAFETY_FRAME}
- Image 0 is the original reference.
${hasRearReference ? '- Image 1 is the authoritative rear reference.' : '- Infer hidden rear construction conservatively.'}
- Image ${generatedFrontIndex} is the approved front output. Match its exact design, proportions, scale, pose phase, lighting, palette, and art style.
- ${fidelityInstruction(fields.fidelity)}
- Keep the full silhouette visible on a uniform pure white (#FFFFFF) background with no scenery, text, border, floor, or shadow.

USER DESCRIPTION
${fields.description}

Return one polished character render only.`.trim();
}

function legacyRetryPrompt(fields, direction) {
  return `
Create a safe, family-friendly ${direction} game-character reference from the supplied images.
- Preserve the character identity, visible costume, colours, hairstyle, accessories, proportions, and defining features.
- Keep one complete neutral figure visible with generous padding.
- Use a uniform pure white (#FFFFFF) background with no scenery, text, shadow, particles, floor, or border.
- Preserve the source clothing without making it more revealing and omit violent detail.

SAFE DESIGN NOTES
${fields.description}

Return one polished character render only.`.trim();
}

export function onRequestOptions({ request, env }) {
  return optionsResponse(request, env);
}

export async function onRequestPost({ request, env }) {
  if (!authorize(request, env)) return jsonResponse(request, env, { error: 'Invalid app access token.' }, 401);

  try {
    const contentType = request.headers.get('Content-Type') || '';
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return jsonResponse(request, env, { error: 'Renderer requests must use multipart/form-data.' }, 400);
    }

    const form = await request.formData();
    const direction = safeText(form.get('direction'), 12);
    if (!['pair', 'front', 'back'].includes(direction)) {
      return jsonResponse(request, env, { error: 'direction must be pair, front or back.' }, 400);
    }

    const referenceFront = validateImageFile(form.get('referenceFront'), 'referenceFront');
    const referenceBack = optionalImageFile(form.get('referenceBack'), 'referenceBack');
    const fields = {
      name: safeText(form.get('name'), 80) || 'Untitled character',
      description: safeText(form.get('description'), 2400),
      pose: safeText(form.get('pose'), 40) || 'walking',
      artTreatment: safeText(form.get('artTreatment'), 40) || 'match-source',
      quality: safeText(form.get('quality'), 12) || 'medium',
      fidelity: safeText(form.get('fidelity'), 2) || '3',
      lookBack: safeText(form.get('lookBack'), 8) || 'false',
    };

    if (!fields.description) return jsonResponse(request, env, { error: 'A character description is required.' }, 400);

    if (direction === 'pair') {
      const images = [referenceFront];
      if (referenceBack) images.push(referenceBack);
      const image = await editImage({
        env,
        images,
        prompt: pairPrompt(fields, Boolean(referenceBack)),
        retryPrompt: pairRetryPrompt(fields, Boolean(referenceBack)),
        quality: fields.quality,
        layout: 'pair',
      });
      return jsonResponse(request, env, { image, direction, name: fields.name, layout: 'front-left-back-right' });
    }

    if (direction === 'front') {
      const image = await editImage({
        env,
        images: [referenceFront],
        prompt: frontPrompt(fields),
        retryPrompt: legacyRetryPrompt(fields, 'front-view'),
        quality: fields.quality,
      });
      return jsonResponse(request, env, { image, direction, name: fields.name });
    }

    const generatedFront = validateImageFile(form.get('generatedFront'), 'generatedFront');
    const images = [referenceFront];
    if (referenceBack) images.push(referenceBack);
    images.push(generatedFront);
    const image = await editImage({
      env,
      images,
      prompt: backPrompt(fields, Boolean(referenceBack)),
      retryPrompt: legacyRetryPrompt(fields, 'back-view'),
      quality: fields.quality,
    });
    return jsonResponse(request, env, { image, direction, name: fields.name });
  } catch (error) {
    return errorResponse(request, env, error);
  }
}
