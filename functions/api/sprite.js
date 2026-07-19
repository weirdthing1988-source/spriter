import {
  authorize,
  editImage,
  errorResponse,
  jsonResponse,
  optionsResponse,
  safeText,
  validateImageFile,
} from '../_shared.js';

const SAFETY_FRAME = 'This is a family-friendly, non-sexual game-asset conversion. Use a neutral professional presentation suitable for a general audience, and preserve the source costume without making it more revealing.';

const treatments = {
  'clean-pixel': 'clean high-resolution pixel art with deliberate clusters, crisp edges, restrained colours, and no blurry anti-aliasing',
  'retro-32': 'retro 32-bit JRPG sprite art with clear pixel clusters, compact shading, and a strong readable silhouette',
  'cel-cutout': 'clean cel-shaded game cutout art with simplified forms, crisp outlines, and reduced fabric detail',
  'painted-cutout': 'simplified painted game cutout art with controlled texture and a strong silhouette',
};

function pairSpritePrompt(fields) {
  return `
Convert the two approved character-art views into ONE matched two-panel Visualiser sprite sheet.
${SAFETY_FRAME}

REFERENCES
- Image 0 is the approved front three-quarter art.
- Image 1 is the approved back three-quarter art.
- Preserve both viewing angles and use them as authoritative design references.

LAYOUT
- Place exactly two complete isolated sprite figures on one wide canvas.
- LEFT PANEL: front three-quarter sprite based on image 0.
- RIGHT PANEL: back three-quarter sprite based on image 1.
- Leave a clean vertical white gutter between them.
- Both sprites must have identical scale, baseline, head-to-body ratio, line weight, palette, lighting, simplification level, and pose phase.

CONSISTENCY
- Render both as the same fixed character model, not separate reinterpretations.
- Preserve the exact visible horn count and shape, hair masses and length, cape construction and lining, tail and tip, shoulder pieces, gloves, garment hem, boots, accessories, markings, wings, weapons, and asymmetrical details.
- Simplify tiny details only in the same way on both views.
- Do not change the walking step, body direction, or silhouette merely to make one panel easier.

STYLE
- Render in ${treatments[fields.treatment] || treatments['clean-pixel']}.
- Keep thin hair strands and garment edges connected enough to survive alpha cleanup.
- Use a perfectly uniform pure white (#FFFFFF) background. No scenery, text, labels, border, base, cast shadow, floor, gradient, particles, or texture.
- Keep generous padding around both complete figures.

CHARACTER NOTES
${fields.description}

Return one wide two-panel sprite sheet only.`.trim();
}

function pairSpriteRetryPrompt(fields) {
  return `
Create a safe, family-friendly matched two-view game sprite sheet from images 0 and 1.
- Put the front three-quarter sprite on the left and the back three-quarter sprite on the right.
- Both must represent the same character with identical scale, proportions, palette, pose phase, costume, hairstyle, features, accessories, and sprite treatment.
- Render in ${treatments[fields.treatment] || treatments['clean-pixel']}.
- Keep both complete figures centred in separate panels with a blank white gutter.
- Use a uniform pure white (#FFFFFF) background with no scenery, text, labels, base, shadow, floor, border, gradient, or texture.
- Preserve the source clothing without making it more revealing and omit violent detail.

SAFE DESIGN NOTES
${fields.description}

Return one wide two-panel sprite sheet only.`.trim();
}

function spritePrompt(direction, fields) {
  const referenceRule = direction === 'back three-quarter'
    ? '- Image 0 is the approved back-view art. Image 1 is the approved front art and is a consistency reference only.'
    : '- Image 0 is the approved front art and authoritative source.';

  return `
Convert the uploaded polished character art into a Visualiser-ready ${direction} character sprite.
${SAFETY_FRAME}

${referenceRule}
- Preserve the exact character identity, pose, viewing angle, proportions, palette, garment construction, hair shape, accessories, and silhouette.
- Render in ${treatments[fields.treatment] || treatments['clean-pixel']}.
- Keep the complete character centred on a uniform pure white (#FFFFFF) background with no scenery, text, border, base, shadow, floor, gradient, or texture.

CHARACTER NOTES
${fields.description}

Return one sprite render only.`.trim();
}

function spriteRetryPrompt(direction, fields) {
  return `
Create a safe, family-friendly ${direction} game sprite from the supplied approved character art.
- Preserve character identity, viewing angle, visible costume, colours, hairstyle, accessories, proportions, and silhouette.
- Use ${treatments[fields.treatment] || treatments['clean-pixel']}.
- Keep one complete neutral figure on a uniform pure white (#FFFFFF) background with no scenery, text, base, shadow, floor, border, gradient, or texture.

SAFE DESIGN NOTES
${fields.description}

Return one sprite render only.`.trim();
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

    const artFront = validateImageFile(form.get('artFront'), 'artFront');
    const fields = {
      name: safeText(form.get('name'), 80) || 'Untitled character',
      description: safeText(form.get('description'), 2400),
      treatment: safeText(form.get('treatment'), 40) || 'clean-pixel',
      quality: safeText(form.get('quality'), 12) || 'medium',
    };

    if (direction === 'pair') {
      const artBack = validateImageFile(form.get('artBack'), 'artBack');
      const image = await editImage({
        env,
        images: [artFront, artBack],
        prompt: pairSpritePrompt(fields),
        retryPrompt: pairSpriteRetryPrompt(fields),
        quality: fields.quality,
        layout: 'pair',
      });
      return jsonResponse(request, env, { image, direction, name: fields.name, layout: 'front-left-back-right' });
    }

    const images = direction === 'front'
      ? [artFront]
      : [validateImageFile(form.get('artBack'), 'artBack'), artFront];
    const image = await editImage({
      env,
      images,
      prompt: spritePrompt(direction === 'front' ? 'front three-quarter' : 'back three-quarter', fields),
      retryPrompt: spriteRetryPrompt(direction === 'front' ? 'front three-quarter' : 'back three-quarter', fields),
      quality: fields.quality,
    });

    return jsonResponse(request, env, { image, direction, name: fields.name });
  } catch (error) {
    return errorResponse(request, env, error);
  }
}
