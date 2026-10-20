(() => {
  const endpointValue = document.body.dataset.viewCounterEndpoint?.trim();
  const countElements = [...document.querySelectorAll("[data-view-count]")];
  if (!endpointValue || countElements.length === 0) return;

  let endpoint;
  try {
    endpoint = new URL(endpointValue);
    if (endpoint.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(endpoint.hostname)) {
      throw new Error("The view counter endpoint must use HTTPS.");
    }
  } catch (error) {
    console.error("文章浏览量统计接口配置无效。", error);
    countElements.forEach((element) => {
      element.textContent = "统计配置无效";
    });
    return;
  }

  const getPath = (element) => new URL(element.dataset.viewPath, window.location.origin).pathname;
  const setCount = (path, count) => {
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error("The view counter returned an invalid count.");
    }
    countElements
      .filter((element) => getPath(element) === path)
      .forEach((element) => {
        element.textContent = `${new Intl.NumberFormat("zh-CN").format(count)} 看过`;
      });
  };
  const requestUrl = (route) => new URL(route, endpoint);

  const loadCounts = async () => {
    const paths = [...new Set(countElements.map(getPath))];
    if (paths.length === 0) return;
    const url = requestUrl("/api/counts");
    paths.forEach((path) => url.searchParams.append("path", path));
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`View counter returned HTTP ${response.status}.`);
    const data = await response.json();
    if (!data || typeof data.counts !== "object" || data.counts === null) {
      throw new Error("The view counter returned an invalid response.");
    }
    paths.forEach((path) => setCount(path, data.counts[path]));
  };

  const recordCurrentPage = async () => {
    const path = window.location.pathname;
    const response = await fetch(requestUrl("/api/view"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
      cache: "no-store",
      keepalive: true,
    });
    if (!response.ok) throw new Error(`View counter returned HTTP ${response.status}.`);
    const data = await response.json();
    setCount(path, data.views);
  };

  const showFailure = (error) => {
    console.error("无法加载文章浏览量统计。", error);
    countElements.forEach((element) => {
      element.textContent = "统计暂不可用";
    });
  };

  if (document.querySelector("[data-view-counter-page]")) {
    recordCurrentPage().catch(showFailure);
  } else {
    loadCounts().catch(showFailure);
  }
})();
