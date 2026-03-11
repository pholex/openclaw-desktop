const { contextBridge, ipcRenderer } = require("electron");
const VALID_SEND = ["save-config", "switch-slot"];
const VALID_ON = ["load-config"];
contextBridge.exposeInMainWorld("api", {
  send: (channel, data) => { if (VALID_SEND.includes(channel)) ipcRenderer.send(channel, data); },
  on: (channel, cb) => { if (VALID_ON.includes(channel)) ipcRenderer.on(channel, (_, ...args) => cb(...args)); },
});

ipcRenderer.on("inject-switcher", (_, btnsJson) => {
  if (document.getElementById("oc-switcher")) return;
  const items = JSON.parse(btnsJson);
  const s = document.createElement("style");
  s.textContent = ".oc-btn{width:32px;height:32px;border-radius:50%;border:2px solid #ddd;background:#fff;color:#666;cursor:pointer;font-size:11px;font-weight:700;transition:all .2s;}.oc-btn:hover{transform:scale(1.15);border-color:#ff4d4d;color:#ff4d4d;box-shadow:0 0 8px rgba(255,77,77,0.3);}.oc-btn.active{border-color:#ff4d4d;background:#ff4d4d;color:#fff;}.oc-btn.active:hover{transform:scale(1.15);box-shadow:0 0 12px rgba(255,77,77,0.5);}";
  document.head.appendChild(s);
  const d = document.createElement("div");
  d.id = "oc-switcher";
  d.style.cssText = "position:fixed;top:50%;right:0;z-index:99999;transform:translateY(-50%);display:flex;flex-direction:column;gap:4px;padding:6px 4px;background:rgba(255,255,255,0.9);border-radius:12px 0 0 12px;box-shadow:-2px 0 12px rgba(0,0,0,0.1);backdrop-filter:blur(8px);";
  items.forEach((item) => {
    const b = document.createElement("button");
    b.className = "oc-btn" + (item.active ? " active" : "");
    b.textContent = item.idx + 1;
    b.addEventListener("click", () => {
      document.querySelectorAll(".oc-btn").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      b.textContent = "⋯";
      // 全屏过渡遮罩
      if (!document.getElementById("oc-loading")) {
        const m = document.createElement("div");
        m.id = "oc-loading";
        m.style.cssText = "position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);";
        m.innerHTML = '<div style="color:#fff;font-size:16px;font-weight:600;">切换中...</div>';
        document.body.appendChild(m);
      }
      ipcRenderer.send("switch-slot", item.idx);
    });
    d.appendChild(b);
  });
  document.body.appendChild(d);
});
