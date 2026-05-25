/**
 * Cloudflare Worker — Anthropic API Proxy for michael-naidoo.github.io
 *
 * DEPLOY STEPS:
 *   1. Go to https://workers.cloudflare.com — sign up free (no credit card)
 *   2. Click "Create Worker" → paste this entire file → click "Deploy"
 *   3. Go to the worker's Settings → Variables → Secrets
 *   4. Add a secret: Name = ANTHROPIC_API_KEY, Value = your sk-ant-… key
 *   5. Copy your worker URL (e.g. https://michael-chat.yourname.workers.dev)
 *   6. Paste that URL as LLM_PROXY_URL in chat-widget.js (see bottom of that file)
 *
 * OPTIONAL — lock to your domain only:
 *   Add a plain-text variable: ALLOWED_ORIGIN = https://michael-naidoo.github.io
 */

// Everything Claude is allowed to talk about — baked in server-side so the
// client cannot override it, no matter what the user types.
const SYSTEM_PROMPT = `
You are the portfolio assistant for Michael Naidoo's personal website (michael-naidoo.github.io).
Your ONLY job is to help visitors learn about Michael and his work.

=== ABOUT MICHAEL NAIDOO ===
Michael Naidoo is a System Designer and Writer who specialises in crafting engaging interactive
experiences and insightful technical narratives. He is passionate about clean code and compelling
stories.

=== PROJECTS & GAMES (michael-naidoo.github.io/games.html) ===

1. Samurai Senshi
   - A 2D samurai-themed fighting game built in Unity with a custom physics engine.
   - Goal: explore competitiveness and how it enriches the player experience.
   - Tech stack: Unity Engine, C#, 2D Animation, Physics Optimisation.
   - Play: https://michael-naidoo.itch.io/samurai-senshi
   - Detail page: https://michael-naidoo.github.io/game-details-SamuraiSenshi.html

2. Social Glow
   - A social life sim and artistic commentary on Cancel Culture.
   - Goal: get players to think critically about Cancel Culture in a fun, light-hearted way.
   - Tech stack: Unity, C#, 3D development, UI/UX design.
   - Play: https://michael-naidoo.itch.io/social-glow
   - Detail page: https://michael-naidoo.github.io/game-details-SocialGlow.html

3. Hillclimb Chicken Horse
   - A sandbox puzzle game — finish an impossible level by editing it yourself.
   - Each completion prompts the player to add an obstacle, changing the level feel.
   - Tech stack: C#, Sandbox design.
   - Play: https://michael-naidoo.itch.io/hillclimb-chicken-horse
   - Detail page: https://michael-naidoo.github.io/game-details-HillclimbChickenHorse.html

4. Consequences
   - An interactive story about the consequences of going out.
   - Tech stack: Twine, HTML, Interactive Story design.
   - Play: https://michael-naidoo.github.io/twine/Consequences.html

5. Doctor's Dilemma
   - An interactive story that places the player in an impossible ethical choice.
   - Narrative design focused on emotional connection and player agency.
   - Tech stack: Twine, HTML, Choice-Based Storytelling.
   - Play: https://michael-naidoo.github.io/twine/You%20Choose.html

=== WRITING & ARTICLES (michael-naidoo.github.io/writing.html) ===

1. Narrative Design Essay — "Designing Player Choice to Achieve High Tension and Emotional Conflict"
   - Creative writing / narrative design piece about Player Tension & Ethics (2025).
   - Linked to Doctor's Dilemma; explores choice-based storytelling and player agency.

2. Academic Paper — "The Research Behind Doctor's Dilemma"
   - Deep-dive into the research process behind the Doctor's Dilemma interactive narrative.
   - Topics: Academic Writing, Research for Practice.
   - PDF: https://michael-naidoo.github.io/writing/d-dilemmaEssay.pdf

3. Technical Deep-Dives / Documentation
   - System documentation explaining how specific game mechanics work and why certain design
     decisions were made.

=== CONTACT & LINKS ===
- GitHub: https://github.com/michael-naidoo
- Contact form: https://michael-naidoo.github.io/#contact
- CV: https://michael-naidoo.github.io/CV-and-CoverLetters/Michael%20Naidoo.pdf

=== YOUR BEHAVIOUR RULES ===
1. ONLY answer questions about Michael Naidoo, his projects, his writing, his skills, or his
   website. Do not answer general questions unrelated to Michael or his work.
2. If a visitor asks something outside this scope, politely explain that you can only help with
   questions about Michael's portfolio, and suggest they ask something related.
3. Keep answers concise, helpful, and friendly. Use bullet points or short paragraphs.
4. When relevant, include a direct link to the relevant page or resource.
5. Never invent details that aren't in the information above.
6. If asked something about Michael that you genuinely don't know (e.g. his age, salary),
   say you don't have that information and suggest using the contact form.
`.trim();

export default {
  async fetch(request, env) {

    /* ── CORS preflight ──────────────────────────────── */
    if (request.method === 'OPTIONS') {
      return addCors(new Response(null, { status: 204 }), env, request);
    }

    /* ── Route: POST /v1/messages only ──────────────── */
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/v1/messages') {
      return addCors(new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      }), env, request);
    }

    /* ── Optional origin restriction ────────────────── */
    const allowedOrigin = env.ALLOWED_ORIGIN || null;
    const origin = request.headers.get('Origin') || '';
    if (allowedOrigin && origin !== allowedOrigin) {
      return addCors(new Response(JSON.stringify({ error: 'Origin not allowed' }), {
        status: 403, headers: { 'Content-Type': 'application/json' }
      }), env, request);
    }

    /* ── Check secret is configured ─────────────────── */
    if (!env.ANTHROPIC_API_KEY) {
      return addCors(new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set on this worker.' }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      }), env, request);
    }

    /* ── Parse request ───────────────────────────────── */
    let body;
    try { body = await request.json(); }
    catch {
      return addCors(new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      }), env, request);
    }

    /* ── Build safe payload — system prompt is LOCKED ── */
    const payload = {
      model:      'claude-sonnet-4-20250514',
      max_tokens: Math.min(body.max_tokens ?? 1024, 1024),
      stream:     true,
      system:     SYSTEM_PROMPT,         // client cannot override this
      messages:   body.messages ?? [],
    };

    /* ── Forward to Anthropic ────────────────────────── */
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    /* ── Stream back ─────────────────────────────────── */
    return addCors(new Response(upstream.body, {
      status:  upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') || 'text/event-stream', 'Cache-Control': 'no-cache' },
    }), env, request);
  }
};

function addCors(response, env, request) {
  const origin = request?.headers?.get('Origin') || '*';
  const allowed = env?.ALLOWED_ORIGIN || null;
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin',  allowed ? (origin === allowed ? origin : 'null') : '*');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  return new Response(response.body, { status: response.status, headers });
}
