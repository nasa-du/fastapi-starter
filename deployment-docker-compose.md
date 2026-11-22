# Docker Compose 部署指南

你可以使用 Docker Compose 将项目部署到自己的远程服务器。部署配置包含 Traefik，用于处理 HTTPS 并将传入流量路由到应用。

## 准备工作

* 准备一台可访问的远程服务器。
* 配置 DNS 记录，将应用域名及需要公开的辅助服务子域名指向服务器，例如 `fastapi-project.example.com` 和 `adminer.fastapi-project.example.com`。
* 在远程服务器上安装并配置 [Docker](https://docs.docker.com/engine/install/)（Docker Engine，而非 Docker Desktop）。

## 复制代码

```bash
rsync -av --exclude=".git/" --filter=":- .gitignore" ./ root@your-server.example.com:/root/code/app/
```

`--filter=":- .gitignore"` 参数让 `rsync` 使用与 Git 相同的忽略规则，从而排除 Python 虚拟环境等文件。

## 配置应用

### 环境变量

设置应用域名、项目名称和初始超级用户的用户编码：

```bash
export DOMAIN=fastapi-project.example.com
export PROJECT_NAME="Full Stack FastAPI Project"
export FIRST_SUPERUSER_CODE=admin
```

还可以根据需要配置以下环境变量：

* `SENTRY_DSN`：Sentry 的 DSN。

### 密钥

生成并设置数据库密码、令牌签名密钥和初始超级用户密码的安全随机值：

```bash
export POSTGRES_PASSWORD="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
export SECRET_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
export FIRST_SUPERUSER_PASSWORD="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
```

## 部署

```bash
cd /root/code/app/
docker compose -f compose.yml -f compose.deploy.yml build
docker compose -f compose.yml -f compose.deploy.yml run --rm backend bash scripts/prestart.sh
docker compose -f compose.yml -f compose.deploy.yml up -d
```

`compose.deploy.yml` 在共享的 `compose.yml` 配置上添加 HTTPS 和自动证书处理。显式列出这两个文件，可以排除 `compose.override.yml` 中的本地开发配置。

后端 Docker 镜像会构建前端，因此服务器无需安装 Bun，也无需预先准备前端构建产物。

`prestart.sh` 会执行数据库迁移，并根据 `FIRST_SUPERUSER_CODE` 与 `FIRST_SUPERUSER_PASSWORD` 创建初始超级用户。账号不开放自注册，后续用户由管理员在用户管理中创建。

## 使用 GitHub Actions 部署

内置的 `.github/workflows/deploy-docker-compose.yml` 工作流会在 GitHub Actions 中手动触发时，在服务器上运行部署命令。

只对贡献者及工作流代码均可信的仓库使用自托管 runner。GitHub 建议将自托管 runner 用于私有仓库，因为工作流会直接在 runner 所在的机器上执行。

### 配置仓库变量与密钥

在仓库中打开 **Settings** > **Secrets and variables** > **Actions**，添加以下仓库变量：

* `DOMAIN`
* `PROJECT_NAME`
* `FIRST_SUPERUSER_CODE`

如需启用 Sentry，可添加 `SENTRY_DSN` 仓库变量。

添加以下仓库密钥：

* `POSTGRES_PASSWORD`
* `SECRET_KEY`
* `FIRST_SUPERUSER_PASSWORD`

### 安装自托管 runner

在服务器上创建专用用户并授予 Docker 访问权限：

```bash
sudo adduser github
sudo usermod -aG docker github
sudo su - github
```

在 GitHub 仓库中打开 **Settings** > **Actions** > **Runners**，选择 **New self-hosted runner**，选择 Linux，然后按照 GitHub 提供的命令下载、配置并注册 runner。将其安装在 `/home/github/actions-runner`。

注册 runner 后，退出 `github` 用户会话，并将 runner 安装为系统服务：

```bash
exit
cd /home/github/actions-runner
sudo ./svc.sh install github
sudo ./svc.sh start
sudo ./svc.sh status
```

请参阅 GitHub 的[添加自托管 runner](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners) 和[将 runner 配置为服务](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/configure-the-application?platform=linux) 指南。

### 运行部署

runner 上线后，打开仓库的 **Actions** 标签页，选择 **Deploy with Docker Compose**，再选择 **Run workflow**。

## 访问地址

将 `fastapi-project.example.com` 替换为你的域名。

- 应用（前端和 API）：`https://fastapi-project.example.com`
- 交互式 API 文档：`https://fastapi-project.example.com/docs`
- Adminer：`https://adminer.fastapi-project.example.com`
