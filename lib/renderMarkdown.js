// Minimal Markdown renderer (headings, lists, bold/italic, links, paragraphs)
// 备注：控制台报错信息可保留中文，但用户可见提示切换为英文。

function mdToHtml(md){
  if(!md) return "";
  // escape HTML
  md = md.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

  // normalize line endings
  md = md.replace(/\r\n/g,"\n");

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
    if (/^<h\d|^<ul>|^<li>|^<blockquote>|^<pre>|^<p>|^<table>|^<img|^<h1/.test(block.trim())){
      return block;
    } else {
      return "<p>" + block.replace(/\n/g,"<br>") + "</p>";
    }
  }).join("\n");

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