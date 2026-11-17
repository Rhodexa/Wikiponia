/* Wikipedia access + HTML cleanup. Everything goes through the public MediaWiki API (CORS via origin=*). */
(function () {
  let LANG = 'en';
  const cache = new Map();
  const HEADERS = { 'Api-User-Agent': 'Wikiponia/0.1 (fan-made pony reader)' };

  function api(params) {
    const u = new URL(`https://${LANG}.wikipedia.org/w/api.php`);
    const all = Object.assign({ format: 'json', formatversion: '2', origin: '*' }, params);
    for (const k in all) u.searchParams.set(k, all[k]);
    return fetch(u, { headers: HEADERS }).then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function key(...p) { return LANG + '|' + p.join('|'); }
  function cached(k, fn) {
    if (cache.has(k)) return cache.get(k);
    const p = fn().catch(e => { cache.delete(k); throw e; });
    cache.set(k, p);
    return p;
  }

  function suggest(q) {
    return api({
      action: 'query', generator: 'prefixsearch', gpssearch: q, gpslimit: 8,
      prop: 'pageimages|description', piprop: 'thumbnail', pithumbsize: 96, redirects: 1,
    }).then(d => ((d.query && d.query.pages) || [])
      .sort((a, b) => a.index - b.index)
      .map(p => ({ title: p.title, description: p.description || '', thumb: p.thumbnail && p.thumbnail.source })));
  }

  function search(q) {
    return api({ action: 'query', list: 'search', srsearch: q, srlimit: 20, srprop: 'snippet' })
      .then(d => ((d.query && d.query.search) || []).map(s => ({ title: s.title, snippet: s.snippet })));
  }

  function summary(title) {
    return cached(key('sum', title), () => api({
      action: 'query', titles: title, redirects: 1,
      prop: 'extracts|pageimages|description', exintro: 1, explaintext: 1, exsentences: 4,
      piprop: 'thumbnail', pithumbsize: 480,
    }).then(d => {
      const p = d.query && d.query.pages && d.query.pages[0];
      if (!p || p.missing) return { title, missing: true, extract: '' };
      return { title: p.title, description: p.description || '', extract: p.extract || '', thumb: p.thumbnail && p.thumbnail.source };
    }));
  }

  function random() {
    return api({ action: 'query', list: 'random', rnnamespace: 0, rnlimit: 1 })
      .then(d => d.query.random[0].title);
  }

  function leadLinks(title) {
    return cached(key('lead', title), () => api({ action: 'parse', page: title, prop: 'links', section: 0, redirects: 1 })
      .then(d => ((d.parse && d.parse.links) || []).filter(l => l.ns === 0 && l.exists).map(l => l.title)));
  }

  function featured() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    const url = `https://${LANG}.wikipedia.org/api/rest_v1/feed/featured/${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
    return cached(key('feat', url), () => fetch(url, { headers: HEADERS }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }));
  }

  const NS_RE = /^(file|image|category|help|special|template|wikipedia|portal|talk|user|module|draft|mediawiki|wp|archivo|imagen|categoría|ayuda|especial|plantilla|usuario|anexo|datei|kategorie|hilfe|vorlage|benutzer|fichier|catégorie|aide|modèle|utilisateur|arquivo|categoria|ajuda|predefinição|utilizador|file|immagine|aiuto|utente)\s*:/i;

  function titleFromHref(href) {
    const m = href.match(/^\/wiki\/([^#?]+)(#.*)?$/);
    if (!m) return null;
    let t;
    try { t = decodeURIComponent(m[1]).replace(/_/g, ' '); } catch (e) { return null; }
    if (NS_RE.test(t)) return null;
    return t;
  }

  const REMOVE = [
    'script', 'style', 'link', 'meta', '.mw-editsection', '.navbox', '.navbox-styles', '.sistersitebox',
    '.ambox', '.ombox', '.tmbox', '.mbox-small', '.metadata', '.noprint', '.mw-empty-elt', '.shortdescription',
    '.portalbox', '.side-box', 'table.vertical-navbox', 'table.sidebar', '.authority-control', '.mw-authority-control', 'span.mw-reflink-text:empty',
  ].join(',');

  const BACK_SECTIONS = /^(references|notes|citations|sources|footnotes|bibliography|external links|further reading|referencias|notas|enlaces externos|bibliografía|fuentes|referências|ligações externas|einzelnachweise|weblinks|literatur|références|liens externes|notes et références|note|collegamenti esterni|bibliografia)$/i;
  const SEE_ALSO = /^(see also|véase también|ver também|siehe auch|voir aussi|voci correlate)$/i;

  // Parse an article into { title, displayTitle, lead, chapters[], links[], infobox }
  function article(title) {
    return cached(key('art', title), () => api({ action: 'parse', page: title, prop: 'text|displaytitle', redirects: 1, disableeditsection: 1 })
      .then(d => {
        if (d.error) throw new Error(d.error.info || 'Not found');
        return build(d.parse);
      }));
  }

  function build(parse) {
    const doc = new DOMParser().parseFromString(parse.text, 'text/html');
    const root = doc.querySelector('.mw-parser-output') || doc.body;
    root.querySelectorAll(REMOVE).forEach(n => n.remove());

    const links = [];
    const seen = new Set();
    root.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (href.startsWith('/wiki/')) {
        const t = titleFromHref(href);
        if (t && !a.closest('.reflist, .references')) {
          a.setAttribute('data-title', t);
          a.setAttribute('href', '#/wiki/' + encodeURIComponent(t));
          a.classList.add('xref');
          if (!a.closest('.infobox') && !seen.has(t)) { seen.add(t); links.push(t); }
        } else {
          a.setAttribute('href', `https://${LANG}.wikipedia.org${href}`);
          a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener');
        }
      } else if (href.startsWith('/w/')) {
        if (a.classList.contains('new')) { a.replaceWith(...a.childNodes); return; }
        a.setAttribute('href', `https://${LANG}.wikipedia.org${href}`);
        a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener');
      } else if (href.startsWith('#')) {
        a.setAttribute('data-anchor', href.slice(1));
        a.setAttribute('href', 'javascript:void 0');
      } else {
        if (href.startsWith('//')) a.setAttribute('href', 'https:' + href);
        a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener');
      }
    });
    root.querySelectorAll('img').forEach(img => {
      const s = img.getAttribute('src');
      if (s && s.startsWith('//')) img.setAttribute('src', 'https:' + s);
      const ss = img.getAttribute('srcset');
      if (ss) img.setAttribute('srcset', ss.replace(/(^|,\s*)\/\//g, '$1https://'));
      img.setAttribute('loading', 'lazy');
      img.setAttribute('decoding', 'async');
    });
    root.querySelectorAll('table:not(.infobox)').forEach(t => {
      const w = doc.createElement('div'); w.className = 'table-wrap';
      t.parentNode.insertBefore(w, t); w.appendChild(t);
    });

    let infobox = null;
    const ib = root.querySelector('table.infobox');
    if (ib) { infobox = ib.closest('.table-wrap') || ib; infobox.remove(); }

    // Split into chapters by h2.
    const lead = doc.createElement('div');
    const chapters = [];
    let cur = { el: lead };
    for (const node of Array.from(root.childNodes)) {
      const h2 = node.nodeType === 1 && (node.matches('h2') ? node : (node.matches('.mw-heading2') ? node.querySelector('h2') : null));
      if (h2) {
        const heading = h2.textContent.trim();
        cur = { id: h2.id || ('ch' + chapters.length), heading, el: doc.createElement('div'),
          kind: BACK_SECTIONS.test(heading) ? 'back' : SEE_ALSO.test(heading) ? 'seealso' : 'body' };
        chapters.push(cur);
        continue;
      }
      cur.el.appendChild(node);
    }
    // strip subheading wrappers into plain h3/h4
    [lead, ...chapters.map(c => c.el)].forEach(el => el.querySelectorAll('.mw-heading').forEach(w => {
      const h = w.querySelector('h3,h4,h5,h6'); if (h) w.replaceWith(h);
    }));

    const tmp = doc.createElement('div'); tmp.innerHTML = parse.displaytitle || parse.title;
    const leadText = lead.textContent.replace(/\s+/g, ' ').trim();

    return {
      title: parse.title,
      displayTitle: tmp.textContent || parse.title,
      lead: lead.innerHTML,
      leadText,
      infobox: infobox ? infobox.outerHTML : '',
      chapters: chapters.map(c => ({ id: c.id, heading: c.heading, kind: c.kind, html: c.el.innerHTML })),
      links,
    };
  }

  window.Wiki = {
    get lang() { return LANG; },
    setLang(l) { LANG = l; },
    suggest, search, summary, random, article, leadLinks, featured,
    pageUrl: (t) => `https://${LANG}.wikipedia.org/wiki/${encodeURIComponent(t.replace(/ /g, '_'))}`,
  };
})();
