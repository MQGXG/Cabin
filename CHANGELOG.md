# Changelog

本文件记录 Cabin 的所有显著变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [1.0.0] - 2026-10-27

### 首发

- 标签分类管理：创建 / 编辑 / 默认标签 / 图标，常用·工具·学习·娱乐默认种子；右键菜单（编辑 / 设默认 / 级联删除）、拖拽排序
- 网站卡片：点击统计、favicon 自动获取（内网 IP / localhost 自动跳过，显示首字母头像）、描述悬浮提示、拖拽排序、右键编辑 / 删除
- 布局：卡片网格 / **分区布局**（所有标签纵向堆叠，吸顶区头，一键跳回网格管理）；分区切换按钮为 SVG 矢量图标
- 视觉：浅灰顶栏 + 深色内容区双色调、彩色渐变 SVG 品牌标、主色添加按钮
- 分页：底部分页器，每页数量可配置（6–200）
- 双搜索：顶部全局 + 卡片区内（名称 / URL）
- 批量导入：浏览器书签 HTML、CSV（含 BOM、引号转义、去重），导入前勾选预览
- 备份恢复：JSON 信封（合并 / 整库替换）+ SQLite `.db` 导出
- 壁纸系统：内置渐变 + 自定义本地图片（IndexedDB 存储）+ 遮罩透明度
- 主题：暗 / 亮手动切换 + 跟随系统（matchMedia 实时响应）
- 存储：浏览器内 SQLite（sql.js WASM），二进制持久化到 IndexedDB，防抖落盘
- 纯函数单测：navCore / importCore / backupCore（`npm run test`）
