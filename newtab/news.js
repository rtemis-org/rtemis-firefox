// rtemis new tab: optional Hacker News feed (https://github.com/HackerNews/API).
// The API sends Access-Control-Allow-Origin: *, so no host permission is needed.
// Stories are cached in storage for a few minutes; the on/off choice is stored too.

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

  async function getJSON(url, { timeout = 8000 } = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
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
      const comments = el("a", null, `${it.comments} comments`);
      comments.href = it.hn;
      const meta = el("span", "news-meta", `${it.domain} · ${it.score} pts · `);
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
    const feed = activeFeed;
    const request = ++loadRequest;
    const isCurrent = () => request === loadRequest && feed === activeFeed && !box.hidden;
    const cacheKey = `newsFeedCache.${feed}`;
    const saved = await browser.storage.local.get(feed === "top" ? [cacheKey, "news"] : [cacheKey]);
    if (!isCurrent()) return;
    // Existing installations can reuse their original Top cache.
    const news = saved[cacheKey] || (feed === "top" ? saved.news : null);
    const hasCache = Array.isArray(news?.items);
    const fresh = hasCache && Date.now() - news.fetchedAt < TTL_MS;

    setStatus("");
    if (hasCache) render(news.items);
    else renderSkeleton();
    if (fresh && !force) { setStatus(news.items.length ? "" : "No stories right now."); return; }

    try {
      const items = await fetchStories(feed);
      if (!isCurrent()) return;
      await browser.storage.local.set({ [cacheKey]: { fetchedAt: Date.now(), items } });
      if (!isCurrent()) return;
      render(items);
      setStatus(items.length ? "" : "No stories right now.");
    } catch (err) {
      if (!isCurrent()) return;
      console.warn("news fetch failed:", err);
      if (hasCache) setStatus("Offline · showing cached stories");
      else { list.replaceChildren(); setStatus("Couldn't reach Hacker News.", true); }
    }
  }

  /* --- feed selection (Top on every new tab) --- */

  function selectFeed(feed) {
    if (!Object.hasOwn(FEEDS, feed)) return;
    activeFeed = feed;
    for (const btn of feedButtons) {
      btn.setAttribute("aria-pressed", String(btn.dataset.feed === feed));
    }
    $("news-title").href = `${HN}${FEEDS[feed].path}`;
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

  browser.storage.local.get("newsEnabled").then(({ newsEnabled }) => {
    setEnabled(Boolean(newsEnabled));
  });

  // Re-check the cache when the tab comes back into view.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !box.hidden) load();
  });

  return { load };
})();
