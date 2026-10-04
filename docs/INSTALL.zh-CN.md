# 自托管 v0.1.0：安装与维护

本发行包含 `workbench/`（PHP 工作台）、`monitoring/`（Node 监测）、统一 `compose.yaml` 与配置生成器。CowTech 自有代码与材料采用 Apache-2.0，第三方独立许可和声明保留；见 [许可范围](../LICENSE-SCOPE.md) 和 [第三方声明](../THIRD_PARTY_NOTICES.md)。已验收本地安装与内部接线，采用者负责配置并验证自己的外部服务。

## 1. 前提

- Docker Engine、Docker Compose v2、Python 3；本轮在 Linux Docker 上验收。
- 能下载容器基础镜像、Composer 与 npm 锁文件依赖。不要复制生产 vendor、node_modules、数据库或 .env。
- 默认只监听本机 `127.0.0.1:18088`。数据库、Redis、监测 API、PHP-FPM 不映射宿主机端口。
- 无第三方账号也能启动后台并管理本地内容；真实邮件、模型、采集、发布需自带服务。不会使用 CowTech 服务兜底。

## 2. 创建本实例配置

在本发行目录执行：

```bash
python3 scripts/configure.py --admin-email owner@example.com --admin-user owner
```

将示例邮箱和用户名换成自己的。按提示输入管理员密码（至少 12 位）；终端不回显密码。生成器会分别生成数据库密码、APP_KEY、内部 Token 和会话密钥，只写入本机权限为 0600 的 `.env`、`config/workbench.env`、`config/monitoring.env`，不打印密钥。第三方凭据保持空。

可用 `--url https://your-domain.example --port 18088` 指定 URL 和本机端口。URL 本身不会配置 DNS、TLS 或反向代理。不要在已有安装重新生成 APP_KEY；配置已存在时生成器会拒绝覆盖。

## 3. 构建、启动

```bash
./scripts/compose.sh build
./scripts/compose.sh up -d
./scripts/compose.sh ps -a
```

首次构建耗时取决于网络和机器，没有固定“几分钟完成”的保证。所有运行依赖均由锁文件安装。工作台生产镜像使用 PHP-FPM + 独立 Nginx，不使用 `artisan serve`。

两个 `*-init` 服务应退出为 0，其余常驻服务保持运行，`monitoring` 显示 healthy。访问 `http://localhost:18088/`，使用配置时填写的账号登录。入口跳转到本实例，不跳转 CowTech 线上站点。

首次初始化执行数据库迁移、显式管理员创建及 `npm run bootstrap`。监测 bootstrap 仅初始化目录数据，不创建测试客户、品牌、问题或回答；它会在首次空库安装关闭历史商业方案的付费额度。重复执行保留操作员设置。已有客户数据但没有本初始化标记的数据库将拒绝首次 bootstrap，不能用来改造未核对的现有生产库。

不要运行 `npm run seed` 作为安装步骤。它是测试专用入口，生产模式明确拒绝；测试品牌数据也不在发行目录中。

## 4. 首次使用与两服务连接

- 工作台：`config/workbench.env`，`AIVGL_DASHBOARD_BASE_URL=http://monitoring:18090`。
- 监测：`config/monitoring.env`，共享 Token 由生成器自动接线；只供后端使用。
- 工作台的初始管理员无 CowTech 订单要求。客户自行注册、邮箱验证和密码重置需先配置自己的 SMTP。
- 未配置 provider 时返回 `provider_not_configured`；生产请求 mock/fixture 会被拒绝。这是正常状态，不代表应开启模拟数据。
- 无真实 embedding 时使用原文/文本检索，不显示为已完成真实语义检索。

参见[第三方接入](INTEGRATIONS.zh-CN.md)和[首次使用](QUICKSTART.zh-CN.md)。模型目录仅代表配置项，不承诺服务商当前一定提供该模型。

## 5. 接入自己的服务

邮件在工作台配置 `MAIL_HOST`、`MAIL_PORT`、`MAIL_SCHEME`、`MAIL_USERNAME`、`MAIL_PASSWORD`、`MAIL_FROM_ADDRESS`。模型和采集服务按接入指南填写自己的凭据。工作台里的 AI/embedding 模型同样由管理员配置。

默认 `EXTERNAL_SPEND_MODE=deny`、监测调度关闭、计划付费权限和额度关闭。不要仅填一个 Key 就期望任务开始。启用真实调用时，需要同时设置 provider、计划权限/预算和请求级付费许可；详细门禁见接入指南。第三方付费调用不包含在本轮干净安装验收中。

环境文件修改后需要重新创建对应容器（`restart` 不会重新加载 env_file）：

```bash
./scripts/compose.sh up -d --force-recreate app queue workbench-scheduler monitoring monitoring-worker
```

本发行默认关闭 Reverb 实时推送，常规页面与队列可运行；要启用需另配置自己的 Reverb 服务和密钥。本包未提供完整生产 TLS、外部邮件投递、真实 AI surface 或目标站发布验收。

## 6. 日常管理、升级和备份

```bash
./scripts/compose.sh logs --tail 100 workbench-init monitoring-init app monitoring
./scripts/compose.sh stop
./scripts/compose.sh start
```

命名卷保存两个数据库、两套 Redis 和公开上传文件。常规停止不删除数据；不要对需要保留数据的实例执行 `down -v`。备份必须包含数据库、上传卷、配置文件与 APP_KEY，并保存到自己的安全位置。以下命令在安装目录导出逻辑备份，不回显密码：

```bash
umask 077
mkdir -p backups
./scripts/compose.sh exec -T workbench-db pg_dump -U workbench -d workbench -Fc > backups/workbench.dump
./scripts/compose.sh exec -T monitoring-db pg_dump -U monitoring -d monitoring -Fc > backups/monitoring.dump
```

数据库备份不包含上传卷和配置；还需单独备份它们。恢复前停止写入并在新环境验证，不对现有生产库直接覆盖恢复。

升级前备份并检查迁移说明。先停止应用写入与队列，再构建、运行两个初始化任务，成功后启动：

```bash
./scripts/compose.sh stop web app queue workbench-scheduler monitoring monitoring-worker
./scripts/compose.sh build
./scripts/compose.sh run --rm workbench-init
./scripts/compose.sh run --rm monitoring-init
./scripts/compose.sh up -d
```

本次仅验收首次安装、重复初始化和重启持久化，不是跨版本升级/灾难恢复认证。不要把旧商业环境直接切换为本自托管配置。

## 7. 本轮验证边界

已验证：锁文件构建、空库迁移、空业务数据、管理员登录、后台 HTTP 页面、内部认证接线、付费默认关闭、初始化幂等、生产 mock/fixture 拒绝和重启持久化。

尚未验证：互联网 SMTP 投递、采用者真实模型/AI surface、文章向真实目标站发布、完整浏览器交互与所有高级功能。本轮已完成发行范围的凭据/数据扫描和许可材料整理；公开源码不等于代为部署线上服务。

## 8. 在远程服务器安装

默认端口只绑定服务器的回环地址。需要先在自己的电脑建立 SSH 隧道：

```bash
ssh -N -L 18088:127.0.0.1:18088 your-user@your-server
```

然后访问自己电脑的 `http://localhost:18088`。正式域名需要自行配置反向代理/TLS，并在生成配置时指定正确的 `--url`；本项目不会修改你的 DNS 或自动公开管理端口。
