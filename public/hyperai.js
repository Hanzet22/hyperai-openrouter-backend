import { initHoudini } from "./houdini.js";
import { initAmbientVisuals } from "./visuals.js";
import { SSEStreamDecoder } from "./sse.js";
import { escapeHTML, renderMarkdown } from "./markdown.js";

    "use strict";

    const API_URL = "/api/chat";
    // Active list is restricted to the models already tested successfully.
    const MODELS = [
      { id: "nvidia/nemotron-3.5-super-vl:free", name: "Nemotron 3.5 Super VL", maker: "NVIDIA", short: "NVIDIA · Free endpoint", group: "NVIDIA · Multimodal", detail: "Model gratis yang sudah kamu uji berhasil. UI chat ini mengirim teks saja.", icon: "N", description: "NVIDIA · multimodal / vision-language" },
      { id: "liquid/lfm-2.5-2.6b:free", name: "Liquid LFM 2.5 · 2.6B", maker: "Liquid AI", short: "Liquid AI · Free endpoint", group: "Liquid AI · Lightweight", detail: "Model ringan yang sudah kamu uji berhasil; batas penggunaan provider tetap berlaku.", icon: "L", description: "Liquid AI · model ringan" },
      { id: "cohere/north-mini-code:free", name: "Cohere North Mini Code", maker: "Cohere", short: "Cohere · Free endpoint", group: "Cohere · Coding", detail: "Model coding yang sudah kamu uji berhasil; batas rate gratis dapat berubah.", icon: "C", description: "Cohere · coding / software engineering" }
    ];
    const THINKING_MODES = [
      { id: "off", name: "⚡ Kilat · Off", subtitle: "Tanpa reasoning tambahan", icon: "⚡" },
      { id: "low", name: "💡 Santai · Low", subtitle: "Usaha berpikir ringan", icon: "L" },
      { id: "medium", name: "⚖️ Standar · Medium", subtitle: "Keseimbangan kecepatan dan analisis", icon: "M" },
      { id: "high", name: "🔍 Teliti · High", subtitle: "Usaha analisis lebih tinggi", icon: "H" },
      { id: "ultra", name: "🚀 Maksimal · Ultra", subtitle: "Usaha reasoning tertinggi yang diminta", icon: "U" }
    ];

    const $ = (selector) => document.querySelector(selector);
    const chat = $("#chat"), welcome = $("#welcome"), promptInput = $("#prompt");
    const sendBtn = $("#sendBtn"), stopBtn = $("#stopBtn"), clearBtn = $("#clearBtn");
    const copyLastBtn = $("#copyLastBtn"), regenBtn = $("#regenBtn");
    const searchToggleBtn = $("#searchToggleBtn"), charCount = $("#charCount"), toast = $("#toast");
    const statusDot = $("#statusDot"), statusText = $("#statusText"), streamStatus = $("#streamStatus");
    const welcomeModal = $("#welcomeModal"), closeModalBtn = $("#closeModalBtn");
    const settingsDialog = $("#settingsDialog"), settingsBtn = $("#settingsBtn");
    const closeSettingsBtn = $("#closeSettingsBtn"), doneSettingsBtn = $("#doneSettingsBtn");
    const settingsThemeBtn = $("#settingsThemeBtn"), settingsMotionBtn = $("#settingsMotionBtn");
    const resetPreferencesBtn = $("#resetPreferencesBtn");
    const modelPicker = $("#modelPicker"), modelTrigger = $("#modelTrigger"), modelMenu = $("#modelMenu");
    const thinkingPicker = $("#thinkingPicker"), thinkingTrigger = $("#thinkingTrigger"), thinkingMenu = $("#thinkingMenu");
    const modelName = $("#modelName"), modelSub = $("#modelSub"), modelChip = $("#modelChip"), modelIdLabel = $("#modelIdLabel");
    const thinkingName = $("#thinkingName"), thinkingSub = $("#thinkingSub");
    const footerModel = $("#footerModel"), themeBtn = $("#themeBtn"), motionBtn = $("#motionBtn"), cursorGlow = $("#cursorGlow");

    let selectedModel = MODELS[0].id;
    let selectedThinking = "medium";
    let messages = [];
    let lastUserPrompt = "";
    let lastAssistantText = "";
    let lastAssistantArticle = null;
    let activeController = null;
    let generating = false;
    let searchEnabled = false;
    let toastTimer = null;
    let requestHadError = false;

    function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
    function safeSet(key, value) { try { localStorage.setItem(key, value); } catch { /* storage can be unavailable */ } }

    function applyTheme(theme) {
      const nextTheme = theme === "light" ? "light" : "dark";
      document.documentElement.dataset.theme = nextTheme;
      themeBtn.textContent = nextTheme === "dark" ? "☀️" : "🌙";
      themeBtn.setAttribute("aria-label", nextTheme === "dark" ? "Beralih ke Day Mode" : "Beralih ke Night Mode");
      themeBtn.title = nextTheme === "dark" ? "Aktifkan Day Mode" : "Aktifkan Night Mode";
      const themeColor = nextTheme === "dark" ? "#080b13" : "#eef3fb";
      document.querySelector('meta[name="theme-color"]').setAttribute("content", themeColor);
      safeSet("hyperai.theme", nextTheme);
      if (settingsThemeBtn) settingsThemeBtn.textContent = nextTheme === "dark" ? "☀️ Beralih ke terang" : "🌙 Beralih ke gelap";
    }
    function applyMotion(enabled) {
      const active = Boolean(enabled);
      document.documentElement.dataset.motion = active ? "advanced" : "basic";
      motionBtn.setAttribute("aria-pressed", String(active));
      motionBtn.textContent = active ? "✦ Advanced Motion: ON" : "✦ Advanced Motion: OFF";
      motionBtn.title = active ? "Matikan animasi lanjutan" : "Aktifkan animasi dan motion lanjutan";
      if (!active) cursorGlow.style.opacity = "0";
      safeSet("hyperai.advancedMotion", active ? "on" : "off");
      if (settingsMotionBtn) { settingsMotionBtn.textContent = active ? "Motion: ON" : "Motion: OFF"; settingsMotionBtn.setAttribute("aria-pressed", String(active)); }
    }
    applyTheme(safeGet("hyperai.theme") || (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
    applyMotion(safeGet("hyperai.advancedMotion") === "on");
    themeBtn.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
    motionBtn.addEventListener("click", () => applyMotion(document.documentElement.dataset.motion !== "advanced"));
    function closeSettings() {
      if (settingsDialog.open) settingsDialog.close();
      settingsBtn.focus({ preventScroll: true });
    }
    settingsBtn.addEventListener("click", () => settingsDialog.showModal());
    closeSettingsBtn.addEventListener("click", closeSettings);
    doneSettingsBtn.addEventListener("click", closeSettings);
    settingsDialog.addEventListener("click", (event) => {
      if (event.target === settingsDialog) closeSettings();
    });
    settingsThemeBtn.addEventListener("click", () => {
      applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    });
    settingsMotionBtn.addEventListener("click", () => {
      applyMotion(document.documentElement.dataset.motion !== "advanced");
    });
    resetPreferencesBtn.addEventListener("click", () => {
      try {
        ["hyperai.theme", "hyperai.advancedMotion", "hyperai.model", "hyperai.thinking"].forEach(key => localStorage.removeItem(key));
      } catch { /* storage may be unavailable */ }
      applyTheme("dark");
      applyMotion(false);
      chooseModel(MODELS[0].id);
      chooseThinking("medium");
      showToast("Preferensi lokal direset.");
    });
    settingsDialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") settingsBtn.focus({ preventScroll: true });
    });

    window.addEventListener("pointermove", (event) => {
      if (document.documentElement.dataset.motion !== "advanced" || event.pointerType === "touch") return;
      cursorGlow.style.left = event.clientX + "px";
      cursorGlow.style.top = event.clientY + "px";
    }, { passive: true });

    function closeWelcomeModal() {
      if (!welcomeModal.isConnected) return;
      welcomeModal.classList.add("is-closing");
      window.setTimeout(() => welcomeModal.remove(), 220);
      promptInput.focus({ preventScroll: true });
    }
    closeModalBtn.addEventListener("click", closeWelcomeModal);
    closeModalBtn.focus({ preventScroll: true });
    welcomeModal.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeWelcomeModal(); return; }
      if (event.key !== "Tab") return;
      const focusable = [...welcomeModal.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(el => el.getClientRects().length);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });

    function updateStatus(text, state = "") {
      statusText.textContent = text;
      statusDot.className = "status-dot" + (state ? ` ${state}` : "");
    }
    function showToast(message) {
      window.clearTimeout(toastTimer);
      toast.textContent = message;
      toast.classList.add("show");
      toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2600);
    }

    function renderPickerOptions(menu, items, selectedId, onSelect, kind) {
      menu.replaceChildren();
      for (const item of items) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "picker-option";
        button.setAttribute("role", "option");
        button.setAttribute("aria-selected", String(item.id === selectedId));
        button.dataset.value = item.id;
        const icon = document.createElement("span");
        icon.className = "option-icon";
        icon.textContent = item.icon || "•";
        const copy = document.createElement("span");
        copy.className = "option-copy";
        const title = document.createElement("span");
        title.className = "option-title";
        title.textContent = kind === "model" ? item.name : item.name;
        const desc = document.createElement("span");
        desc.className = "option-desc";
        desc.textContent = kind === "model" ? item.description : item.subtitle;
        const check = document.createElement("span");
        check.className = "option-check";
        check.textContent = "✓";
        copy.append(title, desc);
        button.append(icon, copy, check);
        button.addEventListener("click", () => onSelect(item.id));
        menu.appendChild(button);
      }
    }
    function closePickers(except = null) {
      for (const [picker, trigger, menu] of [[modelPicker, modelTrigger, modelMenu], [thinkingPicker, thinkingTrigger, thinkingMenu]]) {
        if (picker === except) continue;
        picker.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");
        menu.hidden = true;
      }
    }
    function togglePicker(picker, trigger, menu) {
      const shouldOpen = menu.hidden;
      closePickers(picker);
      menu.hidden = !shouldOpen;
      picker.classList.toggle("open", shouldOpen);
      trigger.setAttribute("aria-expanded", String(shouldOpen));
      if (shouldOpen) {
        const selected = menu.querySelector('[aria-selected="true"]');
        (selected || menu.querySelector("button"))?.focus({ preventScroll: true });
      }
    }
    function chooseModel(id) {
      const selected = MODELS.find(model => model.id === id);
      if (!selected) return;
      selectedModel = selected.id;
      modelName.textContent = selected.name;
      modelSub.textContent = selected.short;
      modelChip.textContent = selected.group;
      modelIdLabel.textContent = selected.id;
      footerModel.textContent = `Model: ${selected.name}`;
      renderPickerOptions(modelMenu, MODELS, selectedModel, chooseModel, "model");
      closePickers();
      safeSet("hyperai.model", selectedModel);
    }
    function chooseThinking(id) {
      const selected = THINKING_MODES.find(mode => mode.id === id);
      if (!selected) return;
      selectedThinking = selected.id;
      thinkingName.textContent = selected.name;
      thinkingSub.textContent = selected.subtitle;
      renderPickerOptions(thinkingMenu, THINKING_MODES, selectedThinking, chooseThinking, "thinking");
      closePickers();
      safeSet("hyperai.thinking", selectedThinking);
    }
    modelTrigger.addEventListener("click", () => togglePicker(modelPicker, modelTrigger, modelMenu));
    thinkingTrigger.addEventListener("click", () => togglePicker(thinkingPicker, thinkingTrigger, thinkingMenu));
    document.addEventListener("click", (event) => {
      if (!modelPicker.contains(event.target) && !thinkingPicker.contains(event.target)) closePickers();
    });
    document.addEventListener("focusin", (event) => {
      if (!modelPicker.contains(event.target) && !thinkingPicker.contains(event.target)) closePickers();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        const activeTrigger = !modelMenu.hidden ? modelTrigger : (!thinkingMenu.hidden ? thinkingTrigger : null);
        closePickers();
        if (activeTrigger) { activeTrigger.focus({ preventScroll: true }); event.stopPropagation(); }
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      const activeMenu = !modelMenu.hidden ? modelMenu : (!thinkingMenu.hidden ? thinkingMenu : null);
      if (!activeMenu) return;
      const options = [...activeMenu.querySelectorAll("button:not(:disabled)")];
      if (!options.length) return;
      const current = options.indexOf(document.activeElement);
      let next = current;
      if (event.key === "ArrowDown") next = (current + 1) % options.length;
      if (event.key === "ArrowUp") next = (current - 1 + options.length) % options.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = options.length - 1;
      event.preventDefault(); options[next]?.focus();
    });

    const savedModel = safeGet("hyperai.model");
    if (MODELS.some(model => model.id === savedModel)) selectedModel = savedModel;
    const savedThinking = safeGet("hyperai.thinking");
    if (THINKING_MODES.some(mode => mode.id === savedThinking)) selectedThinking = savedThinking;
    renderPickerOptions(modelMenu, MODELS, selectedModel, chooseModel, "model");
    renderPickerOptions(thinkingMenu, THINKING_MODES, selectedThinking, chooseThinking, "thinking");
    chooseModel(selectedModel);
    chooseThinking(selectedThinking);

    searchToggleBtn.addEventListener("click", () => {
      searchEnabled = !searchEnabled;
      searchToggleBtn.textContent = searchEnabled ? "🌐 Web: AKTIF" : "🌐 Web: MATI";
      searchToggleBtn.classList.toggle("search-active", searchEnabled);
      searchToggleBtn.setAttribute("aria-pressed", String(searchEnabled));
      showToast(searchEnabled ? "Pencarian web diminta untuk respons selanjutnya." : "Pencarian web dimatikan.");
    });

    function autoResize() {
      promptInput.style.height = "auto";
      promptInput.style.height = Math.min(promptInput.scrollHeight, 160) + "px";
      charCount.textContent = `${promptInput.value.length} / 12000`;
    }
    promptInput.addEventListener("input", autoResize);
    promptInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault(); sendMessage();
      }
    });
    async function copyText(text) {
      if (!text) return false;
      try {
        await navigator.clipboard.writeText(text);
        showToast("Pesan disalin.");
        return true;
      } catch {
        const temporary = document.createElement("textarea");
        temporary.value = text;
        temporary.setAttribute("readonly", "");
        temporary.style.position = "fixed";
        temporary.style.opacity = "0";
        document.body.appendChild(temporary);
        temporary.select();
        let copied = false;
        try { copied = document.execCommand("copy"); } catch { copied = false; }
        temporary.remove();
        showToast(copied ? "Pesan disalin." : "Clipboard tidak tersedia di browser ini.");
        return copied;
      }
    }
    function retryLastResponse() {
      if (generating || !lastUserPrompt) return;
      if (messages.at(-1)?.role === "assistant") messages.pop();
      if (lastAssistantArticle?.isConnected) lastAssistantArticle.remove();
      lastAssistantText = "";
      lastAssistantArticle = null;
      syncActionButtons();
      sendMessage(lastUserPrompt, { skipUserBubble: true });
    }
    function createMessage(role, content = "") {
      if (welcome && welcome.isConnected) welcome.style.display = "none";
      const article = document.createElement("article");
      article.className = `message ${role}`;
      const avatar = document.createElement("div"); avatar.className = "avatar"; avatar.textContent = role === "user" ? "YOU" : "AI"; avatar.setAttribute("aria-hidden", "true");
      const wrap = document.createElement("div"); wrap.className = "bubble-wrap";
      const meta = document.createElement("div"); meta.className = "meta"; meta.textContent = role === "user" ? "USER" : "HYPERAI";
      const bubble = document.createElement("div"); bubble.className = "bubble"; if (content) bubble.innerHTML = renderMarkdown(content);
      wrap.append(meta, bubble);
      let copyButton = null, retryButton = null;
      if (role === "assistant") {
        const actions = document.createElement("div");
        actions.className = "message-actions";
        copyButton = document.createElement("button");
        copyButton.type = "button";
        copyButton.className = "message-action message-copy";
        copyButton.textContent = "Salin";
        copyButton.disabled = !content;
        copyButton.setAttribute("aria-label", "Salin jawaban ini");
        copyButton.addEventListener("click", () => copyText(bubble.innerText || bubble.textContent || ""));
        retryButton = document.createElement("button");
        retryButton.type = "button";
        retryButton.className = "message-action message-retry";
        retryButton.textContent = "↻ Coba lagi";
        retryButton.hidden = true;
        retryButton.addEventListener("click", retryLastResponse);
        actions.append(copyButton, retryButton);
        wrap.appendChild(actions);
      }
      article.append(avatar, wrap); chat.appendChild(article); chat.scrollTop = chat.scrollHeight;
      return { article, bubble, copyButton, retryButton };
    }
    function syncActionButtons() { copyLastBtn.disabled = !lastAssistantText; regenBtn.disabled = !lastUserPrompt || generating; }
    function setGenerating(value) {
      generating = value;
      sendBtn.style.display = value ? "none" : "grid"; stopBtn.style.display = value ? "grid" : "none";
      promptInput.disabled = value; modelTrigger.disabled = value; thinkingTrigger.disabled = value;
      searchToggleBtn.disabled = value; clearBtn.disabled = value;
      updateStatus(value ? "Berpikir…" : "Siap", value ? "busy" : "");
      syncActionButtons();
    }
    async function readErrorResponse(response) {
      const contentType = response.headers.get("content-type") || "";
      try {
        if (contentType.includes("application/json")) {
          const data = await response.json();
          return data?.error?.message || data?.error || data?.message || `HTTP ${response.status}`;
        }
        return (await response.text()).trim().slice(0, 500) || `HTTP ${response.status}`;
      } catch { return `HTTP ${response.status}`; }
    }
    async function sendMessage(customPrompt = null, options = {}) {
      if (generating) return;
      const prompt = String(customPrompt ?? promptInput.value).trim();
      if (!prompt) return;
      const skipUserBubble = Boolean(options.skipUserBubble);
      if (lastAssistantArticle?.isConnected) {
        const previousRetry = lastAssistantArticle.querySelector(".message-retry");
        if (previousRetry) previousRetry.hidden = true;
      }
      lastUserPrompt = prompt; lastAssistantText = ""; lastAssistantArticle = null; syncActionButtons();
      if (!skipUserBubble) { messages.push({ role: "user", content: prompt }); createMessage("user", prompt); }
      promptInput.value = ""; autoResize();
      const assistantMessage = createMessage("assistant");
      const aiBubble = assistantMessage.bubble;
      lastAssistantArticle = assistantMessage.article;
      const copyMessageBtn = assistantMessage.copyButton;
      const retryMessageBtn = assistantMessage.retryButton;
      aiBubble.innerHTML = '<span class="typing" aria-label="HyperAI sedang mengetik"><i></i><i></i><i></i></span>';
      closePickers();
      setGenerating(true); streamStatus.textContent = "HyperAI sedang menyiapkan respons.";
      activeController = new AbortController();
      let fullText = "";
      requestHadError = false;
      try {
        const response = await fetch(API_URL, {
          method: "POST", signal: activeController.signal,
          headers: { "Content-Type": "application/json", "Accept": "text/event-stream, application/json" },
          body: JSON.stringify({ model: selectedModel, messages: messages.slice(-80), thinkingLevel: selectedThinking, enableSearch: searchEnabled })
        });
        if (!response.ok) throw new Error(await readErrorResponse(response));
        if (!response.body) throw new Error("Browser tidak menerima stream dari server.");
        const reader = response.body.getReader(); const decoder = new TextDecoder();
        const appendDelta = (delta) => { fullText += delta; aiBubble.innerHTML = renderMarkdown(fullText); chat.scrollTop = chat.scrollHeight; };
        const streamDecoder = new SSEStreamDecoder(appendDelta);
        while (!streamDecoder.done) {
          const result = await reader.read();
          if (result.done) break;
          streamDecoder.push(decoder.decode(result.value, { stream: true }));
        }
        streamDecoder.push(decoder.decode());
        streamDecoder.finish();
        try { await reader.cancel(); } catch { /* stream may already be closed */ }
        if (!fullText.trim()) throw new Error("Respons kosong. Model mungkin tidak kompatibel atau sedang tidak tersedia.");
        messages.push({ role: "assistant", content: fullText }); lastAssistantText = fullText;
        if (copyMessageBtn) copyMessageBtn.disabled = false;
        updateStatus("Siap", "");
        streamStatus.textContent = "Respons HyperAI selesai.";
      } catch (error) {
        if (error?.name === "AbortError") {
          streamStatus.textContent = "Respons dihentikan.";
          aiBubble.innerHTML = `<p><em>${fullText ? "Respons dihentikan. Teks yang sudah diterima belum disimpan ke riwayat model." : "Percakapan dihentikan."}</em></p>`;
          if (retryMessageBtn) retryMessageBtn.hidden = false;
        } else {
          streamStatus.textContent = "Respons gagal dimuat.";
          aiBubble.innerHTML = `<p style="color:var(--danger)"><strong>Gagal:</strong> ${escapeHTML(error?.message || "Terjadi kesalahan yang tidak diketahui.")}</p>`;
          requestHadError = true;
          if (retryMessageBtn) retryMessageBtn.hidden = false;
          showToast("Gagal memuat respons. Cek model/backend lalu coba lagi."); updateStatus("Error", "error");
        }
      } finally {
        activeController = null; setGenerating(false);
        if (requestHadError) updateStatus("Error", "error");
        promptInput.focus({ preventScroll: true });
      }
    }
    sendBtn.addEventListener("click", () => sendMessage());
    stopBtn.addEventListener("click", () => activeController?.abort());
    clearBtn.addEventListener("click", () => {
      activeController?.abort(); messages = []; lastUserPrompt = ""; lastAssistantText = ""; lastAssistantArticle = null;
      chat.replaceChildren(welcome); welcome.style.display = ""; setGenerating(false); updateStatus("Siap", ""); syncActionButtons(); showToast("Percakapan dibersihkan.");
    });
    copyLastBtn.addEventListener("click", () => copyText(lastAssistantText));
    regenBtn.addEventListener("click", retryLastResponse);
    document.querySelectorAll("[data-prompt]").forEach(button => button.addEventListener("click", () => {
      promptInput.value = button.dataset.prompt || ""; autoResize(); promptInput.focus();
    }));
    updateStatus("Siap", ""); autoResize(); syncActionButtons();

initHoudini();
initAmbientVisuals();
