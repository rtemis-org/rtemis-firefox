// rtemis new tab: optional Hacker News and Slashdot feeds.
// spec: rtemis-firefox/hacker-news#feeds

const News = (() => {
  const API = "https://hacker-news.firebaseio.com/v0";
  const HN = "https://news.ycombinator.com";
  const COUNT = 30;   // list scrolls; ~8 rows are visible at a time
  const TTL_MS = 10 * 60 * 1000;
  const FEEDS = {
    top: { label: "Top", endpoint: "topstories", path: "/" },
    new: { label: "New", endpoint: "newstories", path: "/newest" },
    best: { label: "Best", endpoint: "beststories", path: "/best" },
    ask: { label: "Ask", endpoint: "askstories", path: "/ask" },
    show: { label: "Show", endpoint: "showstories", path: "/show" },
  };
  const SLASHDOT_TTL_MS = 30 * 60 * 1000;
  const SLASHDOT_FEEDS = {
    main: ['Main', 'Main', 'https://slashdot.org/'],
    ask: ['Ask Slashdot', 'AskSlashdot', 'https://ask.slashdot.org/'],
    linux: ['Linux', 'Linux', 'https://linux.slashdot.org/'],
    developers: ['Developers', 'Developers', 'https://developers.slashdot.org/'],
    science: ['Science', 'Science', 'https://science.slashdot.org/'],
    games: ['Games', 'Games', 'https://games.slashdot.org/'],
    politics: ['Politics', 'Politics', 'https://politics.slashdot.org/'],
    rights: ['Your Rights Online', 'YourRightsOnline', 'https://yro.slashdot.org/'],
  };
  let activeSource = 'hn';
  let slashdotFeed = 'main';
  let activeFeed = "top";
  let loadRequest = 0;

  const $ = (id) => document.getElementById(id);
  const hero = document.querySelector(".hero");
  const box = $("news");
  const list = $("news-list");
  const status = $("news-status");
  const showBtn = $("news-show");
  const feedButtons = $("news-feeds").querySelectorAll("button[data-feed]");

  /* --- fetching --- */

  async function getJSON(url, { timeout = 8000, xml = false } = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: "no-store", credentials: "omit" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!xml) return await res.json();
      // Slashdot declares ISO-8859-1 in its XML declaration.
      const bytes = await res.arrayBuffer();
      return new TextDecoder('iso-8859-1').decode(bytes);
    } finally {
      clearTimeout(t);
    }
  }

  function domainOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
  }

  async function fetchStories(feed, n = COUNT) {
    const ids = await getJSON(`${API}/${FEEDS[feed].endpoint}.json`);
    const items = await Promise.all(
      ids.slice(0, n).map((id) => getJSON(`${API}/item/${id}.json`).catch(() => null))
    );
    return items
      .filter((it) => it && it.type === "story" && it.title && !it.dead && !it.deleted)
      .map((it) => ({
        id: it.id,
        title: it.title,
        url: it.url || `${HN}/item?id=${it.id}`,
        domain: it.url ? domainOf(it.url) : "news.ycombinator.com",
        score: it.score || 0,
        comments: it.descendants || 0,
        hn: `${HN}/item?id=${it.id}`,
      }));
  }

  async function fetchSlashdot(feed) {
    const xml = await getJSON('https://rss.slashdot.org/Slashdot/slashdot' + SLASHDOT_FEEDS[feed][1], { xml: true });
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror') || !doc.getElementsByTagNameNS('http://purl.org/rss/1.0/', 'channel').length) {
      throw new Error('Invalid Slashdot feed');
    }
    return Array.from(doc.getElementsByTagNameNS('http://purl.org/rss/1.0/', 'item')).map(item => {
      const text = name => item.getElementsByTagNameNS('http://purl.org/rss/1.0/', name)[0]?.textContent.trim();
      const title = text('title');
      let url;
      try {
        url = new URL(text('link'));
        if (!['https:', 'http:'].includes(url.protocol)) return null;
        for (const key of [...url.searchParams.keys()]) if (key.startsWith('utm_')) url.searchParams.delete(key);
      } catch { return null; }
      const count = item.getElementsByTagNameNS('http://purl.org/rss/1.0/modules/slash/', 'comments')[0]?.textContent.trim();
      return title ? { title, url: url.href, domain: domainOf(url.href),
        comments: /^\d+$/.test(count || '') ? Number(count) : null, discussion: url.href } : null;
    }).filter(Boolean).slice(0, COUNT);
  }

  /* --- rendering --- */

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderSkeleton() {
    list.replaceChildren(...Array.from({ length: 5 }, () => {
      const li = el("li", "sk");
      li.append(el("div", "skeleton sk-line w-80"), el("div", "skeleton sk-line w-40"));
      return li;
    }));
  }

  // Fade the bottom edge while there is more to scroll.
  function updateScrollHint() {
    const more = list.scrollHeight - list.clientHeight - list.scrollTop > 4;
    list.classList.toggle("has-more", more);
  }
  list.addEventListener("scroll", updateScrollHint, { passive: true });
  window.addEventListener("resize", updateScrollHint);

  function render(items) {
    list.replaceChildren(...items.map((it) => {
      const li = el("li");
      const link = el("a", "news-link", it.title);
      link.href = it.url;
      link.title = it.title;
      const comments = el("a", null, it.comments == null ? "Discussion" : `${it.comments} comments`);
      comments.href = it.discussion || it.hn;
      const meta = el("span", "news-meta", `${it.domain} · ${it.score == null ? "" : `${it.score} pts · `}`);
      meta.append(comments);
      li.append(link, meta);
      return li;
    }));
    requestAnimationFrame(updateScrollHint);
  }

  function setStatus(text, isError = false) {
    status.textContent = text || "";
    status.hidden = !text;
    status.classList.toggle("error", isError);
  }

  /* --- loading with cache --- */

  async function load({ force = false } = {}) {
    const source = activeSource;
    const feed = source === 'hn' ? activeFeed : slashdotFeed;
    const request = ++loadRequest;
    const isCurrent = () => request === loadRequest && source === activeSource && feed === (source === 'hn' ? activeFeed : slashdotFeed) && !box.hidden;
    const run = async () => {
      if (!isCurrent()) return;
      const cacheKey = source === 'hn' ? `newsFeedCache.${feed}` : `newsFeedCache.slashdot.${feed}`;
      const saved = await browser.storage.local.get(source === "hn" && feed === "top" ? [cacheKey, "news"] : [cacheKey]);
      if (!isCurrent()) return;
      // Existing installations can reuse their original Top cache.
      const news = saved[cacheKey] || (source === "hn" && feed === "top" ? saved.news : null);
      const hasCache = Array.isArray(news?.items);
      const fresh = hasCache && Date.now() - news.fetchedAt < (source === 'hn' ? TTL_MS : SLASHDOT_TTL_MS);

      setStatus("");
      if (hasCache) render(news.items);
      else renderSkeleton();
      if (fresh && (!force || source === 'slashdot')) { setStatus(news.items.length ? "" : "No stories right now."); return; }

      if (source === 'slashdot') {
        const attemptKey = cacheKey + '.attemptedAt';
        const attempt = await browser.storage.local.get(attemptKey);
        if (!isCurrent()) return;
        if (Date.now() - (attempt[attemptKey] || 0) < SLASHDOT_TTL_MS) {
          if (!hasCache) list.replaceChildren();
          setStatus(hasCache ? 'Showing cached stories · Slashdot updates every 30 minutes' : 'Slashdot is unavailable · try again after 30 minutes');
          return;
        }
        await browser.storage.local.set({ [attemptKey]: Date.now() });
      }
      try {
        const items = await (source === 'hn' ? fetchStories(feed) : fetchSlashdot(feed));
        if (source === 'hn' && !isCurrent()) return;
        await browser.storage.local.set({ [cacheKey]: { fetchedAt: Date.now(), items } });
        if (!isCurrent()) return;
        render(items);
        setStatus(items.length ? "" : "No stories right now.");
      } catch (err) {
        if (!isCurrent()) return;
        console.warn("news fetch failed:", err);
        if (hasCache) setStatus("Offline · showing cached stories");
        else { list.replaceChildren(); setStatus(`Couldn't reach ${source === "hn" ? "Hacker News" : "Slashdot"}.`, true); }
      }
    };
    return source === 'slashdot' ? navigator.locks.request('slashdot-feed-' + feed, run) : run();
  }

  function updateSource() {
    const slashdot = activeSource === 'slashdot';
    $('news-source-hn').setAttribute('aria-pressed', String(!slashdot));
    $('news-source-slashdot').setAttribute('aria-pressed', String(slashdot));
    $('news-feeds').hidden = slashdot;
    $('slashdot-feeds').hidden = !slashdot;
    $('slashdot-feeds').value = slashdotFeed;
    list.setAttribute('aria-label', slashdot ? SLASHDOT_FEEDS[slashdotFeed][0] + ' stories' : FEEDS[activeFeed].label + ' stories');
    list.scrollTop = 0;
  }
  for (const source of ['hn', 'slashdot']) {
    $('news-source-' + source).addEventListener('click', () => {
      if (activeSource === source) return;
      activeSource = source;
      browser.storage.local.set({ newsSource: source });
      updateSource();
      return load();
    });
  }
  for (const [value, [label]] of Object.entries(SLASHDOT_FEEDS)) {
    const option = el('option', null, label);
    option.value = value;
    $('slashdot-feeds').append(option);
  }
  $('slashdot-feeds').addEventListener('change', () => {
    if (!Object.hasOwn(SLASHDOT_FEEDS, $('slashdot-feeds').value)) return;
    slashdotFeed = $('slashdot-feeds').value;
    updateSource();
    return load();
  });

  /* --- feed selection (Top on every new tab) --- */

  function selectFeed(feed) {
    if (!Object.hasOwn(FEEDS, feed)) return;
    activeFeed = feed;
    for (const btn of feedButtons) {
      btn.setAttribute("aria-pressed", String(btn.dataset.feed === feed));
    }
    list.setAttribute("aria-label", `${FEEDS[feed].label} stories`);
    list.scrollTop = 0;
    setStatus("");
    renderSkeleton();
    return load();
  }

  for (const btn of feedButtons) {
    btn.addEventListener("click", () => {
      if (btn.dataset.feed !== activeFeed) return selectFeed(btn.dataset.feed);
    });
  }

  /* --- on/off --- */

  function setEnabled(on) {
    box.hidden = !on;
    showBtn.hidden = on;
    showBtn.setAttribute("aria-expanded", String(on));
    hero.classList.toggle("has-news", on);
    if (on) return load();
    ++loadRequest;
  }

  showBtn.addEventListener("click", () => {
    browser.storage.local.set({ newsEnabled: true });
    const loading = setEnabled(true);
    $("news-hide").focus();
    return loading;
  });

  $("news-hide").addEventListener("click", () => {
    browser.storage.local.set({ newsEnabled: false });
    setEnabled(false);
    showBtn.focus();
  });

  $("news-refresh").addEventListener("click", async () => {
    const btn = $("news-refresh");
    if (btn.classList.contains("busy")) return;
    btn.classList.add("busy");
    const started = Date.now();
    try {
      await load({ force: true });
    } finally {
      setTimeout(() => btn.classList.remove("busy"), Math.max(0, 500 - (Date.now() - started)));
    }
  });

  /* --- init --- */

  browser.storage.local.get(['newsEnabled', 'newsSource']).then(({ newsEnabled, newsSource }) => {
    activeSource = newsSource === 'slashdot' ? 'slashdot' : 'hn';
    updateSource();
    setEnabled(Boolean(newsEnabled));
  });

  // Re-check the cache when the tab comes back into view.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !box.hidden) load();
  });

  return { load };
})();
