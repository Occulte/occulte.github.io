
// Publication detail page renderer.
// Reads publications.bib to find the entry by ?key=...
// Then renders a detail page with centered header (title, authors, affiliations, venue),
// centered teaser (preview) with optional caption, and the body loaded from details md.
// The md body is split into sections by top-level '# ' headings; each section is rendered as
// a titled block, separated by horizontal rules. Custom image tags of the form:
//   <input>image: assets/xxx.png; ratio: 0.8</input>
// are converted to centered responsive images with width = ratio * 100% (keeping aspect).

(function(){
  function qs(sel){ return document.querySelector(sel); }
  function qsp(sel){ return Array.from(document.querySelectorAll(sel)); }
  function getParam(name){
    const u = new URL(location.href);
    return u.searchParams.get(name);
  }
  function sanitizeHTML(s){
    return String(s ?? "").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  // === Copied helpers from publications.js (lightweight versions) ===
  function _normNameForCompare(s){
    return String(s || "")
      .replace(/\*/g, "")
      .toLowerCase()
      .replace(/[^a-z\p{L}]+/giu, " ")
      .trim()
      .replace(/\s+/g, " ");
  }
  const HIGHLIGHT_NAMES = ["Ge Jiahao"];
  function _shouldHighlight(displayName){
    const n = _normNameForCompare(displayName);
    for (const target of HIGHLIGHT_NAMES){
      if (_normNameForCompare(target) === n) return true;
    }
    return false;
  }
  function formatAuthors(authorsStr){
    if (!authorsStr) return "";
    const parts = String(authorsStr).split(/\s+and\s+/i).map(s => s.trim()).filter(Boolean);
    const rendered = parts.map(p => {
      let display = p;
      if (/,/.test(p)){
        const [last, first] = p.split(/,\s*/);
        display = `${(last || "").trim()} ${(first || "").trim()}`.trim();
      }
      display = display.replace(/\s+/g, " ").trim();
      const escaped = sanitizeHTML(display);
      return _shouldHighlight(display) ? `<strong>${escaped}</strong>` : escaped;
    });
    return rendered.join(", ");
  }
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

  async function fetchText(url){
    const res = await fetch(url + (url.includes("?") ? "&" : "?") + "_=" + Date.now());
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.text();
  }

  function resolvePath(maybePath){
    if (!maybePath) return "";
    if (/^https?:\/\//i.test(maybePath) || maybePath.startsWith("/")) return maybePath;
    return "content/" + maybePath;
  }

  // Convert custom <input>image: ...; ratio: ...</input> placeholders into tokens,
  // run through mdToHtml for general markdown, then replace tokens with HTML.
  function processCustomImages(md){
    const tokens = [];
    const out = md.replace(/<input>\s*image:\s*([^;]+?)\s*;\s*ratio:\s*([0-9.]+)\s*<\/input>/gi, (all, src, ratioStr) => {
      const ratio = Math.max(0.1, Math.min(1.0, parseFloat(ratioStr)||1.0));
      const idx = tokens.length;
      const html = `<div class="md-img"><img src="${sanitizeHTML(src.trim())}" style="width:${ratio*100}%;height:auto;display:block;margin:0 auto;" /></div>`;
      tokens.push(html);
      return `{{IMG_TOKEN_${idx}}}`;
    });
    return { out, tokens };
  }
  function restoreCustomImages(html, tokens){
    return html.replace(/\{\{IMG_TOKEN_(\d+)\}\}/g, (m, i) => tokens[Number(i)] || m);
  }

  // Split markdown into sections by top-level '# ' headings.
  function splitIntoSections(md){
    const lines = md.replace(/\r\n/g,"\n").split("\n");
    const sections = [];
    let current = null;
    for (let i=0;i<lines.length;i++){
      const line = lines[i];
      const m = line.match(/^# (.+)\s*$/);
      if (m){
        if (current) sections.push(current);
        current = { title: m[1].trim(), body: [] };
      }else{
        if (!current){
          // ignore content before first '# '
          continue;
        }
        current.body.push(line);
      }
    }
    if (current) sections.push(current);
    return sections;
  }

  async function render(){
    const key = getParam("key");
    const mount = qs("#detailMount");
    if (!key){
      mount.innerHTML = "<p>Missing publication key.</p>";
      return;
    }
    // Load publications.bib & find entry
    let entry;
    try{
      const bibText = await fetchText("content/publications.bib");
      const entries = parseBibTeX(bibText);
      entry = entries.find(e => e.key === key);
    }catch(e){
      console.error(e);
    }
    if (!entry){
      mount.innerHTML = "<p>Publication not found.</p>";
      return;
    }
    const f = entry.fields || {};
    const title = f.title || "Untitled";
    const authorsHtml = formatAuthors(f.author || "");
    const venue = f.journal || "";
    const year = f.year || "";
    const affiliations = f.affiliation || f.affiliations || ""; // optional
    const preview = f.preview ? (/^https?:|^\//.test(f.preview) ? f.preview : "assets/" + f.preview) : "";
    const previewDesc = f.previewdesc || f.desc || f.caption || "";
    const details = resolvePath(f.details || "");

    // Header (centered)
    const headerHtml = `
      <div class="detail-header">
        <h1 class="detail-title">${sanitizeHTML(title)}</h1>
        ${authorsHtml ? `<div class="detail-authors">${authorsHtml}</div>` : ""}
        ${affiliations ? `<div class="detail-affiliations">${sanitizeHTML(affiliations)}</div>` : ""}
        ${venue || year ? `<div class="detail-venue">${sanitizeHTML([venue, year].filter(Boolean).join(", "))}</div>` : ""}
      </div>
    `;

    // Teaser (centered, full width within container)
    const teaserHtml = preview ? `
      <figure class="detail-teaser">
        <img src="${sanitizeHTML(preview)}" alt="teaser" />
        ${previewDesc ? `<figcaption>${sanitizeHTML(previewDesc)}</figcaption>` : ""}
      </figure>
    ` : "";

    // Body
    let bodyHtml = "<p>No details provided.</p>";
    if (details){
      try{
        let md = await fetchText(details);
        // Process custom images first
        const { out: withTokens, tokens } = processCustomImages(md);
        // Use global mdToHtml but we don't want <h1> inside; we'll strip leading headings from body
        // We split into sections by '# ' top-level headings
        const sections = splitIntoSections(withTokens);
        if (sections.length){
          bodyHtml = sections.map((sec, idx) => {
            const mdBody = sec.body.join("\n").trim();
            const htmlBody = restoreCustomImages(window.mdToHtml(mdBody), tokens);
            return `<section class="md-section">
              <h2 class="md-section-title">${sanitizeHTML(sec.title)}</h2>
              <div class="md-section-body">${htmlBody}</div>
            </section>${idx < sections.length-1 ? '<hr class="md-sep" />' : ''}`;
          }).join("\n");
        }else{
          // Fallback: render whole md
          bodyHtml = restoreCustomImages(window.mdToHtml(withTokens), tokens);
        }
      }catch(e){
        console.error("Failed to load details md:", e);
        bodyHtml = "<p style='color:#d33'>Failed to load detail content.</p>";
      }
    }

    
    mount.innerHTML = `
      <div class="detail-container">
        ${headerHtml}
        ${teaserHtml}
        <article class="detail-body">${bodyHtml}</article>
      </div>
    `;
  }
  // Bootstrap when DOM ready
  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", render);
  }else{
    render();
  }
})();
