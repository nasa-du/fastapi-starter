# FastAPI Cloud 部署指南

使用仓库内置的 GitHub Actions 工作流，将项目部署到 [FastAPI Cloud](https://fastapicloud.com)。

## 创建 FastAPI Cloud 应用

在 FastAPI Cloud 中创建应用，并将其[应用目录](https://fastapicloud.com/docs/builds-and-deployments/application-directory/)设置为 `backend`。

通过 [Neon](https://fastapicloud.com/docs/integrations/neon-integration/) 或 [Supabase](https://fastapicloud.com/docs/integrations/supabase-integration/) 集成连接 PostgreSQL 数据库。两种集成都会自动配置 `DATABASE_URL` 密钥。也可以为其他 PostgreSQL 服务提供商手动配置 `DATABASE_URL`。

## 配置应用

### 环境变量

为 FastAPI Cloud 应用添加以下必需的[环境变量](https://fastapicloud.com/docs/builds-and-deployments/environment-variables/)：

* `PROJECT_NAME`：项目名称，用于 API 文档。
* `FIRST_SUPERUSER_CODE`：初始超级用户的用户编码。
* `FRONTEND_HOST`：应用的公开 URL，例如自动生成的 `https://your-app.fastapicloud.dev` 或自定义域名。

如需启用 Sentry，请配置 `SENTRY_DSN`。

### 密钥

添加以下必需值，并将它们标记为密钥：

* `SECRET_KEY`：用于为安全令牌签名的密钥。
* `FIRST_SUPERUSER_PASSWORD`：初始超级用户的密码。
* `DATABASE_URL`：PostgreSQL 连接 URL；使用数据库集成时会自动配置。

可以使用以下命令为 `SECRET_KEY` 和 `FIRST_SUPERUSER_PASSWORD` 生成安全随机值：

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

## 配置持续部署

内置的 `.github/workflows/deploy.yml` 工作流会在变更推送到 `master` 分支时构建前端、准备数据库并部署应用。也可以在 **Actions** 标签页手动运行该工作流。

登录 FastAPI Cloud，并将[部署令牌](https://fastapicloud.com/docs/advanced-features/deploy-tokens/)和应用 ID 配置为 GitHub 仓库密钥：

```bash
uv run fastapi login
uv run fastapi cloud setup-ci --secrets-only --app-id <your-app-id>
```

如果 GitHub CLI 已安装并完成认证，该命令会自动配置 `FASTAPI_CLOUD_TOKEN` 和 `FASTAPI_CLOUD_APP_ID`。否则，命令会打印这些值，请在仓库的 **Settings** > **Secrets and variables** > **Actions** 页面中手动添加。

工作流会在部署前运行数据库迁移并创建初始超级用户。在仓库的 **Settings** > **Secrets and variables** > **Actions** 页面中添加以下仓库变量：

* `PROJECT_NAME`
* `FIRST_SUPERUSER_CODE`

添加以下仓库密钥：

* `DATABASE_URL`
* `SECRET_KEY`
* `FIRST_SUPERUSER_PASSWORD`

这些值应与 FastAPI Cloud 中配置的值一致。`DATABASE_URL` 使用数据库服务提供商提供的连接 URL。数据库必须允许 GitHub 托管的 runner 访问，以便准备步骤能够连接数据库。

部署工作流执行以下步骤：

1. 安装依赖并将前端构建到 `backend/app/frontend`。
2. 运行 `backend/scripts/prestart.sh`，执行数据库迁移并创建初始超级用户。
3. 使用 `uv run fastapi deploy` 部署项目。

## 访问地址

将 `your-app.fastapicloud.dev` 替换为你的 FastAPI Cloud 应用地址。

- 应用（前端和 API）：`https://your-app.fastapicloud.dev`
- 交互式 API 文档：`https://your-app.fastapicloud.dev/docs`

## Docker Compose

如需部署到自己的服务器，请参阅 [Docker Compose 部署指南](./deployment-docker-compose.md)。

## GitHub 仓库自动化

安装以下 GitHub Apps，以启用仓库内置的自动化功能：

* [Latest Changes](https://github.com/apps/latest-changes)：合并拉取请求后更新 `release-notes.md`。
* [PR Push](https://github.com/apps/pr-push)：允许 pre-commit 工作流将自动修复推送到拉取请求分支。
* [PR Submit](https://github.com/apps/pr-submit)：允许 **Bump pre-commit hooks** 和 **Prepare Release** 工作流创建拉取请求。

如需通过 [Smokeshow](https://github.com/samuelcolvin/smokeshow) 发布代码覆盖率，请将 `SMOKESHOW_AUTH_KEY` 添加为仓库密钥。
