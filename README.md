# CowTech GEO

**AI Visibility & Content Optimization Workspace**

[简体中文](README.zh-CN.md) · [GEO explained](docs/GEO-INTRO.zh-CN.md) · [White paper](docs/WHITEPAPER.zh-CN.md) · [Setup](docs/INSTALL.zh-CN.md) · [Integrations](docs/INTEGRATIONS.zh-CN.md)

CowTech GEO connects AI-answer monitoring with a practical content workflow: organize brands and questions, inspect mentions and citations, prioritize content opportunities, work from your knowledge base, review and distribute content, then compare follow-up observations.

**Release: v0.1.0 — self-hosted, bring your own services.** [GitHub](https://github.com/jrishpapi/cowtech-geo) · [Releases](https://github.com/jrishpapi/cowtech-geo/releases) · [Issues](https://github.com/jrishpapi/cowtech-geo/issues). This release provides application code, provider adapters and the internal workflow. Operators supply their own API, email and publishing credentials and validate their selected integrations. It does not claim all live services or browser surfaces have been verified. Documentation beyond this overview is currently in Chinese.

## Why CowTech GEO?

| Problem | Workflow |
|---|---|
| Scattered questions and screenshots | Versioned question sets and recorded runs |
| Reports disconnected from action | Content opportunities, briefs and production tasks |
| Knowledge, writing and publishing in separate tools | Knowledge-backed drafting, review, export and configured publishing channels |
| No follow-up after publishing | Publication records, retest scheduling and comparisons |

The intended audience is brand teams, content operators, GEO/SEO service providers and developers running their own infrastructure.

## Bring your own services

Deploy your own workbench and monitoring service. Configure your own model APIs, collection services, email and publishing accounts. CowTech credentials and subscriptions are not included.

- Self-hosted core access does not require a CowTech payment order.
- Unconfigured providers do not produce synthetic observations. Mock providers are test-only.
- Without a real embedding provider, knowledge retrieval uses text rather than fabricated semantic vectors.
- Your API, infrastructure and service usage may incur costs. Local access is not a third-party subscription.

## What this does not promise

API responses are not evidence of the corresponding consumer website's answers. A sampled visibility score is not an official platform ranking. Content improvements do not guarantee mentions, citations, traffic or sales. Before/after comparisons alone do not establish causation.

See [capability status](docs/CAPABILITIES.zh-CN.md) before adopting a connector. Browser collection and live publishing still require adopter-specific verification. A synthetic-only article expansion path is blocked in production, not represented as a working live connector.

## Quick start

```sh
git clone https://github.com/jrishpapi/cowtech-geo.git
cd cowtech-geo
python3 scripts/configure.py --admin-email owner@example.com --admin-user owner
./scripts/compose.sh build
./scripts/compose.sh up -d
```

Replace the example email with your own and enter a new administrator password at the prompt. Requires Docker, Compose v2 and Python 3. Open `http://localhost:18088`. Provider keys are blank and external spending is disabled by default. Use the [setup guide](docs/INSTALL.zh-CN.md) for remote-host access, TLS, persistence and service configuration. See the [operator validation checklist](docs/OPERATOR-VALIDATION.zh-CN.md) before enabling a live connector.

## Start here

1. Read the [GEO introduction](docs/GEO-INTRO.zh-CN.md) and [capability matrix](docs/CAPABILITIES.zh-CN.md).
2. Follow the [deployment guide](docs/INSTALL.zh-CN.md); the bundled Compose installer has passed a local empty-database acceptance run; public TLS and external services remain adopter-specific.
3. Configure only the services you need using the [integration guide](docs/INTEGRATIONS.zh-CN.md).
4. Follow [first use](docs/QUICKSTART.zh-CN.md), including human review and comparable retests.
5. Read [metrics](docs/METRICS.zh-CN.md) before interpreting scores.

## Architecture and verification

The content workbench uses PHP/Laravel; the monitoring service uses Node.js. PostgreSQL, Redis, workers and schedulers support persistence and background work. See the [white paper](docs/WHITEPAPER.zh-CN.md).

Release preparation checks: PHP 359 tests / 6,052 assertions passed; Node's default suite reported 879 passed and 41 skipped, with no failures. One of those skipped tests was separately run in an isolated production-mode integration environment and passed; 40 other conditional tests were not run. A separate local clean-install run verified login, empty business data, initialization idempotency, persistence and internal authentication. Live third-party integrations remain unverified.

## License and acknowledgements

CowTech-owned application code, documentation and installation tooling are licensed under [Apache-2.0](LICENSE). Incorporated source and dependencies retain their own licenses; see [license scope](LICENSE-SCOPE.md). See [release notes and acknowledgements](docs/RELEASE.zh-CN.md). Do not submit credentials, session cookies, customer data or private logs with issues or contributions.

[本地安装验收摘要 / Local installation acceptance](docs/INSTALL-ACCEPTANCE.zh-CN.md)

[发行审计与接入状态 / Release audit and integration status](docs/RELEASE-AUDIT.zh-CN.md) · [License scope](LICENSE-SCOPE.md) · [Third-party notices](THIRD_PARTY_NOTICES.md)
