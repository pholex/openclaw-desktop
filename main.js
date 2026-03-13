const { app, BrowserWindow, Menu, dialog, ipcMain, clipboard } = require("electron");
const fs = require("fs");
const path = require("path");

let mainWindow;
let willQuitApp = false;
let loaded = false;

const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");
const PRELOAD_PATH = path.join(__dirname, "preload.js");

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
      if (data.host) return { slots: [{ host: data.host, token: data.token }], active: 0 };
      return data;
    }
  } catch (e) {}
  return null;
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function getTargetURL(slot) {
  return `${slot.host}/?token=${slot.token}`;
}

function getActiveURL(config) {
  const slot = config.slots[config.active];
  return slot && slot.host ? getTargetURL(slot) : null;
}

function ensureWindow() {
  if (!mainWindow) createWindow();
}

function showSettings() {
  ensureWindow();
  loaded = false;
  mainWindow.loadFile(path.join(__dirname, "settings.html"));
  mainWindow.webContents.once("did-finish-load", () => {
    const config = loadConfig();
    if (config) mainWindow.webContents.send("load-config", config);
  });
}

async function connectToService(config) {
  const url = getActiveURL(config);
  if (!url) { showSettings(); return; }
  await mainWindow.webContents.session.setProxy({ proxyRules: 'direct://' });
  mainWindow.loadURL(url);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, title: "OpenClaw-Desktop",
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: PRELOAD_PATH },
  });
  mainWindow.on("page-title-updated", (e) => e.preventDefault());

  mainWindow.webContents.on("did-finish-load", () => {
    const url = mainWindow.webContents.getURL();
    if (!url.startsWith("file://")) {
      loaded = true;
      injectSwitcher();
    }
  });

  mainWindow.webContents.on("did-fail-load", (_e, code, _desc, url) => {
    if (code === -3) return;
    if (url && !url.startsWith("file://")) showSettings();
  });

  const config = loadConfig();
  if (config && getActiveURL(config)) {
    connectToService(config);
  } else {
    showSettings();
  }

  mainWindow.on("close", (e) => {
    if (!willQuitApp) {
      if (!loaded) return;
      e.preventDefault();
      dialog.showMessageBox(mainWindow, {
        type: "question", buttons: ["确认", "取消"],
        title: "确认退出", message: "确定要退出应用吗?",
        defaultId: 0, cancelId: 1,
      }).then((r) => { if (r.response === 0) { willQuitApp = true; app.quit(); } });
    }
  });
  mainWindow.on("closed", () => { mainWindow = null; });

  mainWindow.webContents.on("context-menu", (_e, params) => {
    if (params.isEditable) {
      Menu.buildFromTemplate([
        { label: "剪切", role: "cut" },
        { label: "复制", role: "copy" },
        { label: "粘贴", role: "paste" },
        { label: "全选", role: "selectAll" },
      ]).popup(mainWindow);
    }
  });

  rebuildMenu();
}

function rebuildMenu() {
  const menu = Menu.buildFromTemplate([{
    label: "文件", submenu: [
      { label: "设置", accelerator: "CmdOrCtrl+,", click: () => showSettings() },
      { label: "刷新", accelerator: "CmdOrCtrl+R", click: () => mainWindow && mainWindow.reload() },
      { label: "开发者工具", accelerator: "CmdOrCtrl+Shift+I", click: () => mainWindow && mainWindow.webContents.toggleDevTools() },
      { type: "separator" },
      { label: "退出", accelerator: "Command+Q", click: () => { willQuitApp = true; app.quit(); } },
    ],
  }, {
    label: "帮助", submenu: [
      { label: `关于 OpenClaw-Desktop v${app.getVersion()}`, enabled: false },
    ],
  }, {
    label: "编辑", submenu: [
      { role: "undo" }, { role: "redo" }, { type: "separator" },
      { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" },
    ],
  }]);
  Menu.setApplicationMenu(menu);
}

function injectSwitcher() {
  const config = loadConfig();
  if (!config || !config.slots) return;
  const validSlots = config.slots.map((s, i) => (s && s.host) ? i : -1).filter(i => i >= 0);
  if (validSlots.length < 2) return;
  const btnsJson = JSON.stringify(validSlots.map(i => {
    let ip = '';
    try { ip = new URL(config.slots[i].host).hostname; } catch(e) {}
    return { idx: i, active: i === config.active, ip };
  }));
  // Inject via preload context using webContents IPC
  mainWindow.webContents.send('inject-switcher', btnsJson);
}

ipcMain.on("switch-slot", (_, i) => {
  const config = loadConfig();
  if (config && config.slots[i] && config.slots[i].host) {
    config.active = i;
    saveConfig(config);
    connectToService(config);
    rebuildMenu();
  }
});

ipcMain.on("save-config", (_, config) => {
  const prev = loadConfig();
  if (prev && prev.active != null && config.active == null) config.active = prev.active;
  saveConfig(config);
});

ipcMain.on("connect-slot", (_, i) => {
  const config = loadConfig();
  if (!config || !config.slots[i] || !config.slots[i].host) { showSettings(); return; }
  config.active = i;
  saveConfig(config);
  connectToService(config);
  rebuildMenu();
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (!mainWindow) createWindow(); });
app.on("before-quit", () => { willQuitApp = true; });
