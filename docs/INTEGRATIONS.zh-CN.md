# 第三方订阅、API 与 AI surface 接入

所有服务由采用者自行申请和配置。本项目不共享 CowTech 的 API Key、订阅、会话或私有代理。下列为代码字段映射与接入方法，不是供应商价格或套餐承诺。

## 1. 先选择观察对象

如果需要观察模型 API，就使用 API 适配器；如果需要观察网站向用户展示的回答，就验证相应网页 surface。不能用前者替代后者后仍标注为原生网页数据。

现有基础 provider factory 接受：`openrouter`、`perplexity`、`google_ai_overview`、`chatgpt_api_like`、`gemini_api_like`、`claude_api_like`、`grok_api_like`。`unconfigured` 表示未接入；`mock` 仅自动化测试可用。其它内部 surface 路由不等于可以直接作为这些入口的 provider mode。

## 2. 模型 API 与搜索采集

| mode | 监测服务配置字段 | 数据来源与验证 |
|---|---|---|
| `openrouter` | `OPENROUTER_API_KEY`、`OPENROUTER_BASE_URL`；任务的 model target 决定模型 | 聚合 API；本地 HTTP 适配器验证通过，采用者真实账号待验 |
| `perplexity` | `PERPLEXITY_API_KEY`、`PERPLEXITY_MODEL`、`PERPLEXITY_BASE_URL` | API 响应，不冒充 Perplexity 网页 |
| `google_ai_overview` | `SERPAPI_API_KEY`、`SERPAPI_BASE_URL` | SerpApi 搜索结果采集；不是 Gemini API |
| `chatgpt_api_like` | `OPENAI_API_KEY` 及对应模型配置 | 模型 API，不是 ChatGPT 网页会话 |
| `gemini_api_like` | `GEMINI_API_KEY` 及对应模型配置 | 模型 API，不是 Gemini 网页会话 |
| `claude_api_like` | `ANTHROPIC_API_KEY` 及对应模型配置 | 模型 API，不是 Claude 网页会话 |
| `grok_api_like` | `XAI_API_KEY` 及对应模型配置 | 模型 API，不是 Grok 网页会话 |

公开供应商 API 地址可以使用官方地址；不要填入 CowTech 私有代理。模型 ID 应从自己实际可用的目录选择，现有默认值不代表永久可用。

**OpenRouter 接入：** 在自己的账号建立 API Key，设置供应商侧限额，将 Key 仅写入运行环境，选择任务模型并验证请求/响应。官方提供统一 API 接入方式；本项目还会按适配器逻辑请求联网工具，实际支持与费用需用所选模型核验。[OpenRouter 官方接入说明](https://openrouter.ai/docs/quickstart)

**Perplexity 接入：** 申请自己的 API 凭据，填写对应模型与地址，先验证一条明确问题的响应和来源字段。是否具有网站会员不是本适配器的验收依据。[Perplexity API 官方说明](https://docs.perplexity.ai/docs/getting-started/quickstart)

**Google AIO 接入：** 配置自己的 SerpApi Key，验证地区、语言、查询及响应中的 AIO 数据。SerpApi 文档区分搜索响应及带 token 的后续获取方式，采用者应核对当前适配器覆盖的路径。[SerpApi AIO 文档](https://serpapi.com/google-ai-overview-api)

## 3. AI 网页 surface 与证据存储

浏览器连接相关字段包括 `PHASE2_BRIGHT_DATA_CDP_ENDPOINT`、`PHASE2_BRIGHT_DATA_CDP_AUTH_HEADER`、`PHASE2_BROWSER_CORE_ENABLED`；供应商连接由采用者建立，不附送会话。Bright Data 提供远程浏览器接入，但这不意味着本项目每个目标网站的采集流程已验收。[Browser API 文档](https://docs.brightdata.com/products/scraping-browser/introduction)

只有在指定 surface 的连接、登录/访客状态、地区、内容提取和失败处理都验证后，才计为该 surface 可用。不要笼统开启所有 `PHASE*` 开关；它们包含不同实验路径和预算条件。

需要证据对象存储的路径使用 `PHASE2_EVIDENCE_*`：endpoint、region、bucket、prefix、access key 和 secret。采用者提供自己的兼容存储，并验证写入、读取及保留策略。不上传 CowTech 历史证据或客户截图。

## 4. 工作台生成模型与 embedding

工作台模型配置与监测服务环境变量是两套入口，不能只填一侧就认为全部配置完成。

在工作台模型管理中填写自己的 `api_url`、`api_key`、`model_id`、`model_type` 和调用限额。聊天模型用于生成；embedding 模型用于真实向量化。添加并启用 embedding 模型后设置默认 embedding，再用自己的少量资料检查切片、维度和检索结果。

未设置 embedding 可以保留原文和文本检索。更换向量模型时重新生成对应向量，不能把两个不同模型空间的数值混合比较。引用和文章事实仍需核查，不因使用知识库而自动正确。

## 5. 邮件

本地注册和重置依赖采用者的实际投递服务。SMTP 配置 `MAIL_MAILER=smtp`、`MAIL_HOST`、`MAIL_PORT`、`MAIL_SCHEME`、`MAIL_USERNAME`、`MAIL_PASSWORD` 和发件地址；认证字段发行默认留空。

先验证发件域名、测试收件箱和回调链接域名，再启用用户注册。生产 `log`/`array` 被拒绝是预期行为。其它邮件驱动还可能需要额外 SDK，不能仅凭配置名称存在就认为依赖已安装。

## 6. 发布渠道

| 渠道 | 采用者提供 | 最小验收 |
|---|---|---|
| WordPress REST | 自己的网站、发布用户、应用密码 | 先健康检查与草稿，再确认审核后的发布 URL |
| 站点 Agent | 自己部署的接收端、认证与目标地址 | 健康检查、文章字段映射、发布回执 |
| generic webhook | 自己的接收 URL、认证头和数据契约 | 接收端确认处理结果；HTTP 成功不自动等于文章可访问 |

WordPress 支持应用密码配合 HTTPS 进行 REST 认证；在自己的站点为专用账号创建，不把管理员主密码写入示例。[WordPress 官方认证说明](https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/)

未配置渠道时使用草稿与导出路径，不默认发布到任何 CowTech 站点。发布实际会改变目标网站内容，须由采用者决定目标、文章及发布动作。

## 7. 费用与最小验证

配置了 Key 不等于允许调用。监测侧还检查 `EXTERNAL_SPEND_MODE`、请求级 `allow_paid_provider`、客户/能力配置、预算和必要传输许可。供应商测试开关也不是全局绕过开关。

采用者启用顺序：确认账号与模型 → 设置小额预算和调用上限 → 配置明确 provider → 在应用正常入口发起一次真实任务 → 对照请求标识、回答、来源和账单记录 → 再决定是否启用周期调度。不直接构造绕过门禁的供应商调用来“修复”预算错误。

上述费用控制说明适用于监测侧；工作台生成、邮件、发布以及其它供应商仍需各自限额，不能假设一个开关控制全部出站行为。

停用时关闭相应任务与调度、撤销对应调用许可，并在服务商撤销 Key。先保留所需运行记录，不通过删除数据掩盖失败。

## 8. 常见状态

- `provider_not_configured`：补齐实际服务配置，不改成 mock。
- `mock_provider_test_only`：当前为生产模式，测试替身不可用。
- `paid_provider_not_allowed`：请求没有付费许可；检查自己的预算决策。
- `external_spend_globally_denied`：监测传输总开关仍关闭；先核对预算和最小任务。
- 401/403：区分内部认证错误与第三方凭据/权限错误。
- 网页不可用或未出现 AIO：记录观测状态，不能用 API 回答伪装原生成功。

官方资料核验日期：2026-10-04。此指南不列固定价格；以采用者实际服务合同和控制台为准。
