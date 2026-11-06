(() => {
  const root = document.documentElement;
  const storage = {
    get(key, fallback) {
      try { return localStorage.getItem(key) ?? fallback; } catch (_) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); } catch (_) {}
    }
  };
  const toast = document.querySelector(".toast");
  let toastTimer;
  const notify = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  };
  const portrait = document.querySelector(".hero-portrait");
  const finalPortraitPath = portrait?.querySelector('[data-draw-order="4"]');
  finalPortraitPath?.addEventListener("animationend", (event) => {
    if (event.animationName === "portrait-path-draw") portrait.classList.add("is-drawn");
  }, { once: true });

  const savedTheme = storage.get("enji-theme", "light");
  if (savedTheme === "dark") root.classList.add("dark");
  const themeLabel = document.querySelector("[data-theme-label]");
  const focusLabel = document.querySelector("[data-focus-label]");
  const themeButton = document.querySelector("[data-theme-toggle]");
  const focusButton = document.querySelector("[data-focus-toggle]");
  const focusActive = () => root.classList.contains("fm");
  const updateLabels = () => {
    if (themeLabel) themeLabel.textContent = `深色模式：${root.classList.contains("dark") ? "开启" : "关闭"}`;
    if (focusLabel) focusLabel.textContent = `专注模式：${focusActive() ? "开启" : "关闭"}`;
    themeButton?.classList.toggle("is-active", root.classList.contains("dark"));
    focusButton?.classList.toggle("is-active", focusActive());
    themeButton?.setAttribute("aria-pressed", String(root.classList.contains("dark")));
    focusButton?.setAttribute("aria-pressed", String(focusActive()));
  };
  const animateThemeIcon = (isDark) => {
    const rotator = document.querySelector(".theme-icon-rotator");
    const topIcon = document.querySelector(".theme-icon-top");
    const bottomIcon = document.querySelector(".theme-icon-bottom");
    const incomingIcon = isDark ? bottomIcon : topIcon;
    const outgoingIcon = isDark ? topIcon : bottomIcon;
    if (!rotator || !incomingIcon || !outgoingIcon || typeof rotator.animate !== "function") return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!prefersReducedMotion) {
      rotator.animate(
        [{ transform: `rotate(${isDark ? 90 : 90.01}deg)` }, { transform: "rotate(0deg)" }],
        { duration: 800, easing: "ease-out" }
      );
    }
    incomingIcon.animate(
      [
        { opacity: isDark ? 0.01 : 0, ...(prefersReducedMotion ? {} : { transform: `scale(${isDark ? 0.801 : 0.8})` }) },
        { opacity: 1, ...(prefersReducedMotion ? {} : { transform: "scale(1)" }) },
      ],
      { duration: 800, easing: "ease-out" }
    );
    outgoingIcon.animate(
      [
        { opacity: 1, ...(prefersReducedMotion ? {} : { transform: "scale(1)" }) },
        { opacity: isDark ? 0 : 0.01, ...(prefersReducedMotion ? {} : { transform: `scale(${isDark ? 0.801 : 0.8})` }) },
      ],
      { duration: 800, easing: "ease-out" }
    );
  };
  const toggleTheme = () => {
    root.classList.toggle("dark");
    const isDark = root.classList.contains("dark");
    storage.set("enji-theme", isDark ? "dark" : "light");
    animateThemeIcon(isDark);
    updateLabels();
    notify(`已${isDark ? "开启" : "关闭"}深色模式`);
  };
  const toggleFocus = () => {
    root.classList.toggle("fm");
    storage.set("enji-focus", focusActive() ? "on" : "off");
    updateLabels();
    notify(`专注模式已${focusActive() ? "开启" : "关闭"}`);
  };
  if (storage.get("enji-focus", "off") === "on") root.classList.add("fm");
  themeButton?.addEventListener("click", toggleTheme);
  focusButton?.addEventListener("click", toggleFocus);
  updateLabels();

  const panel = document.querySelector(".quick-panel");
  const openButton = document.querySelector(".quick-open");
  const closeButton = document.querySelector(".quick-close");
  let previouslyFocused;
  const panelFocusable = () => [...panel.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')];
  const togglePanel = (open) => {
    if (!panel) return;
    if (open && !panel.classList.contains("is-open")) previouslyFocused = document.activeElement;
    panel?.classList.toggle("is-open", open);
    panel?.setAttribute("aria-hidden", String(!open));
    document.body.classList.toggle("quick-access-open", open);
    if (open) {
      animateThemeIcon(root.classList.contains("dark"));
      closeButton?.focus();
      requestAnimationFrame(() => {
        if (searchInput) searchInput.focus();
        else closeButton?.focus();
      });
    }
    else if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    else openButton?.focus();
  };
  openButton?.addEventListener("click", () => togglePanel(true));
  closeButton?.addEventListener("click", () => togglePanel(false));
  panel?.addEventListener("click", (event) => {
    if (event.target === panel) togglePanel(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(event.target.tagName)) return;
    if (panel?.classList.contains("is-open") && event.key === "Tab") {
      const focusable = panelFocusable();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    if ((event.key === "Escape" || event.code === "KeyQ") && panel?.classList.contains("is-open")) togglePanel(false);
    else if (event.code === "KeyQ" && !event.altKey && !event.ctrlKey && !event.metaKey) togglePanel(true);
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.code === "KeyD") toggleTheme();
    if (event.code === "KeyF") toggleFocus();
  });

  const searchInput = panel?.querySelector("[data-quick-search]");
  const searchStatus = panel?.querySelector("[data-quick-search-status]");
  const searchResults = panel?.querySelector("[data-quick-search-results]");
  const searchPagination = panel?.querySelector("[data-quick-search-pagination]");
  const searchPageSize = 5;
  let searchIndexPromise;
  let searchMatches = [];
  let searchPage = 1;
  const searchTerms = (query) => query.trim().toLocaleLowerCase("zh-CN").split(/\s+/).filter(Boolean);
  const appendHighlightedText = (element, text, terms) => {
    const pattern = terms
      .filter(Boolean)
      .sort((left, right) => right.length - left.length)
      .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");
    if (!pattern) {
      element.textContent = text;
      return;
    }

    const matcher = new RegExp(`(${pattern})`, "giu");
    let cursor = 0;
    for (const match of text.matchAll(matcher)) {
      const index = match.index ?? 0;
      element.append(document.createTextNode(text.slice(cursor, index)));
      const highlight = document.createElement("mark");
      highlight.className = "quick-search-highlight";
      highlight.textContent = match[0];
      element.append(highlight);
      cursor = index + match[0].length;
    }
    element.append(document.createTextNode(text.slice(cursor)));
  };
  const setSearchPage = (page) => {
    if (!searchResults || !searchPagination) return;
    const totalPages = Math.ceil(searchMatches.length / searchPageSize);
    searchPage = Math.min(Math.max(page, 1), totalPages);
    searchResults.replaceChildren();

    const pageItems = searchMatches.slice((searchPage - 1) * searchPageSize, searchPage * searchPageSize);
    pageItems.forEach((article) => {
      const link = document.createElement("a");
      link.className = "quick-search-result";
      link.href = article.url;
      const date = document.createElement("time");
      date.className = "quick-search-date";
      date.dateTime = article.date;
      date.textContent = article.date.slice(5).replace("-", ".");
      const copy = document.createElement("span");
      copy.className = "quick-search-copy";
      const title = document.createElement("b");
      appendHighlightedText(title, article.title, searchTerms(searchInput?.value || ""));
      const summary = document.createElement("small");
      const content = article.content || article.summary || "";
      const contentLower = content.toLocaleLowerCase("zh-CN");
      const firstMatch = searchTerms(searchInput?.value || "")
        .map((term) => contentLower.indexOf(term))
        .filter((index) => index >= 0)
        .sort((left, right) => left - right)[0];
      if (firstMatch === undefined) {
        appendHighlightedText(summary, article.summary || "", searchTerms(searchInput?.value || ""));
      } else {
        const start = Math.max(0, firstMatch - 45);
        const excerpt = content.slice(start, start + 130);
        if (start > 0) summary.append(document.createTextNode("…"));
        appendHighlightedText(summary, excerpt, searchTerms(searchInput?.value || ""));
        if (start + 130 < content.length) summary.append(document.createTextNode("…"));
      }
      copy.append(title, summary);
      const arrow = document.createElement("span");
      arrow.className = "quick-search-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "→";
      link.append(date, copy, arrow);
      searchResults.append(link);
    });

    searchPagination.replaceChildren();
    searchPagination.hidden = totalPages <= 1;
    if (totalPages > 1) {
      const addPageButton = (label, page, options = {}) => {
        if (options.ellipsis) {
          const ellipsis = document.createElement("span");
          ellipsis.className = "quick-search-ellipsis";
          ellipsis.textContent = "…";
          searchPagination.append(ellipsis);
          return;
        }
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.dataset.searchPage = String(page);
        button.disabled = Boolean(options.disabled);
        if (label === "‹") button.setAttribute("aria-label", "上一页");
        if (label === "›") button.setAttribute("aria-label", "下一页");
        if (options.current) {
          button.className = "is-current";
          button.setAttribute("aria-current", "page");
        }
        searchPagination.append(button);
      };
      addPageButton("‹", searchPage - 1, { disabled: searchPage === 1 });
      const pages = [...new Set([1, searchPage - 1, searchPage, searchPage + 1, totalPages])]
        .filter((page) => page >= 1 && page <= totalPages)
        .sort((left, right) => left - right);
      pages.forEach((page, index) => {
        if (index > 0 && page - pages[index - 1] > 1) addPageButton("…", 0, { ellipsis: true });
        addPageButton(String(page), page, { current: page === searchPage });
      });
      addPageButton("›", searchPage + 1, { disabled: searchPage === totalPages });
    }

    if (searchStatus) {
      searchStatus.textContent = `找到 ${searchMatches.length} 篇相关文章 · 第 ${searchPage}/${totalPages} 页`;
    }
  };
  const searchArticles = async () => {
    if (!searchInput || !searchStatus || !searchResults || !searchPagination) return;
    const query = searchInput.value.trim();
    const terms = searchTerms(query);
    if (!terms.length) {
      searchMatches = [];
      searchResults.replaceChildren();
      searchResults.hidden = true;
      searchPagination.hidden = true;
      searchStatus.textContent = "输入关键词搜索文章全文";
      return;
    }

    searchResults.hidden = false;
    searchStatus.textContent = "正在检索文章全文…";
    if (!searchIndexPromise) {
      const indexUrl = searchInput.dataset.searchIndexUrl;
      if (!indexUrl) {
        searchStatus.textContent = "全文搜索未配置，请刷新页面重试。";
        console.error("Article search index URL is not configured.");
        return;
      }
      searchIndexPromise = fetch(indexUrl)
        .then((response) => {
          if (!response.ok) throw new Error(`Search index request failed: ${response.status}`);
          return response.json();
        })
        .then((articles) => {
          if (!Array.isArray(articles)) throw new Error("Search index has an invalid format.");
          return articles;
        });
    }

    try {
      const articles = await searchIndexPromise;
      if (query !== searchInput.value.trim()) return;
      searchMatches = articles.filter((article) => terms.every((term) => article.text.includes(term)));
      searchPage = 1;
      if (!searchMatches.length) {
        searchResults.replaceChildren();
        searchPagination.replaceChildren();
        searchPagination.hidden = true;
        searchStatus.textContent = "没有找到相关文章，试试其他关键词。";
        return;
      }
      setSearchPage(searchPage);
    } catch (error) {
      console.error("Unable to load the article full-text search index.", error);
      searchStatus.textContent = "文章全文索引加载失败，请刷新页面重试。";
    }
  };
  searchInput?.addEventListener("input", searchArticles);
  searchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchResults?.querySelector("a")?.click();
    } else if (event.key === "Escape" && searchInput.value) {
      event.preventDefault();
      event.stopPropagation();
      searchInput.value = "";
      searchArticles();
    } else if (event.key === "Escape") {
      closeButton?.click();
    }
  });
  searchPagination?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-search-page]");
    if (!button || button.disabled) return;
    const page = Number(button.dataset.searchPage);
    if (Number.isInteger(page) && page > 0) setSearchPage(page);
  });

  const header = document.querySelector(".site-header");
  const updateHeader = () => header?.classList.toggle("scrolled", window.scrollY > 0);
  window.addEventListener("scroll", updateHeader, { passive: true });
  updateHeader();

  const mobileButton = document.querySelector(".mobile-menu-button");
  const mobileNav = document.querySelector(".mobile-nav");
  mobileButton?.addEventListener("click", () => {
    const expanded = mobileButton.getAttribute("aria-expanded") === "true";
    mobileButton.setAttribute("aria-expanded", String(!expanded));
    if (mobileNav) mobileNav.hidden = expanded;
  });

  const sections = [...document.querySelectorAll(".prose h2[id], .prose h3[id]")];
  const tocLinks = [...document.querySelectorAll("#TableOfContents a[href^='#']")];
  const setActiveTocLink = (targetId, active) => {
    const link = tocLinks.find((item) => item.getAttribute("href") === `#${targetId}`);
    link?.classList.toggle("active", active);
    link?.closest("li")?.classList.toggle("is-active", active);
  };
  if (sections.length && "IntersectionObserver" in window) {
    sections.forEach((section) => {
      const observer = new IntersectionObserver(([entry]) => {
        setActiveTocLink(entry.target.id, entry.isIntersecting);
      }, { rootMargin: "-96px 0px 0px 0px" });
      observer.observe(section);
    });
  } else if (sections.length) {
    setActiveTocLink(sections[0].id, true);
  }
  const toc = document.querySelector(".toc-card");
  const toTopLink = toc?.querySelector(".to-top");
  const updateTocScrollState = () => {
    const isScrolled = window.scrollY > 200;
    toc?.classList.toggle("is-scrolled", isScrolled);
    toTopLink?.setAttribute("tabindex", isScrolled ? "0" : "-1");
  };
  window.addEventListener("scroll", updateTocScrollState, { passive: true });
  updateTocScrollState();
  toTopLink?.addEventListener("click", (event) => {
    event.preventDefault();
    window.scrollTo({ top: 0 });
  });

  let copiedButton;
  let copyFeedbackTimer;
  document.querySelectorAll("[data-copy-code]").forEach((button) => {
    button.addEventListener("click", async () => {
      const code = button.closest(".mdx-code")?.querySelector("pre code")?.textContent;
      if (code === undefined) {
        notify("找不到可复制的代码");
        return;
      }
      try {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
        await navigator.clipboard.writeText(code);
        copiedButton?.classList.remove("is-copied");
        clearTimeout(copyFeedbackTimer);
        copiedButton = button;
        button.classList.add("is-copied");
        copyFeedbackTimer = setTimeout(() => button.classList.remove("is-copied"), 1600);
      } catch (_) {
        notify("复制失败，请检查浏览器剪贴板权限");
      }
    });
  });

  document.querySelectorAll("[data-project-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      const current = tab.dataset.projectTab;
      document.querySelectorAll("[data-project-tab]").forEach((item) => {
        const selected = item.dataset.projectTab === current;
        item.classList.toggle("is-active", selected);
        item.setAttribute("aria-selected", String(selected));
      });
      document.querySelectorAll("[data-browser-tab]").forEach((item) => item.classList.toggle("is-active", item.dataset.browserTab === current));
      document.querySelectorAll("[data-project-panel]").forEach((item) => { item.hidden = item.dataset.projectPanel !== current; });
      const address = document.querySelector(".browser-address");
      if (address) address.innerHTML = `<span>🔒</span> ${current === "github" ? "github.com/enjidev/tailwindcss-accent" : "npmjs.com/package/tailwindcss-accent"}`;
    });
  });
  document.querySelectorAll("[data-browser-tab]").forEach((tab) => tab.addEventListener("click", () => document.querySelector(`[data-project-tab="${tab.dataset.browserTab}"]`)?.click()));
  document.querySelector("[data-copy-command]")?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText("npm i tailwindcss-accent"); notify("已复制安装命令"); }
    catch (_) { notify("无法访问剪贴板，请手动复制命令"); }
  });

  document.querySelectorAll("[data-accent-toggle]").forEach((button) => button.addEventListener("click", () => {
    root.dataset.accent = root.dataset.accent === "blue" ? "violet" : "blue";
    notify(`强调色已切换为${root.dataset.accent === "blue" ? "蓝色" : "紫色"}`);
  }));

  const demoStates = {
    typography: ["typography"],
    spacing: ["typography", "spacing"],
    colors: ["typography", "spacing", "colors"],
    effects: ["typography", "spacing", "colors", "effects"]
  };
  document.querySelectorAll("[data-demo-state]").forEach((button) => {
    button.addEventListener("click", () => {
      const state = button.dataset.demoState;
      const visibleStates = demoStates[state];
      document.querySelectorAll("[data-demo-state]").forEach((item) => {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      document.querySelectorAll("[data-todo-card]").forEach((card) => {
        card.dataset.state = visibleStates.includes("effects") ? "effects" : state;
      });
    });
  });

  const reactionBar = document.querySelector("[data-reaction-bar]");
  if (reactionBar) {
    const shareActions = reactionBar.querySelector(".share-actions");
    reactionBar.querySelector(".share-toggle")?.addEventListener("click", () => shareActions?.classList.toggle("is-open"));
    reactionBar.querySelector("[data-copy-link]")?.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(location.href); notify("链接已复制"); }
      catch (_) { notify("无法访问剪贴板，请复制地址栏链接"); }
      shareActions?.classList.remove("is-open");
    });
    const shareLink = reactionBar.querySelector("[data-share-x]");
    if (shareLink) shareLink.href = `https://twitter.com/intent/tweet?via=enjidev&url=${encodeURIComponent(location.href)}`;
  }
})();
