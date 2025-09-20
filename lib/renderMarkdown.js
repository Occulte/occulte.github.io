// Minimal Markdown renderer (headings, lists, bold/italic, links, paragraphs)
// 备注：控制台报错信息可保留中文，但用户可见提示切换为英文。

function mdToHtml(md){
  if(!md) return "";
  // escape HTML
  md = md.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

  // normalize line endings
  md = md.replace(/\r\n/g,"\n");

  // [NEW] 将 LaTeX 风格 \vspace{...} 转为内部占位符，并确保其为独立块级
  // 允许：纯数字（无单位，使用 step）、或带 px/em/rem
  // 例：\vspace{-2}  \vspace{12px}  \vspace{0.8rem}
  md = md.replace(/\\vspace\s*\{\s*([+-]?\d*\.?\d+(?:px|em|rem)?)\s*\}/g, function(_, payload){
    return "\n\n§§VSPACE[" + payload + "]§§\n\n";
  });

  // headings ###### to #
  md = md.replace(/^###### (.*)$/gm,"<h6>$1</h6>")
         .replace(/^##### (.*)$/gm,"<h5>$1</h5>")
         .replace(/^#### (.*)$/gm,"<h4>$1</h4>")
         .replace(/^### (.*)$/gm,"<h3>$1</h3>")
         .replace(/^## (.*)$/gm,"<h2>$1</h2>")
         .replace(/^# (.*)$/gm,"<h1>$1</h1>");

  // links [text](url)
  md = md.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');

  // bold **text**
  md = md.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>");

  // italic *text*
  md = md.replace(/(^|[^\*])\*(?!\s)(.+?)\*(?!\s)/g,'$1<em>$2</em>');

  // unordered list items
  md = md.replace(/^(?:-|\*) (.*)$/gm,"<li>$1</li>");
  md = md.replace(/(?:<li>.*<\/li>\n?)+/g, match => "<ul>" + match.replace(/\n/g,"") + "</ul>");

  // paragraphs
  md = md.split(/\n{2,}/).map(block => {
    const b = block.trim();
    // [NEW] 占位符应保持块级，不包 <p>
    if (
      /^<h\d/.test(b) ||
      /^<ul>/.test(b) ||
      /^<li>/.test(b) ||
      /^<blockquote>/.test(b) ||
      /^<pre>/.test(b) ||
      /^<p>/.test(b) ||
      /^<table>/.test(b) ||
      /^<img/.test(b) ||
      /^<h1/.test(b) ||
      /^§§VSPACE\[[^\]]+\]§§$/.test(b)
    ){
      return block;
    } else {
      return "<p>" + block.replace(/\n/g,"<br>") + "</p>";
    }
  }).join("\n");
  
  // support </br> as blank line
  md = md.replace(/&lt;\/br&gt;/g, "<br>");

  // 将 VSPACE 占位符替换为实际的间距元素
  //     规则：
  //       - 若是纯数字（如 2 或 -1.5），按 step 变量计算：var(--md-vspace-step, 0.6em)
  //         正值 => 插入固定高度的空白，高度 = number * step
  //         负值 => 插入 0 高度元素并设置 margin-bottom 为负，收紧后续块间距
  //       - 若带单位（px/em/rem），直接按该单位数值执行：
  //         正值 => height: Nunit
  //         负值 => margin-bottom: Nunit（N 为负数）
  md = md.replace(/§§VSPACE\[([^\]]+)\]§§/g, function(_, payload){
    let html = "";
    payload = String(payload).trim();
    const m = payload.match(/^([+-]?\d*\.?\d+)(px|em|rem)?$/);
    if(!m){ return ""; }
    const num = parseFloat(m[1]);
    const unit = m[2] || ""; // 为空表示使用 step
    if (isNaN(num)) return "";

    if (!unit){
      if (num >= 0){
        html = '<div class="md-vspace" style="height: calc(' + num + ' * var(--md-vspace-step, 0.6em));"></div>';
      }else{
        html = '<div class="md-vspace" style="height:0;margin-bottom: calc(' + num + ' * var(--md-vspace-step, 0.6em));"></div>';
      }
    }else{
      if (num >= 0){
        html = '<div class="md-vspace" style="height: ' + num + unit + ';"></div>';
      }else{
        html = '<div class="md-vspace" style="height:0;margin-bottom: ' + num + unit + ';"></div>';
      }
    }
    return html;
  });

  return md;
}

async function renderMarkdown(url, el){
  if(!el) return;
  try{
    const res = await fetch(url + "?_=" + Date.now());
    const txt = await res.text();
    el.innerHTML = mdToHtml(txt);
  }catch(e){
    console.error("加载 Markdown 失败：", e);
    el.innerHTML = "<p style='color:#d33'>Failed to load content.</p>";
  }
}
