/**
 * SalesGen Widget SDK — Embeddable AI Sales Agent (Premium Edition)
 *
 * Usage:
 * <script src="https://cdn.salesgen.com/widget.js" data-org="your-org-slug"></script>
 *
 * Features:
 *   - Premium dark glassmorphic UI with gradient accents
 *   - Markdown rendering (bold, italic, lists, code blocks, tables)
 *   - KaTeX math rendering for LaTeX expressions
 *   - Citation badges, video embeds, KB resource links
 *   - Voice input, Calendly integration
 *   - Zero dependencies (KaTeX loaded from CDN on demand)
 *
 * The script auto-injects a chat widget, fetches the org's config
 * (colors, greeting, bot name), and handles all communication.
 */
(function () {
  "use strict";

  // ── Config ──
  const scriptTag = document.currentScript;
  const ORG_SLUG = scriptTag?.getAttribute("data-org");
  const API_BASE =
    scriptTag?.getAttribute("data-api") || "http://127.0.0.1:8000";

  if (!ORG_SLUG) {
    console.error("[SalesGen] Missing data-org attribute on script tag.");
    return;
  }

  // ── State ──
  let sessionId = localStorage.getItem(`sg_session_${ORG_SLUG}`) || null;
  let isOpen = false;
  let isLoading = false;
  let messages = [];
  let katexLoaded = false;
  let config = {
    bot_name: "AI Assistant",
    greeting: "Hi! How can I help you today?",
    brand_color: "#6366f1",
    position: "right",
    avatar_url: null,
  };

  // ── Load KaTeX from CDN ──
  function loadKaTeX() {
    if (katexLoaded) return Promise.resolve();
    return new Promise((resolve) => {
      // CSS
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
      document.head.appendChild(link);
      // JS
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js";
      script.onload = () => {
        katexLoaded = true;
        resolve();
      };
      script.onerror = () => {
        katexLoaded = false;
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  // ── Fetch Widget Config ──
  async function fetchConfig() {
    try {
      const res = await fetch(`${API_BASE}/widget-config/${ORG_SLUG}`);
      if (res.ok) {
        const data = await res.json();
        config = { ...config, ...data };
        applyConfig();
      }
    } catch (e) {
      console.warn("[SalesGen] Could not fetch widget config, using defaults.");
    }
  }

  // ── Generate HSL palette from brand color ──
  function hexToHSL(hex) {
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  // ── Inject Styles ──
  function injectStyles() {
    const style = document.createElement("style");
    style.id = "salesgen-widget-styles";
    const bc = config.brand_color;
    const hsl = hexToHSL(bc);
    const brandDark = `hsl(${hsl.h}, ${Math.min(hsl.s + 10, 100)}%, ${Math.max(hsl.l - 15, 10)}%)`;
    const brandGlow = `${bc}40`;
    const brandGlow2 = `${bc}20`;

    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

      #sg-widget-container * {
        box-sizing: border-box; margin: 0; padding: 0;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }

      /* ─── FAB Button ─── */
      #sg-widget-fab {
        position: fixed; bottom: 24px; z-index: 999999;
        width: 60px; height: 60px; border-radius: 20px; border: none;
        background: linear-gradient(135deg, ${bc}, ${brandDark});
        color: white; cursor: pointer;
        box-shadow: 0 8px 32px ${brandGlow}, 0 0 0 1px ${bc}22;
        display: flex; align-items: center; justify-content: center;
        transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      }
      #sg-widget-fab:hover {
        transform: scale(1.1) translateY(-2px);
        box-shadow: 0 12px 40px ${brandGlow}, 0 0 60px ${brandGlow2};
      }
      #sg-widget-fab svg { width: 26px; height: 26px; transition: all 0.3s; }

      /* ─── Panel ─── */
      #sg-widget-panel {
        position: fixed; bottom: 100px; z-index: 999998;
        width: 380px; max-width: calc(100vw - 48px); height: 68vh; max-height: 600px;
        border-radius: 24px;
        background: rgba(12, 12, 22, 0.95);
        backdrop-filter: blur(40px) saturate(180%);
        -webkit-backdrop-filter: blur(40px) saturate(180%);
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.08);
        box-shadow:
          0 25px 60px rgba(0,0,0,0.55),
          0 8px 24px rgba(0,0,0,0.3),
          inset 0 1px 0 rgba(255,255,255,0.06);
        display: flex; flex-direction: column;
        opacity: 0; transform: translateY(24px) scale(0.95);
        transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: none;
      }
      #sg-widget-panel.sg-open {
        opacity: 1; transform: translateY(0) scale(1); pointer-events: all;
      }

      /* ─── Header ─── */
      .sg-header {
        background: linear-gradient(135deg, ${bc}ee, ${brandDark}ee);
        backdrop-filter: blur(20px);
        padding: 20px 22px;
        display: flex; align-items: center; gap: 14px; color: white;
        position: relative; overflow: hidden;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        min-height: 72px;
      }
      .sg-header::after {
        content: '';
        position: absolute; top: 0; left: 0; right: 0; bottom: 0;
        background: linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 100%);
        pointer-events: none;
      }
      .sg-header-avatar {
        width: 40px; height: 40px; border-radius: 14px;
        background: rgba(255,255,255,0.15);
        backdrop-filter: blur(10px);
        display: flex; align-items: center; justify-content: center;
        font-size: 15px; font-weight: 800; letter-spacing: -0.5px;
        border: 1px solid rgba(255,255,255,0.1);
        position: relative; z-index: 1;
      }
      .sg-header-info { flex: 1; position: relative; z-index: 1; }
      .sg-header-name {
        font-size: 15px; font-weight: 700; letter-spacing: -0.3px;
      }
      .sg-header-status {
        font-size: 11px; opacity: 0.75; font-weight: 500;
        display: flex; align-items: center; gap: 5px; margin-top: 2px;
      }
      .sg-header-status::before {
        content: '';
        width: 6px; height: 6px; border-radius: 50%;
        background: #34D399;
        box-shadow: 0 0 8px #34D39966;
        animation: sg-status-pulse 2s ease-in-out infinite;
      }
      @keyframes sg-status-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
      .sg-close-btn {
        background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        width: 34px; height: 34px; display: flex; align-items: center;
        justify-content: center; cursor: pointer; color: white;
        transition: all 0.2s; position: relative; z-index: 1;
      }
      .sg-close-btn:hover { background: rgba(255,255,255,0.2); transform: scale(1.05); }

      /* ─── Messages ─── */
      .sg-messages {
        flex: 1; overflow-y: auto; padding: 24px 20px; display: flex;
        flex-direction: column; gap: 16px; min-height: 0;
        background: transparent;
        scrollbar-width: thin;
        scrollbar-color: rgba(255,255,255,0.08) transparent;
      }
      .sg-messages::-webkit-scrollbar { width: 4px; }
      .sg-messages::-webkit-scrollbar-track { background: transparent; }
      .sg-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }

      /* Entrance animation for messages */
      @keyframes sg-msg-in {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .sg-msg {
        max-width: 82%; display: flex; gap: 10px;
        animation: sg-msg-in 0.3s ease-out;
      }
      .sg-msg-user { align-self: flex-end; flex-direction: row-reverse; }
      .sg-msg-bubble {
        padding: 14px 18px; border-radius: 18px; font-size: 13.5px;
        line-height: 1.7; word-wrap: break-word;
      }
      .sg-msg-user .sg-msg-bubble {
        background: linear-gradient(135deg, ${bc}, ${brandDark});
        color: white;
        border-bottom-right-radius: 6px;
        box-shadow: 0 4px 16px ${brandGlow};
      }
      .sg-msg-bot .sg-msg-bubble {
        background: rgba(255,255,255,0.06);
        color: #E2E8F0;
        border: 1px solid rgba(255,255,255,0.06);
        border-bottom-left-radius: 6px;
      }
      .sg-msg-avatar {
        width: 30px; height: 30px; border-radius: 10px; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        font-size: 10px; font-weight: 800; color: white;
        margin-top: 2px; letter-spacing: -0.3px;
      }
      .sg-msg-bot .sg-msg-avatar {
        background: linear-gradient(135deg, ${bc}, ${brandDark});
        box-shadow: 0 2px 8px ${brandGlow};
      }
      .sg-msg-user .sg-msg-avatar {
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.06);
        color: #94A3B8;
      }

      /* ─── Rich Text Formatting inside bot bubbles ─── */
      .sg-msg-bot .sg-msg-bubble strong, .sg-msg-bot .sg-msg-bubble b {
        color: #FFFFFF; font-weight: 700;
      }
      .sg-msg-bot .sg-msg-bubble em, .sg-msg-bot .sg-msg-bubble i {
        color: #CBD5E1; font-style: italic;
      }
      .sg-msg-bot .sg-msg-bubble code {
        background: rgba(255,255,255,0.08); color: #A5B4FC;
        padding: 2px 7px; border-radius: 6px; font-size: 12px;
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        border: 1px solid rgba(255,255,255,0.06);
      }
      .sg-msg-bot .sg-msg-bubble pre {
        background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.06);
        border-radius: 12px; padding: 14px 16px; margin: 10px 0;
        overflow-x: auto; font-size: 12px; line-height: 1.6;
      }
      .sg-msg-bot .sg-msg-bubble pre code {
        background: none; border: none; padding: 0; color: #A5B4FC; font-size: 12px;
      }
      .sg-msg-bot .sg-msg-bubble ul, .sg-msg-bot .sg-msg-bubble ol {
        padding-left: 18px; margin: 8px 0;
      }
      .sg-msg-bot .sg-msg-bubble li {
        margin: 4px 0; color: #CBD5E1;
      }
      .sg-msg-bot .sg-msg-bubble li::marker {
        color: ${bc};
      }
      .sg-msg-bot .sg-msg-bubble h1, .sg-msg-bot .sg-msg-bubble h2,
      .sg-msg-bot .sg-msg-bubble h3, .sg-msg-bot .sg-msg-bubble h4 {
        color: #FFFFFF; margin: 12px 0 6px; font-weight: 700;
      }
      .sg-msg-bot .sg-msg-bubble h1 { font-size: 18px; }
      .sg-msg-bot .sg-msg-bubble h2 { font-size: 16px; }
      .sg-msg-bot .sg-msg-bubble h3 { font-size: 14px; }
      .sg-msg-bot .sg-msg-bubble table {
        width: 100%; border-collapse: collapse; margin: 10px 0;
        font-size: 12px;
      }
      .sg-msg-bot .sg-msg-bubble th {
        background: rgba(255,255,255,0.06); color: #FFFFFF;
        padding: 8px 12px; text-align: left; font-weight: 700;
        border-bottom: 1px solid rgba(255,255,255,0.1);
        font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;
      }
      .sg-msg-bot .sg-msg-bubble td {
        padding: 7px 12px; color: #CBD5E1;
        border-bottom: 1px solid rgba(255,255,255,0.04);
      }
      .sg-msg-bot .sg-msg-bubble tr:hover td {
        background: rgba(255,255,255,0.02);
      }
      .sg-msg-bot .sg-msg-bubble blockquote {
        border-left: 3px solid ${bc};
        padding: 6px 12px; margin: 8px 0;
        background: rgba(255,255,255,0.03);
        border-radius: 0 8px 8px 0;
        color: #94A3B8; font-style: italic;
      }
      .sg-msg-bot .sg-msg-bubble hr {
        border: none; border-top: 1px solid rgba(255,255,255,0.06);
        margin: 12px 0;
      }
      /* KaTeX inside bubbles */
      .sg-msg-bot .sg-msg-bubble .katex-display {
        margin: 12px 0; overflow-x: auto;
      }
      .sg-msg-bot .sg-msg-bubble .katex {
        color: #E2E8F0; font-size: 1.1em;
      }
      .sg-msg-bot .sg-msg-bubble .sg-math-block {
        background: rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 12px; padding: 16px;
        margin: 10px 0; overflow-x: auto;
        text-align: center;
      }
      .sg-msg-bot .sg-msg-bubble .sg-math-inline .katex {
        font-size: 1em;
      }

      /* ─── Typing Indicator ─── */
      .sg-typing {
        display: flex; gap: 5px; padding: 12px 16px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 18px; border-bottom-left-radius: 6px;
        align-self: flex-start; width: fit-content;
        animation: sg-msg-in 0.3s ease-out;
      }
      .sg-typing span {
        width: 7px; height: 7px; border-radius: 50%;
        background: rgba(255,255,255,0.3);
        animation: sg-bounce 1.4s infinite;
      }
      .sg-typing span:nth-child(2) { animation-delay: 0.2s; }
      .sg-typing span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes sg-bounce {
        0%,60%,100% { transform: translateY(0); }
        30% { transform: translateY(-6px); }
      }

      /* ─── Resource Cards ─── */
      .sg-resource {
        margin-top: 8px; padding: 12px 16px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 14px; cursor: pointer;
        transition: all 0.25s;
        animation: sg-msg-in 0.3s ease-out;
      }
      .sg-resource:hover {
        background: rgba(255,255,255,0.08);
        border-color: ${bc}44;
        transform: translateY(-1px);
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      }
      .sg-resource-title {
        font-size: 13px; font-weight: 700; color: #E2E8F0;
        display: flex; align-items: center; gap: 6px;
      }
      .sg-resource-meta {
        font-size: 11px; color: #64748B; margin-top: 4px;
        display: flex; align-items: center; gap: 6px;
      }
      .sg-resource-match {
        background: linear-gradient(135deg, ${bc}, ${brandDark});
        color: white; padding: 2px 8px; border-radius: 6px;
        font-size: 10px; font-weight: 700;
      }

      /* ─── Citation Badge ─── */
      .sg-citation {
        display: inline-flex; align-items: center; gap: 5px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        padding: 3px 10px; margin: 6px 2px 0; font-size: 11px;
        color: #A5B4FC; font-weight: 600; cursor: default;
        vertical-align: middle; transition: all 0.2s;
      }
      .sg-citation:hover { background: rgba(255,255,255,0.1); border-color: ${bc}44; }
      .sg-citation-icon { font-size: 11px; }
      .sg-citation-source {
        max-width: 120px; overflow: hidden; text-overflow: ellipsis;
        white-space: nowrap; color: #94A3B8;
      }
      .sg-citation-score { font-size: 10px; color: ${bc}; font-weight: 700; }

      /* ─── Video Card ─── */
      .sg-video-card {
        margin-top: 8px; border-radius: 14px; overflow: hidden;
        border: 1px solid rgba(255,255,255,0.06);
        background: rgba(0,0,0,0.3);
        transition: all 0.25s;
        animation: sg-msg-in 0.3s ease-out;
      }
      .sg-video-card:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
      .sg-video-card iframe, .sg-video-card video {
        width: 100%; height: 220px; border: none; display: block;
      }
      .sg-video-card video { background: #000; object-fit: cover; }
      .sg-video-meta {
        padding: 10px 14px; background: rgba(255,255,255,0.03);
        display: flex; align-items: center; gap: 10px;
        border-top: 1px solid rgba(255,255,255,0.04);
      }
      .sg-video-icon { font-size: 18px; }
      .sg-video-info { flex: 1; }
      .sg-video-title { font-size: 12px; font-weight: 700; color: #E2E8F0; }
      .sg-video-desc {
        font-size: 11px; color: #64748B; margin-top: 2px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }

      /* ─── KB Resource Links ─── */
      .sg-kb-links {
        margin-top: 8px; display: flex; flex-direction: column; gap: 6px;
        animation: sg-msg-in 0.3s ease-out;
      }
      .sg-kb-link {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 14px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 12px; text-decoration: none; color: #E2E8F0;
        transition: all 0.25s; font-size: 13px;
      }
      .sg-kb-link:hover {
        background: rgba(255,255,255,0.08);
        border-color: ${bc}44;
        transform: translateX(3px);
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      }
      .sg-kb-link-icon { font-size: 18px; flex-shrink: 0; }
      .sg-kb-link-title { font-weight: 700; color: #E2E8F0; }
      .sg-kb-link-desc { font-size: 11px; color: #64748B; margin-top: 2px; }

      /* ─── Calendly ─── */
      .sg-calendly {
        margin-top: 8px; padding: 16px;
        background: rgba(16,185,129,0.08);
        border: 1px solid rgba(16,185,129,0.15);
        border-radius: 14px; text-align: center;
        animation: sg-msg-in 0.3s ease-out;
      }
      .sg-calendly a {
        display: inline-block; padding: 10px 24px;
        background: linear-gradient(135deg, #10B981, #059669);
        color: white; border-radius: 12px; font-weight: 700; font-size: 14px;
        text-decoration: none; transition: all 0.25s;
        box-shadow: 0 4px 16px rgba(16,185,129,0.3);
      }
      .sg-calendly a:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(16,185,129,0.4);
      }

      /* ─── Input Area ─── */
      .sg-input-area {
        padding: 16px 20px; border-top: 1px solid rgba(255,255,255,0.06);
        display: flex; gap: 10px; align-items: center;
        background: rgba(0,0,0,0.15);
      }
      .sg-input {
        flex: 1; padding: 12px 16px;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 14px; font-size: 14px; outline: none;
        font-family: inherit;
        background: rgba(255,255,255,0.05);
        color: #E2E8F0;
        transition: all 0.25s;
      }
      .sg-input:focus {
        border-color: ${bc}66;
        background: rgba(255,255,255,0.08);
        box-shadow: 0 0 0 3px ${bc}15;
      }
      .sg-input::placeholder { color: #4A5568; }

      .sg-mic {
        width: 42px; height: 42px; border-radius: 12px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.08);
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: all 0.25s; color: #4A5568; flex-shrink: 0;
      }
      .sg-mic:hover {
        color: ${bc}; border-color: ${bc}44;
        background: ${bc}10;
      }
      .sg-mic.sg-mic-active {
        color: #EF4444; border-color: #EF4444;
        background: rgba(239,68,68,0.1);
        animation: sg-pulse 1.5s ease-in-out infinite;
      }
      @keyframes sg-pulse {
        0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.3); }
        50% { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
      }

      .sg-send {
        width: 42px; height: 42px; border-radius: 12px;
        background: linear-gradient(135deg, ${bc}, ${brandDark});
        border: none; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: all 0.25s; color: white; flex-shrink: 0;
        box-shadow: 0 2px 12px ${brandGlow};
      }
      .sg-send:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 16px ${brandGlow};
      }
      .sg-send:disabled { opacity: 0.3; cursor: not-allowed; transform: none; box-shadow: none; }

      /* ─── Powered By ─── */
      .sg-powered {
        text-align: center; padding: 10px 16px; font-size: 10px; color: #4A5568;
        background: rgba(0,0,0,0.15);
        border-top: 1px solid rgba(255,255,255,0.04);
        font-weight: 500; letter-spacing: 0.3px;
      }
      .sg-powered a {
        color: ${bc}; text-decoration: none; font-weight: 700;
        transition: color 0.2s;
      }
      .sg-powered a:hover { color: #A5B4FC; }

      /* ─── Mobile Responsive ─── */
      @media (max-width: 480px) {
        #sg-widget-panel {
          position: fixed !important; top: 0 !important; left: 0 !important;
          right: 0 !important; bottom: 0 !important;
          width: 100% !important; max-width: 100% !important; max-height: 100% !important;
          height: 100% !important;
          border-radius: 0 !important; border: none !important;
        }
        #sg-widget-panel .sg-messages { max-height: none; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Build DOM ──
  function buildWidget() {
    const container = document.createElement("div");
    container.id = "sg-widget-container";

    // Panel
    const panel = document.createElement("div");
    panel.id = "sg-widget-panel";
    panel.style[config.position] = "24px";
    panel.innerHTML = `
      <div class="sg-header">
        <div class="sg-header-avatar">SG</div>
        <div class="sg-header-info">
          <div class="sg-header-name">${escapeHtml(config.bot_name)}</div>
          <div class="sg-header-status">Online</div>
        </div>
        <button class="sg-close-btn" id="sg-close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="sg-messages" id="sg-messages"></div>
      <div class="sg-input-area">
        <input class="sg-input" id="sg-input" placeholder="Type your message..." autocomplete="off" />
        <button class="sg-mic" id="sg-mic" title="Voice input">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>
        <button class="sg-send" id="sg-send">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
      <div class="sg-powered">Powered by <a href="#" target="_blank">SalesGen</a></div>
    `;

    // FAB
    const fab = document.createElement("button");
    fab.id = "sg-widget-fab";
    fab.style[config.position] = "24px";
    fab.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    `;

    container.appendChild(panel);
    container.appendChild(fab);
    document.body.appendChild(container);

    // Events
    fab.addEventListener("click", toggleWidget);
    document.getElementById("sg-close").addEventListener("click", toggleWidget);
    document.getElementById("sg-send").addEventListener("click", sendMessage);
    document.getElementById("sg-mic").addEventListener("click", startVoiceInput);
    document.getElementById("sg-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  function applyConfig() {
    const style = document.getElementById("salesgen-widget-styles");
    if (style) style.remove();
    injectStyles();

    const headerName = document.querySelector(".sg-header-name");
    if (headerName) headerName.textContent = config.bot_name;
  }

  // ── Widget Toggle ──
  function toggleWidget() {
    isOpen = !isOpen;
    const panel = document.getElementById("sg-widget-panel");
    const fab = document.getElementById("sg-widget-fab");
    if (isOpen) {
      panel.classList.add("sg-open");
      fab.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      if (messages.length === 0) {
        addBotMessage(config.greeting);
      }
      document.getElementById("sg-input").focus();
    } else {
      panel.classList.remove("sg-open");
      fab.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
    }
  }

  // ── Voice Input ──
  function startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is supported in Chrome and Edge browsers.");
      return;
    }

    const mic = document.getElementById("sg-mic");
    const input = document.getElementById("sg-input");
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    mic.classList.add("sg-mic-active");
    input.placeholder = "🎤 Listening...";

    recognition.onresult = function (event) {
      const transcript = event.results[0][0].transcript;
      input.value = transcript;
      mic.classList.remove("sg-mic-active");
      input.placeholder = "Type your message...";
      input.focus();
    };

    recognition.onerror = function () {
      mic.classList.remove("sg-mic-active");
      input.placeholder = "Type your message...";
    };

    recognition.onend = function () {
      mic.classList.remove("sg-mic-active");
      input.placeholder = "Type your message...";
    };

    recognition.start();
  }

  // ── Markdown + LaTeX Renderer ──
  function renderMarkdown(text) {
    let html = text;

    // ── LaTeX: block math $$...$$ ──
    html = html.replace(/\$\$([^$]+?)\$\$/g, (_, tex) => {
      return `<div class="sg-math-block">${renderTeX(tex.trim(), true)}</div>`;
    });

    // ── LaTeX: inline math $...$ (not $$) ──
    html = html.replace(/(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g, (_, tex) => {
      return `<span class="sg-math-inline">${renderTeX(tex.trim(), false)}</span>`;
    });

    // ── Code blocks ```...``` ──
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code>${escapeHtml(code.trim())}</code></pre>`;
    });

    // ── Inline code `...` ──
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // ── Tables ──
    html = html.replace(/((?:\|.+\|\n?)+)/g, (match) => {
      const rows = match.trim().split('\n').filter(r => r.trim());
      if (rows.length < 2) return match;
      const headerCells = rows[0].split('|').filter(c => c.trim());
      // Check if row 2 is a separator
      const isSeparator = rows[1] && /^\|?[\s-:|]+\|?$/.test(rows[1]);
      const dataStart = isSeparator ? 2 : 1;

      let table = '<table><thead><tr>';
      headerCells.forEach(c => { table += `<th>${c.trim()}</th>`; });
      table += '</tr></thead><tbody>';
      for (let i = dataStart; i < rows.length; i++) {
        const cells = rows[i].split('|').filter(c => c.trim());
        table += '<tr>';
        cells.forEach(c => { table += `<td>${c.trim()}</td>`; });
        table += '</tr>';
      }
      table += '</tbody></table>';
      return table;
    });

    // ── Blockquotes ──
    html = html.replace(/^>\s*(.+)$/gm, '<blockquote>$1</blockquote>');

    // ── Headers ──
    html = html.replace(/^####\s*(.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^###\s*(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s*(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s*(.+)$/gm, '<h1>$1</h1>');

    // ── Horizontal rules ──
    html = html.replace(/^---$/gm, '<hr/>');

    // ── Bold (**text** or __text__) ──
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // ── Italic (*text* or _text_) ──
    html = html.replace(/\*([^*]+?)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+?)_/g, '<em>$1</em>');

    // ── Unordered lists ──
    html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li>.+<\/li>\n?)+)/g, '<ul>$1</ul>');

    // ── Ordered lists ──
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

    // ── Line breaks — double newlines to paragraph breaks ──
    html = html.replace(/\n\n/g, '<br/><br/>');
    html = html.replace(/\n/g, '<br/>');

    return html;
  }

  function renderTeX(tex, displayMode) {
    if (!katexLoaded || !window.katex) {
      // Fallback: show raw LaTeX in a styled code block
      return `<code style="color:#A5B4FC;background:rgba(255,255,255,0.06);padding:4px 8px;border-radius:6px;font-family:monospace;">${escapeHtml(tex)}</code>`;
    }
    try {
      return window.katex.renderToString(tex, {
        displayMode: displayMode,
        throwOnError: false,
        output: "htmlAndMathml",
      });
    } catch (e) {
      return `<code>${escapeHtml(tex)}</code>`;
    }
  }

  // ── Send Message ──
  async function sendMessage() {
    const input = document.getElementById("sg-input");
    const text = input.value.trim();
    if (!text || isLoading) return;

    input.value = "";
    addUserMessage(text);
    showTyping();
    isLoading = true;
    document.getElementById("sg-send").disabled = true;

    try {
      const res = await fetch(`${API_BASE}/chat/${ORG_SLUG}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, session_id: sessionId }),
      });

      removeTyping();
      if (!res.ok) throw new Error("Chat request failed");

      const data = await res.json();
      sessionId = data.session_id;
      localStorage.setItem(`sg_session_${ORG_SLUG}`, sessionId);

      addBotMessage(data.reply, data.resource);

      if (data.resource) {
        addResourceCard(data.resource);
      }

      if (data.kb_resources && data.kb_resources.length > 0) {
        const videos = data.kb_resources.filter(r => r.type === 'video');
        const links = data.kb_resources.filter(r => r.type !== 'video');
        videos.forEach(v => addVideoCard(v));
        if (links.length > 0) addKBResourceLinks(links);
      }

      if (data.show_calendly && data.calendly_link) {
        addCalendlyCard(data.calendly_link);
      }
    } catch (err) {
      removeTyping();
      addBotMessage("Sorry, I'm having trouble connecting. Please try again.");
      console.error("[SalesGen]", err);
    } finally {
      isLoading = false;
      document.getElementById("sg-send").disabled = false;
    }
  }

  // ── Message Rendering ──
  function addUserMessage(text) {
    messages.push({ role: "user", content: text });
    const container = document.getElementById("sg-messages");
    const el = document.createElement("div");
    el.className = "sg-msg sg-msg-user";
    el.innerHTML = `
      <div class="sg-msg-bubble">${escapeHtml(text)}</div>
      <div class="sg-msg-avatar">You</div>
    `;
    container.appendChild(el);
    scrollToBottom();
  }

  function addBotMessage(text, resource) {
    messages.push({ role: "assistant", content: text });
    const container = document.getElementById("sg-messages");
    const el = document.createElement("div");
    el.className = "sg-msg sg-msg-bot";

    // Render with markdown + LaTeX
    let formattedText = renderMarkdown(text);

    if (resource && resource.source_file) {
      const citationBadge = `<span class="sg-citation">` +
        `<span class="sg-citation-icon">📎</span>` +
        `<span class="sg-citation-source">${escapeHtml(resource.source_file)}</span>` +
        `<span class="sg-citation-score">${resource.relevance_score}%</span>` +
        `</span>`;
      formattedText += `<br>${citationBadge}`;
    }

    el.innerHTML = `
      <div class="sg-msg-avatar">SG</div>
      <div class="sg-msg-bubble">${formattedText}</div>
    `;
    container.appendChild(el);
    scrollToBottom();
  }

  function addResourceCard(resource) {
    const container = document.getElementById("sg-messages");
    const el = document.createElement("div");
    el.className = "sg-resource";
    el.innerHTML = `
      <div class="sg-resource-title">📄 ${escapeHtml(resource.title)}</div>
      <div class="sg-resource-meta">
        <span>${escapeHtml(resource.source_file)}</span>
        <span class="sg-resource-match">${resource.relevance_score}% match</span>
      </div>
    `;
    container.appendChild(el);
    scrollToBottom();
  }

  function addVideoCard(resource) {
    const container = document.getElementById("sg-messages");
    const el = document.createElement("div");
    el.className = "sg-video-card";

    let embedHtml = '';
    const url = resource.url || '';

    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
    if (ytMatch) {
      embedHtml = `<iframe src="https://www.youtube.com/embed/${ytMatch[1]}?rel=0" allowfullscreen loading="lazy"></iframe>`;
    } else if (url.includes('vimeo.com')) {
      const vimeoId = url.match(/vimeo\.com\/(\d+)/);
      if (vimeoId) {
        embedHtml = `<iframe src="https://player.vimeo.com/video/${vimeoId[1]}" allowfullscreen loading="lazy"></iframe>`;
      }
    } else if (url.includes('loom.com')) {
      const loomId = url.match(/loom\.com\/share\/(\w+)/);
      if (loomId) {
        embedHtml = `<iframe src="https://www.loom.com/embed/${loomId[1]}" allowfullscreen loading="lazy"></iframe>`;
      }
    } else if (url.includes('drive.google.com')) {
      const driveMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (driveMatch) {
        embedHtml = `<iframe src="https://drive.google.com/file/d/${driveMatch[1]}/preview" allow="autoplay; encrypted-media" allowfullscreen loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups"></iframe>`;
      } else {
        embedHtml = `<div style="padding:24px;text-align:center;">
          <a href="${escapeHtml(url)}" target="_blank" rel="noopener" style="color:#A5B4FC;font-size:14px;font-weight:600;text-decoration:none;">▶ Open Video in Google Drive</a>
        </div>`;
      }
    } else if (url.includes('dropbox.com')) {
      const rawUrl = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '').replace('?dl=1', '');
      embedHtml = `<video controls preload="metadata"><source src="${escapeHtml(rawUrl)}"></video>`;
    } else if (url.match(/\.(mp4|webm|ogg)($|\?)/i) || url.includes('supabase.co/storage')) {
      embedHtml = `<video controls preload="metadata"><source src="${escapeHtml(url)}"></video>`;
    } else {
      embedHtml = `<div style="padding:30px;text-align:center;">
        <a href="${escapeHtml(url)}" target="_blank" rel="noopener" style="color:#A5B4FC;font-size:14px;font-weight:600;text-decoration:none;">▶ Watch Video</a>
      </div>`;
    }

    el.innerHTML = `
      ${embedHtml}
      <div class="sg-video-meta">
        <span class="sg-video-icon">🎥</span>
        <div class="sg-video-info">
          <div class="sg-video-title">${escapeHtml(resource.title)}</div>
          <div class="sg-video-desc">${escapeHtml(resource.description || '')}</div>
        </div>
      </div>
    `;
    container.appendChild(el);
    scrollToBottom();
  }

  function addKBResourceLinks(resources) {
    const container = document.getElementById("sg-messages");
    const wrapper = document.createElement("div");
    wrapper.className = "sg-kb-links";

    resources.forEach(r => {
      const icon = r.type === 'spec' ? '📋' : r.type === 'guide' ? '📖' : r.type === 'doc' ? '📄' : '🔗';
      const link = document.createElement("a");
      link.className = "sg-kb-link";
      link.href = r.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.innerHTML = `
        <span class="sg-kb-link-icon">${icon}</span>
        <div>
          <div class="sg-kb-link-title">${escapeHtml(r.title)}</div>
          <div class="sg-kb-link-desc">${escapeHtml(r.description || '')}</div>
        </div>
      `;
      wrapper.appendChild(link);
    });

    container.appendChild(wrapper);
    scrollToBottom();
  }

  function addCalendlyCard(link) {
    const container = document.getElementById("sg-messages");
    const el = document.createElement("div");
    el.className = "sg-calendly";
    el.innerHTML = `
      <div style="font-size:13px;color:#6EE7B7;margin-bottom:10px;font-weight:600;">Ready to chat with our team?</div>
      <a href="${escapeHtml(link)}" target="_blank" rel="noopener">📅 Book a Call</a>
    `;
    container.appendChild(el);
    scrollToBottom();
  }

  function showTyping() {
    const container = document.getElementById("sg-messages");
    const el = document.createElement("div");
    el.className = "sg-typing";
    el.id = "sg-typing";
    el.innerHTML = "<span></span><span></span><span></span>";
    container.appendChild(el);
    scrollToBottom();
  }

  function removeTyping() {
    const el = document.getElementById("sg-typing");
    if (el) el.remove();
  }

  function scrollToBottom() {
    const container = document.getElementById("sg-messages");
    setTimeout(() => {
      container.scrollTop = container.scrollHeight;
    }, 50);
  }

  // ── Utils ──
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Init ──
  async function init() {
    injectStyles();
    buildWidget();
    await Promise.all([fetchConfig(), loadKaTeX()]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
