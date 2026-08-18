# DeepSeek Harness Desktop（Linux / Ubuntu）

[![GitHub Release](https://img.shields.io/github/v/release/chendaxin-xin/unbutu-deepseek-Harness-?style=flat-square&color=4d6bfe)](https://github.com/chendaxin-xin/unbutu-deepseek-Harness-/releases/latest)
[![下载 .deb](https://img.shields.io/badge/下载-.deb-4d6bfe?style=flat-square)](https://github.com/chendaxin-xin/unbutu-deepseek-Harness-/releases/latest/download/DeepSeek-Harness-0.1.0-amd64.deb)
[![下载 .AppImage](https://img.shields.io/badge/下载-.AppImage-4d6bfe?style=flat-square)](https://github.com/chendaxin-xin/unbutu-deepseek-Harness-/releases/latest/download/DeepSeek-Harness-0.1.0-x86_64.AppImage)

> 📦 **快速下载**：[进入下载页](https://github.com/chendaxin-xin/unbutu-deepseek-Harness-/releases/latest)，或直接点上面两个「下载」徽章获取 `.deb` / `.AppImage`。

非官方的 DeepSeek Harness（dsh）**Linux 桌面壳**：把 dsh 的浏览器界面封装成原生桌面窗口，
带系统托盘、开机自启、单实例锁，并打包为 **AppImage / deb**。内置 dsh 运行时，
**首次启动离线可用**（无需 Node.js 或 pnpm）。

> 社区已有 Windows 版（`deepseek-harness-desktop`）；本项目是与之对应的 Ubuntu/Linux 版。

## 特性

- 内置 `@deepseek-ai/dsh` 运行时，离线引导 profile（通过符号链接 fallback，无需 pnpm/网络）
- 自动选择空闲端口启动服务，默认绑定 `127.0.0.1`
- 系统托盘：显示/隐藏窗口、在浏览器中打开、开机自启动、退出
- 关闭窗口默认最小化到托盘（可配置）
- 单实例锁：重复启动只会唤起已有窗口
- 打包为 `.deb` 与 `.AppImage`

## 目录结构

```
dsh-desktop/
├── src/main.js        Electron 主进程（窗口/托盘/服务生命周期）
├── src/server.js      dsh 服务管理器（spawn + 端口 + 就绪探测）
├── src/settings.js    持久化设置
├── src/preload.js     预加载脚本（contextBridge）
├── src/splash.html    启动页
├── scripts/make-icons.js   零依赖 PNG 图标生成器
├── scripts/make-linux.sh   一键构建脚本
├── assets/            图标
└── build/icons/       各尺寸图标（electron-builder 用）
```

## 从源码构建（Ubuntu）

仅构建时需要 Node.js 18+（用于运行 npm/electron-builder）；构建出的安装包在目标机器上**不需要 Node**。

```bash
git clone <本仓库> && cd dsh-desktop
./scripts/make-linux.sh
# 产物输出到 dist/
```

## 安装（Ubuntu）

```bash
# 方式一：deb（推荐，含桌面菜单/图标/卸载）
sudo apt install ./dist/DeepSeek-Harness-0.1.0-amd64.deb

# 方式二：AppImage（免安装）
chmod +x dist/DeepSeek-Harness-0.1.0-x86_64.AppImage
./dist/DeepSeek-Harness-0.1.0-x86_64.AppImage
```

## 使用

- 首次启动会在 `~/.dsh` 创建 harness 主目录（与 `dsh` CLI 共享会话与设置）。
- 关闭窗口默认隐藏到托盘；从托盘菜单选择「退出」才真正退出。
- 端口默认自动分配；托盘菜单「在浏览器中打开」可拿到实际地址。

## 配置

设置文件位于 `~/.config/deepseek-harness-desktop/settings.json`：

```json
{
  "host": "127.0.0.1",
  "port": 0,
  "dshHome": "",
  "closeToTray": true,
  "autoStart": false
}
```

- `port`: `0` 表示自动选择空闲端口；设为固定值（如 `3080`）可固定地址。
- `dshHome`: 留空则沿用 `DSH_HOME` 或默认 `~/.dsh`。

## 环境变量

| 变量 | 作用 |
| --- | --- |
| `DSH_HOME` | 指定 harness 主目录 |
| `DSH_NODE` | 指定运行 dsh 的 node 可执行文件（否则自动探测） |
| `DSH_NO_SANDBOX=1` | 禁用 Chromium 沙箱（某些受限环境需要） |

## 故障排查

- **GPU / 白屏**：`./...AppImage --disable-gpu` 或 `--disable-gpu-sandbox`。
- **沙箱报错**（`SUID sandbox helper`）：`DSH_NO_SANDBOX=1 ./...AppImage`，或给 chrome-sandbox 设置 setuid。
- **端口被占用**：将 `settings.json` 中 `port` 改为 `0`（自动），或换一个固定端口。
- **托盘不显示**：部分 GNOME 需安装 `gnome-shell-extension-appindicator`。

## 与 Windows 版对应

与社区 Windows 版（Electron 包装 `dsh web`）思路一致：spawn `dsh web --host … --port …`，
等待 HTTP 就绪后把 `BrowserWindow` 指向本地服务，并提供托盘与打包。差异在于本版本：

- 通过 `ELECTRON_RUN_AS_NODE` 自托管 dsh，无系统 Node 依赖；
- 用符号链接 fallback 离线引导 profile，无需 pnpm；
- 打包目标为 `.deb` / `.AppImage`。

## 免责声明

本项目为非官方社区实现，与 DeepSeek 官方无关。DeepSeek Harness（dsh）及其相关名称归其权利人所有。
