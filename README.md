# OpenClaw Desktop

基于 Electron 的桌面客户端，用于访问 OpenClaw Web 服务。

## 功能

- 通过粘贴访问链接（`http://host:port/?token=xxx`）快速连接服务
- 配置持久化，下次启动自动连接
- 支持 macOS（dmg）和 Windows（portable）打包
- GitHub Actions 自动构建（推送 `v*` tag 触发）

## 快速开始

```bash
# 安装依赖
npm install

# 启动应用
npm start
```

## 打包构建

```bash
# macOS
npm run build

# Windows
npm run build:win

# 全平台
npm run build:all
```

构建产物输出到 `dist/` 目录。

## 使用说明

1. 首次启动会弹出设置窗口，粘贴访问链接即可
2. 后续启动自动连接上次配置的地址
3. 可通过菜单 `文件 → 设置`（`Cmd/Ctrl + ,`）修改配置

## 技术栈

- Electron 35
- electron-builder
