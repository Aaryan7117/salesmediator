/**
 * SalesGen Widget SDK — Embeddable AI Sales Agent
 *
 * Usage:
 * <script src="https://cdn.salesgen.com/widget.js" data-org="your-org-slug"></script>
 *
 * The script auto-injects a chat widget, fetches the org's config
 * (colors, greeting, bot name), and handles all communication.
 * Zero dependencies. Works on any website.
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
  let config = {
    bot_name: "AI Assistant",
    greeting: "Hi! How can I help you today?",
    brand_color: "#6366f1",
    position: "right",
    avatar_url: null,
  };

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

  // ── Inject Styles ──
  function injectStyles() {
    const style = document.createElement("style");
    style.id = "salesgen-widget-styles";
    style.textContent = `
      #sg-widget-container * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }

      /* ── FAB ── */
      #sg-widget-fab {
        position: fixed;
        bottom: 20px;
        z-index: 999999;
        width: 56px;
        height: 56px;
        border-radius: 28px;
        border: none;
        background: ${config.brand_color};
        color: white;
        cursor: pointer;
        box-shadow: 0 4px 20px ${config.brand_color}44;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }
      #sg-widget-fab:hover {
        transform: scale(1.08);
        box-shadow: 0 6px 28px ${config.brand_color}66;
      }
      #sg-widget-fab svg {
        width: 24px;
        height: 24px;
        transition: all 0.2s;
      }

      /* ── Panel ── */
      #sg-widget-panel {
        position: fixed;
        bottom: 88px;
        z-index: 999998;
        width: 380px;
        max-height: 560px;
        border-radius: 16px;
        background: #ffffff;
        overflow: hidden;
        box-shadow: 0 12px 48px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
        display: flex;
        flex-direction: column;
        opacity: 0;
        transform: translateY(16px) scale(0.96);
        transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: none;
      }
      #sg-widget-panel.sg-open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: all;
      }

      /* ── Header ── */
      .sg-header {
        background: ${config.brand_color};
        padding: 16px 20px;
        display: flex;
        align-items: center;
        gap: 12px;
        color: white;
        flex-shrink: 0;
      }
      .sg-header-avatar {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: rgba(255,255,255,0.22);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 700;
        flex-shrink: 0;
      }
      .sg-header-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .sg-header-name {
        font-size: 15px;
        font-weight: 600;
        line-height: 1;
      }
      .sg-header-status {
        font-size: 11px;
        opacity: 0.85;
        line-height: 1;
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .sg-status-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #86efac;
        flex-shrink: 0;
      }
      .sg-close-btn {
        background: rgba(255,255,255,0.15);
        border: none;
        border-radius: 8px;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: white;
        flex-shrink: 0;
        transition: background 0.2s;
      }
      .sg-close-btn:hover { background: rgba(255,255,255,0.28); }

      /* ── Messages ── */
      .sg-messages {
        flex: 1;
        overflow-y: auto;
        padding: 12px 16px 16px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        min-height: 300px;
        max-height: 400px;
        background: #f8fafc;
      }
      .sg-msg {
        max-width: 82%;
        display: flex;
        gap: 9px;
        align-items: flex-end;
      }
      .sg-msg-user {
        align-self: flex-end;
        flex-direction: row-reverse;
      }
      .sg-msg-bot {
        align-self: flex-start;
      }
      .sg-msg-bubble {
        padding: 10px 14px;
        border-radius: 14px;
        font-size: 13.5px;
        line-height: 1.55;
        word-wrap: break-word;
      }
      .sg-msg-user .sg-msg-bubble {
        background: ${config.brand_color};
        color: white;
        border-bottom-right-radius: 4px;
      }
      .sg-msg-bot .sg-msg-bubble {
        background: white;
        color: #1e293b;
        border: 1px solid #e2e8f0;
        border-bottom-left-radius: 4px;
      }
      .sg-msg-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 700;
        color: white;
        margin-bottom: 2px;
      }
      .sg-msg-bot .sg-msg-avatar { background: ${config.brand_color}; }
      .sg-msg-user .sg-msg-avatar { background: #94a3b8; }

      /* ── Typing indicator ── */
      .sg-typing {
        display: flex;
        gap: 5px;
        padding: 12px 14px;
        background: white;
        border-radius: 14px;
        border: 1px solid #e2e8f0;
        border-bottom-left-radius: 4px;
        align-self: flex-start;
        width: fit-content;
        align-items: center;
      }
      .sg-typing span {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #94a3b8;
        animation: sg-bounce 1.4s infinite;
      }
      .sg-typing span:nth-child(2) { animation-delay: 0.2s; }
      .sg-typing span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes sg-bounce {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-5px); }
      }

      /* ── Resource card ── */
      .sg-resource {
        padding: 10px 14px;
        background: #f0f4ff;
        border: 1px solid #c7d2fe;
        border-radius: 10px;
        cursor: pointer;
        transition: background 0.2s;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .sg-resource:hover { background: #e0e7ff; }
      .sg-resource-title {
        font-size: 13px;
        font-weight: 600;
        color: ${config.brand_color};
      }
      .sg-resource-meta {
        font-size: 11px;
        color: #64748b;
      }

      /* ── Calendly card ── */
      .sg-calendly {
        padding: 14px 16px;
        background: #ecfdf5;
        border: 1px solid #6ee7b7;
        border-radius: 10px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
      }
      .sg-calendly p {
        font-size: 13px;
        color: #065f46;
      }
      .sg-calendly a {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 9px 22px;
        background: #10b981;
        color: white;
        border-radius: 8px;
        font-weight: 600;
        font-size: 13.5px;
        text-decoration: none;
        transition: background 0.2s;
      }
      .sg-calendly a:hover { background: #059669; }

      /* ── Input area ── */
      .sg-input-area {
        padding: 12px 16px;
        border-top: 1px solid #e8edf4;
        display: flex;
        align-items: center;
        gap: 8px;
        background: white;
        flex-shrink: 0;
      }
      .sg-input {
        flex: 1;
        padding: 10px 14px;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        font-size: 13.5px;
        outline: none;
        font-family: inherit;
        background: #f8fafc;
        transition: border-color 0.2s;
        height: 40px;
        color: #1e293b;
      }
      .sg-input:focus {
        border-color: ${config.brand_color};
        background: #fff;
      }
      .sg-input::placeholder { color: #94a3b8; }
      .sg-send {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: ${config.brand_color};
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        color: white;
        flex-shrink: 0;
      }
      .sg-send:hover { opacity: 0.88; transform: scale(1.05); }
      .sg-send:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

      /* ── Footer ── */
      .sg-powered {
        text-align: center;
        padding: 8px 16px;
        font-size: 10.5px;
        color: #94a3b8;
        background: white;
        border-top: 1px solid #f1f5f9;
        flex-shrink: 0;
        letter-spacing: 0.01em;
      }
      .sg-powered a {
        color: #6366f1;
        text-decoration: none;
        font-weight: 600;
      }

      /* ── Responsive ── */
      @media (max-width: 480px) {
        #sg-widget-panel {
          width: calc(100vw - 24px);
          bottom: 80px;
          border-radius: 12px;
        }
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
    panel.style[config.position] = "20px";
    panel.innerHTML = `
      <div class="sg-header">
        <div class="sg-header-avatar">SG</div>
        <div class="sg-header-info">
          <div class="sg-header-name">${escapeHtml(config.bot_name)}</div>
          <div class="sg-header-status">
            <span class="sg-status-dot"></span>
            Online
          </div>
        </div>
        <button class="sg-close-btn" id="sg-close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="sg-messages" id="sg-messages"></div>
      <div class="sg-input-area">
        <input class="sg-input" id="sg-input" placeholder="Type your message..." autocomplete="off" />
        <button class="sg-send" id="sg-send">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
      <div class="sg-powered">Powered by <a href="#" target="_blank">SalesGen</a></div>
    `;

    // FAB
    const fab = document.createElement("button");
    fab.id = "sg-widget-fab";
    fab.style[config.position] = "20px";
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
      fab.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      if (messages.length === 0) {
        addBotMessage(config.greeting);
      }
      document.getElementById("sg-input").focus();
    } else {
      panel.classList.remove("sg-open");
      fab.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
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

      addBotMessage(data.reply);

      if (data.resource) {
        addResourceCard(data.resource);
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

  function addBotMessage(text) {
    messages.push({ role: "assistant", content: text });
    const container = document.getElementById("sg-messages");
    const el = document.createElement("div");
    el.className = "sg-msg sg-msg-bot";
    el.innerHTML = `
      <div class="sg-msg-avatar">SG</div>
      <div class="sg-msg-bubble">${escapeHtml(text)}</div>
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
      <div class="sg-resource-meta">${escapeHtml(resource.source_file)} · ${resource.relevance_score}% match</div>
    `;
    container.appendChild(el);
    scrollToBottom();
  }

  function addCalendlyCard(link) {
    const container = document.getElementById("sg-messages");
    const el = document.createElement("div");
    el.className = "sg-calendly";
    el.innerHTML = `
      <p>Ready to chat with our team?</p>
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
    await fetchConfig();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();