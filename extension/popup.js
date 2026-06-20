const STORAGE_KEY = "currentTask";

chrome.storage.local.get([STORAGE_KEY], (output) => {
  const task = output[STORAGE_KEY];
  const box = document.getElementById("task");
  if (!task) return;
  box.innerHTML = `
    <strong>${task.from} → ${task.to}</strong>
    <div>${task.date} ${task.time}</div>
    <div>成人 ${task.adults || 1}，儿童 ${task.children || 0}</div>
    <div>${task.sellerName}</div>
  `;
});

document.getElementById("openPlanner").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
});
