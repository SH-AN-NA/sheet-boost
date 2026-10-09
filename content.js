(() => {
  const HOLDER = 'sheet-boost-links';
  const ICONS = {
    gfg: 'icons/gfg.png',
    leetcode: 'icons/leetcode.png',
    cn: 'icons/cn.png'
  };
  const PLATFORM_NAMES = { gfg: 'GeeksforGeeks', leetcode: 'LeetCode', cn: 'Coding Ninjas' };
  let catalogPromise;
  let legacyPromise;
  let observer;
  let scheduled = false;

  const normalize = value => (value || '')
    .normalize('NFKD').toLowerCase()
    .replace(/\b(the|a|an|problem|problems|gfg|leetcode|coding ninjas)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');

  function getCatalog() {
    return catalogPromise ||= fetch(chrome.runtime.getURL('current-a2z-data.json'))
      .then(r => r.json()).then(d => d.problems || []);
  }
  function getLegacy() {
    return legacyPromise ||= fetch(chrome.runtime.getURL('questions-map.json'))
      .then(r => r.json()).then(d => Array.isArray(d) ? d : []);
  }
  function urlsFor(problem, legacy) {
    const urls = {};
    const candidates = [{ platform: problem.platform, url: problem.url }, ...(problem.altUrls || [])];
    for (const item of candidates) {
      if (!item || !item.url) continue;
      const host = (() => { try { return new URL(item.url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
      let key = item.platform;
      if (host.includes('geeksforgeeks')) key = 'gfg';
      else if (host.includes('leetcode')) key = 'leetcode';
      else if (host.includes('codingninjas')) key = 'cn';
      if (ICONS[key] && !urls[key]) urls[key] = item.url;
    }
    const old = legacy.get(normalize(problem.title));
    if (old) {
      for (const [key, field] of [['gfg','question-gfg'], ['leetcode','question-lc'], ['cn','question-cn']]) {
        if (!urls[key] && /^https?:\/\//i.test(old[field] || '')) urls[key] = old[field];
      }
    }
    return urls;
  }
  function makeLegacyIndex(rows) {
    const buckets = new Map();
    for (const row of rows) {
      const key = normalize(row['question-name']);
      if (!key) continue;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(row);
    }
    const unique = new Map();
    for (const [key, matches] of buckets) if (matches.length === 1) unique.set(key, matches[0]);
    return unique;
  }
  function practiceSlug(anchor) {
    try {
      const url = new URL(anchor.href);
      if (!/(^|\.)takeuforward\.org$/i.test(url.hostname) || !url.pathname.startsWith('/practice/dsa/')) return '';
      return decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) || '');
    } catch { return ''; }
  }
  function addLinks(anchor, urls) {
    if (!Object.keys(urls).length || anchor.parentElement?.querySelector(`:scope > .${HOLDER}`)) return;
    const holder = document.createElement('span');
    holder.className = HOLDER;
    holder.setAttribute('aria-label', 'External problem links');
    for (const key of ['gfg', 'leetcode', 'cn']) {
      if (!urls[key]) continue;
      const link = document.createElement('a');
      link.href = urls[key];
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.title = `Open on ${PLATFORM_NAMES[key]}`;
      link.setAttribute('aria-label', `Open on ${PLATFORM_NAMES[key]}`);
      const img = document.createElement('img');
      img.src = chrome.runtime.getURL(ICONS[key]);
      img.alt = '';
      link.append(img);
      holder.append(link);
    }
    if (holder.childElementCount) anchor.insertAdjacentElement('afterend', holder);
  }
  async function decorate() {
    const [problems, legacyRows, settings] = await Promise.all([
      getCatalog(), getLegacy(), chrome.storage.sync.get({ quickLinks: true, completedStyle: true })
    ]);
    const legacy = makeLegacyIndex(legacyRows);
    const bySlug = new Map(problems.map(p => [p.slug, p]));
    if (!settings.quickLinks) document.querySelectorAll(`.${HOLDER}`).forEach(el => el.remove());
    document.querySelectorAll(`a[href*="/practice/dsa/"]`).forEach(anchor => {
      const slug = practiceSlug(anchor);
      if (!slug || !settings.quickLinks) return;
      const problem = bySlug.get(slug);
      if (!problem) return;
      addLinks(anchor, urlsFor(problem, legacy));
    });
    document.querySelectorAll('.sheet-boost-complete').forEach(el => el.classList.remove('sheet-boost-complete'));
    if (settings.completedStyle) {
      document.querySelectorAll('body *').forEach(el => {
        if (el.children.length > 8 || !el.textContent) return;
        const text = el.textContent.trim();
        if (/^\d+\s*\/\s*\d+$/.test(text) && text.split('/').map(Number).every((n, i, a) => i !== 0 || n === a[1])) {
          const section = el.closest('section, [class*="topic"], [class*="section"]');
          if (section) section.classList.add('sheet-boost-complete');
        }
      });
    }
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; decorate().catch(() => {}); }, 250);
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && (changes.quickLinks || changes.completedStyle)) schedule();
  });
  observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  schedule();
})();
