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
    width: 680, height: 520, resizable: false,
    title: "OpenClaw", parent: mainWindow, modal: !!mainWindow,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  settingsWindow.loadFile(path.join(__dirname, "settings.html"));
  const onSave = (_, config) => {
    saveConfig(config);
    settingsWindow && settingsWindow.close();
    if (onSaved) onSaved(config);
  };
  ipcMain.on("save-config", onSave);
  settingsWindow.on("closed", () => {
    ipcMain.removeListener("save-config", onSave);
    settingsWindow = null;
  });
}

function createWindow(config) {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, title: "OpenClaw",
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  mainWindow.on("page-title-updated", (e) => e.preventDefault());
  mainWindow.loadURL(getTargetURL(config));

  mainWindow.webContents.on("did-fail-load", () => {
    openSettings((c) => mainWindow && mainWindow.loadURL(getTargetURL(c)));
  });

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
