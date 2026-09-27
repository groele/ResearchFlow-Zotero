# ResearchFlow for Zotero

本目录是 Zotero 桌面版插件的源码。修复版安装包由 `node scripts/build-zotero.mjs` 生成在 `dist-zip/researchflow-zotero-9.1.0.xpi`。在 Zotero 的“工具 → 附加组件”中选择“从文件安装附加组件”，安装该 XPI 后重启 Zotero，并确认插件已启用。

多云同步设置已移到 Zotero 的“设置 → ResearchFlow”。主工作区保留仪表盘、手稿看板、投稿与审稿等视图；投稿页的“常用投稿入口”支持自行添加、编辑和删除网址。投稿详情可关联现有手稿，关联后仪表盘、看板与投稿页使用同一数据库记录。原侧栏的“已保存到本机 / 强制同步”卡片已移除；配置云服务后，可在设置页手动同步。

插件的主数据库、导入前备份和工作区界面状态分别存放在 Zotero 数据目录的 `researchflow-data.json`、`researchflow-pre-import-backup.json`、`researchflow-ui-state.json`。网页端 Chrome 扩展使用自己的浏览器存储，两端不会自动共用本地文件；如需迁移，请使用工作区的 JSON 导出与导入。

本地验证：

```powershell
node scripts/build-zotero.mjs
pwsh -NoProfile -File tests/verify.ps1
```

这些命令验证源码、兼容层、数据库读写行为和 XPI 结构。另已在 Zotero 10.0.3 的独立配置与独立数据目录中验证插件启用、通知观察器、文献菜单、阅读器菜单、条目侧栏、文件选择器初始化、数据库加载/保存/导入/恢复、界面状态、文献集合与搜索。本次还验证首选项页注册、自动打开、控件初始化与多云设置框架加载。浏览器端验证了投稿与手稿关联、跨三个视图的显示和状态同步，以及投稿入口的增删改。真实云服务连接、系统文件对话框点击、PDF 选区和多窗口操作仍需在桌面界面中验收。出现异常时，请记录 Zotero 版本、操作步骤，以及“帮助 → 调试输出日志”中的 ResearchFlow 错误。
