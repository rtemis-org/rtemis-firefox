// rtemis new tab: search box backed by Firefox's installed search engines.
// Engines come from browser.search.get(); searches run in this tab via
// browser.search.search(). The chosen engine is remembered in storage.

const Search = (() => {
  const $ = (id) => document.getElementById(id);
  const form = $("search-form");
  const input = $("search-input");
  const btn = $("engine-btn");
  const menu = $("engine-menu");
  const icon = $("engine-icon");
  const glass = $("engine-glass");

  let engines = [];
  let current = null;
  let selected = -1;

  /* --- engine selection --- */

  function setIcon(img, fallback, url) {
    if (url) {
      img.src = url;
      img.hidden = false;
      fallback.hidden = true;
      img.onerror = () => { img.hidden = true; fallback.hidden = false; };
    } else {
      img.hidden = true;
      fallback.hidden = false;
    }
  }

  function renderCurrent() {
    setIcon(icon, glass, current?.favIconUrl);
    input.placeholder = current ? `Search with ${current.name} or enter address` : "Search or enter address";
  }

  function renderMenu() {
    menu.innerHTML = "";
    engines.forEach((e, i) => {
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", i === selected ? "true" : "false");
      li.dataset.current = e === current ? "true" : "false";
      const img = document.createElement("img");
      img.alt = "";
      const fb = glass.cloneNode(true);
      fb.removeAttribute("id");
      setIcon(img, fb, e.favIconUrl);
      li.append(img, fb, document.createTextNode(e.name));
      li.addEventListener("mousedown", (ev) => { ev.preventDefault(); choose(i); });
      menu.appendChild(li);
    });
  }

  function choose(i) {
    current = engines[i] || current;
    browser.storage.local.set({ searchEngine: current?.name });
    renderCurrent();
    closeMenu();
    input.focus();
  }

  function openMenu() {
    if (!engines.length) return;
    selected = Math.max(0, engines.indexOf(current));
    renderMenu();
    menu.hidden = false;
    btn.setAttribute("aria-expanded", "true");
  }

  function closeMenu() {
    menu.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  }

  async function loadEngines() {
    try {
      engines = await browser.search.get();
    } catch (err) {
      console.warn("search engines unavailable:", err);
      engines = [];
    }
    const { searchEngine } = await browser.storage.local.get("searchEngine");
    current = engines.find((e) => e.name === searchEngine)
           || engines.find((e) => e.isDefault)
           || engines[0] || null;
    renderCurrent();
  }

  /* --- submit --- */

  // Treat input as an address when it has no spaces and looks like a host or http(s) URL.
  function asUrl(s) {
    if (/\s/.test(s)) return null;
    if (/^https?:\/\//i.test(s)) return s;
    if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return null;           // other schemes: search instead
    if (/^localhost(:\d+)?(\/|$)/i.test(s)) return `http://${s}`;
    if (/^[^\s/?#]+\.[a-z]{2,}(:\d+)?([/?#].*)?$/i.test(s)) return `https://${s}`;
    return null;
  }

  async function submit(newTab) {
    const q = input.value.trim();
    if (!q) return;
    const tab = await browser.tabs.getCurrent();
    const url = asUrl(q);
    if (url) {
      if (newTab) await browser.tabs.create({ url });
      else await browser.tabs.update(tab.id, { url });
      return;
    }
    const opts = { query: q };
    if (current) opts.engine = current.name;
    if (!newTab) opts.tabId = tab.id;
    await browser.search.search(opts);
  }

  /* --- events --- */

  form.addEventListener("submit", (e) => { e.preventDefault(); submit(false); });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.altKey || e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(true); }
  });

  btn.addEventListener("click", () => (menu.hidden ? openMenu() : closeMenu()));

  btn.addEventListener("keydown", (e) => {
    if (menu.hidden) {
      if (e.key === "ArrowDown") { e.preventDefault(); openMenu(); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); selected = (selected + 1) % engines.length; renderMenu(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); selected = (selected - 1 + engines.length) % engines.length; renderMenu(); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(selected); }
    else if (e.key === "Escape") { e.preventDefault(); closeMenu(); }
  });

  document.addEventListener("mousedown", (e) => {
    if (!menu.hidden && !form.contains(e.target)) closeMenu();
  });

  // "/" focuses the search box when nothing else has focus.
  document.addEventListener("keydown", (e) => {
    const t = e.target;
    const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      input.focus();
    }
  });

  loadEngines();

  return { loadEngines };
})();
