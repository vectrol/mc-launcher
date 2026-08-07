# MC Launcher — Minecraft 第三方启动器

一个现代化、高度可定制的 Minecraft 第三方启动器，基于 Electron + React + TypeScript 构建。界面参考 PCL2 / HMCL / MultiMC 的设计理念，支持多语言、多主题、模组加载器一键安装、Modrinth 模组浏览、整合包导入导出等完整功能。

## 功能特性

### 🎮 版本管理
- 从 Mojang 官方 API 获取全部版本（正式版 / 快照版 / 旧版本）
- 一键安装：**Vanilla / Fabric / Forge / NeoForge / Quilt / OptiFine** 六种选择
- 展开式安装面板，实时进度 + 下载速度 + 剩余时间
- 1.13+ 版本自动抓取 Minecraft Wiki 更新日志
- 版本克隆 / 重命名 / 删除，模组版自动标注父版本

### 👤 账号系统
- **微软账号 OAuth 登录**：完整登录链（OAuth → Xbox Live → XSTS → Minecraft）
- **离线模式**：自定义用户名，确定性 UUID
- 多账号管理：添加 / 切换 / 删除，Token 自动刷新

### 📦 模组生态
- **Modrinth 集成**：热门推荐 + 搜索 + 一键安装（自动装前置依赖）
- 模组启停开关（不删除文件）、拖拽安装、批量导入
- 整合包支持：CurseForge (.zip) / Modrinth (.mrpack) 拖入即装，实例一键导出

### 🗺️ 游戏内容
- 世界管理：存档列表 + 图标预览 + 一键备份
- 资源包：拖拽安装 + 管理
- 截图管理器：网格浏览 + 全屏预览 + 删除

### 🌐 服务器
- 服务器收藏夹 + 实时 Ping 检测（在线状态 / 延迟 / 玩家数 / MotD）
- 延迟历史趋势图（Sparkline）

### ⚡ 下载引擎
- 多线程并行下载（1-16 可调）
- 下载队列：暂停 / 继续 / 取消 / 重试
- HTTP Range 断点续传 + SHA-1 校验
- 带宽限速 + BMCLAPI 镜像源

### 🚀 启动体验
- 启动前自动校验：Java / 版本完整性 / 磁盘空间
- 全屏启动横幅动画
- 崩溃检测 + 修复建议（内存不足 / Mod 冲突 / 驱动问题）
- 崩溃自动重启（最多 3 次，可配置）
- Native 库自动提取 + 缺失自动修复

### 🎨 界面定制
- 4 种语言：简体中文 / English / 日本語 / 한국어
- 暗黑 / 明亮主题 + 8 色调色板 + 自定义取色器
- 每实例独立设置（Java 路径 / 内存 / 游戏目录）
- 快捷键：Ctrl+1~5 切换页面、Ctrl+R 刷新、Ctrl+B 侧边栏、Esc 关闭

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Electron 33 |
| UI | React 18 + TypeScript + Tailwind CSS 3 |
| 动画 | Framer Motion |
| 状态管理 | Zustand |
| 构建 | Vite 6 |
| 打包 | electron-builder (NSIS) |

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式（Vite + Electron 热重载）
npm run dev

# 构建前端
npm run build

# 打包 Windows 安装程序
npm run dist
```

## 项目结构

```
MC/
├── electron/                  # 主进程（Node.js）
│   ├── main.cjs               # 入口：窗口管理 + 全部 IPC 路由
│   ├── preload.cjs            # contextBridge 安全桥接
│   ├── mc-api.cjs             # Mojang API + 版本下载 + 镜像源
│   ├── mc-auth.cjs            # 微软 OAuth + 离线账号
│   ├── mc-mods.cjs            # Fabric/Forge/NeoForge/Quilt/OptiFine 安装
│   ├── mc-versions.cjs        # 已装版本 + 模组管理
│   ├── mc-instances.cjs       # 实例克隆/重命名/每实例设置
│   ├── mc-downloads.cjs       # 下载队列 + 续传 + 限速 + 校验
│   ├── mc-online.cjs          # Modrinth API + 新闻
│   ├── mc-modpack.cjs         # 整合包解析/安装/导出
│   ├── mc-servers.cjs         # 服务器 Ping + 延迟历史
│   ├── mc-extras.cjs          # 世界 + 资源包
│   ├── mc-content.cjs         # 截图 + 版本通知
│   ├── mc-crash.cjs           # 崩溃报告解析 + 启动校验
│   ├── mc-natives.cjs         # Native 库提取
│   ├── mc-settings.cjs        # 设置持久化
│   └── launcher.cjs           # 游戏启动（继承链/占位符替换/classpath）
├── src/
│   ├── App.tsx                # 主界面（6+ 页面导航）
│   ├── store.ts               # Zustand 全局状态
│   ├── i18n.ts                # 4 语言翻译
│   ├── types.ts               # 类型定义
│   └── components/
│       ├── HomePage.tsx       # 主页（新闻/快速启动/统计）
│       ├── VersionBrowser.tsx # 版本浏览（分类折叠）
│       ├── VersionCard.tsx    # 版本卡片（展开安装器）
│       ├── LibraryPage.tsx    # 游戏库（模组/世界/资源包/实例设置）
│       ├── ModBrowser.tsx     # Modrinth 模组浏览
│       ├── ModpackImporter.tsx
│       ├── ServerList.tsx     # 服务器管理
│       ├── ScreenshotsPanel.tsx
│       ├── SettingsPanel.tsx  # 常规 + 高级设置
│       ├── AccountPanel.tsx   # 账号管理
│       ├── ConsolePanel.tsx   # 游戏日志查看器
│       ├── DownloadQueuePanel.tsx
│       ├── SplashOverlay.tsx  # 启动横幅
│       ├── Toast.tsx          # 通知系统
│       ├── DownloadPanel.tsx
│       └── TitleBar.tsx       # 自定义标题栏
```

## 数据目录

游戏数据存储于 Electron `userData` 目录下的 `minecraft/` 文件夹：

```
%APPDATA%/mc-launcher/
├── minecraft/
│   ├── versions/          # 各版本（jar/json/natives/mods）
│   ├── libraries/         # 共享依赖库
│   ├── assets/            # 游戏资源
│   ├── saves/             # 存档
│   ├── resourcepacks/     # 资源包
│   ├── screenshots/       # 截图
│   └── crash-reports/     # 崩溃报告
├── exports/               # 导出的整合包
└── launcher-settings.json # 设置/账号/服务器配置
```

## 快捷键

| 快捷键 | 功能 |
|---|---|
| `Ctrl+1` | 主页 |
| `Ctrl+2` | 版本列表 |
| `Ctrl+3` | 游戏库 |
| `Ctrl+4` | 模组浏览 |
| `Ctrl+5` | 服务器 |
| `Ctrl+R` | 刷新已安装 |
| `Ctrl+B` | 切换侧边栏 |
| `Esc` | 关闭错误提示 |

## Roadmap

- [x] v1.0 版本下载 / 启动 / 模组加载器
- [x] v2.0 新闻 / Modrinth / 整合包 / 服务器
- [x] v2.1 NeoForge / Quilt / 崩溃分析 / 快捷键
- [x] v3.0 实例系统 / 下载队列 / 截图 / 多语言
- [x] v3.1 依赖自动安装 / 模组更新检测 / 延迟历史
- [x] v3.2 好友系统 / P2P 局域网联机 / 模组冲突检测 / 自更新 / CurseForge
- [x] v4.0 皮肤站登录 / Modrinth 整合包 / 资源市场四分类 / 帮助中心

### 未来规划

- [ ] v4.1 模组一键更新增强（批量更新 / 更新前备份）
- [ ] v4.2 跨网联机（ZeroTier 集成 / 中继服务器）
- [ ] v4.3 游戏内 FPS / 内存悬浮窗
- [ ] v4.4 启动器自动更新（真实 GitHub Releases 替换）
- [ ] v5.0 模组冲突深度分析（依赖树解析）

## 免责声明

- 本启动器为个人项目，与 Mojang / Microsoft 无任何关联
- 微软登录使用公开 OAuth 流程，请遵守《Minecraft 使用准则》
- 下载内容版权归 Mojang 及原作者所有
