# CowTech GEO

## AI 可见度监测与内容优化工作台

**从 AI 回答中的品牌呈现，到内容改进、审核发布和复测追踪。**

[English](README.md) · [GEO 科普](docs/GEO-INTRO.zh-CN.md) · [白皮书](docs/WHITEPAPER.zh-CN.md) · [安装说明](docs/INSTALL.zh-CN.md) · [服务接入](docs/INTEGRATIONS.zh-CN.md) · [首次使用](docs/QUICKSTART.zh-CN.md)

CowTech GEO 面向品牌团队、内容运营团队、GEO/SEO 服务商和自托管开发者，将原本分散的品牌监测、知识资料、内容生产、审核分发与复测记录连接起来。

**版本：v0.1.0，自托管、自带服务。** [GitHub 仓库](https://github.com/jrishpapi/cowtech-geo) · [下载发行包](https://github.com/jrishpapi/cowtech-geo/releases) · [问题反馈](https://github.com/jrishpapi/cowtech-geo/issues)。本项目提供代码、接入通道和内部工作链路；采用者自行申请 API、配置邮件与发布服务，并验证选定的接入。已完成本地空库安装和基础接线验收，不声称所有真实第三方平台均已实测。

## 为什么需要它？

团队需要回答的不只是“网站排第几”，还有：AI 是否提到我们、描述是否准确、引用哪些来源、竞争者出现在哪里、应该改进哪些内容，以及改进后样本发生了什么变化。

CowTech 将这些问题组织成可追踪的工作流程，而不是一次性的截图和评分报告。

| 你的问题 | CowTech 提供的工作方式 |
|---|---|
| 提问、截图和结论散落各处 | 品牌、竞争对象、问题集与运行记录 |
| 报告做完不知道下一步 | 来源分析、内容机会、brief 与任务 |
| 资料、写作、审核和分发脱节 | 知识库、内容生成、审核、导出与渠道连接 |
| 发布后无法复盘 | 发布记录、复测安排及前后对比 |

## 六类能力

品牌与问题管理、回答分析、内容机会、知识驱动内容、发布与交付、复测与追踪。分发连接器包括 WordPress、站点 Agent 和 webhook；采用者自行配置目标渠道。

以上为能力范围，不代表每个连接器已完成真实平台验收。详见[功能状态](docs/CAPABILITIES.zh-CN.md)。

## 使用自己的服务，不绑定 CowTech 订阅

自托管核心账号不要求 CowTech 付费订单。采用者自行部署服务、申请 API、配置邮件与发布账号，并承担自己的基础设施和调用费用。发行包不提供 CowTech 的密钥、会员、采集会话或私有 API 默认连接。

未接入的供应商明确显示未配置；生产环境不以 mock 填补结果。未配置真实 embedding 时保留原始资料，使用文本检索，不制造语义向量。

## 快速启动

```bash
git clone https://github.com/jrishpapi/cowtech-geo.git
cd cowtech-geo
python3 scripts/configure.py --admin-email owner@example.com --admin-user owner
./scripts/compose.sh build
./scripts/compose.sh up -d
```

将示例邮箱换成自己的，按提示设置管理员密码。依赖 Docker、Compose v2、Python 3；启动后访问 `http://localhost:18088`。默认不配置第三方密钥、不允许外部付费调用。接入自己的服务时按[使用者验收清单](docs/OPERATOR-VALIDATION.zh-CN.md)逐项核对。

## 开始使用

按[安装说明](docs/INSTALL.zh-CN.md)准备工作台和监测服务，再阅读[接入指南](docs/INTEGRATIONS.zh-CN.md)和[首次使用](docs/QUICKSTART.zh-CN.md)。使用本目录的统一 Compose 和配置生成器；默认仅监听本机，不含公网 TLS 部署。

## 如何看待结果？

API 回答不等于同名 AI 网站的回答；样本分数不等于平台排名。没有样本不等于表现为零。复测差异不等于因果证明。CowTech 不保证被推荐、被引用或获得流量与销售。公式与解释见[指标说明](docs/METRICS.zh-CN.md)。

## 质量与发行状态

已执行修复测试的成绩与范围见[白皮书](docs/WHITEPAPER.zh-CN.md)，本轮另完成空库安装验收，不代表全部第三方服务通过。

CowTech 自有应用代码、文档和安装工具采用 [Apache-2.0](LICENSE)，第三方代码与素材保留原许可；详见 [许可范围](LICENSE-SCOPE.md)。历史展示与必要版权声明分开处理；见[发行与致谢](docs/RELEASE.zh-CN.md)。

[本地安装验收摘要 / Local installation acceptance](docs/INSTALL-ACCEPTANCE.zh-CN.md)

[发行审计与接入状态 / Release audit and integration status](docs/RELEASE-AUDIT.zh-CN.md) · [License scope](LICENSE-SCOPE.md) · [Third-party notices](THIRD_PARTY_NOTICES.md)
