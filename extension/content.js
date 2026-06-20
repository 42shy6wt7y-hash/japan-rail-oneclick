(function runContentScript() {
  const HASH_KEY = "jr-oneclick=";
  const STORAGE_KEY = "currentTask";

  function readTaskFromHash() {
    const hash = decodeURIComponent(window.location.hash || "");
    const index = hash.indexOf(HASH_KEY);
    if (index === -1) return null;
    const payload = hash.slice(index + HASH_KEY.length);
    try {
      return JSON.parse(payload);
    } catch (error) {
      return null;
    }
  }

  function storageGet() {
    return new Promise((resolve) => {
      if (typeof chrome === "undefined" || !chrome.storage?.local) {
        resolve(null);
        return;
      }
      chrome.storage.local.get([STORAGE_KEY], (output) => resolve(output[STORAGE_KEY] || null));
    });
  }

  function storageSet(task) {
    return new Promise((resolve) => {
      if (typeof chrome === "undefined" || !chrome.storage?.local) {
        resolve();
        return;
      }
      chrome.storage.local.set({ [STORAGE_KEY]: task }, resolve);
    });
  }

  function visibleText(node) {
    return String(node?.innerText || node?.textContent || "").trim();
  }

  function fieldCandidates() {
    return [...document.querySelectorAll("input, select, textarea")].filter((field) => {
      if (field.disabled || field.readOnly) return false;
      const type = String(field.getAttribute("type") || "").toLowerCase();
      return !["hidden", "password", "submit", "button", "checkbox", "radio", "file"].includes(type);
    });
  }

  function contextFor(field) {
    const labels = [];
    if (field.id) {
      const explicit = document.querySelector(`label[for="${CSS.escape(field.id)}"]`);
      if (explicit) labels.push(visibleText(explicit));
    }
    const parentLabel = field.closest("label");
    if (parentLabel) labels.push(visibleText(parentLabel));
    const row = field.closest("tr, li, .form-group, .field, .input, .control, div");
    if (row) labels.push(visibleText(row).slice(0, 160));
    labels.push(field.name, field.id, field.placeholder, field.getAttribute("aria-label"));
    return labels.filter(Boolean).join(" ").toLowerCase();
  }

  function setField(field, value) {
    if (!field || value === undefined || value === null) return false;
    field.focus();
    if (field.tagName === "SELECT") {
      const normalized = String(value).toLowerCase();
      const option = [...field.options].find((item) => {
        return item.value.toLowerCase().includes(normalized) || item.textContent.toLowerCase().includes(normalized);
      });
      if (!option) return false;
      field.value = option.value;
    } else {
      field.value = value;
    }
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function pickField(matchers, used) {
    for (const field of fieldCandidates()) {
      if (used.has(field)) continue;
      const context = contextFor(field);
      if (matchers.some((matcher) => matcher.test(context))) {
        used.add(field);
        return field;
      }
    }
    return null;
  }

  function tryAutofill(task) {
    const used = new Set();
    const filled = [];
    const pairs = [
      {
        label: "起点",
        value: task.from,
        matchers: [/from|departure|origin|boarding|乗車|出発|発駅|起点/]
      },
      {
        label: "终点",
        value: task.to,
        matchers: [/to|arrival|destination|alighting|降車|到着|着駅|终点|終点/]
      },
      {
        label: "日期",
        value: task.date,
        matchers: [/date|day|boarding date|乗車日|利用日|日付|日期/]
      },
      {
        label: "时间",
        value: task.time,
        matchers: [/time|hour|departure time|出発時刻|時刻|时间|時間/]
      },
      {
        label: "成人",
        value: task.adults,
        matchers: [/adult|adults|大人|成人/]
      },
      {
        label: "儿童",
        value: task.children,
        matchers: [/child|children|小児|儿童|子供/]
      }
    ];

    for (const pair of pairs) {
      const field = pickField(pair.matchers, used);
      if (field && setField(field, pair.value)) filled.push(pair.label);
    }
    return filled;
  }

  function copyText(text) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    const area = document.createElement("textarea");
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
    return Promise.resolve();
  }

  function renderTask(task) {
    document.getElementById("jr-oneclick-panel")?.remove();
    const panel = document.createElement("aside");
    panel.id = "jr-oneclick-panel";
    panel.innerHTML = `
      <div class="jr-oneclick-head">
        <p class="jr-oneclick-title">中文购票助手</p>
        <button class="jr-oneclick-close" type="button" aria-label="关闭">×</button>
      </div>
      <div class="jr-oneclick-body">
        <div class="jr-oneclick-route">
          <span>${task.from}</span>
          <span class="jr-oneclick-arrow">→</span>
          <span>${task.to}</span>
        </div>
        <dl class="jr-oneclick-detail">
          <dt>日期</dt><dd>${task.date}</dd>
          <dt>时间</dt><dd>${task.time}</dd>
          <dt>人数</dt><dd>成人 ${task.adults || 1}，儿童 ${task.children || 0}</dd>
          <dt>渠道</dt><dd>${task.sellerName}</dd>
        </dl>
        <ul class="jr-oneclick-lines">
          ${(task.lines || []).map((line) => `<li>${line}</li>`).join("")}
        </ul>
        <div class="jr-oneclick-warning">请在官方页面核对日期、列车、座席、价格和退改规则。助手不会自动提交订单或付款。</div>
        <div class="jr-oneclick-actions">
          <button class="jr-oneclick-btn" type="button" data-action="fill">尝试预填</button>
          <button class="jr-oneclick-btn secondary" type="button" data-action="copy">复制任务</button>
        </div>
        <div class="jr-oneclick-status" aria-live="polite"></div>
      </div>
    `;
    document.body.append(panel);

    const status = panel.querySelector(".jr-oneclick-status");
    panel.querySelector(".jr-oneclick-close").addEventListener("click", () => panel.remove());
    panel.querySelector("[data-action='fill']").addEventListener("click", () => {
      const filled = tryAutofill(task);
      status.textContent = filled.length ? `已尝试填写：${filled.join("、")}。` : "没有识别到可填写字段，请按浮层内容手动输入。";
    });
    panel.querySelector("[data-action='copy']").addEventListener("click", async () => {
      await copyText(JSON.stringify(task, null, 2));
      status.textContent = "购票任务已复制。";
    });
  }

  async function boot() {
    const fromHash = readTaskFromHash();
    if (fromHash) await storageSet(fromHash);
    const task = fromHash || await storageGet();
    if (task) renderTask(task);
  }

  boot();
})();
