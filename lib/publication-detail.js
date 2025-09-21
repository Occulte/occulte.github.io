
// Publication detail page renderer.
// Reads publications.bib to find the entry by ?key=...
// Then renders a detail page with centered header (title, authors, affiliations, venue),
// centered teaser (preview) with optional caption, and the body loaded from details md.
// The md body is split into sections by top-level '# ' headings; each section is rendered as
// a titled block, separated by horizontal rules. Custom image tags of the form:
//   <input>image: assets/xxx.png; ratio: 0.8</input>
// are converted to centered responsive images with width = ratio * 100% (keeping aspect).

(function () {
  function qs(sel) { return document.querySelector(sel); }
  function sanitizeHTML(s) {
    return String(s ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function getKeyFromLocation() {
    const u = new URL(location.href);
    const byQuery = u.searchParams.get("key");
    if (byQuery) return byQuery;
    // If no ?key=, derive key from the last path segment (e.g., /LEGOMaker)
    const seg = (u.pathname || "/").replace(/\/+$/, "").split("/").pop();
    if (seg && !/\.html?$/i.test(seg) && seg.toLowerCase() !== "index") return decodeURIComponent(seg);
    return null;
  }

  // === Minimal helpers (no bolding of names on the detail page) ===
  function formatAuthors(authorsStr) {
    if (!authorsStr) return "";
    const parts = String(authorsStr).split(/\s+and\s+/i).map(s => s.trim()).filter(Boolean);
    const rendered = parts.map(p => {
      let display = p;
      if (/,/.test(p)) {
        const [last, first] = p.split(/,\s*/);
        display = `${(last || "").trim()} ${(first || "").trim()}`.trim();
      }
      display = display.replace(/\s+/g, " ").trim();
      return sanitizeHTML(display); // no <strong>
    });
    return rendered.join(", ");
  }

  // UPDATED: detect both '*' (co-authors) and '†' (co-corresponding) markers
  function parseAuthorsDetailed(authorsStr) {
    const parts = String(authorsStr || "").split(/\s+and\s+/i).map(s => s.trim()).filter(Boolean);
    return parts.map(p => {
      const star = /\*/.test(p);
      const dagger = /[\u2020†]/.test(p);
      let display = /,/.test(p) ? p.split(/,\s*/).join(" ") : p;
      display = display.replace(/[\*\u2020†]/g, "").replace(/\s+/g, " ").trim();
      return { display, star, dagger }; // no highlight flag
    });
  }

  // 把 "a, tuple(b, c), d" 这类字符串按顶层逗号拆分
  function splitTopLevelComma(s) {
    s = String(s || "").replace(/tuple\s*\(/gi, "(");
    const out = []; let cur = ""; let depth = 0;
    for (const ch of s) {
      if (ch === "(") depth++;
      else if (ch === ")") depth = Math.max(0, depth - 1);
      if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  // 解析按作者顺序的一组单位（可含 tuple）
  function parseAffiliationsPerAuthor(affStr, nAuthors) {
    const tokens = splitTopLevelComma(affStr);
    // 与作者数不匹配时做容错：多的忽略，少的补空
    const safe = Array.from({ length: nAuthors }, (_, i) => tokens[i] || "");
    return safe.map(tok => {
      const t = tok.trim();
      if (!t) return [];
      if ((t.startsWith("(") && t.endsWith(")"))) {
        return t.slice(1, -1).split(/\s*,\s*/).filter(Boolean);
      }
      return [t];
    });
  }

  function buildAffiliationIndex(perAuthorAffs) {
    const idxMap = new Map(); const ordered = [];
    perAuthorAffs.forEach(list => {
      list.forEach(name => {
        if (!idxMap.has(name)) {
          idxMap.set(name, ordered.length + 1);
          ordered.push(name);
        }
      });
    });
    // 每位作者对应的编号数组
    const authorNums = perAuthorAffs.map(list => {
      const s = new Set(list.map(n => idxMap.get(n)));
      return Array.from(s).filter(Boolean).sort((a, b) => a - b);
    });
    return { ordered, authorNums };
  }

  function parseBibTeX(text) {
    const entries = [];
    const entryRe = /@(\w+)\s*\{\s*([^,]+)\s*,([\s\S]*?)\}\s*(?=@|$)/g;
    let m;
    while ((m = entryRe.exec(text))) {
      const type = m[1];
      const key = m[2].trim();
      const body = m[3];
      const fields = {};
      const fieldRe = /(\w+)\s*=\s*\{([\s\S]*?)\}\s*,?/g;
      let fm;
      while ((fm = fieldRe.exec(body))) {
        const name = fm[1].toLowerCase();
        const value = fm[2].trim();
        fields[name] = value;
      }
      entries.push({ type, key, fields });
    }
    return entries;
  }

  async function fetchText(url) {
    const res = await fetch(url + (url.includes("?") ? "&" : "?") + "_=" + Date.now());
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.text();
  }

  function resolvePath(maybePath) {
    if (!maybePath) return "";
    if (/^https?:\/\//i.test(maybePath) || maybePath.startsWith("/")) return maybePath;
    return "content/" + maybePath;
  }

  // Convert custom <input>image: ...; ratio: ...</input> placeholders into tokens,
  // run through mdToHtml for general markdown, then replace tokens with HTML.
  function processCustomImages(md) {
    const tokens = [];
    const out = md.replace(/<input>\s*image:\s*([^;]+?)\s*;\s*ratio:\s*([0-9.]+)\s*<\/input>/gi, (all, src, ratioStr) => {
      const ratio = Math.max(0.1, Math.min(1.0, parseFloat(ratioStr) || 1.0));
      const idx = tokens.length;
      const html = `<div class="md-img"><img src="${sanitizeHTML(src.trim())}" style="width:${ratio * 100}%;height:auto;display:block;margin:0 auto;" /></div>`;
      tokens.push(html);
      return `{{IMG_TOKEN_${idx}}}`;
    });
    return { out, tokens };
  }
  function restoreCustomImages(html, tokens) {
    return html.replace(/\{\{IMG_TOKEN_(\d+)\}\}/g, (m, i) => tokens[Number(i)] || m);
  }

  // Split markdown into sections by top-level '# ' headings.
  function splitIntoSections(md) {
    const lines = md.replace(/\r\n/g, "\n").split("\n");
    const sections = [];
    let current = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const m = line.match(/^# (.+)\s*$/);
      if (m) {
        if (current) sections.push(current);
        current = { title: m[1].trim(), body: [] };
      } else {
        if (!current) {
          // ignore content before first '# '
          continue;
        }
        current.body.push(line);
      }
    }
    if (current) sections.push(current);
    return sections;
  }


  function buildMinimalBibtex(entry) {
    const f = (entry && entry.fields) ? entry.fields : {};
    const authorsRaw = f.author || "";
    const cleanAuthors = authorsRaw ? authorsRaw.replace(/[\*\u2020†]/g, "") : "";
    const fields = {
      title: f.title || "",
      author: cleanAuthors,
      journal: f.journal || "",
      booktitle: f.booktitle || "",
      year: f.year || ""
    };
    const lines = Object.entries(fields)
      .filter(([_, v]) => v)
      .map(([k, v]) => `  ${k}={${v}}`)
      .join(",\n");
    return `@${entry.type}{${entry.key},\n${lines}\n}`;
  }

  async function render() {
    const key = getKeyFromLocation();
    const mount = qs("#detailMount");
    if (!key) {
      mount.innerHTML = "<p>Missing publication key.</p>";
      return;
    }
    // Load publications.bib & find entry
    let entry;
    try {
      const bibText = await fetchText("content/publications.bib");
      const entries = parseBibTeX(bibText);
      entry = entries.find(e => e.key === key);
    } catch (e) {
      console.error(e);
    }
    if (!entry) {
      mount.innerHTML = "<p>Publication not found.</p>";
      return;
    }
    const f = entry.fields || {};
    const title = f.title || "Untitled";
    const venue = f.journal || f.booktitle || "";
    const year = f.year || "";

    // set page title to paper title
    document.title = title;

    // Replace the visible URL to pretty form "/<key>"
    try {
      const prefix = (location.pathname.match(/^.*\//) || [""])[0];
      history.replaceState({}, "", prefix + encodeURIComponent(key));
    } catch (_) { }

    const authorsArr = parseAuthorsDetailed(f.author || "");
    const hasStar = authorsArr.some(a => a.star);
    const hasDagger = authorsArr.some(a => a.dagger);

    const affStr = f.affiliation || f.affiliations || "";
    const perAuthorAffs = parseAffiliationsPerAuthor(affStr, authorsArr.length);
    const { ordered: affList, authorNums } = buildAffiliationIndex(perAuthorAffs);

    const preview = f.preview ? (/^https?:|^\//.test(f.preview) ? f.preview : "assets/" + f.preview) : "";
    const previewDesc = f.previewdesc || f.desc || f.caption || "";
    const details = resolvePath(f.details || "");

    const authorsGridHtml = `
  <div class="detail-authors author-grid">
    ${authorsArr.map((a, i) => {
      const name = sanitizeHTML(a.display);
      const marks = (a.star ? "*" : "") + (a.dagger ? "†" : "");
      const nums = (authorNums[i] && authorNums[i].length) ? `<sup>${authorNums[i].join(",")}</sup>` : "";
      return `<span class="author-item">${name}${marks}${nums}</span>`;
    }).join("")}
  </div>`;

    const affiliationsGridHtml = affList.length ? `
  <div class="detail-affiliations affil-grid">
    ${affList.map((aff, idx) => `<span class="affil-item"><span class="affil-idx">${idx + 1}</span> ${sanitizeHTML(aff)}</span>`).join("")}
  </div>` : "";

    // Legend row appears right under affiliations (if any marker present).
    const legendItems = [];
    if (hasStar) legendItems.push(`<span class="legend-item"><span class="legend-symbol">*</span> indicates co-authors</span>`);
    if (hasDagger) legendItems.push(`<span class="legend-item"><span class="legend-symbol">†</span> indicates co-corresponding authors</span>`);
    const legendHtml = legendItems.length ? `<div class="detail-legend legend-grid">${legendItems.join('<span class="legend-sep">&nbsp;&nbsp;&nbsp;</span>')}</div>` : "";

    // Header（居中）
    const headerHtml = `
      <div class="detail-header">
        <h1 class="detail-title">${sanitizeHTML(title)}</h1>
    ${authorsGridHtml}
    ${affiliationsGridHtml}
    ${legendHtml}
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
    const bibtexMin = buildMinimalBibtex(entry);
    const bibtexSectionHtml = `\n<section class=\"md-section\">\n  <h2 class=\"md-section-title\">BibTex</h2>\n  <div class=\"md-section-body\">\n    <pre class=\"bibtex detail-bibtex\">${sanitizeHTML(bibtexMin)}</pre>\n  </div>\n</section>`;
    let bodyHtml = "<p>No details provided.</p>";
    if (details) {
      try {
        let md = await fetchText(details);
        // Process custom images first
        const { out: withTokens, tokens } = processCustomImages(md);
        // Use global mdToHtml but we don't want <h1> inside; we'll strip leading headings from body
        // We split into sections by '# ' top-level headings
        const sections = splitIntoSections(withTokens);
        if (sections.length) {
          bodyHtml = sections.map((sec, idx) => {
            const mdBody = sec.body.join("\n").trim();
            const htmlBody = restoreCustomImages(window.mdToHtml(mdBody), tokens);
            return `<section class="md-section">
              <h2 class="md-section-title">${sanitizeHTML(sec.title)}</h2>
              <div class="md-section-body">${htmlBody}</div>
            </section>${idx < sections.length - 1 ? '<hr class="md-sep" />' : ''}`;
          }).join("\n");
        } else {
          // Fallback: render whole md
          bodyHtml = restoreCustomImages(window.mdToHtml(withTokens), tokens);
        }
      } catch (e) {
        console.error("Failed to load details md:", e);
        bodyHtml = "<p style='color:#d33'>Failed to load detail content.</p>";
      }
    }


    mount.innerHTML = `
      <div class="detail-container">
        ${headerHtml}
        ${teaserHtml}
        <article class="detail-body">${bodyHtml}${bibtexSectionHtml}</article>
      </div>
    `;
  }
  // Bootstrap when DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();