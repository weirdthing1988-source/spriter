import { authorize, imageModel, jsonResponse, optionsResponse } from '../_shared.js';

export function onRequestOptions({ request, env }) {
  return optionsResponse(request, env);
}

export function onRequestGet({ request, env }) {
  if (!authorize(request, env)) return jsonResponse(request, env, { error: 'Invalid app access token.' }, 401);
  const configured = Boolean(env.AI && typeof env.AI.run === 'function');
  return jsonResponse(request, env, {
    ok: configured,
    configured,
    provider: 'Cloudflare Workers AI',
    model: imageModel(),
  }, configured ? 200 : 503);
}
