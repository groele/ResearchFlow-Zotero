# ResearchFlow for Zotero

[![Zotero Version](https://img.shields.io/badge/Zotero-7%2B%20%7C%2010-2563eb.svg)](https://github.com/groele/ResearchFlow-Zotero)
[![Version](https://img.shields.io/badge/version-10.0.1-10b981.svg)](https://github.com/groele/ResearchFlow-Zotero/releases/latest)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/groele/ResearchFlow-Zotero)

**ResearchFlow for Zotero** 是专为学术科研、论文写作、期刊投稿与同行评审打造的全流程工作台，完美支持 **Zotero 7+** 与 **Zotero 10**。

---

## 🚀 快速安装 (v10.0.1)

1. 前往 [Releases](https://github.com/groele/ResearchFlow-Zotero/releases/latest) 下载最新的插件安装包：
   ```text
   researchflow-zotero-10.0.1.xpi
   ```
2. 打开 Zotero 桌面端，点击顶部菜单 **工具 (Tools) → 插件 (Plugins / Add-ons)**。
3. 点击右上角齿轮图标，选择 **从文件安装附加组件... (Install Add-on From File...)**。
4. 选中下载的 `researchflow-zotero-10.0.1.xpi` 文件并确认安装。
5. 重启 Zotero 即可在工具栏或“工具”菜单中打开 ResearchFlow 工作区。

---

## 🌟 核心功能

- **仪表盘总览 (Dashboard)**：全景展示手稿时间线、统计数据、审稿周期分析与个性化分享卡片。
- **手稿看板 (Manuscript Kanban)**：从灵感规划到正式发表的全阶段状态跟踪，直接关联 Zotero 文献库条目与笔记。
- **投稿与审稿追踪 (Submissions & Review)**：支持多轮次投稿历史记录、期刊与作者元数据管理、关键里程碑提醒、审稿意见矩阵。
- **常用投稿通道 (Journal Portals)**：快速收藏并跳转目标期刊投稿系统与学术数据库。
- **多云同步与备份 (Sync & Backup)**：支持 WebDAV / GitHub 云端同步，提供完整 JSON 数据导入导出与防误触恢复备份机制。

## 图片保存（V10）

在投稿历程分享图中点击 **另存为 PNG…**，Zotero 会弹出系统保存窗口。选择文件夹与文件名并确认后，界面会显示图片的完整保存路径。图片保存在你选择的位置；取消保存不会生成文件，保存失败会显示错误。系统“分享图片”按钮已移除，仍可使用“复制图片”。

## 开发验证与打包

```powershell
node --test tests/share-image.test.js
python tools/build-xpi.py
```

打包脚本仅收集运行时文件，检查插件、更新清单与界面版本的一致性，输出当前版本的 XPI。

---

## 📂 插件目录结构

```text
├── bootstrap.js               # Zotero 插件启动与宿主生命周期入口
├── chrome.manifest            # Gecko 资源映射清单
├── manifest.json              # 插件元数据与版本定义 (v10.0.1)
├── prefs.js                   # 默认偏好设置
├── update.json                # 自动更新校验清单
├── researchflow-zotero-10.0.1.xpi # 预构建编译安装包
├── chrome/                    # 界面、样式、交互脚本与图标资源
└── locale/                    # 国际化多语言资源 (zh-CN, en-US)
```

---

## 📄 许可证

本项目基于 MIT 协议开源。
