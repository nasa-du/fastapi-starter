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
- [ ] `models.py` 新增 `ResetPasswordResponse(new_password: str)`；`routes/users.py` 新增端点（`Depends(get_current_active_superuser)`）
- [ ] 目标不存在 → 404；普通用户调用 → 403；对停用用户可重置
- [ ] 成功响应含 ≥16 字符临时密码，且用该密码可登录
- [ ] 响应之外无明文密码留存（无日志/无邮件）

**验证**：
- [ ] 测试通过：`cd backend && uv run pytest backend/tests/api/routes/test_users.py -q`
- [ ] lint 通过：`bash backend/scripts/lint.sh`
- [ ] 手动检查：Swagger 中该端点仅超级用户 token 可 200

**依赖**：Task 2

**文件**：
- `backend/app/models.py`
- `backend/app/api/routes/users.py`
- `backend/tests/api/routes/test_users.py`

**规模**：S（3 文件）

---

## ✅ 检查点 A：后端地基
- [ ] `cd backend && uv run pytest` 全绿
- [ ] `bash backend/scripts/lint.sh` 通过
- [ ] Task 1–3 验收标准全部勾选，向人工同步进度

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
- [ ] `user` 表无 `email` 列；`UserPublic` 不含 email 字段；`grep -rn "email" backend/app backend/tests` 无业务性残留
- [ ] `POST /api/v1/utils/test-email/`、`password-recovery*`、`POST /api/v1/users/signup` 均 404
- [ ] backend 依赖中无 `emails`、`email-validator`；`uv.lock` 已同步
- [ ] 迁移在空库与含存量 email 数据的库上均可 `alembic upgrade head`；历史迁移文件零改动
- [ ] 新建行 id 为 v7、存量行不回填（沿用 Task 1 断言）
- [ ] 后端新增测试全部通过且未删除既有用例致覆盖率下降（`bash scripts/test.sh` 的 coverage 口径）

**验证**：
- [ ] 迁移可重放：对预置 email 数据的库执行 `alembic upgrade head` 后 `user_code` 非空唯一
- [ ] 测试通过：`cd backend && uv run pytest`
- [ ] lint 通过：`bash backend/scripts/lint.sh`
- [ ] 手动检查：Swagger OAuth2 用 `admin` + 密码可取 token；`/login/test-token` 行为不变

**依赖**：Task 1、Task 3

**文件**（~16，多为小改/删除）：`backend/app/models.py`、`crud.py`、`core/config.py`、`core/db.py`、`api/main.py`、`api/routes/{login,users,private}.py`、删 `app/utils.py`、`app/email-templates/`、`app/api/routes/utils.py`、`backend/pyproject.toml`、`uv.lock`、新迁移文件、`.env`、`backend/tests/{conftest.py, utils/{user,utils}.py, api/routes/{test_login,test_users,test_private}.py, crud/test_user.py}`

**规模**：L（有意原子化，理由与备选见 plan.md 决策 1 / 开放问题 3）

---

## ✅ 检查点 B：后端就绪
- [ ] 空库 + 存量库迁移均可执行；`uv run pytest` 全绿；lint 通过
- [ ] 已删除端点均 404；向人工同步进度后再进入前端

---

## Task 5：重生成客户端 + 前端编译级适配

**描述**：后端契约变更后执行一次 `sh scripts/generate-client.sh`，随后修复所有编译强耦合点（生成类型中 email 消失、signup/recover/reset 路由方法消失，TanStack 类型化 Link 指向已删路由）。

**验收标准**：
- [ ] `sh scripts/generate-client.sh` 成功；`frontend/src/client/` 仅含生成产物（零手改）
- [ ] 删除 `routes/signup.tsx`、`routes/recover-password.tsx`、`routes/reset-password.tsx`（`routeTree.gen.ts` 由 build 重生成）
- [ ] `useAuth.ts` 删 `signUpMutation` 与 `UserRegister` 引用；全库无 `UserRegister` 残留
- [ ] `Admin/columns.tsx`、`AddUser.tsx`、`EditUser.tsx`：email 字段 → `user_code`（必填、唯一提示）
- [ ] `UserSettings/UserInformation.tsx`：user_code 只读展示；`Sidebar/User.tsx` 副标题 full_name（空则 user_code）
- [ ] `routes/login.tsx`：单输入框 `data-testid="identifier-input"`（type=text）、占位符「User code or name」、删除 Sign up / Forgot password 链接；zod schema 消息「User code or name is required」

**验证**：
- [ ] 契约同步：`sh scripts/generate-client.sh` 成功结束
- [ ] 构建通过：`bun run --filter frontend build`（同时重生成 routeTree）
- [ ] lint 通过：`bun run lint`

**依赖**：Task 4

**文件**（~10）：`scripts/generate-client.sh`（执行）、`frontend/src/client/**`（生成）、删 `routes/{signup,recover-password,reset-password}.tsx`、`hooks/useAuth.ts`、`routes/login.tsx`、`components/Admin/{columns,AddUser,EditUser}.tsx`、`components/UserSettings/UserInformation.tsx`、`components/Sidebar/User.tsx`

**规模**：L（编译强耦合成一体的机械适配）

---

## Task 6：管理员「Reset password」弹窗

**描述**：用户管理操作菜单新增「Reset password」：调用 `POST /users/{user_id}/reset-password`，弹窗一次性显示临时密码 + 复制按钮（复用 `useCopyToClipboard`），关闭后不可再查看。

**验收标准**：
- [ ] `UserActionsMenu` 新增菜单项（仅超级用户可见的管理页语境）
- [ ] 弹窗展示 `new_password`，有复制按钮且可复制成功；关闭/重开不回显旧密码
- [ ] 请求失败（403/404）走既有 `handleError` toast

**验证**：
- [ ] 构建通过：`bun run --filter frontend build`
- [ ] lint 通过：`bun run lint`
- [ ] 手动检查：dev 环境重置任意用户 → 弹窗显示、复制、用临时密码可登录

**依赖**：Task 5（依赖生成客户端中的 `resetUserPassword` 方法）

**文件**：
- `frontend/src/components/Admin/UserActionsMenu.tsx`
- `frontend/src/components/Admin/ResetPasswordDialog.tsx`（新建）

**规模**：S（2 文件）

---

## Task 7：Playwright e2e 重写

**描述**：同步前端测试至新账号体系：登录标识、`FIRST_SUPERUSER_CODE`、删除 signup/重置密码/mailpit 用例、新增管理员重置密码全流程 e2e。

**验收标准**：
- [ ] 删除 `tests/sign-up.spec.ts`、`tests/reset-password.spec.ts`、`tests/utils/mailpit.ts`
- [ ] `config.ts` 读 `FIRST_SUPERUSER_CODE`；`auth.setup.ts` 用 `getByTestId("identifier-input")` 登录
- [ ] `utils/random.ts` 提供 `randomUserCode()`；`utils/user.ts`、`utils/privateApi.ts` 去 email
- [ ] `login.spec.ts`（编码/姓名登录、统一错误信息）、`admin.spec.ts`（建号含 user_code；重置密码弹窗流程）、`user-settings.spec.ts`、`items.spec.ts` 通过
- [ ] 新增 e2e：管理员重置密码 → 弹窗显示临时密码 → 登出 → 用临时密码登录成功

**验证**：
- [ ] e2e 通过：`bun run test`（需 backend + db 运行中，无需 Mailpit）
- [ ] lint 通过：`bun run lint`

**依赖**：Task 5、Task 6

**文件**（~12，多为删除/机械改写）：`tests/{config.ts, auth.setup.ts, login.spec.ts, admin.spec.ts, user-settings.spec.ts, items.spec.ts}`、删 `tests/{sign-up.spec.ts, reset-password.spec.ts, utils/mailpit.ts}`、`tests/utils/{random.ts, user.ts, privateApi.ts}`

**规模**：M

---

## ✅ 检查点 C：前端就绪
- [ ] `bun run lint` 与 `bun run --filter frontend build` 通过
- [ ] `bun run test` 全绿
- [ ] 手动冒烟通过，向人工同步进度

---

## Task 8：基建 / CI / 文档 / 依赖工作区 email 清扫（可与 Phase 3 并行）

**描述**：代码之外的全量 email·SMTP·Mailpit 清除（spec §5 配置/CI/工作区/文档条目）。

**验收标准**：
- [ ] `.env` 删 `SMTP_*`/`EMAILS_*` 块；`compose.yml`/`compose.override.yml`/`compose.deploy.yml` 删 mailpit 服务、SMTP/EMAILS 变量、`MAILPIT_HOST`
- [ ] CI：`test-backend.yml` 改 `--wait db`；`deploy-docker-compose.yml` 删 `SMTP_*`/`EMAILS_FROM_EMAIL` 透传；`deploy.yml` 的 `FIRST_SUPERUSER` → `FIRST_SUPERUSER_CODE`
- [ ] 删 `packages/react-email/`；根 `package.json` 删 `email:dev`/`email:export`；`.pre-commit-config.yaml` 删 email-templates 排除项
- [ ] 文档：`README.md`、`development.md`（Mailpit 节）、`deployment.md`、`deployment-docker-compose.md`（SMTP/EMAILS 变量节）、`backend/README.md`（Email Templates 节）；`FIRST_SUPERUSER_CODE` 语义同步
- [ ] `release-notes.md` 不动（上游历史）

**验证**：
- [ ] `docker compose config` 三个 compose 文件均合法
- [ ] `grep -rin -e smtp -e mailpit .env compose*.yml .github/workflows *.md backend/README.md` 仅剩允许残留（CI 的 `git config user.email`、`release-notes.md`）
- [ ] `bun install` 后 `bun run --filter frontend build` 仍通过

**依赖**：Task 4（`.env` 最小改名已就位）

**文件**（~12，配置/文档）：`.env`、`compose.yml`、`compose.override.yml`、`compose.deploy.yml`、`.github/workflows/{test-backend,deploy-docker-compose,deploy}.yml`、`package.json`、`.pre-commit-config.yaml`、删 `packages/react-email/`、`README.md`、`development.md`、`deployment.md`、`deployment-docker-compose.md`、`backend/README.md`

**规模**：M

---

## Task 9：全量验证 + Success Criteria 核对

**描述**：以 spec「整体」验收口径做最终校验，并逐条核对 Success Criteria A–E。

**验收标准**：
- [ ] `sh scripts/test.sh`（全栈 CI 同款）全绿
- [ ] `bun run test` 全绿；`bash backend/scripts/lint.sh` 与 `bun run lint` 通过
- [ ] `sh scripts/generate-client.sh` 复跑后 `git diff` 为空（契约零漂移）
- [ ] 残留扫描：`grep -rin -e email -e smtp -e mailpit` 于 `backend/app`、`backend/tests`、`frontend/src`、`frontend/tests`、`compose*.yml`、`.github/workflows`、`.env`、活文档 —— 仅允许 CI `git config user.email` 与 `release-notes.md`
- [ ] 未新增任何第三方依赖（`git diff backend/pyproject.toml` 仅删除）
- [ ] 手动：Swagger OAuth2（编码登录）可用；`/login/test-token` 正常
- [ ] Success Criteria A–E 逐条勾选；更新本清单状态

**验证**：
- [ ] 以上命令全部实际执行通过

**依赖**：Task 7、Task 8（及其余全部）

**文件**：无新增（仅更新 `tasks/todo.md` 勾选状态）

**规模**：XS

---

## ✅ 检查点：完成
- [ ] `sh scripts/test.sh` 全绿；`bun run test` 全绿；两端 lint 通过
- [ ] Success Criteria A–E 全部勾选
- [ ] 向人工提交验收总结
