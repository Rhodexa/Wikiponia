/* The cast: who annotates what, and what they say about it. */
(function () {
  const P = (id, name, color, keywords, notes, legacy = true) => ({ id, name, color, img: legacy ? `assets/ponies/${id}.svg` : null, keywords, notes });

  const CAST = [
    P('twilight', 'Twilight Sparkle', '#9b6fd1',
      ['science', 'mathemat', 'physics', 'chemistry', 'library', 'book', 'universit', 'school', 'research', 'theory', 'scholar', 'education', 'encyclop', 'philosoph', 'logic', 'algorithm', 'computer'],
      ['I have read this one fourteen times. Fifteen now.', 'Oh! This has <i>footnotes</i>. My favorite kind of book.', 'Cross-reference everything. Trust me.', 'I made you a checklist for this article. It has 47 items.', 'Fascinating! Somepony take notes. Actually, I\'ll take notes.']),
    P('pinkie', 'Pinkie Pie', '#f26ac0',
      ['party', 'cake', 'candy', 'confection', 'dessert', 'sugar', 'celebrat', 'festival', 'balloon', 'comedy', 'clown', 'birthday', 'baking', 'pastry', 'chocolate', 'joke'],
      ['This article is SO FUN I could throw it a party! Actually, I already did.', 'Did you know reading is like eating cupcakes but for your BRAIN?!', 'I read it backwards first. It was still good!', 'Ooh! Ooh! Scroll down, there\'s a picture!', 'My Pinkie Sense says you\'ll click a blue link in 3… 2…']),
    P('rainbow', 'Rainbow Dash', '#2aa7e0',
      ['aviation', 'aircraft', 'flight', 'sport', 'race', 'racing', 'speed', 'weather', 'storm', 'cloud', 'rainbow', 'athlet', 'olympic', 'pilot', 'military', 'football', 'soccer', 'team'],
      ['This is like, 20% cooler than the average article.', 'Read it fast. Faster! Ten seconds flat!', 'I only read the parts with action. So, the infobox.', 'Not bad. Not Daring Do, but not bad.', 'Awesome. Totally awesome.']),
    P('applejack', 'Applejack', '#f0a020',
      ['apple', 'farm', 'agricultur', 'orchard', 'fruit', 'cider', 'rural', 'ranch', 'cattle', 'harvest', 'crop', 'texas', 'country music', 'family', 'tree'],
      ['Honest truth? This here\'s a mighty fine article.', 'Now that\'s what I call good, honest information.', 'Granny Smith would\'ve liked this one.', 'Yeehaw! Learnin\'!', 'Ain\'t no shame in readin\' the whole thing.']),
    P('rarity', 'Rarity', '#7a4fd6',
      ['fashion', 'cloth', 'dress', 'textile', 'design', 'gem', 'diamond', 'jewel', 'mineral', 'crystal', 'art', 'paint', 'theatre', 'theater', 'opera', 'luxury', 'perfume', 'architect'],
      ['Darling, the <i>formatting</i>. Exquisite.', 'This article simply sparkles. Like a gem. Like ME.', 'I would have used more lace in the infobox, but it\'s passable.', 'How positively, absolutely, fabulously informative!', 'Ugh. It\'s a bit plain. But the CONTENT, darling!']),
    P('fluttershy', 'Fluttershy', '#f5c84c',
      ['animal', 'bird', 'mammal', 'species', 'insect', 'butterfl', 'fish', 'wildlife', 'nature', 'forest', 'plant', 'biology', 'veterinar', 'zoo', 'pet', 'rabbit', 'bear', 'genus'],
      ['Oh, um… I hope you like this one. If that\'s okay.', 'The animals in this article are all very well-behaved. Yay.', 'Please read gently. Articles have feelings too.', 'Angel Bunny says it\'s… adequate.', 'yay.']),
    P('spike', 'Spike', '#3fae49',
      ['dragon', 'reptile', 'dinosaur', 'fire', 'comic', 'video game', 'mail', 'post', 'letter', 'gemstone', 'lizard', 'volcano', 'knight'],
      ['Number one assistant, reporting! I fetched this one myself.', 'Is there a part about dragons? Skip to the part about dragons.', 'I\'d take notes but I\'m kind of hungry.', 'Delivered fresh from the archives!']),
    P('celestia', 'Princess Celestia', '#f2c14e',
      ['sun', 'solar', 'monarch', 'king', 'queen', 'empire', 'kingdom', 'royal', 'history', 'ancient', 'dynasty', 'government', 'politic', 'law', 'constitution', 'president'],
      ['A thousand years of history, and still more to learn.', 'My faithful student would adore this article.', 'Remember to send me a friendship report about this.', 'Ah, I remember when this happened.']),
    P('luna', 'Princess Luna', '#5b6fd6',
      ['moon', 'lunar', 'night', 'nocturn', 'astronom', 'star ', 'stars', 'dream', 'sleep', 'eclipse', 'owl', 'constellation', 'planet'],
      ['WE APPROVE OF THIS ARTICLE. Ahem. Sorry. Royal Canterlot voice.', 'The night is far more interesting than the day. As is this article.', 'Read it by moonlight; it is better that way.', 'Tia would have skimmed this. We read every word.'], false),
    P('trixie', 'The Great and Powerful Trixie', '#4aa3f0',
      ['magic', 'illusion', 'stage', 'perform', 'actor', 'actress', 'celebrity', 'show', 'circus', 'boast', 'film', 'television', 'entertain'],
      ['The Great and Powerful Trixie has ALREADY read this article!', 'Behold! Information! Ta-daaa!', 'This article is almost as impressive as Trixie. Almost.']),
    P('discord', 'Discord', '#b0784a',
      ['chaos', 'paradox', 'absurd', 'surreal', 'random', 'quantum', 'entropy', 'star trek', 'starship', 'klingon', 'vulcan', 'lcars', 'spock', 'enterprise', 'jedi'],
      ['Oh, how delightfully ordered. Let me fix that.', 'I\'ve rearranged the citations alphabetically. By vowel.', 'Read it upside down; it\'s funnier.', 'I once made it rain chocolate milk. This article could use some.']),
    P('derpy', 'Derpy', '#c7c7d9',
      ['muffin', 'mail', 'postal', 'delivery', 'bubble', 'clumsy', 'accident', 'oops', 'courier'],
      ['I just don\'t know what went wrong!', 'Muffins!', 'I delivered this article. To the wrong house first.']),
    P('lyra', 'Lyra Heartstrings', '#5fd6b8',
      ['music', 'harp', 'lyre', 'instrument', 'human', 'hand', 'song', 'composer', 'orchestra', 'myth'],
      ['HANDS! Does this article mention hands?! Please say yes.', 'Fascinating. Humans are REAL, I tell you.', 'I\'d play a song about this, if I had fingers.']),
    P('octavia', 'Octavia', '#6c6c78',
      ['classical', 'symphony', 'cello', 'violin', 'concert', 'baroque', 'bach', 'mozart', 'beethoven'],
      ['A refined article. Rather like a cello suite.', 'Mm. Acceptable.']),
    P('starlight', 'Starlight Glimmer', '#c58fe0',
      ['equal', 'utopia', 'commune', 'revolution', 'time travel', 'cult', 'reform', 'friendship', 'social'],
      ['Everypony should read this article. Equally.', 'I promise this time the cross-references are not a trap.']),
    P('bonbon', 'Bon Bon', '#f5f0d0',
      ['spy', 'agent', 'secret', 'intelligence', 'espionage', 'monster', 'cryptid'],
      ['Nothing suspicious in this article. Nothing at all. Move along.', 'Sweetie Drops? Never heard of her.']),
  ];
  const BY_ID = Object.fromEntries(CAST.map(p => [p.id, p]));
  const ART = window.ART || {};

  // First available new-art pose for a pony; otherwise its old full-body SVG (legacy: faces left).
  function art(id, ...poses) {
    const set = ART[id] || {};
    for (const pose of poses) if (set[pose]) return { src: set[pose].src, legacy: false, pose };
    const p = BY_ID[id];
    if (p && p.img) return { src: p.img, legacy: true, pose: 'full' };
    if (set.bust) return { src: set.bust.src, legacy: false, pose: 'bust' };
    return { src: BY_ID.twilight.img, legacy: true, pose: 'full' };
  }
  const has = (id, pose) => !!(ART[id] && ART[id][pose]);
  // An animation drawn as numbered poses (run-000, run-001, ...), in order. Empty if none.
  function frames(id, name) {
    const set = ART[id] || {};
    const re = new RegExp('^' + name + '-(\\d{3})$');
    return Object.keys(set).filter(k => re.test(k)).sort().map(k => set[k].src);
  }

  // Title matches weigh much more than body matches ("Rainbow" beats "sunlight").
  function pickAnnotator(text, seed, title) {
    const t = (text || '').toLowerCase();
    const tt = ' ' + (title || '').toLowerCase() + ' ';
    let best = null, bestScore = 0;
    for (const p of CAST) {
      let s = 0;
      for (const k of p.keywords) { if (t.includes(k)) s += 1; if (tt.includes(k)) s += 5; }
      if (s > bestScore) { best = p; bestScore = s; }
    }
    return best || [BY_ID.twilight, BY_ID.pinkie, BY_ID.rarity, BY_ID.applejack, BY_ID.rainbow, BY_ID.fluttershy][(seed || 0) % 6];
  }

  function noteFor(p, seed) { return p.notes[(seed || 0) % p.notes.length]; }

  // The six curated "wings" of the library: a tappable tree for browsing.
  const WINGS = [
    { id: 'twilight', title: 'Magic of Science', topics: ['Science', 'Physics', 'Chemistry', 'Mathematics', 'Astronomy', 'Computer science', 'Biology', 'Medicine'] },
    { id: 'celestia', title: 'Royal Archives', topics: ['History', 'Ancient history', 'Middle Ages', 'Renaissance', 'Industrial Revolution', 'Monarchy', 'Philosophy', 'Mythology'] },
    { id: 'fluttershy', title: 'Everfree Wildlife', topics: ['Animal', 'Bird', 'Butterfly', 'Rabbit', 'Bear', 'Forest', 'Ecology', 'Plant'] },
    { id: 'rarity', title: 'Carousel Boutique', topics: ['Fashion', 'Gemstone', 'Diamond', 'Art', 'Painting', 'Architecture', 'Textile', 'Design'] },
    { id: 'rainbow', title: 'Cloudsdale Annex', topics: ['Weather', 'Rainbow', 'Aviation', 'Sport', 'Lightning', 'Cloud', 'Speed of sound', 'Olympic Games'] },
    { id: 'applejack', title: 'Sweet Apple Acres', topics: ['Apple', 'Agriculture', 'Orchard', 'Cider', 'Farm', 'Horse', 'Country music', 'Family'] },
    { id: 'pinkie', title: 'Sugarcube Corner', topics: ['Cake', 'Cupcake', 'Party', 'Confectionery', 'Balloon', 'Comedy', 'Chocolate', 'Fireworks'] },
    { id: 'discord', title: 'The Chaos Wing', topics: ['Chaos theory', 'Paradox', 'Surrealism', 'Entropy', 'Quantum mechanics', 'Star Trek', 'Absurdism', 'Randomness'] },
  ];

  window.Ponies = { CAST, BY_ID, pickAnnotator, noteFor, WINGS, art, has, frames };
})();
