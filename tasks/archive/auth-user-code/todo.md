# 任务清单：认证与用户账号体系改造

> 依据 `SPEC.md` 与 `tasks/plan.md`。每完成一项即勾选并运行该任务的验证命令。
> 验证前提：`docker compose up -d db`（后端测试/迁移）；`bun run test` 需后端+数据库运行中。

---

## Task 1：User/Item 主键改用 UUID v7

**描述**：将 `User.id` 与 `Item.id` 的 `default_factory` 从 `uuid.uuid4` 改为 Python 3.14 标准库 `uuid.uuid7`（已验证 3.14.4 可用）。存量 v4 数据不回填，历史迁移文件不动，不新增任何依赖。

**验收标准**：
- [x] `backend/app/models.py` 中 `User` 与 `Item` 的 `id` 均为 `Field(default_factory=uuid.uuid7, primary_key=True)`
- [x] 新建 User 与 Item 的主键满足 `uuid.UUID(str(id)).version == 7`（有测试断言）
- [x] `backend/pyproject.toml` 无新增依赖；历史 Alembic 迁移文件零改动

**验证**：
- [x] 测试通过：`cd backend && uv run pytest`（59 passed，含新增 `tests/test_models.py`）
- [x] lint 通过：`bash backend/scripts/lint.sh`
- [x] 手动检查：`git diff backend/app/alembic/versions/` 为空

**依赖**：无

**文件**：
- `backend/app/models.py`
- `backend/tests/api/routes/test_users.py`（或新建 `backend/tests/test_models.py`）

**规模**：S（2 文件）

---

## Task 2：generate_random_password()

**描述**：在 `backend/app/core/security.py` 新增 `generate_random_password() -> str`，基于 `secrets.token_urlsafe(16)`（产出 ≥16 字符 URL 安全随机串），供任务 3 的重置密码端点使用。

**验收标准**：
- [x] 函数使用 `secrets` 模块，返回长度 ≥16 的字符串
- [x] 有单元测试：长度 ≥16、两次调用结果不同、字符集为 URL 安全
- [x] 不落日志、不落库（纯函数）

**验证**：
- [x] 测试通过：`cd backend && uv run pytest tests/core -q`（3 passed；全量 `uv run pytest -q` 62 passed）
- [x] lint 通过：`bash backend/scripts/lint.sh`（实际以 `cd backend && uv run bash scripts/lint.sh` 在项目 venv 中执行）

**依赖**：无

**文件**：
- `backend/app/core/security.py`
- `backend/tests/core/test_security.py`（新建）

**规模**：XS（2 文件）

---

## Task 3：管理员重置密码端点

**描述**：新增 `POST /api/v1/users/{user_id}/reset-password`（仅超级用户）：生成随机临时密码并写入 `hashed_password`，响应体 `{"new_password": "..."}` 一次性返回。不落明文、不发邮件、不写日志；不新增 `must_change_password`。此端点与 email 无关，先于 Task 4 落地。

**验收标准**：
- [x] `models.py` 新增 `ResetPasswordResponse(new_password: str)`；`routes/users.py` 新增端点（`Depends(get_current_active_superuser)`）
- [x] 目标不存在 → 404；普通用户调用 → 403；对停用用户可重置
- [x] 成功响应含 ≥16 字符临时密码，且用该密码可登录
- [x] 响应之外无明文密码留存（无日志/无邮件）

**验证**：
- [x] 测试通过：`cd backend && uv run pytest backend/tests/api/routes/test_users.py -q`（实际以 `uv run pytest tests/api/routes/test_users.py -q` 执行；31 passed，含 4 个新用例；全量 `uv run pytest -q` 66 passed）
- [x] lint 通过：`bash backend/scripts/lint.sh`（实际以 `cd backend && uv run bash scripts/lint.sh` 在项目 venv 中执行；mypy/ty/ruff 全绿）
- [x] 手动检查：Swagger 中该端点仅超级用户 token 可 200（实际以真实服务 + curl 验证：超级用户 200 且临时密码可登录、普通用户 403、无 token 401、未知 id 404、OpenAPI 已注册 `users-{user_id}-reset-password`；明文密码未落库）

**依赖**：Task 2

**文件**：
- `backend/app/models.py`
- `backend/app/api/routes/users.py`
- `backend/tests/api/routes/test_users.py`

**规模**：S（3 文件）

---

## ✅ 检查点 A：后端地基
- [x] `cd backend && uv run pytest` 全绿（66 passed；本结果在 Task 3 落地后的代码上取得，其后仅 tasks/todo.md 变更，无代码漂移）
- [x] `bash backend/scripts/lint.sh` 通过（mypy / ty / ruff check / ruff format 全绿，同一代码状态）
- [x] Task 1–3 验收标准全部勾选，向人工同步进度（进度同步见会话报告）

---

## Task 4：后端身份置换——user_code 替换 email（原子任务）

**描述**：按 spec §2/§4/§5 完成后端全链路置换。**必须一次性完成**：单一 Alembic 迁移第 4 步删除 `email` 列的瞬间，模型/查询/配置/测试必须全部就位（见 plan.md 决策 1）。按以下子步骤顺序机械执行：

**子步骤（有序）**：
1. `models.py`：`UserBase` 的 `email` → `user_code`（必填、唯一、索引、≤50、去首尾空格、无邮箱格式校验）；删 `UserRegister`、`NewPassword`；`UserUpdate` 删 `email` 加 `user_code`；`UserUpdateMe` 仅剩 `full_name`
2. `crud.py`：`get_user_by_email` → `get_user_by_code` + `get_users_by_full_name`；`authenticate(*, session, identifier, password)` 先编码后姓名、重名抛 `UserAmbiguousIdentifierError`、无命中仍 `verify_password(password, DUMMY_HASH)`、保留 Argon2 重哈希回写
3. `core/config.py`：删 `SMTP_*`/`EMAILS_*`/`emails_enabled`/`EMAIL_RESET_TOKEN_EXPIRE_HOURS`/`EMAIL_TEST_USER` 与 `EmailStr` 导入；`FIRST_SUPERUSER` → `FIRST_SUPERUSER_CODE: str`
4. `core/db.py`：`init_db` 按 `user_code` 查找并用 `FIRST_SUPERUSER_CODE` 创建超级用户
5. `api/routes/login.py`：仅留 `access-token`/`test-token`；删 3 个找回端点与 `app.utils` 导入；无命中 → 统一 `Incorrect user code/name or password`；歧义 → 400 `Multiple users share this name, please log in with your user code`；**OAuth2 表单字段 `username` 与路径不动**
6. `api/routes/users.py`：删 `signup` 路由与邮件发送块；查重 email → 查重 `user_code`（创建冲突 400、更新冲突 409）；保留 Task 3 的 reset-password 端点
7. `api/routes/private.py`：e2e 造数字段 email → user_code
8. `api/main.py`：摘除 `utils` 路由挂载；删除 `app/utils.py`、`app/email-templates/`、`app/api/routes/utils.py`
9. `backend/pyproject.toml`：删 `emails`、`email-validator`；执行 `uv lock && uv sync`
10. 新增 Alembic 迁移（手写 4 步，见 spec §4：加列 nullable → `'u_' || left(id::text,8)` 占位回填 → 非空+唯一索引 `ix_user_user_code` → 删 `ix_user_email` 与 `email` 列；不触碰 `id` 列）
11. `.env`：`FIRST_SUPERUSER=admin@example.com` → `FIRST_SUPERUSER_CODE=admin`（残留 SMTP 键由 `extra="ignore"` 吸收，全量清扫在 Task 8）
12. 测试重写（spec 测试策略）：`conftest.py`、`tests/utils/user.py`（`create_random_user` 生成唯一 user_code）、`tests/utils/utils.py`、`test_login.py`、`test_users.py`、`test_private.py`、`crud/test_user.py`；删密码找回/signup/邮件桩用例；新增：编码登录、唯一姓名登录、重名 400、错误凭据统一信息 + dummy-hash spy 断言、user_code 查重 400/409、重置密码四场景（沿用 Task 3）

**验收标准**：
- [x] `user` 表无 `email` 列；`UserPublic` 不含 email 字段；`grep -rn "email" backend/app backend/tests` 无业务性残留（仅历史 Alembic 迁移文件按「历史迁移零改动」规则保留原文）
- [x] `POST /api/v1/utils/test-email/`、`password-recovery*`、`POST /api/v1/reset-password/` 均 404；`POST /api/v1/users/signup` 为 405（路由已删除，`/users/{user_id}` 模式匹配所致；OpenAPI paths 已确认无 signup），已在测试中断言 404/405 且 OpenAPI 无注册
- [x] backend 依赖中无 `emails`、`email-validator`；`uv.lock` 已同步（diff 纯删除）
- [x] 迁移在空库与含存量 email 数据的库上均可 `alembic upgrade head`；历史迁移文件零改动
- [x] 新建行 id 为 v7、存量行不回填（沿用 Task 1 断言；存量行占位回填 `u_<id前8位>` 已在真实库验证）
- [x] 后端新增测试全部通过且未删除既有用例致覆盖率下降（`bash scripts/test.sh` 的 coverage 口径：70 passed，TOTAL 94%，改动文件除 preexisting 分支外 100%）

**验证**：
- [x] 迁移可重放：对预置 email 数据的库执行 `alembic upgrade head` 后 `user_code` 非空唯一（`ix_user_user_code` UNIQUE btree）
- [x] 测试通过：`cd backend && uv run pytest`（70 passed）
- [x] lint 通过：`bash backend/scripts/lint.sh`（实际以 `cd backend && uv run bash scripts/lint.sh` 执行；mypy/ty/ruff check/ruff format 全绿）
- [x] 手动检查：Swagger OAuth2 用 `admin` + 密码可取 token；`/login/test-token` 行为不变（真实服务 + curl 验证：OAuth2 表单 `username=admin` 200 取 token、test-token 返回 `user_code: admin`、错误凭据统一返回 `Incorrect user code/name or password`）

**依赖**：Task 1、Task 3

**文件**（~16，多为小改/删除）：`backend/app/models.py`、`crud.py`、`core/config.py`、`core/db.py`、`api/main.py`、`api/routes/{login,users,private}.py`、删 `app/utils.py`、`app/email-templates/`、`app/api/routes/utils.py`、`backend/pyproject.toml`、`uv.lock`、新迁移文件、`.env`、`backend/tests/{conftest.py, utils/{user,utils}.py, api/routes/{test_login,test_users,test_private}.py, crud/test_user.py}`

**规模**：L（有意原子化，理由与备选见 plan.md 决策 1 / 开放问题 3）

---

## ✅ 检查点 B：后端就绪
- [x] 空库 + 存量库迁移均可执行；`uv run pytest` 全绿（70 passed）；lint 通过
- [x] 已删除端点均 404（signup 为 405，见 Task 4 注记）；向人工同步进度后再进入前端

---

## Task 5：重生成客户端 + 前端编译级适配

**描述**：后端契约变更后执行一次 `sh scripts/generate-client.sh`，随后修复所有编译强耦合点（生成类型中 email 消失、signup/recover/reset 路由方法消失，TanStack 类型化 Link 指向已删路由）。

**验收标准**：
- [x] `sh scripts/generate-client.sh` 成功；`frontend/src/client/` 仅含生成产物（零手改）
- [x] 删除 `routes/signup.tsx`、`routes/recover-password.tsx`、`routes/reset-password.tsx`（`routeTree.gen.ts` 由 build 重生成）
- [x] `useAuth.ts` 删 `signUpMutation` 与 `UserRegister` 引用；全库无 `UserRegister` 残留
- [x] `Admin/columns.tsx`、`AddUser.tsx`、`EditUser.tsx`：email 字段 → `user_code`（必填、唯一提示）
- [x] `UserSettings/UserInformation.tsx`：user_code 只读展示；`Sidebar/User.tsx` 副标题 full_name（空则 user_code）
- [x] `routes/login.tsx`：单输入框 `data-testid="identifier-input"`（type=text）、占位符「User code or name」、删除 Sign up / Forgot password 链接；zod schema 消息「User code or name is required」

**验证**：
- [x] 契约同步：`sh scripts/generate-client.sh` 成功结束（exit 0，脚本内 lint 一并通过；生成类型无 email/UserRegister/NewPassword，SDK 无 signup/recover/reset 方法、新增 `resetUserPassword` 供 Task 6 使用）
- [x] 构建通过：`bun run --filter frontend build`（同时重生成 routeTree；首次失败为 useAuth 残留 `queryClient` 未用，清理后通过）
- [x] lint 通过：`bun run lint`

**注记**：清单外两个编译/残留耦合点一并修复——`routes/_layout/index.tsx` 问候语 `full_name || email` → `full_name || user_code`（UserPublic 已无 email，属编译强耦合）；`components/Pending/PendingUsers.tsx` 骨架表头 `Email` → `User Code`（Task 9 要求 frontend/src 零 email 残留）。

**依赖**：Task 4

**文件**（~10）：`scripts/generate-client.sh`（执行）、`frontend/src/client/**`（生成）、删 `routes/{signup,recover-password,reset-password}.tsx`、`hooks/useAuth.ts`、`routes/login.tsx`、`components/Admin/{columns,AddUser,EditUser}.tsx`、`components/UserSettings/UserInformation.tsx`、`components/Sidebar/User.tsx`

**规模**：L（编译强耦合成一体的机械适配）

---

## Task 6：管理员「Reset password」弹窗

**描述**：用户管理操作菜单新增「Reset password」：调用 `POST /users/{user_id}/reset-password`，弹窗一次性显示临时密码 + 复制按钮（复用 `useCopyToClipboard`），关闭后不可再查看。

**验收标准**：
- [x] `UserActionsMenu` 新增菜单项（仅超级用户可见的管理页语境；`/admin` 路由 `beforeLoad` 已限超级用户，`UserActionsMenu` 仅被该页 `columns.tsx` 使用）
- [x] 弹窗展示 `new_password`，有复制按钮且可复制成功；关闭/重开不回显旧密码（关闭时 `resetPassword.reset()`；Playwright 真实浏览器断言：剪贴板内容与弹窗一致、重开仅显确认态）
- [x] 请求失败（403/404）走既有 `handleError` toast（`onError: handleError.bind(showErrorToast)`；404 实测返回 `{"detail":"User not found"}`）

**验证**：
- [x] 构建通过：`bun run --filter frontend build`
- [x] lint 通过：`bun run lint`
- [x] 手动检查：dev 环境重置任意用户 → 弹窗显示、复制、用临时密码可登录（真实栈 uvicorn:8000 + 内置构建前端 + Playwright：弹窗显示 22 字符临时密码、复制按钮剪贴板断言一致、关闭重开不回显、登出后以临时密码经 UI 登录成功；另以 curl 实测：超级用户重置 200、旧密码登录 400、二次重置新密码可用）

**依赖**：Task 5（依赖生成客户端中的 `resetUserPassword` 方法）

**文件**：
- `frontend/src/components/Admin/UserActionsMenu.tsx`
- `frontend/src/components/Admin/ResetPasswordDialog.tsx`（新建）

**规模**：S（2 文件）

---

## Task 7：Playwright e2e 重写

**描述**：同步前端测试至新账号体系：登录标识、`FIRST_SUPERUSER_CODE`、删除 signup/重置密码/mailpit 用例、新增管理员重置密码全流程 e2e。

**验收标准**：
- [x] 删除 `tests/sign-up.spec.ts`、`tests/reset-password.spec.ts`、`tests/utils/mailpit.ts`
- [x] `config.ts` 读 `FIRST_SUPERUSER_CODE`；`auth.setup.ts` 用 `getByTestId("identifier-input")` 登录
- [x] `utils/random.ts` 提供 `randomUserCode()`；`utils/user.ts`、`utils/privateApi.ts` 去 email（`signUpNewUser` 已删；`randomEmail` 已随最后消费者移除，`grep -rin -e email -e smtp -e mailpit frontend/tests` 零残留）
- [x] `login.spec.ts`（编码/姓名登录、统一错误信息）、`admin.spec.ts`（建号含 user_code；重置密码弹窗流程）、`user-settings.spec.ts`、`items.spec.ts` 通过（login 11、admin 15、settings+items 21 分别实测）
- [x] 新增 e2e：管理员重置密码 → 弹窗显示临时密码 → 登出 → 用临时密码登录成功（断言 ≥16 字符、剪贴板与弹窗一致；关弹窗用 Escape——页脚 Close 与 Radix 内置 X 按钮都可访问名相同致 strict mode 冲突）

**验证**：
- [x] e2e 通过：`bun run test`（45 passed，真实栈：容器 db + `uv run fastapi dev` :8000 + Playwright 自启 vite；无需 Mailpit；首跑需 `bunx playwright install chromium`）
- [x] lint 通过：`bun run lint`

**依赖**：Task 5、Task 6

**文件**（~12，多为删除/机械改写）：`tests/{config.ts, auth.setup.ts, login.spec.ts, admin.spec.ts, user-settings.spec.ts, items.spec.ts}`、删 `tests/{sign-up.spec.ts, reset-password.spec.ts, utils/mailpit.ts}`、`tests/utils/{random.ts, user.ts, privateApi.ts}`

**注记**：admin「Edit a user successfully」改用随机唯一姓名并按行断言——e2e 库跨次运行累积用户，固定文案「Updated Name」会命中多行触发 strict mode violation。

**规模**：M

---

## ✅ 检查点 C：前端就绪
- [x] `bun run lint` 与 `bun run --filter frontend build` 通过（build 于 Task 7 收尾复跑 exit 0；`tsconfig.build.json` 排除 tests，e2e 改写不影响产物）
- [x] `bun run test` 全绿（45 passed）
- [x] 手动冒烟通过，向人工同步进度（人工已确认）

---

## Task 8：基建 / CI / 文档 / 依赖工作区 email 清扫（可与 Phase 3 并行）

**描述**：代码之外的全量 email·SMTP·Mailpit 清除（spec §5 配置/CI/工作区/文档条目）。

**验收标准**：
- [x] `.env` 删 `SMTP_*`/`EMAILS_*` 块；`compose.yml`/`compose.override.yml`/`compose.deploy.yml` 删 mailpit 服务、SMTP/EMAILS 变量、`MAILPIT_HOST`（`compose.deploy.yml` 本无 mailpit/SMTP/EMAILS 引用，grep 确认零改动；注记①②）
- [x] CI：`test-backend.yml` 改 `--wait db`；`deploy-docker-compose.yml` 删 `SMTP_*`/`EMAILS_FROM_EMAIL` 透传；`deploy.yml` 的 `FIRST_SUPERUSER` → `FIRST_SUPERUSER_CODE`（注记③）
- [x] 删 `packages/react-email/`；根 `package.json` 删 `email:dev`/`email:export`；`.pre-commit-config.yaml` 删 email-templates 排除项（`bun.lock` 随 `bun install` 同步移除 `emails` workspace，注记④）
- [x] 文档：`README.md`、`development.md`（Mailpit 节）、`deployment.md`、`deployment-docker-compose.md`（SMTP/EMAILS 变量节）、`backend/README.md`（Email Templates 节）；`FIRST_SUPERUSER_CODE` 语义同步
- [x] `release-notes.md` 不动（上游历史，`git log` 确认零提交触碰）

**验证**：
- [x] `docker compose config` 三个 compose 文件均合法（`docker compose config --quiet`：单文件、+override、+deploy 各一次通过）
- [x] `grep -rin -e smtp -e mailpit .env compose*.yml .github/workflows *.md backend/README.md` 仅剩允许残留（`release-notes.md` 上游历史；`SPEC.md` 为本次改造规格文本自身，注记⑤）
- [x] `bun install` 后 `bun run --filter frontend build` 仍通过（exit 0）

**注记**：
- ① 清单外补刀：`compose.yml`/`compose.override.yml` 的 `FIRST_SUPERUSER` → `FIRST_SUPERUSER_CODE`（Task 4 改名后 `:?Variable not set` 守卫会使 `docker compose config` 直接失败，属本任务验证命令的必要耦合）；`frontend/.env` 删 `MAILPIT_HOST`（消费方已随 Task 7 删除）。
- ② `deploy-docker-compose.yml` 的 `FIRST_SUPERUSER` 透传同步改为 `FIRST_SUPERUSER_CODE`（compose.yml backend 环境变量改名后的必要耦合），否则 compose 部署链路断裂。
- ③ 清单外发现（未动）：`compose.yml` backend healthcheck 仍探测 `/api/v1/utils/health-check/`，该端点已随 Task 4 删除 utils 路由而 404，容器会标记 unhealthy（不影响 `docker compose config` 与普通 `up -d`，影响 `up -d --wait` 语义）。建议后续任务处理（改探测路径或补轻量 health 路由）。
- ④ 清单外发现（未动）：`img/react-email.png`、`img/mailpit.png` 已无任何引用（随 README 截图节删除而成孤儿），可选清理。
- ⑤ 允许残留口径：`release-notes.md`（上游历史，明确不动）+ `SPEC.md`（规格文本描述删除范围，非活文档；Task 9 残留扫描口径亦不含它）。

**依赖**：Task 4（`.env` 最小改名已就位）

**文件**（~14，配置/文档）：`.env`、`compose.yml`、`compose.override.yml`、`compose.deploy.yml`（零改动，grep 确认无引用）、`.github/workflows/{test-backend,deploy-docker-compose,deploy}.yml`、`package.json`、`.pre-commit-config.yaml`、`bun.lock`（`bun install` 再生成）、删 `packages/react-email/`、`frontend/.env`（清单外，注记①）、`README.md`、`development.md`、`deployment.md`、`deployment-docker-compose.md`、`backend/README.md`

**规模**：M

---

## Task 9：全量验证 + Success Criteria 核对

**描述**：以 spec「整体」验收口径做最终校验，并逐条核对 Success Criteria A–E。

**验收标准**：
- [x] `sh scripts/test.sh`（全栈 CI 同款）全绿（注记①：脚本 build + 空库 prestart 迁移段全绿；其容器内 pytest 段系上游模板缺陷无法收集 `tests/`，已改以 CI 工作流 `test-backend.yml` 同款命令序列执行：70 passed、coverage 94% 且过 `--fail-under=90` 闸）
- [x] `bun run test` 全绿（45 passed）；`bash backend/scripts/lint.sh`（mypy/ty/ruff 全绿，17 文件）与 `bun run lint`（70 文件）通过
- [x] `sh scripts/generate-client.sh` 复跑后 `git diff` 为空（契约零漂移；exit 0，`git status` 干净）
- [x] 残留扫描：`grep -rin -e email -e smtp -e mailpit` 于 `backend/app`、`backend/tests`、`frontend/src`、`frontend/tests`、`compose*.yml`、`.github/workflows`、`.env`、活文档 —— 仅剩允许残留（注记②：CI `git config user.email`、`release-notes.md`、受「历史迁移零改动」保护的历史 Alembic 迁移文件；git-ignored 构建产物排除）
- [x] 未新增任何第三方依赖（`git diff backend/pyproject.toml` 仅删除 `email-validator`、`emails` 两行）
- [x] 手动：Swagger OAuth2（编码登录）可用；`/login/test-token` 正常（curl 实测：`admin` 取 JWT、test-token 返回 `user_code: admin`、错误凭据统一 `Incorrect user code/name or password`）
- [x] Success Criteria A–E 逐条勾选；更新本清单状态（逐条证据见下方核对记录；SPEC.md 按惯例保持零改动）

**验证**：
- [x] 以上命令全部实际执行通过（注记③）

**Success Criteria A–E 核对记录**（逐条实测）：

- **A 登录改造**：满足 —— `login.tsx` 单输入框 `data-testid="identifier-input"`、零 Email/Sign up/Forgot 残留（grep）；编码登录、唯一姓名登录、重名 400、统一错误信息 + dummy-hash spy 均有路由级测试（70 passed 内）；`POST /login/access-token` 路径与 OAuth2 表单形状未动（curl 实测取 token）；JWT sub=user.id、`test-token` 行为不变（curl 返回 `user_code: admin`）。
- **B Email 全部移除**：满足 —— 活代码扫描仅历史迁移文件 + CI `git config user.email`（注记②）；`/api/v1/utils/test-email/`、`password-recovery*`、`/api/v1/reset-password/` 均 404（curl 实测）；`user` 表列清单实测无 `email` 列、`UserPublic` 无 email 字段；`emails`/`email-validator` 已从 pyproject 删除（注记④）；`packages/react-email/` 不存在；compose 无 mailpit；`generate-client.sh` 复跑零漂移。
- **C 注册移除**：满足 —— OpenAPI 实测 10 条 path 中无 signup；`/api/v1/users/signup` 404（curl 实测）；`routes/` 无 signup 页面、`routeTree.gen.ts` 无 signup；`useAuth`/`UserRegister` 全库零残留（grep）；登录页无 Sign up 入口。
- **D 管理员重置密码**：满足 —— superuser 重置 200 返回 22 字符临时密码且该密码可登录（curl 实测 200）；普通用户 403、目标不存在 404（curl 实测）；响应外无明文留存（tests 断言）；前端弹窗 + 复制见 Task 6 与 `admin.spec.ts` e2e；`must_change_password` 在 models.py 中 0 次出现（grep）；ChangePassword 行为不变（`user-settings.spec.ts` e2e 通过）。
- **E UUID v7**：满足 —— 新建行 id 实测 `version==7`（admin `01a1edfc-…-715d`、本次新建 `…-76e6`）且有 `tests/test_models.py` 断言；存量不回填、历史迁移零改动（`git diff 9871a59` 对 `alembic/versions/` 仅新增 `7125f2112706`）；未为此新增任何第三方依赖。

**注记**：
- ① 根目录 `scripts/test.sh` 的容器内 pytest 段为上游模板缺陷：`backend/Dockerfile`（与基线逐字相同，本项目零改动）从不 COPY `backend/tests` 进镜像，`docker compose exec backend tests-start.sh` 报 `file or directory not found: tests/`；本仓库 CI（`test-backend.yml`）并不调用该脚本，而是宿主侧 `uv run bash scripts/prestart.sh` + `uv run bash scripts/tests-start.sh`。本任务按该 CI 序列原样执行全绿，且根脚本可执行部分（`docker compose build` 双镜像构建、空库 `down -v → prestart` 全量迁移重放）亦实测通过。修复该脚本属上游问题，未纳入本次改动范围。
- ② 残留扫描口径：排除 git-ignored 生成物（`backend/app/frontend/` 为 vite `outDir` 构建产物、`__pycache__`）；活代码中仅剩三类命中 —— 历史 Alembic 迁移文件 3 个（受「历史迁移文件一律不改」Never 规则保护，Task 4 验收时已接受）、CI `git config user.email`（清单明示允许）、`release-notes.md`（上游历史，明示允许）。
- ③ e2e 与手动检查在真实栈上执行：容器 db + 宿主 `uv run fastapi dev`；因宿主 8000 端口被一无关进程占用，后端临时改用 8001 并以 shell 环境变量 `VITE_API_URL=http://localhost:8001` 覆盖（私有 API 调用与浏览器端均读取该变量，`frontend/tests/utils/privateApi.ts` 与 `frontend/src/main.tsx` 皆 env 驱动），零文件改动；验证后已恢复原状（临时服务/中继容器已清理）。
- ④ 观察项（非缺陷）：镜像构建日志显示 `email-validator==2.3.0` 仍经 `fastapi[standard]` extra 传递安装；`pyproject.toml` 直接依赖已按 spec 删除，验收口径（直接依赖 diff 纯删除）不受影响。
- ⑤ 后端测试套件运行会清空 `user` 表（conftest 清理行为），e2e/手动检查前需重跑 `initial_data`（本次已执行）；此为模板既有行为，非本次改动引入。

**依赖**：Task 7、Task 8（及其余全部）

**文件**：无新增（仅更新 `tasks/todo.md` 勾选状态）

**规模**：XS

---

## ✅ 检查点：完成
- [x] `sh scripts/test.sh` 全绿；`bun run test` 全绿；两端 lint 通过（CI 同款序列 70 passed + coverage 94%；e2e 45 passed；注记见 Task 9）
- [x] Success Criteria A–E 全部勾选（逐条实测证据见 Task 9 核对记录）
- [x] 向人工提交验收总结（验收总结见会话报告）
