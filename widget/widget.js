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
      #sg-widget-container * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      #sg-widget-fab {
        position: fixed; bottom: 20px; z-index: 999999;
        width: 56px; height: 56px; border-radius: 28px; border: none;
        background: ${config.brand_color}; color: white; cursor: pointer;
        box-shadow: 0 4px 20px ${config.brand_color}44;
        display: flex; align-items: center; justify-content: center;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }
      #sg-widget-fab:hover { transform: scale(1.08); box-shadow: 0 6px 28px ${config.brand_color}66; }
      #sg-widget-fab svg { width: 24px; height: 24px; transition: all 0.2s; }

      #sg-widget-panel {
        position: fixed; bottom: 88px; z-index: 999998;
        width: 500px; height: 80vh; border-radius: 16px;
        background: #ffffff; overflow: hidden;
        box-shadow: 0 12px 48px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08);
        display: flex; flex-direction: column;
        opacity: 0; transform: translateY(16px) scale(0.96);
        transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: none;
      }
      #sg-widget-panel.sg-open {
        opacity: 1; transform: translateY(0) scale(1); pointer-events: all;
      }

      .sg-header {
        background: ${config.brand_color}; padding: 16px 20px;
        display: flex; align-items: center; gap: 12px; color: white;
      }
      .sg-header-avatar {
        width: 36px; height: 36px; border-radius: 50%;
        background: rgba(255,255,255,0.2);
        display: flex; align-items: center; justify-content: center;
        font-size: 14px; font-weight: 700;
      }
      .sg-header-info { flex: 1; }
      .sg-header-name { font-size: 15px; font-weight: 600; }
      .sg-header-status { font-size: 12px; opacity: 0.8; }
      .sg-close-btn {
        background: rgba(255,255,255,0.15); border: none; border-radius: 8px;
        width: 32px; height: 32px; display: flex; align-items: center;
        justify-content: center; cursor: pointer; color: white;
        transition: background 0.2s;
      }
      .sg-close-btn:hover { background: rgba(255,255,255,0.25); }

      .sg-messages {
        flex: 1; overflow-y: auto; padding: 16px; display: flex;
        flex-direction: column; gap: 12px; min-height: 0;
        background: #f8fafc;
      }
      .sg-msg { max-width: 80%; display: flex; gap: 8px; }
      .sg-msg-user {
        align-self: flex-end; flex-direction: row-reverse;
      }
      .sg-msg-bubble {
        padding: 10px 14px; border-radius: 14px; font-size: 14px;
        line-height: 1.5; word-wrap: break-word;
      }
      .sg-msg-user .sg-msg-bubble {
        background: ${config.brand_color}; color: white;
        border-bottom-right-radius: 4px;
      }
      .sg-msg-bot .sg-msg-bubble {
        background: white; color: #1e293b;
        border: 1px solid #e2e8f0; border-bottom-left-radius: 4px;
      }
      .sg-msg-avatar {
        width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        font-size: 11px; font-weight: 700; color: white;
      }
      .sg-msg-bot .sg-msg-avatar { background: ${config.brand_color}; }
      .sg-msg-user .sg-msg-avatar { background: #64748b; }

      .sg-typing { display: flex; gap: 4px; padding: 10px 14px;
        background: white; border-radius: 14px; border: 1px solid #e2e8f0;
        align-self: flex-start; width: fit-content; }
      .sg-typing span {
        width: 7px; height: 7px; border-radius: 50%; background: #94a3b8;
        animation: sg-bounce 1.4s infinite; }
      .sg-typing span:nth-child(2) { animation-delay: 0.2s; }
      .sg-typing span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes sg-bounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }

      .sg-resource {
        margin-top: 8px; padding: 10px 14px; background: #f0f4ff;
        border: 1px solid #c7d2fe; border-radius: 10px; cursor: pointer;
        transition: background 0.2s;
      }
      .sg-resource:hover { background: #e0e7ff; }
      .sg-resource-title { font-size: 13px; font-weight: 600; color: ${config.brand_color}; }
      .sg-resource-meta { font-size: 11px; color: #64748b; margin-top: 2px; }

      /* Citation badge inline in bot message */
      .sg-citation {
        display: inline-flex; align-items: center; gap: 4px;
        background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 6px;
        padding: 2px 8px; margin: 4px 2px; font-size: 11px; color: #4338ca;
        font-weight: 600; cursor: default; vertical-align: middle;
        transition: background 0.2s;
      }
      .sg-citation:hover { background: #e0e7ff; }
      .sg-citation-icon { font-size: 10px; }
      .sg-citation-source { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sg-citation-score { font-size: 10px; color: #6366f1; font-weight: 500; }

      /* Video embed card */
      .sg-video-card {
        margin-top: 8px; border-radius: 10px; overflow: hidden;
        border: 1px solid #e2e8f0; background: #0f172a;
        transition: transform 0.2s;
      }
      .sg-video-card:hover { transform: scale(1.01); }
      .sg-video-card iframe, .sg-video-card video {
        width: 100%; height: 280px; border: none; display: block;
      }
      .sg-video-card video { background: #000; object-fit: cover; }
      .sg-video-meta {
        padding: 8px 12px; background: white;
        display: flex; align-items: center; gap: 8px;
      }
      .sg-video-icon { font-size: 16px; }
      .sg-video-info { flex: 1; }
      .sg-video-title { font-size: 12px; font-weight: 600; color: #1e293b; }
      .sg-video-desc { font-size: 11px; color: #64748b; margin-top: 1px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      /* KB Resource link cards (for unqualified leads) */
      .sg-kb-links { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }
      .sg-kb-link {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0;
        border-radius: 8px; text-decoration: none; color: #1e293b;
        transition: all 0.2s; font-size: 13px;
      }
      .sg-kb-link:hover { background: #f0f4ff; border-color: ${config.brand_color}; transform: translateX(2px); }
      .sg-kb-link-icon { font-size: 16px; flex-shrink: 0; }
      .sg-kb-link-title { font-weight: 600; }
      .sg-kb-link-desc { font-size: 11px; color: #64748b; margin-top: 1px; }

      .sg-calendly {
        margin-top: 8px; padding: 12px; background: #ecfdf5;
        border: 1px solid #6ee7b7; border-radius: 10px; text-align: center;
      }
      .sg-calendly a {
        display: inline-block; padding: 8px 20px; background: #10b981;
        color: white; border-radius: 8px; font-weight: 600; font-size: 14px;
        text-decoration: none; transition: background 0.2s;
      }
      .sg-calendly a:hover { background: #059669; }

      .sg-input-area {
        padding: 12px 16px; border-top: 1px solid #e2e8f0;
        display: flex; gap: 8px; background: white;
      }
      .sg-input {
        flex: 1; padding: 10px 14px; border: 1px solid #e2e8f0;
        border-radius: 10px; font-size: 14px; outline: none;
        font-family: inherit; background: #f8fafc;
        transition: border-color 0.2s;
      }
      .sg-input:focus { border-color: ${config.brand_color}; }
      .sg-input::placeholder { color: #94a3b8; }
      .sg-mic {
        width: 40px; height: 40px; border-radius: 10px;
        background: transparent; border: 1px solid #e2e8f0; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: all 0.2s; color: #94a3b8; flex-shrink: 0;
      }
      .sg-mic:hover { color: ${config.brand_color}; border-color: ${config.brand_color}; }
      .sg-mic.sg-mic-active { color: #ef4444; border-color: #ef4444; background: #fef2f2; animation: sg-pulse 1.5s ease-in-out infinite; }
      @keyframes sg-pulse {
        0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.3); }
        50% { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
      }

      .sg-send {
        width: 40px; height: 40px; border-radius: 10px;
        background: ${config.brand_color}; border: none; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: all 0.2s; color: white; flex-shrink: 0;
      }
      .sg-send:hover { opacity: 0.9; transform: scale(1.05); }
      .sg-send:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

      .sg-powered {
        text-align: center; padding: 6px; font-size: 10px; color: #94a3b8;
        background: white; border-top: 1px solid #f1f5f9;
      }
      .sg-powered a { color: #6366f1; text-decoration: none; font-weight: 600; }

      @media (max-width: 480px) {
        #sg-widget-panel {
          position: fixed !important; top: 0 !important; left: 0 !important;
          right: 0 !important; bottom: 0 !important;
          width: 100% !important; max-height: 100% !important;
          border-radius: 0 !important;
        }
        #sg-widget-panel .sg-messages { max-height: none; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Build DOM ──
  function buildWidget() {
    // Container
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
          <div class="sg-header-status">● Online</div>
        </div>
        <button class="sg-close-btn" id="sg-close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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

  // ── Voice Input (Web Speech API) ──
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

    // Visual feedback — mic turns red while listening
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

      // Show resource card if KB matched (citation)
      if (data.resource) {
        addResourceCard(data.resource);
      }

      // Show video and link resources from kb_resources
      if (data.kb_resources && data.kb_resources.length > 0) {
        const videos = data.kb_resources.filter(r => r.type === 'video');
        const links = data.kb_resources.filter(r => r.type !== 'video');
        videos.forEach(v => addVideoCard(v));
        if (links.length > 0) addKBResourceLinks(links);
      }

      // Show Calendly if triggered
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

    // Format reply with citation badges if KB resource was used
    let formattedText = escapeHtml(text);
    if (resource && resource.source_file) {
      // Add inline citation badge at end of message
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
        <span>Source: ${escapeHtml(resource.source_file)}</span>
        <span style="margin-left:6px;background:#6366f1;color:white;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;">${resource.relevance_score}% match</span>
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

    // YouTube embed
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
    if (ytMatch) {
      embedHtml = `<iframe src="https://www.youtube.com/embed/${ytMatch[1]}?rel=0" allowfullscreen loading="lazy"></iframe>`;
    }
    // Vimeo embed
    else if (url.includes('vimeo.com')) {
      const vimeoId = url.match(/vimeo\.com\/(\d+)/);
      if (vimeoId) {
        embedHtml = `<iframe src="https://player.vimeo.com/video/${vimeoId[1]}" allowfullscreen loading="lazy"></iframe>`;
      }
    }
    // Loom embed
    else if (url.includes('loom.com')) {
      const loomId = url.match(/loom\.com\/share\/(\w+)/);
      if (loomId) {
        embedHtml = `<iframe src="https://www.loom.com/embed/${loomId[1]}" allowfullscreen loading="lazy"></iframe>`;
      }
    }
    // Google Drive embed — use proper embed player URL
    else if (url.includes('drive.google.com')) {
      const driveMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (driveMatch) {
        embedHtml = `<iframe src="https://drive.google.com/file/d/${driveMatch[1]}/preview" allow="autoplay; encrypted-media" allowfullscreen loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups"></iframe>`;
      } else {
        // Fallback: open externally
        embedHtml = `<div style="padding:20px;text-align:center;background:#1e293b;">
          <a href="${escapeHtml(url)}" target="_blank" rel="noopener" style="color:#818cf8;font-size:14px;font-weight:600;text-decoration:none;">▶ Open Video in Google Drive</a>
        </div>`;
      }
    }
    // Dropbox — convert share link to raw playable URL
    else if (url.includes('dropbox.com')) {
      const rawUrl = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '').replace('?dl=1', '');
      embedHtml = `<video controls preload="metadata"><source src="${escapeHtml(rawUrl)}"></video>`;
    }
    // Direct video URL (.mp4, .webm, .ogg or Supabase storage URLs)
    else if (url.match(/\.(mp4|webm|ogg)($|\?)/i) || url.includes('supabase.co/storage')) {
      embedHtml = `<video controls preload="metadata"><source src="${escapeHtml(url)}"></video>`;
    }
    // Fallback: clickable link to watch externally
    else {
      embedHtml = `<div style="padding:30px;text-align:center;">
        <a href="${escapeHtml(url)}" target="_blank" rel="noopener" style="color:#6366f1;font-size:14px;font-weight:600;text-decoration:none;">▶ Watch Video</a>
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
      <div style="font-size:13px;color:#065f46;margin-bottom:8px;">Ready to chat with our team?</div>
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
