/**
 * Small, dependency-free Markdown renderer for untrusted model output.
 * HTML is escaped before formatting; only HTTP(S) URLs become links.
 */
export function escapeHTML(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function renderMarkdown(text) {
  let safe = escapeHTML(text);
  const blocks = [];
  safe = safe.replace(/```([^\n]*)\n?([\s\S]*?)```/g, (_, language, body) => `@@CODE_${blocks.push({ language: language.trim(), body }) - 1}@@`);
  safe = safe.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  safe = safe.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  safe = safe.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  safe = safe.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
    const cleaned = url.replace(/[),.!?]+$/, "");
    return `<a href="${cleaned}" target="_blank" rel="noopener noreferrer">${cleaned}</a>${url.slice(cleaned.length)}`;
  });
  safe = safe.replace(/(^|\n)[ \t]*[-*] (.+)/g, "$1• $2");
  safe = `<p>${safe.replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>")}</p>`;
  blocks.forEach((block, index) => {
    const lang = block.language ? ` data-language="${escapeHTML(block.language)}"` : "";
    safe = safe.replace(`@@CODE_${index}@@`, `<pre${lang}><code>${block.body}</code></pre>`);
  });
  return safe;
}
