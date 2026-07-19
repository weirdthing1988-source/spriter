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

function spritePrompt(direction, fields) {
  const referenceRule = direction === 'back three-quarter'
    ? '- Image 0 is the approved back-view art. Image 1 is the approved front art and is a consistency reference only.'
    : '- Image 0 is the approved front art and authoritative source.';

  return `
Convert the uploaded polished character art into a Visualiser-ready ${direction} character sprite.
${SAFETY_FRAME}

${referenceRule}
- Preserve the exact character identity, pose, viewing angle, proportions, palette, garment construction, hair shape, accessories, and silhouette.
- Do not redesign the character and do not change the walking step or body direction.
- Render in ${treatments[fields.treatment] || treatments['clean-pixel']}.
- Simplify tiny details that would become visual noise at board scale, while retaining all defining shapes and colours.
- Keep the complete character figure centred and isolated with generous empty padding.
- Use a perfectly uniform pure white (#FFFFFF) background. No scenery, text, border, base, cast shadow, ground plane, gradient, or texture.
- Keep thin hair strands and garment edges connected enough to survive alpha cleanup.

CHARACTER NOTES
${fields.description}

Return one sprite render only.`.trim();
}


function spriteRetryPrompt(direction, fields) {
  return `
Create a safe, family-friendly ${direction} game sprite from the supplied approved character art.
- Preserve the character identity, viewing angle, visible costume, colours, hairstyle, accessories, proportions, and silhouette.
- Use ${treatments[fields.treatment] || treatments['clean-pixel']}.
- Keep one complete, non-sexual character figure centred with generous padding.
- Use a uniform pure white (#FFFFFF) background with no scenery, text, base, shadow, floor, border, gradient, or texture.
- Keep the result suitable for a general audience: preserve the source clothing without making it more revealing, use a neutral presentation, and omit violent detail. Ignore any note that conflicts with this rule.

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
    if (!['front', 'back'].includes(direction)) {
      return jsonResponse(request, env, { error: 'direction must be front or back.' }, 400);
    }

    const artFront = validateImageFile(form.get('artFront'), 'artFront');
    const fields = {
      name: safeText(form.get('name'), 80) || 'Untitled character',
      description: safeText(form.get('description'), 2400),
      treatment: safeText(form.get('treatment'), 40) || 'clean-pixel',
      quality: safeText(form.get('quality'), 12) || 'medium',
    };

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
