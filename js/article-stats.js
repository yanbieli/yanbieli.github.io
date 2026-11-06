(() => {
  const views = [...document.querySelectorAll("[data-view-count]")];
  const reactionBar = document.querySelector("[data-reaction-bar]");
  const reactionButtons = [...(reactionBar?.querySelectorAll("[data-reaction]") || [])];
  if (!views.length && !reactionButtons.length) return;

  const endpointValue = document.body.dataset.viewCounterEndpoint?.trim();
  const site = document.body.dataset.viewCounterSite?.trim();
  let endpoint;

  try {
    endpoint = new URL(endpointValue);
    if (endpoint.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(endpoint.hostname)) {
      throw new Error("The view counter endpoint must use HTTPS.");
    }
    if (!site) throw new Error("The view counter site is not configured.");
  } catch (error) {
    console.error("文章统计接口配置无效。", error);
    views.forEach((element) => { element.textContent = "统计配置无效"; });
    reactionButtons.forEach((button) => {
      const count = button.querySelector("[data-count]");
      if (count) count.textContent = "不可用";
      button.disabled = true;
    });
    return;
  }

  const pagePath = window.location.pathname;
  const requestUrl = (route) => new URL(route, endpoint);
  const setViewCount = (value) => {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("The view counter returned an invalid count.");
    views.forEach((element) => {
      element.textContent = `${new Intl.NumberFormat("zh-CN").format(value)} 看过`;
    });
  };
  const setReactionCount = (type, value) => {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("The reaction counter returned an invalid count.");
    const output = reactionBar.querySelector(`[data-count="${type}"]`);
    if (output) output.textContent = new Intl.NumberFormat("zh-CN").format(value);
  };
  const setReactionCounts = (counts) => {
    for (const button of reactionButtons) {
      const type = button.dataset.reaction;
      setReactionCount(type, counts[type]);
    }
  };
  const requestJson = async (url, options) => {
    const response = await fetch(url, { cache: "no-store", ...options });
    if (!response.ok) throw new Error(`Article stats returned HTTP ${response.status}.`);
    return response.json();
  };
  const showError = (message, error) => {
    console.error(message, error);
  };

  if (views.length) {
    requestJson(requestUrl("/api/view"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site, path: pagePath }),
      keepalive: true,
    })
      .then((data) => setViewCount(data.views))
      .catch((error) => {
        views.forEach((element) => { element.textContent = "统计暂不可用"; });
        showError("无法加载文章浏览量统计。", error);
      });
  }

  if (!reactionButtons.length) return;
  const countsUrl = requestUrl("/api/reactions");
  countsUrl.searchParams.set("site", site);
  countsUrl.searchParams.set("path", pagePath);
  requestJson(countsUrl)
    .then((data) => setReactionCounts(data.counts))
    .catch((error) => {
      reactionButtons.forEach((button) => {
        const output = button.querySelector(`[data-count="${button.dataset.reaction}"]`);
        if (output) output.textContent = "不可用";
      });
      showError("无法加载文章点赞统计。", error);
    });

  const quotaKey = `enji-reaction-quota:${site}:${pagePath}`;
  const pending = new Set();
  const toast = document.querySelector(".toast");
  let toastTimer;
  const notify = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2200);
  };

  reactionButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const type = button.dataset.reaction;
      if (pending.has(type)) return;

      let quota = 0;
      try {
        quota = Number(localStorage.getItem(`${quotaKey}:${type}`) || 0);
      } catch (error) {
        showError("无法读取本地点赞次数限制。", error);
      }
      if (quota >= 10) {
        notify("此表情的反应次数已达上限");
        return;
      }

      pending.add(type);
      button.disabled = true;
      try {
        const data = await requestJson(requestUrl("/api/reaction"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ site, path: pagePath, reaction: type }),
        });
        if (!Number.isSafeInteger(data.count) || data.count < 0) {
          throw new Error("The reaction counter returned an invalid count.");
        }
        setReactionCount(type, data.count);
        try {
          localStorage.setItem(`${quotaKey}:${type}`, String(quota + 1));
        } catch (error) {
          showError("无法保存本地点赞次数限制。", error);
        }
        if (typeof button.animate === "function") {
          button.animate([{ transform: "scale(1)" }, { transform: "scale(1.22)" }, { transform: "scale(1)" }], { duration: 250 });
        }
      } catch (error) {
        notify("点赞暂时失败，请稍后重试");
        showError("无法记录文章点赞。", error);
      } finally {
        pending.delete(type);
        button.disabled = false;
      }
    });
  });
})();
