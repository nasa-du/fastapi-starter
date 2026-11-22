# 开发指南

## 本地开发

本地开发时，使用 Docker Compose 运行 PostgreSQL，在本机分别运行 FastAPI 和 Vite 开发服务器。

在项目根目录启动数据库：

```bash
docker compose up -d db
```

然后进入 `backend/` 目录，安装依赖并准备数据库。`prestart.sh` 会执行数据库迁移，并根据 `FIRST_SUPERUSER_CODE` 与 `FIRST_SUPERUSER_PASSWORD` 创建初始超级用户：

```bash
cd backend
uv sync
uv run bash scripts/prestart.sh
```

启动 FastAPI 开发服务器：

```bash
uv run fastapi dev
```

另开一个终端，在项目根目录安装前端依赖并启动 Vite：

```bash
bun install
bun run dev
```

现在可以访问：

- 前端开发服务器：<http://localhost:5173>
- 后端 API：<http://localhost:8000>
- Swagger UI 交互式 API 文档：<http://localhost:8000/docs>

前端开发服务器按照 `frontend/.env` 的配置使用 `http://localhost:8000` 上的后端。

### 由 FastAPI 托管前端

在 `frontend/` 目录构建前端：

```bash
bun run build
```

也可以在项目根目录执行等价命令 `bun run --filter frontend build`。构建产物写入 `backend/app/frontend`，由 FastAPI 在 <http://localhost:8000> 托管。修改前端后需要重新构建。

### 测试与客户端同步

后端测试需要 PostgreSQL 已启动；在 `backend/` 目录执行：

```bash
uv run pytest
uv run bash scripts/test.sh
uv run bash scripts/lint.sh
```

其中 `uv run pytest` 用于快速测试，`uv run bash scripts/test.sh` 运行带覆盖率报告的 CI 同款测试，`uv run bash scripts/lint.sh` 执行 mypy、ty、ruff 检查及格式检查。

前端命令在项目根目录执行：

```bash
bun run lint
bun run --filter frontend build
bun run test
bun run test:ui
```

`bun run test` 是 Playwright 端到端测试，会自动拉起前端开发服务器，但要求后端和数据库已经运行。`bun run test:ui` 使用 Playwright UI 模式。

后端模型或路由变更后，必须同步前端客户端：

```bash
sh scripts/generate-client.sh
```

该脚本导出 `openapi.json`、重新生成 `frontend/src/client/` 并执行前端 lint。不要手工编辑生成文件。

## 使用 Docker Compose 运行全栈

使用 Docker Compose 运行后端和已构建的前端：

```bash
docker compose run --rm backend bash scripts/prestart.sh
docker compose watch
```

现在可以访问：

- 应用（前端与 API 均由 FastAPI 托管）：<http://localhost:8000>
- Swagger UI 交互式 API 文档：<http://localhost:8000/docs>
- Adminer 数据库管理界面：<http://localhost:8080>
- Traefik UI（查看代理路由）：<http://localhost:8090>

启动 Compose 后端前，先停止本机运行的 FastAPI 服务，因为两者都使用 `8000` 端口。

**注意**：首次启动整个技术栈时，所有服务就绪可能需要约一分钟。可使用 `docker compose logs` 查看全部日志，或使用 `docker compose logs backend` 仅查看后端日志。

## Docker Compose 文件与环境变量

主配置文件 `compose.yml` 包含整个技术栈共享的配置，Docker Compose 会自动加载。

`compose.override.yml` 添加本地开发配置，例如通过 `develop.watch` 将后端源码同步到容器，并在前端或依赖文件变化时重建镜像。Docker Compose 也会自动加载该文件，并将其叠加到 `compose.yml` 之上。

`compose.deploy.yml` 包含部署专用配置，包括 HTTPS 和自动证书处理。部署时需显式将它与 `compose.yml` 组合使用。

后端从 `.env` 文件读取本地配置。Docker Compose 同样使用该文件插值，并将各容器所需的配置传入容器。

修改环境变量后，重新启动技术栈：

```bash
docker compose watch
```

## `.env` 文件

仓库跟踪的 `.env` 文件包含本地开发默认值、密码和其他配置。对于直接在本机运行的进程，其中的主机名使用 `localhost`。在 Docker Compose 中，数据库等主机名会被替换为对应的 Compose 服务名。

不要在 `.env` 中存放部署密钥。请按照 [FastAPI Cloud 部署指南](./deployment.md) 或 [Docker Compose 部署指南](./deployment-docker-compose.md) 配置部署密钥。

## Git 钩子与代码检查

项目使用 [prek](https://prek.j178.dev/) 进行代码检查与格式化，它是 [pre-commit](https://pre-commit.com/) 的现代替代方案。

配置文件为项目根目录的 `.pre-commit-config.yaml`，包含拼写检查、格式检查及项目检查命令。

### 安装 prek 自动运行

`prek` 已包含在项目依赖中。

在项目根目录安装 Git 钩子，使 `prek` 在每次提交前自动运行：

```bash
uv run prek install -f
```

如果之前安装过 `pre-commit` 钩子，`-f` 参数会强制覆盖安装。

之后每次执行提交，例如：

```bash
git commit
```

`prek` 都会检查并格式化即将提交的代码。如果它修改了文件，请先将这些文件重新加入 Git 暂存区，再提交。

### 手动运行 prek

也可以在项目根目录对全部文件手动运行：

```bash
uv run prek run --all-files
```
