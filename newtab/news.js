// rtemis new tab: optional Hacker News feed (https://github.com/HackerNews/API).
// The API sends Access-Control-Allow-Origin: *, so no host permission is needed.
// Stories are cached in storage for a few minutes; the on/off choice is stored too.

const News = (() => {
  const API = "https://hacker-news.firebaseio.com/v0";
  const HN = "https://news.ycombinator.com";
  const COUNT = 30;   // list scrolls; ~8 rows are visible at a time
  const TTL_MS = 10 * 60 * 1000;

  const $ = (id) => document.getElementById(id);
  const hero = document.querySelector(".hero");
  const box = $("news");
  const list = $("news-list");
  const status = $("news-status");
  const showBtn = $("news-show");

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

  async function fetchTop(n = COUNT) {
    const ids = await getJSON(`${API}/topstories.json`);
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

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function renderSkeleton() {
    list.innerHTML = Array.from({ length: 5 }, () =>
      '<li class="sk"><div class="skeleton sk-line w-80"></div><div class="skeleton sk-line w-40"></div></li>'
    ).join("");
  }

  // Fade the bottom edge while there is more to scroll.
  function updateScrollHint() {
    const more = list.scrollHeight - list.clientHeight - list.scrollTop > 4;
    list.classList.toggle("has-more", more);
  }
  list.addEventListener("scroll", updateScrollHint, { passive: true });
  window.addEventListener("resize", updateScrollHint);

  function render(items) {
    list.innerHTML = items.map((it) => `
      <li>
        <a class="news-link" href="${esc(it.url)}" title="${esc(it.title)}">${esc(it.title)}</a>
        <span class="news-meta">${esc(it.domain)} · ${it.score} pts · <a href="${esc(it.hn)}">${it.comments} comments</a></span>
      </li>`).join("");
    requestAnimationFrame(updateScrollHint);
  }

  function setStatus(text, isError = false) {
    status.textContent = text || "";
    status.hidden = !text;
    status.classList.toggle("error", isError);
  }

  /* --- loading with cache --- */

  async function load({ force = false } = {}) {
    const { news } = await browser.storage.local.get("news");
    const fresh = news && Date.now() - news.fetchedAt < TTL_MS;

    if (news?.items?.length) render(news.items);
    else renderSkeleton();
    if (fresh && !force) { setStatus(""); return; }

    try {
      const items = await fetchTop();
      await browser.storage.local.set({ news: { fetchedAt: Date.now(), items } });
      render(items);
      setStatus("");
    } catch (err) {
      console.warn("news fetch failed:", err);
      if (news?.items?.length) setStatus("Offline · showing cached stories");
      else { list.innerHTML = ""; setStatus("Couldn't reach Hacker News.", true); }
    }
  }

  /* --- on/off --- */

  function setEnabled(on) {
    box.hidden = !on;
    showBtn.hidden = on;
    hero.classList.toggle("has-news", on);
    if (on) load();
  }

  showBtn.addEventListener("click", () => {
    browser.storage.local.set({ newsEnabled: true });
    setEnabled(true);
  });

  $("news-hide").addEventListener("click", () => {
    browser.storage.local.set({ newsEnabled: false });
    setEnabled(false);
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
