import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Menu, X, Github, Mail, ChevronLeft, ChevronRight } from 'lucide-react';

const CONTENT_BASE = '/content';
const PROFILE = {
  name: 'Jiahao Ge',
  title: 'PhD Candidate @ CUHK',
  image: '/assets/profile.jpg',
  email: 'jiahaoge@link.cuhk.edu.hk',
  github: 'https://github.com/occulte',
  focuses: ['Computer Graphics', 'Assemble Generation', 'LEGO']
};

const BLOGS = [
  { title: '格利泽-726 - 3 Gliese 726 - Part 3', date: '2022-01-18', slug: 'gliese-726-part-3' },
  { title: '格利泽-726 - 2 Gliese 726 - Part 2', date: '2021-12-29', slug: 'gliese-726-part-2' },
  { title: '格利泽-726 - 1 Gliese 726 - Part 1', date: '2021-12-01', slug: 'gliese-726-part-1' },
  { title: '遂宫 Sui Palace', date: '2018-01-01', slug: 'sui-palace' },
];

const fetchText = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
};

const parseNews = (text) => {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('-'))
    .map(line => line.replace(/^-\s*/, ''))
    .map(line => {
      const separator = line.includes('：') ? '：' : ':';
      const [date, ...rest] = line.split(separator);
      return { date: (date || '').trim(), content: rest.join(separator).trim() };
    })
    .filter(item => item.content);
};

const renderNewsContent = (content) => {
  const regex = /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  let linkIdx = 0;
  
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    parts.push(
      <a
        key={`news-link-${linkIdx}`}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-2 underline-offset-2 hover:opacity-80"
        onClick={(e) => e.stopPropagation()}
      >
        {match[1]}
      </a>
    );
    linkIdx += 1;
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }
  
  return parts.length > 0 ? parts : content;
};

const normalizePreview = (value) => {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const sanitized = value.replace(/^\/+/, '').replace(/^assets\//i, '');
  return `/assets/${sanitized}`;
};

const formatAuthors = (authorsStr) => {
  if (!authorsStr) return '';
  const parts = authorsStr
    .split(/\s+and\s+/i)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => {
      if (/,/.test(p)) {
        const [last, first] = p.split(/,\s*/);
        return `${(last || '').trim()} ${(first || '').trim()}`.trim();
      }
      return p;
    });
  return parts.join(', ');
};

const parseBibTeX = (text) => {
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
};

const mapBibEntryToPub = (entry) => {
  const f = entry.fields || {};
  const preview = normalizePreview(f.preview || '');
  const detailsFile = f.details ? `${CONTENT_BASE}/${f.details}` : null;
  return {
    id: entry.key || f.title || 'untitled',
    abbr: f.abbr || '',
    title: f.title || 'Untitled',
    authors: formatAuthors(f.author || ''),
    affiliation: f.affiliation || '',
    year: f.year || '',
    selected: String(f.selected || '').toLowerCase() === 'true',
    preview,
    previewDesc: f.previewdesc || '',
    detailsFile,
    links: {
      pdf: f.pdf || '',
      html: f.html || '',
      code: f.code || ''
    }
  };
};

// --- COMPONENTS ---

const MarkdownRenderer = ({ content }) => {
  if (!content) return null;
  const lines = content.split('\n');
  const renderLineWithLinksAndFormatting = (line, baseKey) => {
    const elements = [];
    let remainingText = line;
    let elementIdx = 0;
    
    // Process the line character by character to handle nested formatting
    const processText = (text) => {
      const parts = [];
      let currentIdx = 0;
      
      // Combined regex to match links, bold, HTML italic tags, and markdown italic
      // Order matters: bold (**) before italic (*), links first
      const combinedRegex = /(\[(.+?)\]\((https?:\/\/[^\s)]+)\))|(<i>(.+?)<\/i>)|(\*\*(.+?)\*\*)|(\*(.+?)\*)|(__(.+?)__)|(_(.+?)_)/g;
      let match;
      
      while ((match = combinedRegex.exec(text)) !== null) {
        // Add text before the match
        if (match.index > currentIdx) {
          parts.push(text.slice(currentIdx, match.index));
        }
        
        if (match[1]) {
          // Link match [text](url)
          parts.push(
            <a
              key={`${baseKey}-link-${elementIdx++}`}
              href={match[3]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-600 underline decoration-2 underline-offset-4 hover:text-black"
            >
              {match[2]}
            </a>
          );
        } else if (match[4]) {
          // HTML italic tag <i>text</i>
          parts.push(
            <em key={`${baseKey}-i-${elementIdx++}`} className="italic text-neutral-600">
              {match[5]}
            </em>
          );
        } else if (match[6]) {
          // Bold with **
          parts.push(
            <strong key={`${baseKey}-strong-${elementIdx++}`} className="font-bold text-black">
              {match[7]}
            </strong>
          );
        } else if (match[8]) {
          // Italic with * 
          parts.push(
            <em key={`${baseKey}-em-${elementIdx++}`} className="italic text-neutral-600">
              {match[9]}
            </em>
          );
        } else if (match[10]) {
          // Bold with __
          parts.push(
            <strong key={`${baseKey}-strong2-${elementIdx++}`} className="font-bold text-black">
              {match[11]}
            </strong>
          );
        } else if (match[12]) {
          // Italic with _
          parts.push(
            <em key={`${baseKey}-em2-${elementIdx++}`} className="italic text-neutral-600">
              {match[13]}
            </em>
          );
        }
        
        currentIdx = match.index + match[0].length;
      }
      
      // Add remaining text
      if (currentIdx < text.length) {
        parts.push(text.slice(currentIdx));
      }
      
      return parts.length > 0 ? parts : text;
    };
    
    return processText(remainingText);
  };

  // Handle multi-line center blocks and code blocks
  const processedElements = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Handle code blocks (``` or ````)
    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim();
      let codeContent = [];
      let j = i + 1;
      // Collect lines until closing ```
      while (j < lines.length && !lines[j].trim().startsWith('```')) {
        codeContent.push(lines[j]);
        j++;
      }
      const codeText = codeContent.join('\n');
      processedElements.push(
        <pre key={`code-${i}`} className="my-6 p-6 bg-neutral-100 border-2 border-black overflow-y-auto" style={{ maxHeight: '66vh' }}>
          <code className="text-sm font-mono text-neutral-800 whitespace-pre-wrap break-words" style={{ tabSize: 4 }}>{codeText}</code>
        </pre>
      );
      i = j + 1;
      continue;
    }
    
    // Handle center blocks (potentially multi-line)
    if (trimmed.startsWith('<center>')) {
      let centerContent = [trimmed];
      let j = i;
      // Check if center tag is closed on same line
      if (!trimmed.includes('</center>')) {
        j++;
        // Collect lines until closing tag
        while (j < lines.length && !lines[j].trim().includes('</center>')) {
          centerContent.push(lines[j]);
          j++;
        }
        if (j < lines.length) {
          centerContent.push(lines[j]);
        }
      }
      const centerHtml = centerContent.join('\n');
      processedElements.push(
        <div key={`center-${i}`} className="my-6 text-center italic text-neutral-600" dangerouslySetInnerHTML={{ __html: centerHtml }} />
      );
      i = j + 1;
      continue;
    }
    
    // Handle markdown syntax
    if (line.startsWith('# ')) {
      processedElements.push(
        <h1 key={`h1-${i}`} className="text-4xl font-bold mt-10 mb-6 pb-4 border-b-4 border-black tracking-tight">
          {renderLineWithLinksAndFormatting(line.slice(2), `${i}-h1`)}
        </h1>
      );
    } else if (line.startsWith('## ')) {
      processedElements.push(
        <h2 key={`h2-${i}`} className="text-2xl font-bold mt-8 mb-4 flex items-center gap-3">
          <span className="w-3 h-3 bg-red-600 inline-block"></span>
          {renderLineWithLinksAndFormatting(line.slice(3), `${i}-h2`)}
        </h2>
      );
    } else if (line.startsWith('- ')) {
      processedElements.push(
        <li key={`li-${i}`} className="ml-4 list-square text-neutral-700 marker:text-red-600 pl-2">
          {renderLineWithLinksAndFormatting(line.slice(2), `${i}-li`)}
        </li>
      );
    } else if (line.startsWith('![')) {
      const match = line.match(/!\[(.*?)\]\((.*?)\)/);
      if (match) {
        processedElements.push(
          <img key={`img-${i}`} src={match[2]} alt={match[1]} className="w-full border-2 border-neutral-200 my-8" />
        );
      }
    } else if (trimmed === '') {
      processedElements.push(<br key={`br-${i}`} />);
    } else {
      processedElements.push(
        <p key={`p-${i}`} className="text-lg font-normal leading-relaxed">
          {renderLineWithLinksAndFormatting(line, i)}
        </p>
      );
    }
    i++;
  }

  return (
    <div className="space-y-4 text-neutral-800 leading-relaxed">
      {processedElements}
    </div>
  );
};

const NavLink = ({ active, onClick, children }) => (
  <button 
    onClick={onClick}
    className={`text-sm font-bold uppercase tracking-widest px-4 py-2 transition-all duration-300 relative group overflow-hidden ${active ? 'bg-red-600 text-white' : 'bg-white text-black hover:bg-black hover:text-white'}`}
  >
    {children}
  </button>
);

const SectionHeader = ({ title, number }) => (
  <div className="flex items-center gap-6 mb-12">
    <div className="bg-black text-white w-12 h-12 flex items-center justify-center font-mono text-lg font-bold">0{number}</div>
    <h2 className="text-5xl font-bold tracking-tighter text-black uppercase">{title}</h2>
    <div className="flex-grow h-1 bg-black ml-6"></div>
  </div>
);

const PublicationCard = ({ pub, onClick }) => {
  return (
    <div className="group relative border-t-4 border-black py-16 cursor-pointer transition-all duration-500 hover:bg-neutral-50" onClick={onClick}>
        {/* Cinematic Full-Width Image */}
        <div className="w-full overflow-hidden border-4 border-black bg-neutral-100 relative mb-10">
             {/* Hover Zoom Effect */}
            <img 
                src={pub.preview} 
                alt={pub.title} 
                className="w-full h-auto object-contain group-hover:scale-105 transition-all duration-700 ease-out"
            />
            {/* Floating Badge */}
            <div className="absolute top-0 left-0 bg-red-600 text-white px-6 py-3 text-sm md:text-base font-black uppercase tracking-widest border-b-4 border-r-4 border-black z-10">
                {pub.abbr}
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-9">
                <h3 className="text-4xl md:text-5xl font-black mb-4 leading-[0.9] text-black group-hover:text-red-600 transition-colors uppercase">{pub.title}</h3>
                <p className="text-xl text-neutral-600 mb-6 font-medium">{pub.authors}</p>
                <p className="text-neutral-500 text-base italic pl-6 border-l-4 border-red-600 max-w-3xl">{pub.previewDesc}</p>
            </div>

            <div className="lg:col-span-3 flex flex-col justify-between items-end h-full">
                <span className="text-6xl font-black text-neutral-200 group-hover:text-black transition-colors select-none">{pub.year}</span>
                
                <div className="flex flex-wrap justify-end gap-3 mt-8">
                    {pub.links?.pdf && <button onClick={(e) => {e.stopPropagation(); window.open(pub.links.pdf)}} className="px-6 py-3 border-2 border-black text-xs font-bold hover:bg-black hover:text-white transition-colors uppercase">PDF</button>}
                    {pub.links?.html && <button onClick={(e) => {e.stopPropagation(); window.open(pub.links.html)}} className="px-6 py-3 border-2 border-black text-xs font-bold hover:bg-black hover:text-white transition-colors uppercase">WEB</button>}
                    {pub.detailsFile && (
                        <button className="flex items-center gap-2 text-xs font-bold bg-black text-white border-2 border-black hover:bg-red-600 hover:border-red-600 px-6 py-3 transition-all">
                            DETAILS <ArrowRight size={14} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

export default function App() {
  const [view, setView] = useState('home');
  const [activePub, setActivePub] = useState(null);
  const [detailContent, setDetailContent] = useState('');
  const [activeBlog, setActiveBlog] = useState(null);
  const [blogContent, setBlogContent] = useState('');
  const [aboutContent, setAboutContent] = useState('');
  const [newsItems, setNewsItems] = useState([]);
  const [publications, setPublications] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const newsRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [aboutText, newsText, bibText] = await Promise.all([
          fetchText(`${CONTENT_BASE}/about.md`),
          fetchText(`${CONTENT_BASE}/news.md`),
          fetchText(`${CONTENT_BASE}/publications.bib`)
        ]);
        if (cancelled) return;
        setAboutContent(aboutText);
        setNewsItems(parseNews(newsText));
        setPublications(parseBibTeX(bibText).map(mapBibEntryToPub));
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        setError('数据加载失败，请稍后重试。');
      } finally {
        if (cancelled) return;
        setLoaded(true);
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const loadDetail = async () => {
      if (!activePub?.detailsFile) {
        setDetailContent('');
        return;
      }
      try {
        const md = await fetchText(activePub.detailsFile);
        setDetailContent(md);
      } catch (e) {
        console.error(e);
        setDetailContent('');
      }
    };
    loadDetail();
  }, [activePub]);

  useEffect(() => {
    const loadBlog = async () => {
      if (!activeBlog?.slug) {
        setBlogContent('');
        return;
      }
      try {
        const md = await fetchText(`${CONTENT_BASE}/blogs/${activeBlog.slug}.md`);
        setBlogContent(md);
      } catch (e) {
        console.error(e);
        setBlogContent('加载文章失败。');
      }
    };
    loadBlog();
  }, [activeBlog]);

  const handlePubClick = (pub) => {
    if (pub.detailsFile) {
      setActivePub(pub);
      setView('detail');
      window.scrollTo(0, 0);
    } else if (pub.links?.html) {
      window.open(pub.links.html, '_blank');
    }
  };

  const handleBlogClick = (slug) => {
    const blog = BLOGS.find(b => b.slug === slug);
    if (blog) {
      setActiveBlog(blog);
      setView('blog-detail');
      window.scrollTo(0, 0);
    }
  };

  const scrollNews = (direction) => {
      if(newsRef.current){
          const scrollAmount = 350;
          newsRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
      }
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen text-xl font-bold uppercase tracking-widest">
          Loading content...
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center min-h-screen text-xl font-bold uppercase tracking-widest text-red-600">
          {error}
        </div>
      );
    }

    switch(view) {
      case 'detail': {
        const pub = activePub;
        return (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 max-w-5xl mx-auto pt-12 pb-24 px-6">
            <button 
              onClick={() => setView('home')} 
              className="group flex items-center gap-3 text-black font-bold uppercase tracking-widest text-sm mb-12 hover:text-red-600 transition-colors"
            >
              <div className="p-1 border-2 border-black group-hover:border-red-600"><ChevronLeft size={16} /></div>
              Back to Home
            </button>
            
            <div className="mb-16 pb-8 border-b-8 border-black">
                <div className="flex items-center gap-4 mb-6">
                    <span className="inline-block bg-red-600 text-white px-4 py-2 text-sm font-bold uppercase">{pub?.abbr}</span>
                    <span className="font-mono font-bold text-neutral-400">{pub?.year}</span>
                </div>
                <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-8 text-black">{pub?.title}</h1>
                <p className="text-xl text-neutral-600 font-medium">{pub?.authors}</p>
            </div>

            <div className="prose prose-lg max-w-none prose-headings:font-bold prose-p:text-neutral-700">
               <MarkdownRenderer content={detailContent || '内容加载中...'} />
            </div>
          </div>
        );
      }

      case 'blog-detail': {
        // Parse blog content to extract title and metadata
        const blogLines = blogContent.split('\n');
        let title = activeBlog?.title || '';
        let metadata = '';
        let contentStart = 0;
        
        // Extract title from first line if it's a heading
        if (blogLines[0]?.startsWith('# ')) {
          title = blogLines[0].slice(2).trim();
          contentStart = 1;
        }
        
        // Extract metadata from second line if it's in format _..._
        if (blogLines[contentStart]?.trim().startsWith('_') && blogLines[contentStart]?.trim().endsWith('_')) {
          metadata = blogLines[contentStart].trim().slice(1, -1);
          contentStart++;
        }
        
        // Skip empty lines after title/metadata
        while (contentStart < blogLines.length && blogLines[contentStart].trim() === '') {
          contentStart++;
        }
        
        const actualContent = blogLines.slice(contentStart).join('\n');
        
        return (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 max-w-4xl mx-auto pt-12 pb-24 px-6">
            <button 
              onClick={() => setView('writings')} 
              className="group flex items-center gap-3 text-black font-bold uppercase tracking-widest text-sm mb-12 hover:text-red-600 transition-colors"
            >
              <div className="p-1 border-2 border-black group-hover:border-red-600"><ChevronLeft size={16} /></div>
              Back to Writings
            </button>

            <div className="mb-10 pb-6 border-b-4 border-black">
              <h1 className="text-5xl md:text-6xl font-black leading-tight text-black mb-4">{title}</h1>
              {metadata && (
                <span className="text-sm italic text-neutral-500">{metadata}</span>
              )}
            </div>

            <div className="prose prose-lg max-w-none prose-headings:font-bold prose-p:text-neutral-800">
              <MarkdownRenderer content={actualContent || '内容加载中...'} />
            </div>
          </div>
        );
      }

      case 'research':
        return (
          <div className="max-w-7xl mx-auto pt-24 px-6 pb-24 animate-in fade-in">
            <SectionHeader title="All Publications" number="1" />
            <div className="space-y-12">
                {publications.map((pub, idx) => (
                    <PublicationCard key={idx} pub={pub} onClick={() => handlePubClick(pub)} />
                ))}
            </div>
          </div>
        );

      case 'writings':
        return (
            <div className="max-w-7xl mx-auto pt-24 px-6 pb-24 animate-in fade-in">
                <SectionHeader title="Writings" number="1" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    {BLOGS.map((blog, idx) => (
                        <div key={idx} onClick={() => handleBlogClick(blog.slug)} className="cursor-pointer block p-8 border-4 border-black hover:bg-black hover:text-white transition-all group relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-red-600 -mr-8 -mt-8 rotate-45 transition-transform group-hover:scale-150"></div>
                            <span className="text-xs font-mono font-bold text-neutral-400 group-hover:text-neutral-500 block mb-4 relative z-10">{blog.date}</span>
                            <h3 className="text-2xl font-bold mb-6 relative z-10">{blog.title}</h3>
                            <span className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 relative z-10 group-hover:text-red-500">Read Article <ArrowRight size={14} /></span>
                        </div>
                    ))}
                </div>
             </div>
        );

      case 'home':
      default:
        return (
          <div className="animate-in fade-in duration-700">
            {/* Hero / About Section */}
            <section id="about" className="min-h-[95vh] flex flex-col justify-center pt-32 pb-20 px-6 md:px-12 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
                    {/* Photo - Swiss Style Frame */}
                    <div className="lg:col-span-5 relative order-2 lg:order-1">
                        <div className="relative z-10 border-4 border-black bg-white p-2">
                            <img src={PROFILE.image} alt="Profile" className="w-full transition-all duration-500" />
                        </div>
                        {/* Offset Red Block */}
                        <div className="absolute top-6 left-6 w-full h-full bg-red-600 border-4 border-black -z-0"></div>
                    </div>

                    {/* Intro Text */}
                    <div className="lg:col-span-7 flex flex-col justify-center h-full order-1 lg:order-2">
                        <div>
                            <div className="w-24 h-2 bg-red-600 mb-8"></div>
                            <h1 className="text-7xl md:text-9xl font-bold tracking-tighter mb-8 leading-[0.85] text-black">
                                {PROFILE.name.split(' ').map((word, i) => (
                                    <span key={i} className="block">{word}</span>
                                ))}
                            </h1>
                            <div className="text-2xl font-medium text-neutral-800 leading-relaxed space-y-6 border-l-4 border-black pl-8">
                                <p>{PROFILE.title}</p>
                                {aboutContent && (
                                  <div className="text-lg text-neutral-600">
                                    <MarkdownRenderer content={aboutContent} />
                                  </div>
                                )}
                            </div>
                            
                            <div className="flex gap-6 mt-10">
                                <a href={PROFILE.github} className="w-12 h-12 flex items-center justify-center border-2 border-black hover:bg-black hover:text-white transition-colors"><Github /></a>
                                <a href={`mailto:${PROFILE.email}`} className="w-12 h-12 flex items-center justify-center border-2 border-black hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors"><Mail /></a>
                            </div>
                        </div>
                        
                        {/* Research Interests Tags */}
                        <div className="mt-16">
                            <h4 className="text-xs font-black uppercase tracking-widest text-black mb-4">Focus Area</h4>
                            <div className="flex flex-wrap gap-3">
                                {PROFILE.focuses.map(tag => (
                                    <span key={tag} className="px-6 py-3 bg-white border-2 border-black text-black text-sm font-bold uppercase hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors cursor-default">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* News Section - Horizontal Layout with Swiss Cards */}
            <section id="news" className="py-24 border-t-4 border-black bg-neutral-50">
                <div className="max-w-7xl mx-auto px-6 md:px-12">
                    <div className="flex justify-between items-end mb-12">
                        <SectionHeader title="Latest News" number="1" />
                        <div className="flex gap-0 mb-12">
                            <button onClick={() => scrollNews('left')} className="w-14 h-14 border-2 border-black flex items-center justify-center hover:bg-black hover:text-white transition-colors border-r-0"><ChevronLeft size={24}/></button>
                            <button onClick={() => scrollNews('right')} className="w-14 h-14 border-2 border-black flex items-center justify-center hover:bg-black hover:text-white transition-colors"><ChevronRight size={24}/></button>
                        </div>
                    </div>
                    
                    {/* Horizontal Scroll Container */}
                    <div 
                        ref={newsRef}
                        className="flex gap-8 overflow-x-auto pb-8 scrollbar-hide snap-x snap-mandatory px-1"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        {newsItems.map((item, i) => (
                            <div key={i} className="min-w-[350px] snap-start flex flex-col justify-between p-8 bg-white border-2 border-black hover:bg-red-600 hover:border-red-600 hover:text-white transition-all duration-300 group h-[240px] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px]">
                                <p className="text-xl font-bold leading-snug">{renderNewsContent(item.content)}</p>
                                <div className="flex items-center justify-between mt-4 pt-4 border-t-2 border-black/10 group-hover:border-white/20">
                                    <span className="text-xs font-mono font-bold uppercase tracking-wider">{item.date}</span>
                                    <div className="w-2 h-2 bg-red-600 group-hover:bg-white rounded-full"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Selected Papers */}
            <section id="selected-papers" className="py-24 px-6 md:px-12 max-w-7xl mx-auto">
                <div className="flex justify-between items-baseline mb-4">
                    <SectionHeader title="Selected Works" number="2" />
                    <button onClick={() => setView('research')} className="text-sm font-bold uppercase border-b-2 border-black hover:bg-black hover:text-white px-2 transition-all pb-1">View All</button>
                </div>
                
                <div className="space-y-16">
                    {publications.filter(p => p.selected).map((pub, idx) => (
                        <PublicationCard key={idx} pub={pub} onClick={() => handlePubClick(pub)} />
                    ))}
                </div>
            </section>

            {/* Blogs */}
            <section id="blogs" className="py-24 px-6 md:px-12 bg-black text-white">
                 <div className="max-w-7xl mx-auto">
                    <div className="flex justify-between items-baseline mb-16">
                        <div className="flex items-center gap-6">
                             <div className="bg-white text-black w-12 h-12 flex items-center justify-center font-mono text-lg font-bold">03</div>
                             <h2 className="text-5xl font-bold tracking-tighter uppercase">Writings</h2>
                        </div>
                        <button onClick={() => setView('writings')} className="text-sm font-bold uppercase border-b-2 border-white hover:bg-white hover:text-black px-2 transition-all pb-1">Archive</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-0 border-t border-l border-neutral-800">
                        {BLOGS.slice(0,4).map((blog, i) => (
                            <div key={i} onClick={() => handleBlogClick(blog.slug)} className="group cursor-pointer border-r border-b border-neutral-800 p-8 hover:bg-neutral-900 transition-colors relative">
                                <span className="text-xs font-mono text-red-600 mb-4 block">{blog.date}</span>
                                <h3 className="text-xl font-bold leading-tight mb-8 group-hover:text-red-500 transition-colors">{blog.title}</h3>
                                <div className="absolute bottom-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ArrowRight size={20} className="text-red-600" />
                                </div>
                            </div>
                        ))}
                    </div>
                 </div>
            </section>

            <footer className="py-12 text-center text-black text-sm font-bold uppercase tracking-widest border-t-4 border-black bg-white">
                <p>&copy; {new Date().getFullYear()} {PROFILE.name}. Swiss Style Academic.</p>
            </footer>
          </div>
        );
    }
  };

  return (
    <div className={`min-h-screen bg-white text-black selection:bg-red-600 selection:text-white font-sans ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-1000`}>
      {/* Navigation - Solid White with Black Text */}
      <nav className="fixed top-0 left-0 w-full z-50 bg-white/95 backdrop-blur-sm border-b-4 border-black">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
           <div className="text-2xl font-black tracking-tighter cursor-pointer z-50 hover:text-red-600 transition-colors uppercase" onClick={() => setView('home')}>
             {PROFILE.name || "RESEARCHER."}
           </div>

           {/* Desktop Nav */}
           <div className="hidden md:flex gap-8">
             <NavLink active={view === 'home'} onClick={() => setView('home')}>Home</NavLink>
             <NavLink active={view === 'research'} onClick={() => setView('research')}>Research</NavLink>
             <NavLink active={view === 'writings'} onClick={() => setView('writings')}>Writings</NavLink>
           </div>

           {/* Mobile Menu Button */}
           <button className="md:hidden z-50 text-black" onClick={() => setMenuOpen(!menuOpen)}>
             {menuOpen ? <X size={32} /> : <Menu size={32} />}
           </button>
        </div>

        {/* Mobile Nav Overlay */}
        {menuOpen && (
            <div className="absolute top-0 left-0 w-full h-screen bg-white flex flex-col items-center justify-center gap-12 text-4xl font-black uppercase md:hidden">
                <button onClick={() => {setView('home'); setMenuOpen(false);}} className="hover:text-red-600 hover:underline decoration-4 underline-offset-8">Home</button>
                <button onClick={() => {setView('research'); setMenuOpen(false);}} className="hover:text-red-600 hover:underline decoration-4 underline-offset-8">Research</button>
                <button onClick={() => {setView('writings'); setMenuOpen(false);}} className="hover:text-red-600 hover:underline decoration-4 underline-offset-8">Writings</button>
            </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="min-h-screen">
        {renderContent()}
      </main>
    </div>
  );
}
