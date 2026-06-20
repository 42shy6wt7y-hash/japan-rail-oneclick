(function attachApp(global) {
  const DATA = global.JR_DATA;
  const ENGINE = global.JR_ENGINE;
  const state = {
    sort: "recommended",
    plans: [],
    selectedId: null,
    input: {}
  };

  const $ = (selector) => document.querySelector(selector);
  const results = $("#results");
  const selectedPlan = $("#selectedPlan");
  const routeMap = $("#routeMap");
  const toast = $("#toast");

  function initDate() {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    $("#travelDate").value = date.toISOString().slice(0, 10);
  }

  function populateStations() {
    const list = $("#stationList");
    list.innerHTML = DATA.stations.map((station) => `<option value="${station.name}"></option>`).join("");
  }

  function formInput() {
    const form = new FormData($("#searchForm"));
    return {
      from: form.get("from"),
      to: form.get("to"),
      date: form.get("date"),
      time: form.get("time"),
      adults: Number(form.get("adults")) || 1,
      children: Number(form.get("children")) || 0,
      luggage: $("#luggage").checked,
      jrPass: $("#jrPass").checked,
      avoidNozomi: $("#avoidNozomi").checked
    };
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 3200);
  }

  function routeBadges(plan) {
    const badges = [
      `<span class="badge ${plan.direct ? "good" : ""}">${plan.direct ? "直达" : `${plan.transfers} 次换乘`}</span>`,
      `<span class="badge">${plan.minutes} 分钟</span>`
    ];
    if (state.input.jrPass) badges.push(`<span class="badge ${plan.passFriendly ? "good" : "warn"}">${plan.passFriendly ? "JR Pass 友好" : "需另付"}</span>`);
    if (plan.sellers.length > 1) badges.push(`<span class="badge warn">跨 ${plan.sellers.length} 个售票系统</span>`);
    return badges.join("");
  }

  function legLine(plan) {
    return plan.legs
      .map((leg) => `${ENGINE.stationLabel(leg.from)} → ${ENGINE.stationLabel(leg.to)} · ${leg.line}`)
      .join("<br>");
  }

  function renderResults() {
    const plans = ENGINE.sortPlans(state.plans, state.sort);
    if (!plans.length) {
      results.innerHTML = `<div class="empty-state">没有找到合适方案。试试关闭“避开 Nozomi/Mizuho”或换一个站点。</div>`;
      routeMap.innerHTML = "";
      return;
    }

    if (!state.selectedId || !plans.some((plan) => plan.id === state.selectedId)) {
      state.selectedId = plans[0].id;
    }

    results.innerHTML = plans.map((plan) => `
      <article class="route-card ${plan.id === state.selectedId ? "selected" : ""}">
        <button class="route-select" type="button" data-plan-id="${plan.id}">
          <div class="route-summary">
            <h3>${ENGINE.stationLabel(plan.from)} → ${ENGINE.stationLabel(plan.to)}</h3>
            <div class="route-meta">${routeBadges(plan)}</div>
            <div class="leg-line">${legLine(plan)}</div>
          </div>
          <div class="fare-block">
            <div class="fare">${ENGINE.formatFare(plan.fare)}</div>
            <div class="small-muted">${state.input.jrPass ? "需另付估算" : "票价估算"}</div>
          </div>
        </button>
      </article>
    `).join("");

    results.querySelectorAll("[data-plan-id]").forEach((button) => {
      button.addEventListener("click", () => selectPlan(button.dataset.planId));
    });

    renderSelected();
  }

  function colorFor(leg) {
    const colors = {
      blue: "#2f80ed",
      teal: "#006d77",
      green: "#3f7d20",
      coral: "#d9480f",
      yellow: "#b08900"
    };
    return colors[leg.color] || "#006d77";
  }

  function renderMap(plan, timeline) {
    const stops = [plan.from, ...plan.legs.map((leg) => leg.to)];
    const labels = [];
    for (let index = 0; index < stops.length; index += 1) {
      const leg = timeline[index - 1] || timeline[0];
      const time = index === 0 ? timeline[0].departLabel : timeline[index - 1].arriveLabel;
      const color = index === 0 ? colorFor(timeline[0]) : colorFor(leg);
      labels.push(`
        <div class="map-stop" style="--segment-color:${color}">
          <div class="map-name">${ENGINE.stationLabel(stops[index])}</div>
          <div class="map-dot"></div>
          <div class="map-time">${time}</div>
        </div>
      `);
    }
    routeMap.innerHTML = `<div class="map-inner" style="--station-count:${stops.length}">${labels.join("")}</div>`;
  }

  function renderSelected() {
    const plan = state.plans.find((item) => item.id === state.selectedId);
    if (!plan) return;
    const timeline = ENGINE.buildTimeline(plan, state.input.date, state.input.time);
    const segments = ENGINE.groupBookingSegments(plan, timeline, state.input);
    renderMap(plan, timeline);

    const warningHtml = plan.warnings.length ? `
      <ul class="warning-list">
        ${plan.warnings.map((warning) => `<li>${warning}</li>`).join("")}
      </ul>
    ` : `<span class="badge good">未发现明显购票风险</span>`;

    selectedPlan.classList.remove("empty-state");
    selectedPlan.innerHTML = `
      <div>
        <strong>${ENGINE.stationLabel(plan.from)} → ${ENGINE.stationLabel(plan.to)}</strong>
        <div class="small-muted">${timeline[0].departLabel} 出发，${timeline[timeline.length - 1].arriveLabel} 到达</div>
      </div>
      ${warningHtml}
      <div class="segment-list">
        ${segments.map(segmentHtml).join("")}
      </div>
      <button type="button" class="primary-action" id="startAssistant">发送到购票助手</button>
    `;

    selectedPlan.querySelectorAll("[data-segment]").forEach((link) => {
      link.addEventListener("click", () => {
        const segment = segments.find((item) => item.id === link.dataset.segment);
        saveSegment(segment);
      });
    });

    $("#startAssistant").addEventListener("click", () => {
      localStorage.setItem("jr-oneclick-segments", JSON.stringify(segments.map((segment) => segment.payload)));
      showToast("已生成购票任务。请逐个打开官方页面确认。");
      window.dispatchEvent(new CustomEvent("jr-oneclick-ready", { detail: segments.map((segment) => segment.payload) }));
    });
  }

  function segmentHtml(segment) {
    const encoded = encodeURIComponent(JSON.stringify(segment.payload));
    return `
      <section class="segment-item">
        <h3>第 ${segment.index} 段 · ${segment.seller.name}</h3>
        <dl>
          <dt>区间</dt><dd>${segment.fromName} → ${segment.toName}</dd>
          <dt>时间</dt><dd>${segment.departLabel} → ${segment.arriveLabel}</dd>
          <dt>票价</dt><dd>${ENGINE.formatFare(segment.fare)}</dd>
          <dt>车次</dt><dd>${segment.lines.join(" / ")}</dd>
        </dl>
        <a class="link-action" data-segment="${segment.id}" href="${segment.purchaseUrl}#jr-oneclick=${encoded}" target="_blank" rel="noreferrer">打开官方购票页</a>
      </section>
    `;
  }

  function saveSegment(segment) {
    localStorage.setItem("jr-oneclick-current", JSON.stringify(segment.payload));
    showToast(`已为 ${segment.seller.name} 准备中文购票任务。`);
  }

  function selectPlan(planId) {
    state.selectedId = planId;
    renderResults();
  }

  function handleSearch(event) {
    event.preventDefault();
    state.input = formInput();
    const output = ENGINE.search(state.input);
    if (output.error) {
      state.plans = [];
      state.selectedId = null;
      $("#routeTitle").textContent = "未找到路线";
      renderResults();
      showToast(output.error);
      return;
    }
    state.plans = output.plans;
    state.selectedId = null;
    $("#routeTitle").textContent = `${output.from.name} → ${output.to.name}`;
    renderResults();
  }

  function bindEvents() {
    $("#searchForm").addEventListener("submit", handleSearch);
    $("#swapStations").addEventListener("click", () => {
      const from = $("#fromStation");
      const to = $("#toStation");
      const value = from.value;
      from.value = to.value;
      to.value = value;
      $("#searchForm").requestSubmit();
    });
    document.querySelectorAll("[data-sort]").forEach((button) => {
      button.addEventListener("click", () => {
        state.sort = button.dataset.sort;
        document.querySelectorAll("[data-sort]").forEach((item) => item.classList.toggle("active", item === button));
        renderResults();
      });
    });
  }

  function detectExtension() {
    const status = $("#extensionStatus");
    if (global.chrome && chrome.runtime && chrome.runtime.id) {
      status.textContent = "扩展已连接";
      status.classList.add("ready");
    } else {
      status.textContent = "本地页面模式";
    }
  }

  function init() {
    initDate();
    populateStations();
    bindEvents();
    detectExtension();
    $("#searchForm").requestSubmit();
  }

  document.addEventListener("DOMContentLoaded", init);
})(window);
