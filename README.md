# ResearchFlow for Zotero

**科研工作流：从手稿规划到投稿、审稿与发表。**

**A research workspace for manuscript planning, submission, peer review, and publication.**

[![Version](https://img.shields.io/badge/version-10.0.4-10b981.svg)](https://github.com/groele/ResearchFlow-Zotero/releases/tag/v10.0.4)
[![Zotero](https://img.shields.io/badge/Zotero-7%2B%20%7C%2010-2563eb.svg)](https://github.com/groele/ResearchFlow-Zotero/releases/latest)
[![Languages](https://img.shields.io/badge/UI-简体中文%20%7C%20English-6366f1.svg)](#settings)

ResearchFlow 将手稿看板、投稿记录、审稿意见、科研时间线与 Zotero 文献条目连接在一起。数据优先保存在本机，可按需配置 WebDAV 或 GitHub 同步。

ResearchFlow connects manuscript boards, submission records, reviewer comments, research timelines, and Zotero items. Data is saved locally first, with optional WebDAV or GitHub synchronization.

**当前版本 / Current version:** `10.0.4` · **插件 ID / Add-on ID:** `researchflow@groele.org`

[下载最新版本 / Download the latest release](https://github.com/groele/ResearchFlow-Zotero/releases/latest) · [V10.0.4 安装包 / Installer](https://github.com/groele/ResearchFlow-Zotero/releases/download/v10.0.4/researchflow-zotero-10.0.4.xpi) · [报告问题 / Report an issue](https://github.com/groele/ResearchFlow-Zotero/issues)

## 目录 / Contents

1. [项目定位与兼容性 / Overview and compatibility](#overview)
2. [安装与升级 / Installation and upgrades](#installation)
3. [首次使用 / First steps](#first-steps)
4. [主要功能 / Main features](#features)
5. [手稿、投稿与审稿 / Manuscripts, submissions, and review](#workflow)
6. [与 Zotero 的联动 / Zotero integration](#integration)
7. [分享图与图片保存 / Share Studio and image saving](#share-studio)
8. [本地数据、备份与恢复 / Local data, backup, and recovery](#data)
9. [WebDAV 与 GitHub 同步 / WebDAV and GitHub synchronization](#sync)
10. [界面与窗口设置 / Interface and window settings](#settings)
11. [快捷键 / Keyboard shortcuts](#shortcuts)
12. [常见问题与故障排查 / Troubleshooting](#troubleshooting)
13. [开发、测试与打包 / Development, testing, and packaging](#development)
14. [项目结构 / Project structure](#layout)
15. [版本记录与验证范围 / Releases and validation scope](#releases)
16. [反馈、贡献与许可说明 / Feedback, contributions, and licensing](#contributing)

<a id="overview"></a>
## 1. 项目定位与兼容性 / Overview and compatibility

ResearchFlow 用于管理研究进展与论文处理过程：记录手稿当前阶段、每次投稿、审稿反馈、回复内容和关键日期，并将这些记录与 Zotero 文献库关联。它不替代 Zotero 的文献库管理、PDF 阅读或文字处理软件中的引文功能。

ResearchFlow tracks research progress and the manuscript lifecycle: manuscript stages, individual submissions, reviewer feedback, responses, and key dates, linked to the Zotero library. Zotero continues to manage references, PDF reading, and citations in word processors.

- **目标环境：** Zotero 桌面端，面向 Zotero 7+ 与 Zotero 10；不是浏览器扩展，也不安装到 Zotero Connector。
- **Target environment:** Zotero Desktop, targeting Zotero 7+ and Zotero 10. Install it in Zotero, rather than in the browser or Zotero Connector.
- **已验证环境：** Windows、Zotero 10.0.3。其他系统及 Zotero 版本的完整操作流程尚未逐一验证。
- **Validated environment:** Windows with Zotero 10.0.3. Complete workflows have not been verified individually on other operating systems or Zotero versions.
- **日常使用：** 安装 XPI 即可，无需 Node.js 或 Python；云同步为可选项。
- **Normal use:** Install the XPI; Node.js and Python are unnecessary. Cloud synchronization is optional.

<a id="installation"></a>
## 2. 安装与升级 / Installation and upgrades

### 安装 / Installation

**中文**

1. 从 [GitHub Releases](https://github.com/groele/ResearchFlow-Zotero/releases/latest) 下载最新的 `.xpi` 安装包。当前文件名为 `researchflow-zotero-10.0.4.xpi`。
2. 打开 Zotero，进入 **工具 → 插件**。不同 Zotero 版本可能显示为“附加组件”。
3. 点击齿轮菜单，选择 **从文件安装附加组件…**。
4. 选择下载的 XPI，按提示确认安装。
5. 如提示需要重启，重启 Zotero；随后使用工具栏 ResearchFlow 图标或“工具”菜单打开工作区。

**English**

1. Download the latest `.xpi` from [GitHub Releases](https://github.com/groele/ResearchFlow-Zotero/releases/latest). The current file is `researchflow-zotero-10.0.4.xpi`.
2. In Zotero, open **Tools → Plugins**. Some versions use “Add-ons.”
3. Open the gear menu and select **Install Add-on From File…**.
4. Choose the XPI and confirm installation.
5. Restart Zotero if prompted, then open ResearchFlow through its toolbar icon or the Tools menu.

Zotero 也支持在插件管理窗口中拖入 XPI；安装方式见 [Zotero 官方插件说明](https://www.zotero.org/support/plugins)。

Zotero also supports dragging an XPI into the plugin manager; see the [official plugin instructions](https://www.zotero.org/support/plugins).

### 升级 / Upgrades

升级前，建议通过 ResearchFlow 设置导出一份 JSON 备份。安装新版 XPI 可更新现有插件；无需先删除手稿数据。自动更新清单位于仓库根目录的 `update.json`。

Before upgrading, export a JSON backup through ResearchFlow settings. Installing a newer XPI updates the add-on without requiring manuscript data to be deleted. The automatic update manifest is the repository-root `update.json`.

如果旧版无法自动更新，先手动安装最新 XPI，再重启 Zotero。插件代码更新与数据备份是两件不同的事；保留 XPI 并不能替代备份个人记录。

If an older version cannot update automatically, install the latest XPI manually and restart Zotero. An installer preserves add-on code, not your personal records; keep separate data backups.

<a id="first-steps"></a>
## 3. 首次使用 / First steps

**中文**

1. 点击 ResearchFlow 工具栏图标，进入工作区。
2. 在设置中选择语言、主题和默认窗口模式。
3. 在“手稿看板”中新建手稿，或在 Zotero 条目侧边栏中创建并关联手稿（右键菜单快捷项默认隐藏，可在偏好设置中开启）。
4. 补充标题、作者、研究阶段等信息。
5. 在“投稿与审稿”中建立投稿记录，填写期刊、日期、状态及审稿意见。
6. 返回仪表盘查看进展；随后导出 JSON 备份。需要跨设备使用时，再配置云同步。

**English**

1. Click the ResearchFlow toolbar icon to open the workspace.
2. Choose a language, theme, and default window mode in settings.
3. Create a manuscript in the manuscript board, or create and link one from the Zotero item pane (context menu shortcuts are disabled by default and can be enabled in preferences).
4. Complete its title, authors, research stage, and other details.
5. Add a submission in Submissions & Review, including the journal, dates, status, and reviewer comments.
6. Review progress in the dashboard and export a JSON backup. Configure cloud synchronization if you need multiple devices.

首次启动且没有本地数据库时，插件会加载随安装包提供的预置数据。看到已有记录，并不表示插件已自动识别你的真实投稿；请按实际情况整理后开始使用。

When no local database exists, the add-on initializes from bundled data. Existing entries on first launch are preset records, rather than automatically detected submissions; organize them to suit your own work.

<a id="features"></a>
## 4. 主要功能 / Main features

| 页面 / Page | 中文说明 | English |
| --- | --- | --- |
| 仪表盘总览 / Dashboard | 汇总手稿状态、统计、时间线与提醒，查看科研进展并生成分享图。 | View manuscript status, statistics, timelines, and reminders; generate progress images. |
| 手稿看板 / Manuscript Kanban | 按研究和写作阶段组织手稿，维护元数据并关联 Zotero 条目。 | Organize manuscripts by research and writing stage, maintain metadata, and link Zotero items. |
| 投稿与审稿 / Submissions & Review | 记录期刊投稿、不同轮次、关键日期、审稿意见与回复。 | Track journal submissions, rounds, dates, reviewer comments, and responses. |
| 多云设置 / Multi-Cloud Settings | 配置本地存储、WebDAV 或 GitHub 同步，以及相关数据操作。 | Configure local storage, WebDAV or GitHub synchronization, and related data operations. |

常用投稿通道可保存并打开期刊投稿系统链接，内置通道包含 ACS、Wiley、APL、Nature 等。它们是访问入口，投稿状态仍需按实际情况记录。

Journal portals provide shortcuts to submission websites, including ACS, Wiley, APL, and Nature. They open the relevant websites; maintain submission status according to your actual records.

<a id="workflow"></a>
## 5. 手稿、投稿与审稿 / Manuscripts, submissions, and review

### 手稿管理 / Manuscript management

手稿可保存标题、作者、期刊等元数据，并关联 Zotero 文献条目。关联条目后，可读取标题、作者、DOI、摘要、标签、分类及引文信息，减少重复录入。

Manuscripts store metadata such as titles, authors, and journals, and can link to Zotero items. Linked items supply metadata including title, authors, DOI, abstract, tags, collections, and citation information.

内置阶段覆盖以下流程；实际工作可按需要推进或回退。

Built-in stages cover the following workflow; move between stages according to the actual project.

| 阶段代码 / Stage key | 中文 | English |
| --- | --- | --- |
| `idea` | 灵感 | Idea |
| `outline` | 大纲 | Outline |
| `figure_preparation` | 图表准备 | Figure preparation |
| `drafting` | 写作 | Drafting |
| `internal_review` | 内部审阅 | Internal review |
| `submitted` | 已投稿 | Submitted |
| `under_review` | 审稿中 | Under review |
| `revision` | 修改 | Revision |
| `accepted` | 已接收 | Accepted |
| `published` | 已发表 | Published |
| `rejected` | 已拒稿 | Rejected |

### 投稿轮次与时间线 / Submission rounds and timelines

同一手稿可保留不同期刊或不同轮次的投稿记录，通过上一条投稿关联与轮次编号组织历史。修改旧记录与建立新轮次具有不同含义；希望保留历史时，应建立对应的新记录。

A manuscript can retain submissions to different journals or different rounds. Previous-submission links and round indices organize this history. Create a new record when you need to preserve a separate round, rather than replacing the historical entry.

填写投稿日期不等于稿件已经进入外审。请分别维护投稿日期、当前状态与后续节点；仪表盘和分享图根据这些记录显示历程。

A submission date alone does not establish that peer review has started. Maintain dates, current status, and subsequent milestones separately; the dashboard and sharing images reflect those records.

### 审稿意见与回复 / Reviewer comments and responses

意见矩阵用于整理审稿意见、处理状态与回复内容，可结合自定义字段和时间线节点维护修稿过程。支持 Markdown / LaTeX 回复内容预览与复制，便于继续在编辑器中处理。

Review matrices organize comments, handling status, and responses. Custom fields and timeline nodes help track revisions. Markdown / LaTeX response previews and copying support further editing in your preferred editor.

若文本导出的下载操作在当前 Zotero 环境中未生成文件，可将预览内容复制到编辑器后保存。V10 的原生“另存为”修复针对分享图 PNG；其他导出功能应以实际操作结果为准。

If a text export does not produce a file in your Zotero environment, copy the preview into an editor and save it there. V10's native Save As repair applies to Share Studio PNG images; verify the result of other export actions separately.

<a id="integration"></a>
## 6. 与 Zotero 的联动 / Zotero integration

| 入口 / Entry point | 中文说明 | English |
| --- | --- | --- |
| 主工具栏 / Main toolbar | 点击 ResearchFlow 图标打开工作区。 | Click the ResearchFlow icon to open the workspace. |
| 工具菜单 / Tools menu | 打开工作区或插件偏好设置。 | Open the workspace or add-on preferences. |
| 条目右键菜单 / Item context menu | 可选快捷入口：根据选中文献创建手稿或关联已有手稿（默认关闭，可在偏好设置中按需开启）。 | Optional shortcuts: Create a manuscript from a selected item or link it to an existing manuscript (disabled by default, configurable in preferences). |
| PDF 阅读器 / PDF reader | 将可用的选中文本、页码与来源链接捕获到关联记录。 | Capture available selected text, page information, and source links into linked records. |
| 条目侧栏 / Item pane | 查看关联手稿信息，打开记录、同步笔记或使用相关文献操作。 | Inspect linked manuscript information, open records, synchronize notes, and access related item actions. |
| 引文辅助 / Citation helpers | 使用 APA / BibTeX 等内容辅助写作，投稿前核对输出格式。 | Use APA / BibTeX helpers and check the output against journal requirements. |

### ResearchFlow 数据与 Zotero 笔记 / ResearchFlow data and Zotero notes

“同步笔记”将手稿状态、时间线和审稿回复等摘要写入关联条目的 ResearchFlow 子笔记。更新同步笔记会更新插件维护的笔记内容；不要把这类自动生成笔记当作独立手写稿保存。

Note synchronization writes summaries of manuscript status, timelines, and reviewer responses into ResearchFlow child notes attached to linked Zotero items. Updating a synchronized note refreshes its managed content; keep independent writing in separate notes.

在 Zotero 笔记中修改文字，不会反向修改 ResearchFlow 数据库。Zotero 自身的同步可以同步这些笔记，但不会自动同步整个 ResearchFlow JSON 数据库；完整工作区数据需使用插件的云同步或 JSON 备份。

Editing a Zotero note does not update the ResearchFlow database. Zotero's own synchronization can synchronize these notes, but it does not synchronize the complete ResearchFlow JSON database. Use the add-on's cloud synchronization or JSON backups for workspace data.

<a id="share-studio"></a>
## 7. 分享图与图片保存 / Share Studio and image saving

分享图工作室用于生成科研或投稿历程卡片。图片在本机生成，保存后可由你自行发送。V10 已移除不可用的系统“分享图片”按钮。

Share Studio generates research and submission progress cards locally. Save the image and send it through your preferred application. V10 removes the unavailable system “Share Image” button.

### 设计与预览 / Design and preview

| 设置 / Setting | 中文说明 | English |
| --- | --- | --- |
| 内容选择 / Visible content | 控制题目、期刊、第一作者、当前状态、历程天数、节点日期与品牌标识。 | Choose whether to show title, journal, first author, status, elapsed days, milestone dates, and branding. |
| 卡片风格 / Styles | 江湾、鸢尾、琥珀、期刊封面、会议海报、实验档案、清纸、蓝图、极简、墨夜、赛博、极光、终端。 | Estuary, Iris, Amber, Journal, Conference, Archive, Paper, Blueprint, Minimal, Ink, Cyber, Aurora, and Terminal. |
| 画幅 / Format | 竖版、故事画幅及自动布局。 | Portrait, story, and automatic layouts. |
| 输出宽度 / Output width | 提供 720、1440、2160 像素选项；实际尺寸显示在底部。 | Choose 720, 1440, or 2160 pixels wide; the footer shows the actual dimensions. |
| 品牌视觉 / Branding | 调整品牌呈现大小。 | Adjust branding prominence. |
| 预览 / Preview | 缩放、适应窗口、重试生成与重置设计。 | Zoom, fit to window, retry rendering, and reset the design. |

隐藏选项会保存在本地，并用于下一次生成。生成前检查预览，确认没有包含不希望公开的作者、题目或审稿信息。

Visibility preferences are stored locally and reused. Review the preview before sharing, including any author, title, or review information you intend to disclose.

### “另存为 PNG…”保存到哪里？ / Where does “Save PNG As…” save the image?

**中文**

1. 等待预览生成完成。
2. 点击 **另存为 PNG…**，Zotero 将打开系统保存窗口。
3. 选择文件夹与文件名，确认保存。
4. 文件写入成功后，界面显示**完整保存路径**；到该路径即可找到图片。

**English**

1. Wait for the preview to finish rendering.
2. Click **Save PNG As…** to open Zotero's native save dialog.
3. Choose a folder and filename, then confirm.
4. After the file is written successfully, the interface displays its **full saved path**.

**保存位置由你选择，没有固定的“下载文件夹”。** 系统窗口最初显示的文件夹由运行环境决定。取消保存不会生成文件；写入失败会显示错误；保存进行中会阻止重复提交。

**You choose the destination; there is no fixed Downloads folder.** The dialog's initial location depends on the environment. Cancellation produces no file, write failures display an error, and repeated saves are blocked while a save is in progress.

### 复制图片 / Copy image

“复制图片”依赖当前 Zotero 环境的图片剪贴板能力。不支持时按钮可能隐藏；复制失败时界面显示提示。此时可先另存 PNG，再从保存位置使用图片。

Copy Image depends on image clipboard support in the Zotero environment. The button may be hidden when unsupported, and copy failures display a message. Save a PNG and use the saved file if copying is unavailable.

<a id="data"></a>
## 8. 本地数据、备份与恢复 / Local data, backup, and recovery

### 数据文件 / Data files

插件文件位于 **Zotero 当前数据目录**下。ResearchFlow 偏好设置显示数据库的实际完整路径；若更改过 Zotero 数据目录，文件位置也随之变化。查看数据目录的方法见 [Zotero 官方数据目录说明](https://www.zotero.org/support/zotero_data)。

The add-on stores files in the **current Zotero data directory**. ResearchFlow preferences show the database's full path. A custom Zotero data directory changes this location; see [Zotero's data directory documentation](https://www.zotero.org/support/zotero_data).

| 文件 / File | 中文用途 | English purpose |
| --- | --- | --- |
| `researchflow-data.json` | 手稿、投稿、时间线、审稿矩阵及相关配置数据。 | Manuscripts, submissions, timelines, review matrices, and related configuration. |
| `researchflow-ui-state.json` | 工作区界面状态与偏好。 | Workspace interface state and preferences. |
| `researchflow-pre-import-backup.json` | 导入前的数据快照，用于恢复。 | A pre-import snapshot used for recovery. |

导出 JSON 备份，并保留带日期的多个副本。ResearchFlow JSON 不包含完整 Zotero 文献库和 PDF 附件；文献库本身需要另行备份。

Export JSON backups and retain multiple dated copies. A ResearchFlow JSON backup does not contain the complete Zotero library or PDF attachments; back up the library separately.

### 导入模式与恢复 / Import modes and recovery

| 操作 / Action | 中文说明 | English |
| --- | --- | --- |
| 导出数据库 / Export database | 将当前数据库保存为 JSON 备份。 | Export the current database as a JSON backup. |
| 合并导入 / Merge import | 合并主要记录集合；相同 ID 的记录可能由导入内容更新。 | Merge the main record collections; imported content may update records with matching IDs. |
| 覆盖导入 / Overwrite import | 用导入数据库替换当前数据库。 | Replace the current database with the imported database. |
| 恢复导入前备份 / Restore pre-import backup | 从最近的导入前快照恢复数据。 | Restore data from the most recent pre-import snapshot. |

导入前快照会在后续导入时更新，并不是永久版本历史。执行合并、覆盖或恢复前，先单独导出当前数据库；导入后检查记录数量及关键手稿。

The pre-import snapshot is updated by subsequent imports and is not a permanent version history. Export the current database separately before merging, overwriting, or restoring, then check record counts and important manuscripts.

### 凭据与隐私 / Credentials and privacy

云同步凭据保存在本机 Zotero 偏好设置中，独立于正常的云端数据载荷。当前实现不使用操作系统加密凭据库。云端同步会过滤已知的凭据字段；旧数据、手动导入文件和原始数据库导出仍需自行检查。

Cloud credentials are stored in local Zotero preferences, separately from normal cloud data payloads. The current implementation does not use the operating system's encrypted credential vault. Cloud synchronization filters known credential fields; inspect legacy data, imported files, and raw database exports separately.

完整备份可能包含未公开手稿、作者信息和审稿内容。不要将个人数据库、令牌或密码提交到公开代码仓库或公开 Issue。

Full backups may contain unpublished manuscripts, author details, and review content. Keep personal databases, tokens, and passwords out of public code repositories and public issues.

<a id="sync"></a>
## 9. WebDAV 与 GitHub 同步 / WebDAV and GitHub synchronization

默认使用本地存储。仅在选择云服务、完成配置并启用相应同步设置后，插件才会进行云同步。可先测试连接，再执行一次手动同步并检查结果。

Local storage is the default. Cloud synchronization requires selecting a provider, completing its configuration, and enabling the relevant synchronization settings. Test the connection, perform a manual synchronization, and inspect the result.

### WebDAV

**中文**

1. 在多云设置中选择 WebDAV。
2. 输入可读写的 WebDAV 文件夹 URL、用户名与密码。
3. 插件将在该文件夹中使用 `researchflow_db.json` 保存数据；URL 应指向文件夹。
4. 测试连接，再手动同步。
5. 确认数据正常后，根据需要启用自动同步。

**English**

1. Select WebDAV in Multi-Cloud Settings.
2. Enter a writable WebDAV folder URL, username, and password.
3. The add-on uses `researchflow_db.json` inside that folder; provide a folder URL.
4. Test the connection, then synchronize manually.
5. Enable automatic synchronization after confirming the result.

### GitHub

**中文**

1. 为个人数据准备一个自己的私有 GitHub 仓库。
2. 创建具有该仓库 Contents 读写权限的访问令牌。
3. 填写所有者、仓库、分支与令牌；默认分支配置为 `main`，请与实际仓库保持一致。
4. 插件通过仓库中的 `researchflow_db.json` 读写数据。
5. 测试连接并手动同步，确认后再使用自动同步。

**English**

1. Prepare your own private GitHub repository for personal data.
2. Create an access token with read/write Contents permission for that repository.
3. Enter the owner, repository, branch, and token. The configured default is `main`; match the repository's actual branch.
4. The add-on reads and writes `researchflow_db.json` in that repository.
5. Test the connection and synchronize manually before relying on automatic synchronization.

个人同步仓库与本项目的公开代码仓库 `groele/ResearchFlow-Zotero` 用途不同。令牌的配置与管理可参考 [GitHub 官方访问令牌说明](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)。

Use a personal data repository separately from the public software repository `groele/ResearchFlow-Zotero`. See [GitHub's access token documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) for token management.

### 多设备使用 / Multiple devices

每台设备分别安装插件并配置连接与凭据。同步合并主要记录集合并处理删除标记；本机设置与凭据仍在本机管理。大量编辑前先拉取并检查记录，完成编辑后再同步，可减少同时修改造成的冲突。

Install the add-on and configure the connection and credentials on each device. Synchronization merges major record collections and handles deletion markers, while local settings and credentials remain locally managed. Synchronize and inspect records before extensive editing, then synchronize again afterward to reduce conflicting concurrent changes.

连接测试成功只表示该次连接检查通过，不代表所有网络状态、权限变化和多设备并发情况均已验证。遇到冲突或失败时保留本地备份，并记录完整错误信息。

A successful connection test confirms that check only; it does not validate every network condition, permission change, or concurrent editing scenario. Keep local backups and record full errors when synchronization fails.

<a id="settings"></a>
## 10. 界面与窗口设置 / Interface and window settings

工作区支持简体中文与 English，以及跟随系统、浅色、深色主题。切换语言改变界面文字，不翻译已有手稿或审稿记录。部分 Zotero 原生偏好设置标签仍为中文。

The workspace supports Simplified Chinese and English, with system, light, and dark themes. Changing the language changes interface text, rather than translating manuscript or review records. Some labels in Zotero's native preferences remain in Chinese.

| 模式 / Mode | 中文说明 | English |
| --- | --- | --- |
| 标签页 / Tab | 在 Zotero 内部标签页打开，默认模式。 | Open as an internal Zotero tab; the default mode. |
| 伴随窗口 / Companion window | 初始约 480 × 780，适合与文献阅读并排使用，可设置置顶。 | Initially about 480 × 780, suitable alongside reading; supports an always-on-top preference. |
| 独立窗口 / Standalone window | 初始约 1240 × 820，适合完整工作区操作。 | Initially about 1240 × 820, suitable for the full workspace. |

窗口大小可随使用调整。原生偏好设置提供默认窗口模式、伴随窗口置顶、数据路径与备份恢复等选项。

Window sizes can be adjusted. Native preferences expose the default window mode, companion-window always-on-top behavior, data path, and backup/recovery controls.

<a id="shortcuts"></a>
## 11. 快捷键 / Keyboard shortcuts

| Windows / Linux | 中文操作 | English action |
| --- | --- | --- |
| `Ctrl + Alt + R` | 按默认窗口模式打开工作区。 | Open the workspace in the default window mode. |
| `Ctrl + Shift + R` | 在阅读器中捕获内容，或基于选中条目创建记录；取决于当前上下文。 | Capture reader content or create a record from the selected item, depending on context. |

代码包含 macOS 修饰键映射（`⌘ + Option + R`、`⌘ + Shift + R`），但尚未完成 macOS 实机验证。若快捷键与其他插件或系统冲突，可使用工具栏和菜单入口。

The code includes macOS modifier mappings (`⌘ + Option + R`, `⌘ + Shift + R`), but these have not been verified on macOS hardware. Use toolbar and menu entries if a shortcut conflicts with another add-on or the system.

<a id="troubleshooting"></a>
## 12. 常见问题与故障排查 / Troubleshooting

| 问题 / Problem | 中文处理 | English guidance |
| --- | --- | --- |
| 工具栏图标偏小 / Small toolbar icon | 确认版本为 10.0.1 或更新版本，安装后重启 Zotero。10.0.1 将图标统一为 20 × 20，按钮为 28 × 28。 | Confirm version 10.0.1 or later and restart Zotero. Version 10.0.1 uses a 20 × 20 icon in a 28 × 28 button. |
| 仍看到“分享图片” / Share Image is still visible | 检查是否仍在运行旧版，手动安装最新 XPI 并重启。 | Check for an older installed version, install the latest XPI, and restart. |
| 找不到保存的 PNG / Cannot find a saved PNG | 查看保存成功后显示的完整路径；保存位置由系统保存窗口中的选择决定。 | Check the full path shown after a successful save; the native dialog determines the destination. |
| PNG 保存失败 / PNG saving fails | 检查目标目录是否可写、路径是否有效，选择其他位置并保留错误信息。 | Check destination permissions and path validity, try another location, and retain the error. |
| 图片预览生成失败 / Image rendering fails | 重试生成，降低输出分辨率，或减少长时间线内容。 | Retry rendering, reduce output resolution, or shorten long timelines. |
| 复制图片不可用 / Image copying unavailable | 当前环境可能缺少图片剪贴板支持；使用另存 PNG。 | The environment may lack image clipboard support; save a PNG instead. |
| 首次打开出现已有记录 / Existing records at first launch | 无本地数据库时会使用预置数据，按实际项目整理。 | Bundled data initializes a missing database; organize it for your projects. |
| 云同步失败 / Cloud synchronization fails | 检查 URL、仓库、分支、权限与凭据；先测试连接，再手动同步。 | Check the URL, repository, branch, permissions, and credentials; test and synchronize manually. |
| 导入后数据不符合预期 / Unexpected imported data | 使用导入前快照或独立备份恢复；再次导入前确认合并与覆盖模式。 | Restore a pre-import snapshot or a separate backup; check merge versus overwrite mode before importing again. |
| JSON 备份没有 PDF / No PDFs in JSON backup | ResearchFlow JSON 只备份工作区数据；另行备份 Zotero 文献库与附件。 | ResearchFlow JSON backs up workspace data; back up the Zotero library and attachments separately. |
| 改了 Zotero 笔记但工作区未改变 / Note edits do not change workspace | 笔记同步从 ResearchFlow 写入 Zotero，不反向更新数据库。 | Note synchronization writes from ResearchFlow to Zotero and does not update the database in reverse. |

提交问题时，请提供：ResearchFlow 版本、Zotero 版本、操作系统、复现步骤、预期与实际结果、完整错误信息；必要时附截图或诊断信息。公开前检查是否包含个人数据、令牌或密码。

When reporting an issue, include the ResearchFlow version, Zotero version, operating system, reproduction steps, expected and actual behavior, and full errors. Add screenshots or diagnostics when useful, after checking for personal data, tokens, and passwords.

<a id="development"></a>
## 13. 开发、测试与打包 / Development, testing, and packaging

开发需要 Git、Node.js 与 Python 3。插件使用 Zotero / Gecko 环境中的 JavaScript、HTML 和 CSS；正常安装使用预构建 XPI 即可。

Development requires Git, Node.js, and Python 3. The add-on uses JavaScript, HTML, and CSS in Zotero / Gecko. Regular users can install the prebuilt XPI.

### 获取源码与检查 / Get the source and run checks

以下命令适用于 PowerShell；在仓库根目录执行检查。

Use the following commands in PowerShell; run checks from the repository root.

```powershell
git clone https://github.com/groele/ResearchFlow-Zotero.git
Set-Location ResearchFlow-Zotero

node --test tests/share-image.test.js
node --check bootstrap.js
node --check chrome/content/scripts/index.js
node --check chrome/content/scripts/options.js
node --check chrome/content/scripts/zotero-bridge.js
git diff --check

python tools/build-xpi.py
```

打包脚本只收集运行时文件，检查插件、更新清单与界面版本一致性，并生成当前版本 XPI。README、测试、开发脚本及文档图片不会进入安装包。

The build script includes runtime files only, checks version consistency across the add-on, update manifest, and interface, and generates the current-version XPI. The README, tests, development tools, and documentation images are excluded from the installer.

### 测试范围 / Test scope

`tests/share-image.test.js` 包含 8 项自动测试，覆盖保存桥接、取消、错误与重复保存等相关行为。测试使用模拟宿主，不能替代 Zotero 实机验证。

`tests/share-image.test.js` contains eight automated tests covering save bridging, cancellation, errors, and related behavior such as repeated saves. Its mocked host cannot replace validation in Zotero.

修改界面或宿主功能时，应在隔离 Zotero 配置中测试实际流程；图片保存还应核对文件确实存在、PNG 可以打开、显示路径正确。发布时同步核对所有版本字段、更新清单、安装包、Git 标签及 Release 资产。

For interface or host changes, test the actual workflow in an isolated Zotero profile. For image saving, confirm that the file exists, opens as a PNG, and matches the displayed path. Before a release, verify all version fields, the update manifest, installer, Git tag, and Release assets.

<a id="layout"></a>
## 14. 项目结构 / Project structure

```text
ResearchFlow-Zotero/
├── bootstrap.js                       # Zotero lifecycle / Zotero 生命周期
├── chrome.manifest                    # Gecko resource mapping / 资源映射
├── manifest.json                      # Add-on metadata / 插件元数据
├── prefs.js                           # Default preferences / 默认偏好设置
├── update.json                        # Update manifest / 自动更新清单
├── chrome/
│   └── content/
│       ├── index.html                 # Workspace / 工作区
│       ├── preferences.xhtml          # Native preferences / 原生偏好设置
│       ├── pages/                     # Settings pages / 设置页面
│       ├── scripts/                   # UI, storage, bridge / 界面、存储、桥接
│       ├── styles/                    # Stylesheets / 样式
│       ├── data/                      # Bundled initial data / 预置数据
│       └── icons/                     # Icon resources / 图标资源
├── locale/                            # Locale resources / 本地化资源
├── tests/                             # Automated test suites / 自动化测试套件
│   ├── share-image.test.js            # Image-save tests / 图片保存测试
│   └── context-menu.test.js           # Context menu tests / 右键菜单测试
├── tools/build-xpi.py                  # XPI builder / 安装包打包脚本
├── docs/images/                       # Documentation images / 文档图片
├── RELEASE_NOTES_v10.0.0.md            # V10 release notes / V10 发布说明
├── RELEASE_NOTES_v10.0.1.md            # Toolbar icon notes / 工具栏图标说明
├── RELEASE_NOTES_v10.0.2.md            # Sidebar icon notes / 侧边栏图标说明
├── RELEASE_NOTES_v10.0.3.md            # Context menu notes / 右键菜单优化说明
├── RELEASE_NOTES_v10.0.4.md            # Plugin Market fix / 插件市场修复说明
├── researchflow-zotero-10.0.4.xpi      # Current installer / 当前安装包
└── README.md                          # Bilingual guide / 双语说明
```

仓库中可能保留历史安装包；安装时优先使用最新 Release 的资产。

Historical installers may remain in the repository; use assets from the latest Release when installing.

<a id="releases"></a>
## 15. 版本记录与验证范围 / Releases and validation scope

| 版本 / Version | 中文变更 | English changes |
| --- | --- | --- |
| [10.0.4](https://github.com/groele/ResearchFlow-Zotero/releases/tag/v10.0.4) | 将工具栏图标限制在 Zotero 主文献窗口，移除“插件市场”窗口中误插入的图标。 | Restrict the toolbar icon to the Zotero library window and remove unintended placement in Plugin Market. |
| [10.0.3](https://github.com/groele/ResearchFlow-Zotero/releases/tag/v10.0.3) | 默认隐藏文献条目右键菜单以避免菜单冗长，解决 Zotero 7+ 中空白无字图标的渲染异常，提供偏好设置切换项并自动清理残留节点。 | Hide item context menu shortcuts by default to keep menus tidy, resolve blank icon rendering glitches in Zotero 7+, add a preference toggle, and purge legacy DOM nodes. |
| [10.0.2](https://github.com/groele/ResearchFlow-Zotero/releases/tag/v10.0.2) | 文献条目侧边栏入口改为仅显示图标；完整标题保留在内容区，图标悬停仍显示提示。 | Make the item-pane navigation icon-only while retaining the full section title and hover tooltip. |
| [10.0.1](https://github.com/groele/ResearchFlow-Zotero/releases/tag/v10.0.1) | 统一 Zotero 主工具栏图标尺寸、按钮尺寸与垂直对齐。 | Align the main toolbar icon's size, button dimensions, and vertical position with native controls. |
| [10.0.0](https://github.com/groele/ResearchFlow-Zotero/releases/tag/v10.0.0) | 移除系统分享按钮；PNG 使用原生另存为，成功后显示完整路径，处理取消与错误。 | Remove system sharing; use native Save As for PNGs, show the full path after success, and handle cancellation and errors. |
| 9.1.6 | 此仓库的早期版本基线。 | Earlier version baseline in this repository. |

详细说明见 [V10.0.0 发布说明](RELEASE_NOTES_v10.0.0.md)、[V10.0.1 发布说明](RELEASE_NOTES_v10.0.1.md)、[V10.0.2 发布说明](RELEASE_NOTES_v10.0.2.md)、[V10.0.3 发布说明](RELEASE_NOTES_v10.0.3.md) 和 [V10.0.4 发布说明](RELEASE_NOTES_v10.0.4.md)。

See the [V10.0.0 release notes](RELEASE_NOTES_v10.0.0.md), [V10.0.1 release notes](RELEASE_NOTES_v10.0.1.md), [V10.0.2 release notes](RELEASE_NOTES_v10.0.2.md), [V10.0.3 release notes](RELEASE_NOTES_v10.0.3.md), and [V10.0.4 release notes](RELEASE_NOTES_v10.0.4.md).

### 工具栏效果 / Toolbar appearance

![ResearchFlow V10.0.1 toolbar aligned with Zotero native icons / ResearchFlow 工具栏图标与 Zotero 原生图标对齐](docs/images/toolbar-v10.0.1.png)

上图来自隔离 Zotero 测试配置。10.0.1 已核对原生工具栏与插件的 20 × 20 图标、28 × 28 按钮及垂直中心位置。

The screenshot comes from an isolated Zotero test profile. Version 10.0.1 was checked against native toolbar controls for its 20 × 20 icon, 28 × 28 button, and vertical center.

### 已验证与尚未验证 / Verified and unverified behavior

- **已验证：** Windows Zotero 10.0.3 中的真实图片渲染、宿主桥接、PNG 文件写入与路径显示；通过自动化保存窗口响应验证取消、失败、覆盖及等待超过 6 秒的情况。
- **Verified:** Real image rendering, host bridging, PNG writing, and displayed paths in Windows Zotero 10.0.3, with automated save-dialog responses covering cancellation, failure, overwrite, and waits longer than six seconds.
- **已验证：** 工具栏在初始化及延迟调整后，图标大小和位置保持一致；8 项图片保存自动测试通过。
- **Verified:** Toolbar dimensions and positioning after initialization and delayed updates; all eight image-save automated tests passed.
- **尚未完整验证：** 人工操作操作系统保存窗口的完整流程、所有平台与 Zotero 版本、所有云服务配置及多设备并发场景。
- **Not fully verified:** The complete manually operated OS save-dialog workflow, every platform and Zotero version, every cloud provider configuration, and concurrent multi-device scenarios.

<a id="contributing"></a>
## 16. 反馈、贡献与许可说明 / Feedback, contributions, and licensing

欢迎通过 [GitHub Issues](https://github.com/groele/ResearchFlow-Zotero/issues) 报告问题或提出建议。提交代码时，请说明解决的问题、最终行为与验证方式，并保持变更范围清晰；界面变更应同时考虑中文与英文。

Report problems and suggestions through [GitHub Issues](https://github.com/groele/ResearchFlow-Zotero/issues). For code contributions, describe the problem, resulting behavior, and validation, and keep the change focused. Consider both Chinese and English for interface changes.

公开提交前检查变更内容，避免加入个人数据库、真实审稿内容、密码、访问令牌或本机私有路径。

Review public changes for personal databases, real review content, passwords, access tokens, and private local paths.

**许可说明：** 当前仓库未提供独立的 `LICENSE` 文件。请向维护者确认适用许可；本 README 不新增许可授权。

**Licensing:** The repository currently has no standalone `LICENSE` file. Confirm the applicable license with the maintainer; this README does not grant additional license rights.
