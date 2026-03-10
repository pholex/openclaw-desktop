const { app, BrowserWindow, Menu, dialog, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");

let mainWindow;
let settingsWindow;
let willQuitApp = false;

const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    }
  } catch (e) {}
  return null;
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function getTargetURL(config) {
  return `${config.host}/?token=${config.token}`;
}

function openSettings(onSaved) {
  if (settingsWindow) { settingsWindow.focus(); return; }
  settingsWindow = new BrowserWindow({
    width: 480, height: 300, resizable: false,
    title: "设置", parent: mainWindow, modal: !!mainWindow,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  const config = loadConfig();
  const currentURL = config ? getTargetURL(config) : "";
  settingsWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html><head><style>
  body{font-family:system-ui;padding:24px;background:#f5f5f5}
  label{display:block;margin:8px 0 4px;font-size:14px}
  input{width:100%;padding:6px 8px;box-sizing:border-box;border:1px solid #ccc;border-radius:4px;font-size:14px}
  button{margin-top:16px;padding:8px 24px;background:#007aff;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px}
  .hint{font-size:12px;color:#888;margin-top:4px}
</style></head><body>
  <label>粘贴访问链接</label>
  <input id="url" placeholder="http://host:port/?token=xxx" value="${currentURL}">
  <div class="hint">例如: http://127.0.0.1:18789/?token=abc123</div>
  <button onclick="save()">保存</button>
  <script>
    const {ipcRenderer}=require('electron');
    function save(){
      try{
        const u=new URL(document.getElementById('url').value.trim());
        const token=u.searchParams.get('token')||'';
        const host=u.origin;
        ipcRenderer.send('save-config',{host,token});
      }catch(e){alert('链接格式不正确')}
    }
  </script>
</body></html>`)}`);
  settingsWindow.on("closed", () => { settingsWindow = null; });
  ipcMain.once("save-config", (_, config) => {
    saveConfig(config);
    settingsWindow && settingsWindow.close();
    if (onSaved) onSaved(config);
  });
}

function createWindow(config) {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, title: "OpenClaw",
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  mainWindow.on("page-title-updated", (e) => e.preventDefault());
  mainWindow.loadURL(getTargetURL(config));

  mainWindow.on("close", function (e) {
    if (!willQuitApp) {
      e.preventDefault();
      dialog.showMessageBox(mainWindow, {
        type: "question", buttons: ["确认", "取消"],
        title: "确认退出", message: "确定要退出应用吗?",
        defaultId: 0, cancelId: 1,
      }).then((r) => { if (r.response === 0) { willQuitApp = true; app.quit(); } });
    }
  });
  mainWindow.on("closed", () => { mainWindow = null; });

  const menu = Menu.buildFromTemplate([{
    label: "文件", submenu: [
      { label: "设置", accelerator: "CmdOrCtrl+,", click: () => openSettings((c) => mainWindow && mainWindow.loadURL(getTargetURL(c))) },
      { label: "刷新", accelerator: "CmdOrCtrl+R", click: () => mainWindow && mainWindow.reload() },
      { label: "开发者工具", accelerator: "CmdOrCtrl+Shift+I", click: () => mainWindow && mainWindow.webContents.toggleDevTools() },
      { type: "separator" },
      { label: "退出", accelerator: "Command+Q", click: () => {
        dialog.showMessageBox(mainWindow, {
          type: "question", buttons: ["确认", "取消"],
          title: "确认退出", message: "确定要退出应用吗?",
          defaultId: 0, cancelId: 1,
        }).then((r) => { if (r.response === 0) { willQuitApp = true; app.quit(); } });
      }},
    ],
  }]);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  const config = loadConfig();
  if (config) {
    createWindow(config);
  } else {
    openSettings((c) => createWindow(c));
  }
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (mainWindow === null) { const c = loadConfig(); if (c) createWindow(c); } });
app.on("before-quit", () => { willQuitApp = true; });
