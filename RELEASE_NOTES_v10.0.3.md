# ResearchFlow for Zotero 10.0.3

## 右键菜单优化与可配置项 / Context menu cleanup and configuration

- 默认不再向 Zotero 条目右键菜单注入快捷项，保持右键菜单整洁轻量。
- 彻底解决 Zotero 7+ 中因直接注入 DOM 导致的底部空白无字图标问题。
- 在“ResearchFlow 偏好设置”中新增“在文献右键菜单中显示快捷操作”开关，默认关闭，支持按需开启。
- 启动及窗口加载时自动清理历史残留的右键菜单 DOM 节点。

ResearchFlow context menu items are now hidden by default to keep Zotero's item
context menu tidy and lightweight. This resolves the duplicate blank icon entries
caused by legacy direct DOM injection in Zotero 7+. A new setting in ResearchFlow
Preferences allows users to optionally re-enable clean MenuManager context menu
shortcuts at any time, while stale legacy DOM nodes are automatically purged.
