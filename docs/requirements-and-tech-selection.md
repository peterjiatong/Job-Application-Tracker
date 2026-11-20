# Job Application Tracker 浏览器扩展：需求分析与技术选型

## Context

手动在多个求职平台（LinkedIn、Indeed、Handshake 等）筛岗位时，同一个岗位会在不同平台重复出现。平台不同导致无法一眼判断"只是同名"还是"同一个岗位"，只能点进去读 JD。

**关键观察**：不同聚合平台上的同一个岗位，最终都会跳到同一个 ATS 页面（Workday、Greenhouse 等），而 ATS URL 里带有稳定的岗位 ID。所以只要在 ATS 页面上解析出 `(ATS, 公司, 岗位ID)` 并本地记录，再次打开时就能立刻提示"你看过/申请过这个岗位"，不用再读 JD。

目标产物：一个开源、纯本地、无账号的 Chrome + Firefox 扩展。项目目录目前为空，从零开始。

已确认的决策：
- 记录有两种状态：`viewed`（看过）和 `applied`（已申请）
- Dashboard 用 React；页面内弹框用原生 TypeScript + Shadow DOM
- 不处理 LinkedIn / Indeed 的 Easy Apply（平台自带记录），只覆盖主流 ATS
- 需要"手动添加 URL"入口，兜底程序没识别到的页面
- 不支持 Oracle Recruiting
- **代码由用户自己写**，Claude 只做讲解、答疑和 review
- 首版不引入 LLM（理由见 2.7）

---

## 一、需求分析

### 1.1 目标用户与定位

- 用户：海投阶段的求职者，尤其是需要关注签证/身份限制的留学生
- 与 Simplify / Teal / Huntr 的差异（也是 README 的卖点）：**去重优先、纯本地、零账号、零网络请求、开源**。不做自动填表，不做云同步

### 1.2 功能需求

优先级：P0 = 首版必须，P1 = 首版之后尽快，P2 = 以后再说。

| ID | 功能 | 说明 | 优先级 |
|---|---|---|---|
| F0 | 可编辑的展示字段 | 公司名、岗位标题可在 dashboard 列表里手动修改（自动提取不准时的兜底，见 1.5.1） | P0 |
| F1 | ATS 页面识别与 ID 解析 | 从 URL 解析出 `(ats, company, jobId)`，忽略 `utm_*`、`gh_src`、`source` 等追踪参数。列表页、非岗位页解析结果为空，不做任何事 | P0 |
| F2 | 自动记录模式 | 打开岗位页即记为 `viewed`，弹框显示"已记录"，提供 **撤销** 和 **标记已申请** | P0 |
| F3 | 手动记录模式 | 打开岗位页弹框询问"是否记录"，提供 **记录** / **忽略**。忽略不落库，下次打开仍会询问 | P0 |
| F4 | 重复提醒 | 再次打开已记录岗位时弹框："你在 YYYY-MM-DD 看过 / 申请过这个岗位"。状态为 `viewed` 时附带 **标记已申请** | P0 |
| F5 | 标记已申请 | 三个入口：页面弹框、工具栏 popup、dashboard 列表行。记录 `appliedAt` | P0 |
| F6 | 关键词预警 | 扫描页面文本，命中 Citizenship / Clearance / Sponsorship 三类规则时在弹框中提示，**附带命中的原句片段**供用户自行判断。命中的类别写入记录 | P0 |
| F7 | 手动添加 URL | popup 里"记录当前页面"按钮 + dashboard 里"添加 URL"输入框。走同一个解析器；解析不出来就以规范化 URL（去掉追踪参数）作为去重键，`ats = other` | P0 |
| F8 | Dashboard | 见 1.4 | P0 |
| F9 | 设置 | 自动/手动模式切换、关键词规则增删改、关键词预警开关。放在 dashboard 页内的一个标签页，不单独做 options 页 | P0 |
| F10 | 导出 / 导入 | JSON 导出导入（备份、换浏览器迁移），CSV 导出 | P0 |
| F11 | 自动识别"已提交" | 检测各 ATS 的提交成功页（如 Greenhouse `/confirmation`、Lever `/thanks`）自动标记 `applied` | P1 |
| F12 | 自定义域名监控 | 对手动添加的非内置域名申请该域名的可选权限，之后也能自动提醒（覆盖公司自建招聘页嵌入 Greenhouse 等情况） | P1 |
| F13 | 多语言界面 | `browser.i18n`，首版只做英文界面 | P2 |
| F14 | 申请流程跟踪 | 面试 / Offer / 拒信等状态 | P2 |
| F15 | 可选的 LLM 语义判断 | 仅用于关键词预警的语义判断，默认关闭，见 2.7 | P2 |

### 1.3 弹框（Toast）交互

- 位置：页面右上角，样式参考 Google Translate 弹框。用 Shadow DOM 隔离样式，不受宿主页面 CSS 影响也不污染它
- **一个页面只出一个弹框**，记录状态和关键词预警合并在同一个弹框里分区显示，不连续弹多个
- **不自动消失**：弹框一直保留，直到用户点 × 关闭或离开这个页面。原因是常常填到一半才决定要不要申请，那时还需要弹框上的 **标记已申请**
- 可访问性：`role="status"`，按钮可键盘聚焦。弹框没有动画
- SPA 支持：Workday、Ashby 是单页应用，URL 变化不刷新页面，需要监听路由变化后重新走一遍流程；关键词扫描要等岗位内容渲染完成（DOM 稳定后再扫，设超时上限）

### 1.4 Dashboard

扩展自带的一个独立页面，从 popup 或弹框里打开。

- **每日申请活跃度**：GitHub 风格热力图，按 `appliedAt` 的本地日期统计，悬停显示当天申请数和浏览数
- **数量分析**：累计看过 / 累计申请 / 近 7 天申请 / 看过→申请转化率 / 按 ATS 分布 / 命中各类预警的岗位数
- **记录列表**：列为日期、公司、岗位标题、ATS、状态、预警标签、链接。支持搜索、按状态/ATS/预警筛选、按日期排序；行内可切换状态、删除
- 顶部操作：添加 URL、导出、导入

### 1.5 首版支持的 ATS

| ATS | 域名匹配 | 岗位 ID 来源 |
|---|---|---|
| Workday | `*.myworkdayjobs.com`、`*.myworkdaysite.com` | 路径末尾 `_` 后的 Req ID（如 `_JR1234567`），公司取子域名 |
| Greenhouse | `boards.greenhouse.io`、`job-boards.greenhouse.io`（含 `.eu.`） | `/{company}/jobs/{id}`；嵌入页用 `for` + `token` 参数 |
| Lever | `jobs.lever.co`、`jobs.eu.lever.co` | `/{company}/{uuid}`，忽略 `/apply` 后缀 |
| Ashby | `jobs.ashbyhq.com` | `/{company}/{uuid}`，忽略 `/application` 后缀 |
| iCIMS | `*.icims.com` | `/jobs/{id}/...`，公司取子域名 |
| SmartRecruiters | `jobs.smartrecruiters.com` | `/{company}/{id}-{slug}` |
| Workable | `apply.workable.com` | `/{company}/j/{shortcode}` |

以上格式来自已有认知，**实现时必须逐个用真实 URL 做成测试样例验证**。P1 再加：SuccessFactors、Taleo、Jobvite、BambooHR、Rippling、Eightfold。不支持 Oracle Recruiting。

### 1.5.1 公司名与岗位标题从哪来

URL 只负责**去重键**，这部分是精确的：`(ats, company 标识, jobId)` 全部直接取自 URL，不需要猜。

公司名和岗位标题只是**展示字段**，不参与去重，从页面内容里取，按顺序回退：

1. 页面里的 JSON-LD `JobPosting` 结构化数据（`hiringOrganization.name`、`title`）。很多 ATS 为了被 Google for Jobs 收录会内嵌它
2. `og:title` / `og:site_name` 元标签
3. ~~`document.title`~~ 已放弃：唯一需要它的是 iCIMS，而那里它先是"iCIMS Careers Portal"，之后变成混着地点的长串，存进去比没有更糟
4. URL 里的公司标识（如 `nvidia`）
5. 用户在 dashboard 列表里手动改

各 ATS 实际命中的层（2026-11-20 用真实岗位页核实，整页加载的情况）：

| ATS | 岗位标题来自 | 公司名来自 | 备注 |
|---|---|---|---|
| Greenhouse | `og:title` | URL 标识 | 没有 JSON-LD，也没有 `og:site_name` |
| Lever | JSON-LD | JSON-LD | |
| Ashby | JSON-LD | JSON-LD | 标题带前导空格，需要去掉 |
| SmartRecruiters | `og:title` | `og:site_name` | 没有 JSON-LD |
| Workable | JSON-LD | JSON-LD | |
| iCIMS | 无 | URL 标识 | 岗位内容在 iframe 里，顶层页面读不到标题。记录暂时没有标题，待处理 |
| Workday | JSON-LD | JSON-LD | 公司名是内部法人实体名（如 `2100 NVIDIA USA`），不如 URL 标识好看 |

**页面内跳转时这些标签是过期的。** Workday 从列表点进岗位时不重新加载页面，JSON-LD 不存在，`og:title` 仍是列表页的"CAREERS AT NVIDIA"，`document.title` 为空。所以这三层只能在"整页加载到这个 URL"时使用，页面内跳转要另找来源（Workday 的标题在 `[data-automation-id="jobPostingHeader"]` 里）。

### 1.6 关键词规则（默认内置，用户可改）

| 类别 | 默认匹配（正则，忽略大小写） |
|---|---|
| Citizenship | `U.S. citizen(ship)`、`citizens only`、`U.S. person`、`ITAR`、`export control`、`permanent resident`、`green card` |
| Clearance | `security clearance`、`TS/SCI`、`top secret`、`secret clearance`、`public trust`、`polygraph` |
| Sponsorship | `(not\|unable to\|cannot\|will not\|does not\|no) … sponsor`、`without (visa) sponsorship`、`sponsorship is not available`、`authorized to work … without` |

规则只匹配**限制性**表述，并且永远展示原句片段，因为"We sponsor visas"和"We do not sponsor visas"靠关键词本身分不清。

### 1.7 数据模型

```ts
type JobRecord = {
  key: string;            // `${ats}:${company}:${jobId}`；无法解析时为 `url:${规范化URL}`
  ats: string;            // 'workday' | 'greenhouse' | ... | 'other'
  company: string;        // URL 里的公司标识，有 JSON-LD 时用其中的公司名
  jobId: string;
  url: string;            // 去掉追踪参数后的 URL
  title?: string;         // JSON-LD JobPosting → og:title → document.title
  status: 'viewed' | 'applied';
  firstSeenAt: number;
  lastSeenAt: number;
  appliedAt?: number;
  flags: string[];        // 命中的关键词类别
  source: 'auto' | 'manual';
};
```

不保存 JD 全文。

### 1.8 非功能需求

- **隐私**：零网络请求，数据不出浏览器。这同时是商店审核和用户信任的核心
- **最小权限**：只申请 `storage`、`activeTab` 和上表 ATS 域名的主机权限。不要 `tabs`，不要 `<all_urls>`
- **性能**：注入页面的脚本不带任何 UI 框架；每个页面只扫描一次文本
- **健壮性**：URL 解析失败时静默，不打扰用户
- **跨浏览器**：Chrome 与 Firefox 同一套代码

### 1.9 明确不做

LinkedIn / Indeed Easy Apply 记录、Oracle Recruiting、自动填表、账号与云同步、在聚合平台列表页上直接标注、JD 全文存储、首版内的任何 LLM 调用。

### 1.10 风险与对策

| 风险 | 对策 |
|---|---|
| ATS URL 格式有变体或改版 | 解析器做成"每个 ATS 一条规则"的表，配真实 URL 测试样例；手动添加 URL 兜底 |
| 公司自建域名的招聘页（如 `company.com/careers?gh_jid=`）域名匹配不到 | 首版靠 popup 的"记录当前页面"；P1 做 F12 |
| "已申请"依赖手动点击，容易忘 | 三个入口降低成本；P1 做 F11 自动识别 |
| 关键词误报 / 漏报 | 展示原句片段；规则可编辑 |
| 卸载扩展或清数据导致记录丢失 | 导出 / 导入；README 里明确提醒 |
| 项目名过于通用，商店里同名扩展很多 | 上架前起一个有辨识度的名字 |

---

## 二、技术选型分析

### 2.1 结论

| 层 | 选择 |
|---|---|
| 扩展框架 | **WXT** |
| 语言 | **TypeScript**（strict） |
| Manifest | **MV3**（Chrome 与 Firefox 均用 MV3） |
| Dashboard / Popup | **React** |
| 页面内弹框 | **原生 TypeScript + Shadow DOM** |
| 样式 | **原生 CSS** |
| 图表 | **不引入图表库**，热力图和条形图用 CSS Grid / div 手写 |
| 存储 | **`browser.storage.local`**，每条记录一个 key |
| 测试 | **Vitest**，只测 URL 解析器和关键词扫描两个纯函数模块 |
| 包管理 / CI | pnpm + GitHub Actions |
| 许可证 | MIT |

### 2.2 扩展框架

| 方案 | 优点 | 缺点 |
|---|---|---|
| **WXT**（推荐） | 基于 Vite；一套代码输出 Chrome 和 Firefox，自动处理 manifest 差异和 `chrome` / `browser` API 差异；自带 Shadow DOM UI 挂载和 SPA 路由变化事件，正好对应 1.3 的两个难点；自带打包和商店提交命令；维护活跃 | 多一层框架约定要学 |
| Plasmo | React 体验好，上手快 | 基于 Parcel，维护节奏明显放缓，Firefox 支持不如 WXT |
| CRXJS + Vite | 轻，贴近原生 | 以 Chrome 为中心，Firefox 需要自己处理 |
| 纯手写 | 零依赖 | 要自己维护两份 manifest、构建和热更新，纯重复劳动 |

### 2.3 界面

- **弹框不用 React**：它会被注入到每一个 ATS 页面，内容只有几行文字加两三个按钮，原生 DOM 足够，避免给宿主页面增加体积和启动开销
- **Dashboard / Popup 用 React**：是扩展自己的页面，体积不影响别人的网页；列表的筛选、排序、行内编辑用 React 写更清晰，贡献者也最熟悉
- **不用 Tailwind**：只有一个页面加一个弹框，且 Shadow DOM 内使用 Tailwind 需要额外配置，原生 CSS 更省事
- **不用图表库**：热力图是 53×7 的格子，分布图是按百分比设宽度的 div。将来要折线图、多维图表时再引入 Recharts

### 2.4 存储

| 方案 | 评价 |
|---|---|
| **`storage.local`**（推荐） | 内容脚本、popup、dashboard 都能直接读写，不需要经过后台转发。每条记录约 0.3–0.5 KB，默认 10 MB 配额可容纳两万条以上。每条记录单独一个 key（`job:<key>`），查重是一次直接读取，多个标签页同时写也不会互相覆盖 |
| IndexedDB / Dexie | 内容脚本里的 IndexedDB 属于宿主网页而不是扩展，必须经后台中转；对几千条记录的量级是过度设计 |
| `storage.sync` | 总配额约 100 KB，装不下 |

### 2.5 架构

```
entrypoints/
  content.ts        匹配 ATS 域名：解析 URL → 查库 → 记录/询问 → 扫描关键词 → 渲染弹框
  background.ts     极薄：只负责响应"打开 dashboard"消息
  popup/            当前页状态、记录当前页面、标记已申请、模式切换、打开 dashboard
  dashboard/        React：热力图、统计、列表、添加 URL、导入导出、设置
lib/
  ats.ts            parseJobUrl(url) → { ats, company, jobId } | null    纯函数
  keywords.ts       scan(text, rules) → 命中列表（含原句片段）            纯函数
  store.ts          对 storage.local 的读写封装
```

业务逻辑集中在 `lib/` 的两个纯函数模块里，这也是唯一需要自动化测试的部分。

### 2.6 跨浏览器与上架

- Firefox 的 MV3 后台不是 service worker 而是后台脚本，WXT 会按目标浏览器生成对应 manifest
- Firefox 需要在 manifest 里声明扩展 ID 和数据收集声明（本项目填"不收集"）；AMO 审核需要同时上传源码包，WXT 打包时会自动生成
- Chrome Web Store 开发者注册一次性 5 美元，需要填写隐私实践表单；AMO 免费
- 主机权限只限 ATS 域名、单一用途、零数据收集，这三点能让两边审核都比较顺利

### 2.7 是否引入 LLM

**结论：首版不引入。**

- **解决的不是真问题**：去重键完全来自 URL，是精确的。LLM 能改善的只有公司名这个展示字段，而 1.5.1 的回退链加上手动修改已经够用
- **代价很大**：
  - 破坏"零网络请求、数据不出浏览器"这个核心卖点，页面内容要发给第三方
  - 需要额外的 API 域名主机权限，商店审核要填数据外发声明
  - API key 只能明文存在 `storage.local`
  - 绝大多数用户不会去申请并填写 API key，功能实际覆盖率很低
  - 要维护多家模型的适配层，每次页面访问还有延迟和费用
- **LLM 真正有价值的位置**是关键词预警里的语义判断（"We sponsor"和"We do not sponsor"正则分不清），而不是解析公司名。如果将来要做，作为 P2 的**可选**功能加在这里，并优先考虑 Chrome 内置的本地模型（Prompt API，无需 key、数据不出本机，但 Firefox 不支持），其次才是用户自填 API key

### 2.8 里程碑与工时估计

前提：用户自己写代码，Claude 负责讲解和 review。以下是专注工时的粗估，最大变量是对 TypeScript / React 的熟悉程度，以及各 ATS 真实页面的边界情况调试。

| 阶段 | 内容 | 估计工时 |
|---|---|---|
| M1 | WXT 脚手架；`lib/ats.ts` 解析器 + 真实 URL 测试；内容脚本记录与弹框（自动/手动、重复提醒、撤销、标记已申请） | 12–18 小时 |
| M2 | 关键词扫描与设置 | 5–8 小时 |
| M3 | Dashboard（热力图、统计、列表、添加 URL、导入导出）与 popup | 12–18 小时 |
| M4 | Firefox 适配验证；中英双语 README + 演示 GIF；CI；提交两个商店 | 6–10 小时 |
| 合计 | | **约 35–55 小时** |

- 每天 2 小时左右：3–4 周；全职投入：1–1.5 周
- 商店审核时间另算（通常几天，Chrome 偶尔更久）
- **M1 完成后就能以"加载未打包扩展"的方式在 Chrome 里自用**，建议先做完 M1 立刻边投简历边用，用真实使用中发现的问题来修正后面的设计

### 2.9 验证方式

- `pnpm test`：`lib/ats.ts` 用每个 ATS 的真实 URL（含带追踪参数、`/apply` 后缀、列表页等情况）做表驱动测试；`lib/keywords.ts` 用正反例句测试
- `pnpm dev` 与 `pnpm dev:firefox` 分别加载扩展，实际打开各 ATS 的岗位页，检查首次记录、重复提醒、撤销、标记已申请、关键词预警、SPA 内跳转
- 打开 dashboard 检查热力图、统计数字与列表是否和实际操作一致；导出后清空再导入，数据应完全恢复

