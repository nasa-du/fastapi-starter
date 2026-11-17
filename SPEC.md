# Spec: 认证与用户账号体系改造

> 状态：待人工评审
> 范围决策：五项改动共享同一 `User` 数据模型与消费者，作为单一能力域处理（无 capability map），验收标准按 A–E 分区。

## Objective

把模板的「Email + 密码」账号体系改造成「用户编码/姓名 + 密码」的内部账号体系，并收口账号生命周期：

1. **登录**：登录标识改为「用户编码（user_code）或姓名（full_name）」+ 密码，单个输入框，先按编码匹配、再按姓名匹配。
2. **移除 Email**：删除全部邮件相关功能与组件（SMTP 配置、Mailpit、react-email 包、邮件模板、test-email 接口、文档/CI 引用、`emails`/`email-validator` 依赖）。
3. **移除注册**：删除自注册入口（`POST /users/signup`、`/signup` 页面），账号一律由管理员创建。
4. **忘记密码 → 管理员重置**：删除邮件 token 找回密码流程；管理员在用户管理中重置密码，后端生成随机临时密码，前端弹窗一次性显示；**不**强制用户首次登录改密。
5. **UUID v7**：`User.id`、`Item.id` 新建数据改用 `uuid.uuid7()`（Python 3.14 内置，无新依赖）；存量 v4 数据不回填。

**用户故事**

- 作为用户，我用我的用户编码（或姓名，若唯一）+ 密码登录系统。
- 作为用户，我忘记密码时联系管理员，由管理员重置并线下告知我临时密码。
- 作为管理员，我在用户管理页创建用户（编码、姓名、密码），无需邮件通知。
- 作为管理员，我对任意用户一键重置密码，系统显示随机临时密码供我复制。
- 作为管理员，系统初始超级用户由 `FIRST_SUPERUSER_CODE` 环境变量配置。

**不在范围内**

- 强制改密流程（`must_change_password`）
- 界面中文化（沿用模板英文文案）
- 其他业务功能（Items 等）
- `release-notes.md`（上游历史记录，保留不动）

## 已确认的决策（问答记录）

| 决策点 | 结论 |
|---|---|
| 登录标识 | 单输入框：先按 `user_code` 匹配，未命中再按 `full_name` 匹配；重名命中多条时返回 400 提示改用编码登录 |
| Email 清理范围 | 全部移除（含 Mailpit、react-email 包、SMTP 配置、CI 引用、依赖） |
| 重置密码方式 | 后端 `secrets` 生成随机临时密码，接口返回，前端弹窗一次性展示供复制 |
| 强制改密 | 不做，用户可长期使用临时密码 |
| UUID v7 存量 | 仅 `default_factory=uuid.uuid7` 作用于新建行，无回填迁移 |

## Tech Stack

- 后端：Python 3.14、FastAPI (>=0.141)、SQLModel、Alembic、PostgreSQL、uv workspace（根 `pyproject.toml`，成员 `backend`）
- 前端：React 19、TanStack Router/Query/Table、@hey-api/openapi-ts 生成客户端、Biome、Playwright、bun
- UUID：Python 3.14 标准库 `uuid.uuid7()`（**禁止**为此新增第三方依赖）
- 移除的依赖：`emails`、`email-validator`（`pydantic[email]` extra 随之不再需要）

## Commands

```bash
# ---- 后端（backend/，uv workspace，需先起数据库）----
docker compose up -d db                                # 本地 Postgres
cd backend
uv run pytest                                          # 快速跑测试（FASTAPI_ENV=development）
bash scripts/test.sh                                   # coverage + report（CI 同款）
bash scripts/lint.sh                                   # mypy + ty + ruff check + ruff format --check
bash scripts/format.sh                                 # ruff 自动修复 + 格式化
alembic revision -m "drop email add user_code"         # 生成迁移（手写操作步骤）
alembic upgrade head                                   # 由 scripts/prestart.sh 自动执行

# ---- 前端（根目录）----
bun install
bun run dev                                            # vite http://localhost:5173
bun run lint                                           # biome
bun run --filter frontend build                        # tsc + vite build
bun run test                                           # Playwright e2e（需 backend+db 运行；不再需要 Mailpit）

# ---- 契约同步（后端模型变更后必须执行）----
sh scripts/generate-client.sh                          # 导出 openapi.json 并重新生成 frontend/src/client

# ---- 全栈 CI 式验证 ----
sh scripts/test.sh                                     # docker compose 全栈构建 + prestart + pytest
```

## Project Structure

```
backend/
  app/
    models.py              # User: user_code 替换 email；UserRegister/NewPassword 删除；id → uuid7
    crud.py                # authenticate(identifier) 双段匹配 + 重名歧义信号
    core/
      config.py            # 删 SMTP_*/EMAILS_*/EMAIL_TEST_USER；FIRST_SUPERUSER → FIRST_SUPERUSER_CODE
      security.py          # 新增 generate_random_password()（secrets）
      db.py                # init_db 用 FIRST_SUPERUSER_CODE 创建超级用户
    api/
      routes/login.py      # 仅保留 access-token / test-token；删 3 个找回密码端点
      routes/users.py      # 删 signup；email 查重 → user_code 查重；新增 reset-password 端点
      routes/utils.py      # 整个删除（只剩 test-email）
      routes/private.py    # e2e 造数端点：email → user_code
    utils.py               # 整个删除（纯邮件工具）
    email-templates/       # 整个删除
    alembic/versions/      # 新增迁移：user 表 drop email → add user_code（见迁移策略）
  tests/                   # 用例同步改写（见 Testing Strategy）
frontend/
  src/
    routes/
      login.tsx            # 「用户编码/姓名 + 密码」；删忘记密码/注册链接；testid 改 identifier-input
      signup.tsx           # 删除
      recover-password.tsx # 删除
      reset-password.tsx   # 删除
    components/Admin/      # AddUser/EditUser/columns：email → user_code；UserActionsMenu 增「重置密码」
    components/UserSettings/  # UserInformation 去 email（user_code 只读展示）；ChangePassword 保留
    components/Sidebar/User.tsx  # 副标题 email → full_name（空则 user_code）
    hooks/useAuth.ts       # 删 signUpMutation / UserRegister
    client/                # 仅由 generate-client.sh 生成，禁止手改
  tests/                   # 删 sign-up/reset-password/mailpit 用例；其余改 user_code
packages/react-email/      # 整个删除
compose*.yml / .env / .github/workflows / *.md  # 去 mailpit/SMTP/email 引用；FIRST_SUPERUSER_CODE
```

## 关键设计

### 1. 登录认证（crud.authenticate）

```python
def authenticate(*, session: Session, identifier: str, password: str) -> User | None:
    """user_code 优先，full_name 兜底；重名歧义由调用方单独处理。"""
    db_user = get_user_by_code(session=session, user_code=identifier)
    if not db_user:
        matches = get_users_by_full_name(session=session, full_name=identifier)
        if len(matches) > 1:
            raise UserAmbiguousIdentifierError  # login 路由转译为 400
        db_user = matches[0] if matches else None
    if not db_user:
        verify_password(password, DUMMY_HASH)   # 保留防时序攻击
        return None
    ...
```

- `POST /login/access-token` 端点路径与 OAuth2 表单字段 `username` **保持不变**（OAuth2 兼容、Swagger 可用），语义变为「用户编码或姓名」。
- 统一错误信息（防枚举）：`Incorrect user code/name or password`；重名时特殊提示：`Multiple users share this name, please log in with your user code`。
- JWT `sub` 仍为 `user.id`，token 体系不动。

### 2. 数据模型（backend/app/models.py）

```python
class UserBase(SQLModel):
    user_code: str = Field(unique=True, index=True, max_length=50)  # 替代 email
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)

class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid7, primary_key=True)  # v4 → v7
```

- `user_code`：必填、唯一、≤50 字符、去首尾空格；**不做**邮箱格式校验；用户不可自行修改（`UserUpdateMe` 只含 `full_name`）。
- 删除：`UserRegister`、`NewPassword`、`UserUpdateMe.email`、`UserUpdate.email`。
- `UserUpdate` 增加 `user_code`（管理员可改，改时查重，冲突 409）。

### 3. 管理员重置密码

```python
@router.post("/{user_id}/reset-password",
             dependencies=[Depends(get_current_active_superuser)])
def reset_user_password(session: SessionDep, user_id: uuid.UUID) -> ResetPasswordResponse:
    ...
```

- 路由：`POST /api/v1/users/{user_id}/reset-password`，仅超级用户；用户不存在 404；可对自己之外任意用户执行（含停用用户）。
- 临时密码：`core/security.py` 中 `generate_random_password()` 基于 `secrets.token_urlsafe(16)`（≥16 字符）。
- 响应体 `{"new_password": "..."}` 一次性返回，**不落库明文、不发邮件、不写日志**；前端弹窗展示 + 复制按钮，关闭后不可再查看。
- 不新增 `must_change_password` 字段。

### 4. 数据库迁移（新增 1 个 Alembic 迁移）

对 `user` 表（模板阶段，容忍破坏性，但写成可对非空表重放的步骤）：

1. `add_column user.user_code VARCHAR(50) nullable=True`
2. `UPDATE user SET user_code = 'u_' || left(id::text, 8) WHERE user_code IS NULL`（占位回填）
3. `alter_column user_code nullable=False` + 建唯一索引 `ix_user_user_code`
4. `drop_index ix_user_email` + `drop_column user.email`

- 历史 v4 主键行**不回填** v7；迁移不触碰 `id` 列。
- 历史迁移文件一律不改。

### 5. Email 移除清单（全量）

- 后端：`app/utils.py`、`app/email-templates/`、`routes/utils.py`、login.py 3 个找回端点、users.py 的邮件发送、config.py 全部 `SMTP_*`/`EMAILS_*`/`EMAIL_RESET_TOKEN_EXPIRE_HOURS`/`emails_enabled`/`EMAIL_TEST_USER`
- 配置：`.env`（删 SMTP/EMAILS 块，`FIRST_SUPERUSER=admin@example.com` → `FIRST_SUPERUSER_CODE=admin`）、`compose.yml`/`compose.override.yml`/`compose.deploy.yml`（删 mailpit 服务与 EMAILS_FROM_EMAIL）
- CI：`test-backend.yml`（`--wait db mailpit` → `--wait db`）、`deploy-docker-compose.yml`（删 SMTP_* / EMAILS_FROM_EMAIL 变量透传）
- 工作区：删除 `packages/react-email/`，根 `package.json` 删 `email:dev`/`email:export`，`.pre-commit-config.yaml` 删 email-templates 排除项
- 依赖：backend `pyproject.toml` 删 `emails`、`email-validator`；`uv.lock` 同步（`uv lock`/`uv sync`）
- 文档：`README.md`、`development.md`（Mailpit 节）、`deployment.md`、`deployment-docker-compose.md`（SMTP/EMAILS 变量节）、`backend/README.md`（Email Templates 节）
- 前端：`routes/recover-password.tsx`、`routes/reset-password.tsx` 删除；`tests/utils/mailpit.ts` 删除；登录页/设置页/Admin 组件去 email 字段

## Code Style

沿用现有约定：后端 ruff（select E,W,F,I,B,C4,UP,ARG001,T201）+ mypy strict + ty；前端 Biome + TypeScript strict；组件用 react-hook-form + zod。

```python
# 后端：SQLModel + 依赖注入 + 明确的 HTTPException（与现有 routes/users.py 一致）
@router.post(
    "/{user_id}/reset-password",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=ResetPasswordResponse,
)
def reset_user_password(session: SessionDep, user_id: uuid.UUID) -> ResetPasswordResponse:
    """Reset a user's password to a random temporary password (superuser only)."""
    db_user = session.get(User, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    temp_password = generate_random_password()
    db_user.hashed_password = get_password_hash(temp_password)
    session.add(db_user)
    session.commit()
    return ResetPasswordResponse(new_password=temp_password)
```

```tsx
// 前端：zod schema 与生成客户端类型对齐（与现有 routes/login.tsx 一致）
const formSchema = z.object({
  username: z.string().min(1, { message: "User code or name is required" }),
  password: z.string().min(1, { message: "Password is required" }),
}) satisfies z.ZodType<AccessToken>
// 输入框：data-testid="identifier-input"，type="text"（不再是 email）
```

命名：数据库/Python 用 `user_code`（snake_case），前端类型随生成客户端保持 `user_code`；登录表单字段名保持 `username`（OAuth2 兼容）。

## Testing Strategy

**后端**（pytest，`backend/tests/`，需 Postgres：`docker compose up -d db`）：

- 改写 `conftest.py`、`tests/utils/user.py`（`create_random_user` 生成唯一 user_code）、`test_login.py`、`test_users.py`、`test_private.py`
- 删除：密码找回 token 相关用例、signup 用例、`patch("app.utils.send_email")` 桩
- 新增用例：
  - 唯一 user_code 登录成功 / 唯一 full_name 登录成功
  - 重名 full_name 登录 → 400 且提示改用编码
  - 错误密码 / 不存在用户 → 统一错误信息；不存在用户时仍执行 dummy hash（防时序）
  - `POST /users/{id}/reset-password`：superuser 成功返回 ≥16 字符临时密码且临时密码可登录；普通用户 403；不存在 404；停用用户可被重置
  - user_code 唯一性：管理员创建/更新重复编码 → 400/409
  - UUID v7：新建 User/Item 的 id 解析后 `.version == 7`
- 现有测试不得删除或注释致覆盖率下降；新端点必须有路由级测试

**前端**（Playwright，`frontend/tests/`，需 backend + db，不再需要 Mailpit）：

- 更新 `auth.setup.ts`（`FIRST_SUPERUSER_CODE` 登录）、`config.ts`（读 `FIRST_SUPERUSER_CODE`）、`login.spec.ts`、`admin.spec.ts`（创建用户含 user_code；重置密码弹窗流程）、`items.spec.ts`、`user-settings.spec.ts`、`utils/user.ts`、`utils/random.ts`（`randomUserCode()`）、`utils/privateApi.ts`
- 删除：`sign-up.spec.ts`、`reset-password.spec.ts`、`utils/mailpit.ts`
- 新增 e2e：管理员重置密码 → 弹窗显示临时密码 → 登出后用临时密码登录成功

**验证命令**：`sh scripts/test.sh`（后端全栈）+ `bun run test`（前端 e2e）+ `bash backend/scripts/lint.sh` + `bun run lint`

## Boundaries

**Always**

- 后端改动后执行 `bash backend/scripts/lint.sh` 与 `uv run pytest`；前端改动后执行 `bun run lint`
- 后端模型/路由变更后必须运行 `sh scripts/generate-client.sh` 同步前端客户端，提交生成的变更
- schema 变更走新增 Alembic 迁移（`alembic revision`），迁移需可在空库与非空库上重放
- 每完成一个任务即更新任务清单状态并跑对应验证

**Ask first**

- 修改/删除既有 Alembic 历史迁移
- 更改 `POST /login/access-token` 的路径、方法或请求形状（OAuth2 兼容性）
- 新增任何依赖（本 spec 明确要求 UUID 用标准库）
- 修改 `compose.deploy.yml` 生产配置或 CI 工作流的非 email 部分
- 删除任何现有测试

**Never**

- 手工编辑 `frontend/src/client/` 下的生成文件
- 重新引入任何 email/SMTP/Mailpit 相关代码、配置或依赖
- 在日志、响应（临时密码字段除外）或持久化中记录明文密码
- 把临时密码之外的密码以明文形式返回给任何接口
- 提交真实生产密钥到 `.env`

## Success Criteria

**A. 登录改造**

- [ ] 登录页为「用户编码/姓名 + 密码」，页面无 Email 字样与忘记密码/注册链接；输入框 `data-testid="identifier-input"`
- [ ] 唯一 user_code 可登录；唯一 full_name 可登录；重名 full_name 登录返回 400 并提示改用编码
- [ ] 错误凭据返回统一信息 `Incorrect user code/name or password`，且不存在的用户仍触发 dummy hash 校验（防时序）
- [ ] `POST /login/access-token` 路径、OAuth2 表单形状不变，Swagger OAuth2 流程可用
- [ ] JWT `sub` 仍为 user.id；`/login/test-token` 行为不变

**B. Email 全部移除**

- [ ] `grep -rin -e email -e smtp -e mailpit` 在 `backend/app`、`backend/tests`、`frontend/src`、`frontend/tests`、`compose*.yml`、`.github/workflows`、`.env`、根级活文档（README/development/deployment\*/backend README）中无业务性残留（CI 中 `git config user.email` 与 `release-notes.md` 历史除外）
- [ ] `POST /api/v1/utils/test-email/` 不存在（404）；`password-recovery*`/`reset-password` 端点不存在（404）
- [ ] `user` 表无 `email` 列，`UserPublic` 响应不含 email 字段
- [ ] backend 依赖中无 `emails`、`email-validator`；`packages/react-email/` 目录不存在；compose 中无 mailpit 服务
- [ ] `sh scripts/generate-client.sh` 可成功执行，前端类型与后端 OpenAPI 一致

**C. 注册移除**

- [ ] `POST /api/v1/users/signup` 路由不存在（404）；`/signup` 前端路由不存在
- [ ] `useAuth` 无 `signUpMutation`；代码库无 `UserRegister` 类型引用
- [ ] 登录页无「Sign up」入口；唯一建号途径是管理员创建

**D. 管理员重置密码**

- [ ] 仅超级用户可调用 `POST /api/v1/users/{user_id}/reset-password`；普通用户 403；目标不存在 404
- [ ] 成功响应含 ≥16 字符随机临时密码；无任何邮件发送；响应外无明文密码留存
- [ ] 用该临时密码可正常登录；不新增 `must_change_password` 字段
- [ ] 前端用户管理操作菜单有「Reset password」，弹窗一次性显示 + 可复制
- [ ] 用户可继续在 Settings 中用自己的当前密码自助改密（ChangePassword 行为不变）

**E. UUID v7**

- [ ] 新建 User 与 Item 的主键满足 `uuid.UUID(str(id)).version == 7`（有测试断言）
- [ ] 存量数据不回填、历史迁移文件未改动
- [ ] 未为此新增任何第三方依赖

**整体**

- [ ] `sh scripts/test.sh` 全绿；`bun run test` 全绿；两端 lint 通过
- [ ] `.env` / compose / 部署文档与 `FIRST_SUPERUSER_CODE` 一致，prestart 可用新配置初始化超级用户

## Open Questions

1. **user_code 生成方式**：默认按「管理员创建时手工填写（必填、唯一）」实现。若希望系统自动生成（如 `U0001` 递增流水号），请在评审时说明 —— 会改变 AddUser 表单与迁移占位逻辑。
2. full_name 是否改为管理员创建时必填（当前模型允许为空）？默认保持可空（为空时仅能以编码登录）。
