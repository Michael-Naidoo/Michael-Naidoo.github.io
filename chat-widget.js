/**
 * Michael Naidoo — Portfolio Chat Widget
 *
 * SETUP (one-time):
 *   1. Deploy worker.js to Cloudflare Workers and add your ANTHROPIC_API_KEY secret.
 *   2. Replace YOUR_WORKER_URL below with your actual worker URL.
 *   3. Add to any page on your site, just before </body>:
 *        <script src="chat-widget.js"></script>
 */

(function () {
  if (document.getElementById('mn-chat-root')) return;

  /* ── ✏️  SET YOUR WORKER URL HERE ────────────────────── */
  const PROXY_URL = 'YOUR_WORKER_URL'; // e.g. https://michael-chat.yourname.workers.dev
  /* ────────────────────────────────────────────────────── */

  const ENDPOINT = PROXY_URL.replace(/\/$/, '') + '/v1/messages';

  const SUGGESTIONS = [
    'What projects has Michael built?',
    'Tell me about Samurai Senshi',
    'What is Social Glow about?',
    'Show me his writing',
    'How do I contact Michael?',
  ];

  /* ── Fonts ──────────────────────────────────────────── */
  if (!document.querySelector('link[href*="fonts.googleapis.com/css2?family=Inter"]')) {
    const f = document.createElement('link');
    f.rel = 'stylesheet';
    f.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap';
    document.head.appendChild(f);
  }

  /* ── Styles ─────────────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
    /* ── Widget root ──────────────────────────────────────────── */
    #mn-chat-root *, #mn-chat-root *::before, #mn-chat-root *::after {
      box-sizing: border-box; margin: 0; padding: 0;
    }
    #mn-chat-root {
      --bg:       #1D1E22;
      --surface:  #111111;
      --surface2: #2a2c30;
      --border:   #333640;
      --accent:   #00BCD4;
      --accent-dk:#008D9B;
      --text:     #E0E0E0;
      --muted:    #777e8a;
      --radius:   10px;
      --shadow:   0 8px 40px rgba(0,0,0,0.6), 0 2px 10px rgba(0,0,0,0.4);
      font-family: 'Inter', Arial, sans-serif;
      position: fixed; bottom: 28px; right: 28px; z-index: 999999;
    }

    /* ── Toggle button ──────────────────────────────────────── */
    #mn-chat-toggle {
      width: 56px; height: 56px; border-radius: 50%;
      background: var(--accent); border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 5px 20px rgba(0,188,212,0.45);
      transition: transform 0.2s cubic-bezier(.34,1.56,.64,1),
                  background 0.2s, box-shadow 0.2s;
      position: relative;
    }
    #mn-chat-toggle:hover {
      background: var(--accent-dk);
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0,188,212,0.5);
    }
    #mn-chat-toggle svg { transition: opacity 0.15s, transform 0.15s; }
    #mn-chat-toggle .ic-chat  { position: absolute; }
    #mn-chat-toggle .ic-close { position: absolute; opacity: 0; transform: rotate(-45deg); }
    #mn-chat-root.open #mn-chat-toggle .ic-chat  { opacity: 0; transform: rotate(45deg); }
    #mn-chat-root.open #mn-chat-toggle .ic-close { opacity: 1; transform: rotate(0); }

    #mn-notif {
      position: absolute; top: -2px; right: -2px;
      width: 13px; height: 13px; border-radius: 50%;
      background: #ff5252; border: 2px solid #1D1E22;
      display: none; animation: mn-notif-pop 0.3s cubic-bezier(.34,1.56,.64,1);
    }
    @keyframes mn-notif-pop { from { transform: scale(0); } to { transform: scale(1); } }

    /* ── Panel ─────────────────────────────────────────────── */
    #mn-chat-panel {
      position: absolute; bottom: 68px; right: 0;
      width: 360px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-top: 3px solid var(--accent);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      display: flex; flex-direction: column;
      overflow: hidden;
      transform-origin: bottom right;
      transform: scale(0.9) translateY(12px);
      opacity: 0; pointer-events: none;
      transition: transform 0.25s cubic-bezier(.34,1.3,.64,1), opacity 0.2s;
      max-height: 560px;
    }
    #mn-chat-root.open #mn-chat-panel {
      transform: scale(1) translateY(0);
      opacity: 1; pointer-events: all;
    }

    /* ── Header ────────────────────────────────────────────── */
    #mn-chat-header {
      background: #111;
      padding: 13px 16px;
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; gap: 10px;
    }
    #mn-chat-header-avatar {
      width: 32px; height: 32px; border-radius: 50%;
      background: var(--accent);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 13px; color: var(--bg);
      flex-shrink: 0;
    }
    #mn-chat-header-info { flex: 1; }
    #mn-chat-header-name {
      font-size: 13px; font-weight: 600; color: var(--text);
      line-height: 1.2;
    }
    #mn-chat-header-sub {
      font-size: 10px; color: var(--accent);
      letter-spacing: 0.06em; text-transform: uppercase; margin-top: 1px;
    }
    #mn-chat-clear {
      background: none; border: none; cursor: pointer; color: var(--muted);
      padding: 5px; border-radius: 5px; transition: color 0.15s, background 0.15s;
      display: flex; align-items: center;
    }
    #mn-chat-clear:hover { color: var(--text); background: var(--surface2); }

    /* ── Messages ──────────────────────────────────────────── */
    #mn-chat-msgs {
      flex: 1; overflow-y: auto; padding: 14px 12px;
      display: flex; flex-direction: column; gap: 10px;
      scroll-behavior: smooth; min-height: 180px; max-height: 320px;
    }
    #mn-chat-msgs::-webkit-scrollbar { width: 4px; }
    #mn-chat-msgs::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

    /* ── Suggested prompts ─────────────────────────────────── */
    #mn-chat-suggestions {
      padding: 0 12px 12px;
      display: flex; flex-wrap: wrap; gap: 6px;
    }
    .mn-sug {
      font-size: 10.5px; font-family: inherit;
      padding: 5px 11px; border-radius: 50px;
      border: 1.5px solid var(--border);
      color: var(--muted); background: none; cursor: pointer;
      transition: border-color 0.2s, color 0.2s, background 0.2s;
      letter-spacing: 0.01em; line-height: 1.3;
    }
    .mn-sug:hover {
      border-color: var(--accent); color: var(--accent);
      background: rgba(0,188,212,0.07);
    }

    .mn-msg { display: flex; flex-direction: column; gap: 3px; animation: mn-in 0.18s ease; }
    @keyframes mn-in { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:none; } }

    .mn-msg-lbl {
      font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase;
      color: var(--muted); padding: 0 3px;
    }
    .mn-msg.user .mn-msg-lbl { text-align: right; color: var(--accent); opacity: 0.75; }

    .mn-msg-bubble {
      padding: 10px 13px; border-radius: 8px;
      font-size: 13px; line-height: 1.6; color: var(--text);
      white-space: pre-wrap; word-break: break-word;
    }
    .mn-msg.user .mn-msg-bubble {
      background: var(--surface2); border: 1px solid var(--border);
      border-bottom-right-radius: 2px; align-self: flex-end; max-width: 86%;
    }
    .mn-msg.ai .mn-msg-bubble {
      background: var(--surface); border: 1px solid var(--border);
      border-left: 3px solid var(--accent);
      border-bottom-left-radius: 2px; align-self: flex-start; max-width: 92%;
    }
    .mn-msg.ai .mn-msg-bubble a {
      color: var(--accent); text-decoration: none;
    }
    .mn-msg.ai .mn-msg-bubble a:hover { text-decoration: underline; }

    /* ── Typing dots ───────────────────────────────────────── */
    #mn-typing {
      display: none; align-items: center; gap: 5px; padding: 4px 4px;
    }
    #mn-typing.on { display: flex; }
    .mn-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--accent); opacity: 0.4;
      animation: mn-bounce 1.2s ease-in-out infinite;
    }
    .mn-dot:nth-child(2) { animation-delay: 0.2s; }
    .mn-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes mn-bounce {
      0%,80%,100% { transform: translateY(0); opacity: 0.35; }
      40%          { transform: translateY(-6px); opacity: 1; }
    }

    /* ── Empty state ───────────────────────────────────────── */
    #mn-empty {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 20px; text-align: center; gap: 8px;
      color: var(--muted);
    }
    #mn-empty p { font-size: 12px; line-height: 1.7; }
    .mn-empty-icon {
      font-size: 26px; font-weight: 700;
      color: var(--accent); opacity: 0.35;
    }

    /* ── Input bar ─────────────────────────────────────────── */
    #mn-chat-inputbar {
      padding: 10px 12px;
      border-top: 1px solid var(--border);
      display: flex; gap: 8px; align-items: flex-end;
      background: #111;
    }
    #mn-chat-ta {
      flex: 1; background: var(--surface2);
      border: 1px solid #444; border-radius: 5px;
      color: var(--text); font-family: 'Inter', Arial, sans-serif;
      font-size: 13px; padding: 9px 11px; resize: none; outline: none;
      line-height: 1.45; max-height: 110px; overflow-y: auto;
      transition: border-color 0.2s;
    }
    #mn-chat-ta:focus { border-color: var(--accent); }
    #mn-chat-ta::placeholder { color: var(--muted); }
    #mn-chat-send {
      width: 36px; height: 36px; border-radius: 50px;
      background: var(--accent); border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      transition: background 0.2s, transform 0.15s;
    }
    #mn-chat-send:hover { background: var(--accent-dk); transform: translateY(-1px); }
    #mn-chat-send:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }

    /* ── Footer note ───────────────────────────────────────── */
    #mn-chat-footer {
      text-align: center; font-size: 9.5px; color: var(--muted);
      padding: 5px 12px 8px; letter-spacing: 0.04em;
      background: #111; border-top: 1px solid var(--border);
    }

    @media (max-width: 440px) {
      #mn-chat-panel { width: calc(100vw - 32px); right: -14px; }
    }
  `;
  document.head.appendChild(style);

  /* ── HTML ───────────────────────────────────────────── */
  const root = document.createElement('div');
  root.id = 'mn-chat-root';
  root.innerHTML = `
    <div id="mn-chat-panel">

      <div id="mn-chat-header">
        <div id="mn-chat-header-avatar">MN</div>
        <div id="mn-chat-header-info">
          <div id="mn-chat-header-name">Michael's Portfolio</div>
          <div id="mn-chat-header-sub">● Online — ask me anything</div>
        </div>
        <button id="mn-chat-clear" title="Clear conversation">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
      </div>

      <div id="mn-chat-msgs">
        <div id="mn-empty">
          <div class="mn-empty-icon">{ }</div>
          <p>Ask me about Michael's projects,<br/>writing, skills, or how to get in touch.</p>
        </div>
        <div id="mn-typing">
          <div class="mn-dot"></div>
          <div class="mn-dot"></div>
          <div class="mn-dot"></div>
        </div>
      </div>

      <div id="mn-chat-suggestions">
        ${SUGGESTIONS.map(s => `<button class="mn-sug">${s}</button>`).join('')}
      </div>

      <div id="mn-chat-inputbar">
        <textarea id="mn-chat-ta" rows="1" placeholder="Ask about Michael's work…" maxlength="800"></textarea>
        <button id="mn-chat-send" disabled>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1D1E22" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>

      <div id="mn-chat-footer">Powered by Claude · Answers are limited to this portfolio</div>
    </div>

    <button id="mn-chat-toggle" aria-label="Open chat">
      <div id="mn-notif"></div>
      <svg class="ic-chat" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1D1E22" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <svg class="ic-close" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D1E22" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `;
  document.body.appendChild(root);

  /* ── State ──────────────────────────────────────────── */
  let messages  = [];
  let streaming = false;

  /* ── Refs ───────────────────────────────────────────── */
  const toggle   = root.querySelector('#mn-chat-toggle');
  const msgsEl   = root.querySelector('#mn-chat-msgs');
  const ta       = root.querySelector('#mn-chat-ta');
  const sendBtn  = root.querySelector('#mn-chat-send');
  const clearBtn = root.querySelector('#mn-chat-clear');
  const typingEl = root.querySelector('#mn-typing');
  const emptyEl  = root.querySelector('#mn-empty');
  const suggBox  = root.querySelector('#mn-chat-suggestions');
  const notifDot = root.querySelector('#mn-notif');

  /* ── Toggle ─────────────────────────────────────────── */
  toggle.addEventListener('click', () => {
    root.classList.toggle('open');
    notifDot.style.display = 'none';
    if (root.classList.contains('open')) setTimeout(() => ta.focus(), 260);
  });

  /* ── Suggestions ────────────────────────────────────── */
  root.querySelectorAll('.mn-sug').forEach(btn => {
    btn.addEventListener('click', () => {
      ta.value = btn.textContent;
      ta.dispatchEvent(new Event('input'));
      if (!root.classList.contains('open')) root.classList.add('open');
      ta.focus();
    });
  });

  /* ── Textarea auto-resize ───────────────────────────── */
  ta.addEventListener('input', () => {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 110) + 'px';
    sendBtn.disabled = !ta.value.trim() || streaming;
  });
  ta.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!sendBtn.disabled) send(); }
  });

  /* ── Clear ──────────────────────────────────────────── */
  clearBtn.addEventListener('click', () => {
    messages = [];
    msgsEl.querySelectorAll('.mn-msg').forEach(m => m.remove());
    emptyEl.style.display = 'flex';
    suggBox.style.display = 'flex';
  });

  /* ── Render message ─────────────────────────────────── */
  function renderMsg(role, text) {
    emptyEl.style.display = 'none';
    suggBox.style.display = 'none';

    const wrap   = document.createElement('div');
    wrap.className = 'mn-msg ' + role;
    const lbl    = document.createElement('div');
    lbl.className = 'mn-msg-lbl';
    lbl.textContent = role === 'user' ? 'you' : 'michael\'s site';
    const bubble = document.createElement('div');
    bubble.className = 'mn-msg-bubble';
    setContent(bubble, text, role === 'ai');
    wrap.appendChild(lbl);
    wrap.appendChild(bubble);
    msgsEl.insertBefore(wrap, typingEl);
    return bubble;
  }

  /* Render plain text but linkify URLs for AI messages */
  function setContent(el, text, linkify) {
    if (!linkify) { el.textContent = text; return; }
    el.innerHTML = '';
    const urlRe = /https?:\/\/[^\s)]+/g;
    let last = 0, m;
    while ((m = urlRe.exec(text)) !== null) {
      if (m.index > last) el.appendChild(document.createTextNode(text.slice(last, m.index)));
      const a = document.createElement('a');
      a.href = m[0]; a.target = '_blank'; a.rel = 'noopener';
      a.textContent = m[0];
      el.appendChild(a);
      last = m.index + m[0].length;
    }
    if (last < text.length) el.appendChild(document.createTextNode(text.slice(last)));
  }

  function scrollBottom() { msgsEl.scrollTop = msgsEl.scrollHeight; }

  /* ── Send ───────────────────────────────────────────── */
  sendBtn.addEventListener('click', send);

  async function send() {
    const text = ta.value.trim();
    if (!text || streaming) return;
    ta.value = ''; ta.style.height = 'auto';
    sendBtn.disabled = true; streaming = true;

    messages.push({ role: 'user', content: text });
    renderMsg('user', text);
    scrollBottom();

    typingEl.classList.add('on');
    scrollBottom();

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_tokens: 1024, messages }),
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error?.message || `HTTP ${res.status}`);
      }

      typingEl.classList.remove('on');
      const bubble = renderMsg('ai', '');
      let full = '';

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const d = line.slice(6);
          if (d === '[DONE]') continue;
          try {
            const j = JSON.parse(d);
            if (j.type === 'content_block_delta' && j.delta?.text) {
              full += j.delta.text;
              setContent(bubble, full, true);
              scrollBottom();
            }
          } catch { /* skip */ }
        }
      }

      messages.push({ role: 'assistant', content: full });
      if (!root.classList.contains('open')) notifDot.style.display = 'block';

    } catch (err) {
      typingEl.classList.remove('on');
      renderMsg('ai', `⚠ ${err.message}`);
      scrollBottom();
    }

    streaming = false;
    sendBtn.disabled = !ta.value.trim();
  }

})();
