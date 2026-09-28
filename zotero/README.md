# Zotero 插件源码

此目录包含桌面插件引导、Gecko 资源、宿主 API、首选项和语言文件。整个仓库仅发布 Zotero XPI。

安装与数据说明见[中文文档](../README.zh-CN.md)，开发入口见[架构文档](../ARCHITECTURE.md)。

```powershell
node scripts/build-zotero.mjs
pwsh -NoProfile -File tests/verify.ps1
```

当前安装包为 dist-zip/researchflow-zotero-9.1.4.xpi。chrome/ 与 chrome.manifest 是 Zotero 的 Gecko 资源结构。
