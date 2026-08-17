#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# 一键构建 Linux 桌面包（.deb + .AppImage）。
# 需要 Node.js 18+（仅用于构建工具）。

export npm_config_cache="${npm_config_cache:-$PWD/.npm-cache}"
export ELECTRON_CACHE="${ELECTRON_CACHE:-$PWD/.electron-cache}"

echo '==> 安装依赖（含 Electron 二进制）'
npm install --no-audit --no-fund

echo '==> 生成图标'
node scripts/make-icons.js

echo '==> 打包'
npm run dist

echo '==> 完成，产物在 dist/ 目录'
ls -lh dist/
