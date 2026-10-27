# Changelog

本文件记录 Cabin 的所有显著变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [1.0.0] - 2026-10-27

### 首发

- 标签分类管理：创建 / 编辑 / 默认标签 / 图标，常用·工具·学习·娱乐默认种子
- 网站卡片：网格 / 列表布局、点击统计、favicon 自动获取 + 首字母占位、右键编辑 / 删除
- 双搜索：顶部全局 + 卡片区内（名称 / URL）
- 批量导入：浏览器书签 HTML、CSV（含 BOM、引号转义、去重）
- 备份恢复：JSON 信封（合并 / 整库替换）+ SQLite `.db` 导出
- 壁纸系统：内置渐变 + 自定义本地图片（IndexedDB 存储）+ 遮罩透明度
- 主题：默认暗色、可切亮色（CSS 变量）
- 存储：浏览器内 SQLite（sql.js WASM），二进制持久化到 IndexedDB，防抖落盘
- 纯函数单测：navCore / importCore / backupCore（`npm run test`）
