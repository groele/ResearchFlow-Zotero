# ResearchFlow Zotero 插件

[English](README.md) · [下载最新 XPI](https://github.com/groele/ResearchFlow-Zotero/releases/latest)

本仓库仅维护 **Zotero 桌面版插件**。已移除 Chrome Companion 的扩展入口、后台服务、网页识别脚本、ZIP 安装包及相关说明。

## 安装 9.1.2

1. 下载 [researchflow-zotero-9.1.2.xpi](https://github.com/groele/ResearchFlow-Zotero/releases/download/v9.1.2/researchflow-zotero-9.1.2.xpi)。
2. 打开 Zotero 的“工具 → 插件”（部分版本为“附加组件”），选择“从文件安装附加组件”，选中 XPI。
3. 重启 Zotero，从 ResearchFlow 工具栏按钮或工具菜单打开工作区。

桌面验证环境为 Zotero 10.0.3。插件清单声明兼容 Zotero 7 及以上版本，其他版本尚未逐一完成桌面验证。

## 功能

- **仪表盘总览**：统计、手稿时间线、日期编辑及可配置的分享图片。
- **手稿看板**：规划、状态修改，关联 Zotero 文献，载入文献、分类与 PDF 摘录信息。
- **投稿与审稿**：投稿轮次、转投历史、期刊、作者、截止日期、时间节点、审稿矩阵与清单。
- **常用投稿网址**：用户可添加、修改、删除自己的 HTTP/HTTPS 投稿入口。
- **Zotero 设置**：语言、外观、WebDAV/GitHub 多云同步、JSON 导入导出和导入前备份恢复。

三个模块共享同一份关联数据。标题、期刊、作者、状态和时间节点同步更新；手稿跟随当前投稿轮次，历史投稿保留原期刊及状态。接收日期和上线日期分别保存。多云配置集中在 Zotero 设置中，Chrome 专属的网页自动识别开关已移除。

## 数据与备份

| Zotero 数据目录中的文件 | 内容 |
| --- | --- |
| researchflow-data.json | 主数据库 |
| researchflow-pre-import-backup.json | 导入前备份 |
| researchflow-ui-state.json | 本机界面状态与凭据 |

兼容已有 JSON 导出格式，凭据不会写入工作流导出或云端数据。覆盖导入、恢复备份前建议先导出当前数据库。云同步为可选功能，需要用户配置自己的服务。

## 开发验证

使用 Node.js 22+ 与 PowerShell 7：

```powershell
npm run build:zotero
npm test
# 可选：使用测试浏览器与模拟 Zotero 接口检查界面
npm install --no-save --no-package-lock playwright
npx playwright install chromium
pwsh -NoProfile -File tests/verify.ps1 -Browser
```

安装包输出到 dist-zip，临时打包目录为 dist-zotero。构建只复制明确列出的 Zotero 运行时脚本。界面测试不加载 Chrome 扩展，也不能代替真实 Zotero 桌面和真实云账户测试。

源码中的 zotero/chrome、chrome.manifest、chrome:// 与 ChromeUtils 属于 Zotero 使用的 Gecko 机制，是桌面插件必需部分。

参见[使用说明](guide.md)、[架构说明](ARCHITECTURE.md)和[版本记录](RELEASE_NOTES_v9.1.2.md)。报告问题时请附 Zotero 版本、操作步骤及“帮助 → 调试输出日志”中的 ResearchFlow 错误。
