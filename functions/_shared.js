const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const WORKERS_AI_MODEL = '@cf/black-forest-labs/flux-2-klein-4b';

export function corsHeaders(request, env) {
  const configured = env.ALLOWED_ORIGIN?.trim();
  const requestOrigin = request.headers.get('Origin') || '';
  let origin = '*';
  if (configured) {
    const allowed = configured.split(',').map((item) => item.trim()).filter(Boolean);
    origin = allowed.includes(requestOrigin) ? requestOrigin : allowed[0];
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-App-Token',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export function jsonResponse(request, env, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request, env),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export function optionsResponse(request, env) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export function authorize(request, env) {
  if (!env.APP_ACCESS_TOKEN) return true;
  return request.headers.get('X-App-Token') === env.APP_ACCESS_TOKEN;
}

export function requireAiBinding(env) {
  if (!env.AI || typeof env.AI.run !== 'function') {
    throw new HttpError(503, 'The Cloudflare Workers AI binding "AI" is not available on this deployment.');
  }
}

export class HttpError extends Error {
  constructor(status, message, details = undefined) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function validateImageFile(value, fieldName) {
  if (!(value instanceof File)) throw new HttpError(400, `${fieldName} is required.`);
  if (!/^image\/(png|jpeg|webp)$/i.test(value.type)) throw new HttpError(400, `${fieldName} must be a PNG, JPG or WebP image.`);
  if (value.size > MAX_IMAGE_BYTES) throw new HttpError(413, `${fieldName} must be 20 MB or smaller.`);
  return value;
}

export function optionalImageFile(value, fieldName) {
  if (!(value instanceof File) || value.size === 0) return null;
  return validateImageFile(value, fieldName);
}

export function safeText(value, maxLength = 2400) {
  return String(value || '').trim().slice(0, maxLength);
}

export function imageModel() {
  return WORKERS_AI_MODEL;
}

function renderDimensions(quality) {
  if (quality === 'low') return { width: 512, height: 768 };
  if (quality === 'high') return { width: 1024, height: 1536 };
  return { width: 768, height: 1152 };
}

function workersAiErrorInfo(error) {
  const rawCode = error?.code ?? error?.cause?.code ?? error?.error?.code;
  const message = String(error?.message || error?.cause?.message || error?.error?.message || 'Cloudflare Workers AI rejected the image request.');
  const match = message.match(/(?:^|\b)(3030)(?:\b|:)/);
  const code = Number(rawCode || match?.[1] || 0) || undefined;
  return { code, message };
}

function isFlaggedOutput(error) {
  const { code, message } = workersAiErrorInfo(error);
  return code === 3030 || /output has been flagged|prompt \/ input image combination/i.test(message);
}

async function runImageModel(env, form) {
  const serialized = new Response(form);
  const contentType = serialized.headers.get('content-type');
  if (!serialized.body || !contentType) throw new HttpError(500, 'Could not serialize the Workers AI image request.');
  return env.AI.run(WORKERS_AI_MODEL, {
    multipart: {
      body: serialized.body,
      contentType,
    },
  });
}

function makeImageForm({ images, prompt, width, height }) {
  const form = new FormData();
  form.append('prompt', prompt);
  form.append('width', String(width));
  form.append('height', String(height));
  images.forEach((image, index) => {
    form.append(`input_image_${index}`, image, image.name || `reference-${index}.png`);
  });
  return form;
}

export async function editImage({ env, images, prompt, retryPrompt = '', quality = 'medium' }) {
  requireAiBinding(env);
  if (!Array.isArray(images) || images.length < 1) throw new HttpError(400, 'At least one AI reference image is required.');
  if (images.length > 4) throw new HttpError(400, 'FLUX.2 Klein supports no more than four reference images.');

  const { width, height } = renderDimensions(quality);
  let payload;
  try {
    payload = await runImageModel(env, makeImageForm({ images, prompt, width, height }));
  } catch (firstError) {
    if (!isFlaggedOutput(firstError) || !retryPrompt) {
      const { code, message } = workersAiErrorInfo(firstError);
      throw new HttpError(Number.isInteger(firstError?.status) ? firstError.status : 502, message, code ? { code } : undefined);
    }

    try {
      payload = await runImageModel(env, makeImageForm({ images, prompt: retryPrompt, width, height }));
    } catch (retryError) {
      if (isFlaggedOutput(retryError)) {
        throw new HttpError(
          422,
          'Cloudflare’s image safety filter rejected this prompt/reference combination twice. Try a neutral single-character reference, remove anatomy or age wording from the description, or use a less suggestive pose.',
          { code: 3030, retryAttempted: true },
        );
      }
      const { code, message } = workersAiErrorInfo(retryError);
      throw new HttpError(Number.isInteger(retryError?.status) ? retryError.status : 502, message, code ? { code } : undefined);
    }
  }

  const image = payload?.image;
  if (!image || typeof image !== 'string') throw new HttpError(502, 'Cloudflare Workers AI returned no image data.');
  return image;
}

export function errorResponse(request, env, error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const message = status >= 500 && !error?.message ? 'Unexpected renderer error.' : error.message;
  const body = { error: message || 'Unexpected renderer error.' };
  if (error?.details?.code) body.code = error.details.code;
  if (error?.details?.retryAttempted) body.retryAttempted = true;
  return jsonResponse(request, env, body, status);
}
