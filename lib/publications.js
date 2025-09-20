// Publications rendering (BibTeX-first).
// - Reads a .bib file directly and falls back to JSON array if needed.
// - Home page can pass { onlySelected: true } to show selected items only.
//
// 2025-09-20: Author formatting update
// - Remove comma between last and first name (e.g., "Ge*, Jiahao" -> "Ge* Jiahao")
// - Replace "and" separators with comma in the rendered list
// - Bold all occurrences of specific names (configurable via HIGHLIGHT_NAMES)

// ========== Config ==========
// You can add more names to bold. Comparison ignores case, spaces, hyphens, and '*'.
const HIGHLIGHT_NAMES = [
  "Ge Jiahao"
];

function sanitizeHTML(s){
  return String(s ?? "").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// Normalize string for name comparison (remove *, punctuation, collapse spaces, lowercase)
function _normNameForCompare(s){
  return String(s || "")
    .replace(/\*/g, "")
    .toLowerCase()
    .replace(/[^a-z\p{L}]+/giu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function _shouldHighlight(displayName){
  const n = _normNameForCompare(displayName);
  for (const target of HIGHLIGHT_NAMES){
    if (_normNameForCompare(target) === n) return true;
  }
  return false;
}

// Turn an authors string like
//   "Ge*, Jiahao and Zhou*, Mingjun and Fu, Chi-Wing"
// into safe HTML:
//   "<strong>Ge* Jiahao</strong>, Zhou* Mingjun, Fu Chi-Wing"
function formatAuthors(authorsStr){
  if (!authorsStr) return "";
  // Split by BibTeX-style 'and' (case-insensitive, with spaces around)
  const parts = String(authorsStr).split(/\s+and\s+/i).map(s => s.trim()).filter(Boolean);
  const rendered = parts.map(p => {
    let display = p;
    // If in "Last, First" form, flip to "Last First"
    if (/,/.test(p)){
      const [last, first] = p.split(/,\s*/);
      display = `${(last || "").trim()} ${(first || "").trim()}`.trim();
    }
    // Normalize internal spacing
    display = display.replace(/\s+/g, " ").trim();

    // Escape any user-provided text, then selectively wrap with <strong>
    const escaped = sanitizeHTML(display);
    return _shouldHighlight(display) ? `<strong>${escaped}</strong>` : escaped;
  });
  // Join with commas for front-end display
  return rendered.join(", ");
}

// Very small BibTeX parser good enough for flat { ... } fields.
function parseBibTeX(text){
  const entries = [];
  const entryRe = /@(\w+)\s*\{\s*([^,]+)\s*,([\s\S]*?)\}\s*(?=@|$)/g;
  let m;
  while ((m = entryRe.exec(text))){
    const type = m[1];
    const key = m[2].trim();
    const body = m[3];
    const fields = {};
    const fieldRe = /(\w+)\s*=\s*\{([\s\S]*?)\}\s*,?/g;
    let fm;
    while ((fm = fieldRe.exec(body))){
      const name = fm[1].toLowerCase();
      const value = fm[2].trim();
      fields[name] = value;
    }
    entries.push({ type, key, fields });
  }
  return entries;
}

function mapBibEntryToPub(e){
  const f = e.fields || {};
  const title   = f.title   || "";
  const authorsRaw = f.author  || "";
  const journal = f.journal || "";
  const year    = f.year    || "";
  const venue   = journal;  // 前端不再显示 abbr，只显示期刊全名
  const html    = f.html || "";
  const pdf     = f.pdf  || "";
  const key = e.key || "";

  // selected={true} in .bib
  const selected = String(f.selected || "").toLowerCase() === "true";

  // preview={filename.png}  -> default to assets/ if it looks like a bare file name
  let teaser = f.preview || "";
  if (teaser && !/^https?:\/\//.test(teaser) && !/^\//.test(teaser)){
    teaser = "assets/" + teaser;
  }
  // Fallback image
  if (!teaser) teaser = "assets/teaser1.svg";

  // Minimal BibTeX for the toggle (keeps original authors string)
  const bibtexMin = `@${e.type}{${e.key},\n  title={${title}},\n  author={${authorsRaw}},\n  journal={${journal}},\n  year={${year}}\n}`;

  return {
    teaser,
    title,
    venue,
    authorsHtml: formatAuthors(authorsRaw),
    links: {
      paper: html || undefined,
      pdf:   pdf  || undefined
    },
    bibtex: bibtexMin,
    selected,
    key,
    details: f.details || ""
  };
}

// Template identical to original, but uses authorsHtml and minimal bibtex built above.
function pubTemplate(p, idx){
  const teaser = p.teaser || "assets/teaser1.svg";
  const title = p.title || "Untitled";
  const venue = p.venue ? `<span>${sanitizeHTML(p.venue)}</span>` : "";
  const authorsBlock = p.authorsHtml ? `<div class="pub-meta">${p.authorsHtml}</div>` : "";
  const links = [
    p.links?.paper ? `<a href="${sanitizeHTML(p.links.paper)}" target="_blank" rel="noopener">Paper</a>` : "",
    p.links?.pdf ? `<a href="${sanitizeHTML(p.links.pdf)}" target="_blank" rel="noopener">PDF</a>` : ""
  ].filter(Boolean).join(" · ");
  const bibtexId = `bib-${idx}`;
  const canClick = !!(p.details && p.key);

  // Only teaser image is clickable; info section is plain text/links.
  const teaserBlock = canClick
    ? `<a class="teaser-link" href="publication.html?key=${encodeURIComponent(p.key)}"><img class="teaser" src="${sanitizeHTML(teaser)}" alt="teaser" /></a>`
    : `<img class="teaser" src="${sanitizeHTML(teaser)}" alt="teaser" />`;

  return `<div class="pub-item">
    ${teaserBlock}
    <div class="info">
      <h3 class="pub-title">${sanitizeHTML(title)}</h3>
      <div class="pub-meta">${venue}</div>
      ${authorsBlock}
      ${links ? `<div class="pub-links">${links}</div>` : ""}
      ${p.bibtex ? `<button class="toggle-btn" data-target="${bibtexId}">Show / Hide BibTeX</button>
      <pre id="${bibtexId}" class="bibtex">${sanitizeHTML(p.bibtex)}</pre>` : ""}
    </div>
  </div>`;
}

function bindToggles(container){
  container.querySelectorAll(".toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-target");
      const pre = document.getElementById(id);
      if (!pre) return;
      pre.style.display = pre.style.display === "block" ? "none" : "block";
    });
  });
}

async function fetchText(url){
  const res = await fetch(url + (url.includes("?") ? "&" : "?") + "_=" + Date.now());
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.text();
}

async function fetchJSON(url){
  const res = await fetch(url + (url.includes("?") ? "&" : "?") + "_=" + Date.now());
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

/**
 * Render publications from a .bib file (preferred) or fallback JSON array.
 * @param {string} srcUrl - e.g., 'content/publications.bib' or 'content/publications.json'
 * @param {HTMLElement} mountEl
 * @param {Object} options - { onlySelected?: boolean }
 */
async function renderPublications(srcUrl, mountEl, options = {}){
  const onlySelected = !!options.onlySelected;
  try{
    let list = [];
    if (srcUrl.toLowerCase().endsWith(".bib")){
      const text = await fetchText(srcUrl);
      const entries = parseBibTeX(text);
      list = entries.map(mapBibEntryToPub);
    }else{
      // Backward-compat JSON: expect array of { title, authors, teaser, links:{paper,pdf}, bibtex?, selected? }
      const json = await fetchJSON(srcUrl);
      list = Array.isArray(json) ? json : [];
      // Normalize JSON items minimally to match the template/filters
      list = list.map(p => ({
        teaser: p.teaser || "assets/teaser1.svg",
        title: p.title || "Untitled",
        venue: p.venue || p.journal || "",
        authorsHtml: p.authors ? formatAuthors(p.authors) : "",
        links: p.links || {},
        bibtex: p.bibtex || "",
        selected: !!p.selected
      }));
    }

    if (onlySelected){
      list = list.filter(p => p.selected);
    }

    if (!Array.isArray(list) || !list.length){
      mountEl.innerHTML = "<p>No publications yet.</p>";
      return;
    }

    mountEl.innerHTML = list.map(pubTemplate).join("");
    bindToggles(mountEl);
  }catch(e){
    console.error("Failed to load publications:", e);
    mountEl.innerHTML = "<p>Failed to load publications.</p>";
  }
}

// Expose to global
window.renderPublications = renderPublications;
