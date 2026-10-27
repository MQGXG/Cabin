# Cabin 🛖

> 你的离线个人导航起始页 —— 小木屋一样安放你的常用网站。数据全部存在本地浏览器，零后端、零上传、零账号。

<p align="center">
  <img src="https://img.shields.io/badge/Vue-3-orange" alt="Vue 3">
  <img src="https://img.shields.io/badge/TypeScript-strict-blue" alt="TS">
  <img src="https://img.shields.io/badge/Vite-8-purple" alt="Vite">
  <img src="https://img.shields.io/badge/SQLite-浏览器内-green" alt="SQLite">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT">
</p>

## 特性

| 功能 | 说明 |
|------|------|
| 🗂️ 标签分类 | 常用 / 工具 / 学习 / 娱乐开箱即用；右键菜单：编辑 / 设默认 / 删除（级联），拖拽排序 |
| 🔗 网站卡片 | 图标 + 名称 + 域名 + 描述悬浮提示，网格 / 列表双布局，点击计数，**拖拽排序**，右键编辑 / 删除 |
| 📄 分页 | 底部分页器（每页数量可在设置中调整，6–200） |
| 🔍 双搜索 | 顶部全局搜索（跨标签）+ 卡片区内搜索 |
| 📥 批量导入 | 浏览器书签 HTML、CSV（表头 `name,url[,description]`），自动去重，导入前可勾选预览 |
| 💾 备份恢复 | JSON 信封备份（合并 / 整库替换两种模式）+ 导出完整 SQLite `.db` 文件 |
| 🖼️ 壁纸系统 | 内置渐变壁纸 + 自定义本地图片（存本地 IndexedDB）+ 遮罩透明度调节 |
| 🌗 主题 | 暗 / 亮手动切换 + **跟随系统**（matchMedia 实时响应） |
| 📦 SQLite | 数据存真 · 正 · 的 SQLite —— `sql.js`（WASM）跑在浏览器里，二进制持久化到 IndexedDB |
| 🔒 隐私优先 | 无账号、无后端、不上传任何数据；favicon 由 favicon.im 公共服务按需拉取 |

## 快速开始

```bash
npm install
npm run dev        # 开发：http://localhost:5173

npm run build      # 构建产物 dist/（sql-wasm.wasm 已内联为 data URL）
npm run preview    # 远程本地服务预览构建产物
```

> 构建产物 `dist/` 可以放到**任意静态服务器**（Nginx / GitHub Pages / PM2 serve）。首次打开会自动建库并种子四个默认标签。
> `sql.js` 是 WASM 模块，浏览器安全策略不允许在 `file://` 下通过 Worker 拉取数据 —— 虽然本项目产物已内联 wasm，但仍建议通过静态服务访问。

## 数据说明

- 数据库：浏览器 IndexedDB 中 `cabin-sqlite` → `sqlite` store，读写 SQLite（表：`tabs` / `navigations` / `settings` / `meta`）
- 写后 500ms 防抖落盘；页面关闭前兜底保存
- 清除数据：F12 → Application → IndexedDB → 删除 `cabin-sqlite` 即回到初始状态
- 迁移：在旧设备「备份 / 恢复」→ 导出 `.db` 或 JSON，在新设备导入即可

## 项目结构

```
cabin/
├── index.html
├── vite.config.ts        # @ → /src + wasm 内联构建配置
├── src/
│   ├── main.ts           # 应用入口（Element Plus zh-cn）
│   ├── App.vue           # 壳：Header + 标签栏 + 统计条 + 网格 + 弹窗
│   ├── components/       # 10 个组件（Header/TabBar/StatsBar/NavGrid/五个弹窗/壁纸Fab）
│   ├── composables/ui.ts # 弹窗联动总线
│   ├── core/             # 纯逻辑（可单测）：navCore / importCore / backupCore
│   ├── db/               # sql.js 连接 + 表读写
│   ├── stores/cabin.ts   # Pinia 状态（tabs/sites/settings/搜索/筛选）
│   ├── types/index.ts
│   └── styles/main.css   # Tailwind + CSS 变量主题
├── scripts/              # 纯函数单测
└── public/favicon.svg
```

## 常用命令

```bash
npm run typecheck      # vue-tsc 全量类型检查
npm run test           # 纯函数单测（navCore / importCore / backupCore）
npm run test:nav       # 单独跑某组
```

## License

[MIT](./LICENSE)
