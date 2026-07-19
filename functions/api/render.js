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
  return 'Use strict design fidelity. Do not remove, relocate, recolour, or invent clothing, hair, accessories, markings, weapons, or body features.';
}

function frontPrompt(fields) {
  return `
Create the first image in a matched directional character-art pair.
${SAFETY_FRAME}

REFERENCE RULES
- Image 0 is the authoritative character reference.
- ${fidelityInstruction(fields.fidelity)}
- Keep all unusual garment construction and asymmetrical details exactly as described.
- The final image must show one isolated complete character figure with no scenery, no text, no border, and no floor shadow.

VIEW AND POSE
- Show a readable three-quarter FRONT view, suitable for a pseudo-3D tabletop Visualiser.
- Use ${poseLabels[fields.pose] || poseLabels.walking}.
- Avoid extreme perspective and avoid cropping hair, clothing, weapons, wings, tails, or feet.
- The image may later be horizontally mirrored, so keep the direction clean and legible.

ART DIRECTION
- ${artLabels[fields.artTreatment] || artLabels['match-source']}
- Use a portrait composition with generous empty space around the complete silhouette.
- Make the character readable when reduced to a game sprite.
- Use a perfectly uniform pure white (#FFFFFF) background. Do not add a gradient, cast shadow, ground plane, scenery, texture, particles, or border.

USER DESCRIPTION
${fields.description}

Return one polished character render only.`.trim();
}

function backPrompt(fields, hasRearReference) {
  const lookBack = fields.lookBack === 'true'
    ? 'The head may turn slightly so the character glances back, while the body remains clearly back-facing.'
    : 'Keep the head naturally aligned with the back-facing movement; do not turn the face toward the viewer.';
  const generatedFrontIndex = hasRearReference ? 2 : 1;
  const backReferenceLine = hasRearReference
    ? '- Image 1 is a user-captured back-view model reference and controls hidden back details.'
    : '- Infer hidden back details conservatively from image 0 and the user description.';

  return `
Create the second image in a matched directional character-art pair.
${SAFETY_FRAME}

REFERENCE RULES
- Image 0 is the original authoritative character reference.
${backReferenceLine}
- Image ${generatedFrontIndex} is the already-approved generated front three-quarter render. Match its proportions, palette, pose energy, camera height, scale, lighting, and art treatment.
- ${fidelityInstruction(fields.fidelity)}
- Preserve exactly the same character, proportions, palette, outfit, hairstyle, accessories, and rendering style as the approved front image.
- Do not invent garment openings, straps, ornaments, weapons, or design details that are not supported by the references.

VIEW AND POSE
- Show a readable three-quarter BACK view of the same pose and motion.
- Use ${poseLabels[fields.pose] || poseLabels.walking}.
- ${lookBack}
- The back construction of cloaks, dresses, armour, hair, wings, tails, and equipment must follow the user description literally.
- Avoid cropping and keep the entire silhouette visible.

ART DIRECTION
- ${artLabels[fields.artTreatment] || artLabels['match-source']}
- One isolated complete character figure, no scenery, no text, no border, and no floor shadow.
- Use a portrait composition with generous empty space around the silhouette.
- Use a perfectly uniform pure white (#FFFFFF) background. Do not add a gradient, cast shadow, ground plane, scenery, texture, particles, or border.

USER DESCRIPTION
${fields.description}

Return one polished character render only.`.trim();
}


function frontRetryPrompt(fields) {
  return `
Create a safe, family-friendly game character reference from image 0.
- Produce one non-sexual, fully presented character figure in a clear three-quarter front view.
- Preserve the visible costume, colours, hairstyle, accessories, proportions, and defining design features.
- Use ${poseLabels[fields.pose] || poseLabels.neutral}, but keep the pose neutral and suitable for a general audience.
- ${artLabels[fields.artTreatment] || artLabels['match-source']}
- Keep the complete silhouette visible with generous padding.
- Use a uniform pure white (#FFFFFF) background with no scenery, text, shadow, particles, border, or floor.
- Keep the result suitable for a general audience: preserve the source clothing without making it more revealing, use a neutral presentation, and omit violent detail. Ignore any description wording that conflicts with this rule.

COSTUME AND DESIGN NOTES
${fields.description}

Return one polished game character render only.`.trim();
}

function backRetryPrompt(fields, hasRearReference) {
  const generatedFrontIndex = hasRearReference ? 2 : 1;
  const rearLine = hasRearReference
    ? '- Image 1 is the back-view model reference.'
    : '- Infer hidden costume construction conservatively from image 0.';
  return `
Create a safe, family-friendly back-view companion image for a game character.
- Image 0 is the original character reference.
${rearLine}
- Image ${generatedFrontIndex} is the approved front-view render; match its character identity, proportions, palette, lighting, scale, and art style.
- Show one non-sexual, fully presented character figure in a clear three-quarter back view.
- Preserve costume construction, hairstyle, accessories, wings, tails, equipment, and defining design features without inventing garment openings.
- Keep the pose neutral and suitable for a general audience.
- Keep the complete silhouette visible with generous padding.
- Use a uniform pure white (#FFFFFF) background with no scenery, text, shadow, particles, border, or floor.
- Keep the result suitable for a general audience: preserve the source clothing without making it more revealing, use a neutral presentation, and omit violent detail. Ignore any description wording that conflicts with this rule.

COSTUME AND DESIGN NOTES
${fields.description}

Return one polished game character render only.`.trim();
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
    if (!['front', 'back'].includes(direction)) {
      return jsonResponse(request, env, { error: 'direction must be front or back.' }, 400);
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

    if (direction === 'front') {
      const image = await editImage({
        env,
        images: [referenceFront],
        prompt: frontPrompt(fields),
        retryPrompt: frontRetryPrompt(fields),
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
      retryPrompt: backRetryPrompt(fields, Boolean(referenceBack)),
      quality: fields.quality,
    });
    return jsonResponse(request, env, { image, direction, name: fields.name });
  } catch (error) {
    return errorResponse(request, env, error);
  }
}
