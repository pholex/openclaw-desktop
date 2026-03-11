const { app, BrowserWindow, Menu, dialog, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");

let mainWindow;
let willQuitApp = false;
let loaded = false;

const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");
const PRELOAD_PATH = path.join(__dirname, "preload.js");

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch (e) {}
  return null;
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function getTargetURL(config) {
  return `${config.host}/?token=${config.token}`;
}

function showSettings() {
  loaded = false;
  mainWindow.loadFile(path.join(__dirname, "settings.html"));
  mainWindow.webContents.once("did-finish-load", () => {
    const config = loadConfig();
    if (config) mainWindow.webContents.send("load-config", getTargetURL(config));
  });
}

function connectToService(config) {
  mainWindow.loadURL(getTargetURL(config));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, title: "OpenClaw-Desktop",
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: PRELOAD_PATH },
  });
  mainWindow.on("page-title-updated", (e) => e.preventDefault());

  mainWindow.webContents.on("did-finish-load", () => {
    const url = mainWindow.webContents.getURL();
    if (!url.startsWith("file://")) loaded = true;
  });

  mainWindow.webContents.on("did-fail-load", (_e, code, _desc, url) => {
    if (code === -3) return; // ignore aborted loads
    if (url && !url.startsWith("file://")) showSettings();
  });

  const config = loadConfig();
  if (config) {
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

  const menu = Menu.buildFromTemplate([{
    label: "文件", submenu: [
      { label: "设置", accelerator: "CmdOrCtrl+,", click: () => showSettings() },
      { label: "刷新", accelerator: "CmdOrCtrl+R", click: () => mainWindow && mainWindow.reload() },
      { label: "开发者工具", accelerator: "CmdOrCtrl+Shift+I", click: () => mainWindow && mainWindow.webContents.toggleDevTools() },
      { type: "separator" },
      { label: "退出", accelerator: "Command+Q", click: () => { willQuitApp = true; app.quit(); } },
    ],
  }, {
    label: "编辑", submenu: [
      { role: "undo" }, { role: "redo" }, { type: "separator" },
      { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" },
    ],
  }]);
  Menu.setApplicationMenu(menu);
}

ipcMain.on("save-config", (_, config) => {
  saveConfig(config);
  connectToService(config);
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (!mainWindow) createWindow(); });
app.on("before-quit", () => { willQuitApp = true; });
