/* Ponify: an English text filter that makes every article a little more Equestrian. */
(function () {
  // Order matters: longer phrases first.
  const PAIRS = [
    ['Star Trek', 'Star Trot'],
    ['Valentine\'s Day', 'Hearts and Hooves Day'],
    ['Christmas', 'Hearth\'s Warming'],
    ['Halloween', 'Nightmare Night'],
    ['no one', 'nopony'],
    ['no-one', 'nopony'],
    ['everybody', 'everypony'],
    ['everyone', 'everypony'],
    ['anybody', 'anypony'],
    ['anyone', 'anypony'],
    ['nobody', 'nopony'],
    ['somebody', 'somepony'],
    ['someone', 'somepony'],
    ['humanity', 'ponykind'],
    ['mankind', 'ponykind'],
    ['humankind', 'ponykind'],
    ['humans', 'ponies'],
    ['people', 'ponies'],
    ['persons', 'ponies'],
    ['gentlemen', 'gentlecolts'],
    ['gentleman', 'gentlecolt'],
    ['women', 'mares'],
    ['woman', 'mare'],
    ['girls', 'fillies'],
    ['boys', 'colts'],
    ['children', 'foals'],
    ['child', 'foal'],
    ['handmade', 'hoofmade'],
    ['handbook', 'hoofbook'],
    ['handshake', 'hoofshake'],
    ['handy', 'hoofy'],
    ['hands', 'hooves'],
    ['hand', 'hoof'],
    ['fingers', 'hooves'],
    ['feet', 'hooves'],
    ['Manhattan', 'Manehattan'],
    ['Philadelphia', 'Fillydelphia'],
    ['Baltimore', 'Baltimare'],
    ['Las Vegas', 'Las Pegasus'],
    ['Los Angeles', 'Los Pegasus'],
    ['Vancouver', 'Vanhoover'],
    ['Seattle', 'Seaddle'],
    ['Hollywood', 'Hollywoof'],
    ['hell', 'hay'],
    ['awesome', 'awesome (20% cooler)'],
    ['anyway', 'anyhoof'],
    ['anyhow', 'anyhoof'],
  ];

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  const map = new Map(PAIRS.map(([a, b]) => [a.toLowerCase(), b]));
  const re = new RegExp('\\b(' + PAIRS.map(p => escapeRe(p[0])).join('|') + ')\\b', 'gi');

  function matchCase(src, out) {
    if (src === src.toUpperCase() && src.length > 1) return out.toUpperCase();
    if (src[0] === src[0].toUpperCase()) return out[0].toUpperCase() + out.slice(1);
    return out;
  }

  function text(s) {
    if (!s) return s;
    return s.replace(re, (m) => {
      const out = map.get(m.toLowerCase());
      return out ? matchCase(m, out) : m;
    });
  }

  const SKIP = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'MATH', 'TEXTAREA', 'INPUT']);
  // Walk a DOM tree, ponifying text nodes in place. Returns count of replacements.
  function dom(root) {
    let count = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        let p = n.parentNode;
        while (p && p !== root) { if (SKIP.has(p.nodeName)) return NodeFilter.FILTER_REJECT; p = p.parentNode; }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) {
      const before = n.nodeValue;
      re.lastIndex = 0;
      if (!re.test(before)) continue;
      const after = text(before);
      if (after !== before) { n.nodeValue = after; count++; }
    }
    return count;
  }

  window.Ponify = { text, dom };
})();
