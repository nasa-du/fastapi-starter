# Spec: self-account-deletion-removal

> 状态：实现完成（Tasks 1–9，2026-11-25；10 条 Success Criteria 核对证据见 `tasks/todo.md` Task 9）；契约决定（含 Open Question 3 处置）见文末「契约决定记录」；待人工终审
> 所属能力地图：`CAPABILITY-MAP.md` → `self-account-deletion-removal`
> 本规格仅移除用户删除自己账号的自助流程，不改变管理员侧用户管理。

## Objective

彻底移除用户自助注销能力：设置页不再显示“危险操作/删除账号”入口，后端不再提供 `DELETE /api/v1/users/me`，生成客户端不再暴露对应方法，相关自助注销业务逻辑和测试被删除。

本变更**不删除任何已有用户数据，不涉及数据库结构或数据迁移**。管理员仍可在用户管理中删除其他用户；现有“管理员不能通过用户管理删除自己”的保护继续保留。删除账号入口与登出入口不同，普通用户仍可以主动登出。

**用户故事**

- 作为普通用户，我可以管理个人资料、修改密码和登出，但不能自行删除账号。
- 作为管理员，我可以继续创建、查看、编辑、停用和删除其他用户，以及重置密码。
- 作为维护者，系统不再暴露可绕过前端的自助注销 API 或生成客户端方法。

## Tech Stack

沿用现有技术栈，不新增依赖：

- 后端：Python 3.14、FastAPI、SQLModel、PostgreSQL、pytest、uv。
- 前端：React 19、TypeScript、TanStack Query、i18next、Biome、Playwright、bun。
- API 客户端：@hey-api/openapi-ts，由 `scripts/generate-client.sh` 统一生成。
- 数据库：无 schema 变化，无 Alembic 新迁移。

## Commands

```bash
# 后端（在 backend/ 下执行；测试需 PostgreSQL）
docker compose up -d db  # 在项目根目录执行
uv run pytest
uv run bash scripts/test.sh
uv run bash scripts/lint.sh

# 同步 OpenAPI 和前端客户端（在项目根目录执行）
sh scripts/generate-client.sh

# 前端（在项目根目录执行）
bun run lint
bun run --filter frontend build
bun run test

# 全栈验证（在项目根目录执行）
sh scripts/test.sh
```

本模块没有数据库迁移命令。执行测试和客户端生成不需要，也不允许为了移除自助注销而清空或修改已有用户数据。

## Project Structure

```
CAPABILITY-MAP.md                                  # 已批准的能力地图
SPEC-self-account-deletion-removal.md             # 本模块规格
backend/
  app/
    api/routes/users.py                            # 删除 DELETE /me 路由；管理员动态路由加 {user_id:uuid}（2026-11-25 批准）
  tests/
    api/routes/test_users.py                       # 替换自助注销测试，保留管理员测试
frontend/
  src/
    routes/_layout/settings.tsx                    # 删除危险操作 tab 及超级用户分支
    components/UserSettings/
      DeleteAccount.tsx                            # 整个删除
      DeleteConfirmation.tsx                       # 整个删除
      UserInformation.tsx / ChangePassword.tsx      # 保留
    locales/{en,zh-CN}.json                         # 删除自助注销文案，保留管理员文案
    client/                                        # 仅由生成器更新
  tests/
    user-settings.spec.ts                          # 删除自助注销场景，增加入口移除断言
    admin.spec.ts                                  # 保留管理员删除用户等场景
README.md                                          # 明确账号由管理员管理，不提供自助注销
```

`frontend/src/components/Admin/DeleteUser.tsx` 及其调用链属于管理员用户管理，必须保留。`USERS_SUPERUSER_DELETE_SELF` 错误码仍被管理员删除自己的保护逻辑使用，不能因删除 `DELETE /users/me` 而误删。

历史发布记录和已归档任务中的自助注销描述保留；当前文档不得继续宣传该功能。

## Code Style

删除整个自助注销路由和组件，而不是用隐藏、禁用或无操作实现保留僵尸代码。同时简化因此失去用途的分支与文案。

```python
# backend/app/api/routes/users.py：保留其他 /me 自助管理能力
@router.get("/me", response_model=UserPublic)
def read_user_me(current_user: CurrentUser) -> Any:
    return current_user

# PATCH /me 与 PATCH /me/password 保留。
# DELETE /me 整个删除，不增加替代处理函数或兼容响应。
# 管理员动态路由改为 {user_id:uuid}（2026-11-25 批准），使 DELETE /users/me 在路由层统一返回 405。

# 以下管理员端点保留，不因路径包含 delete 而误删：
# DELETE /{user_id:uuid}，依赖 get_current_active_superuser。
```

```tsx
// frontend/src/routes/_layout/settings.tsx：设置页只保留两个 tab
const tabsConfig = [
  { value: "my-profile", titleKey: "settings.tabs.profile", component: UserInformation },
  { value: "password", titleKey: "settings.tabs.password", component: ChangePassword },
]

// 所有用户使用同一份 tabsConfig；移除仅为隐藏超级用户危险 tab 而存在的分支。
// logout 仍由现有 Sidebar 用户菜单提供，不迁移或改造成注销入口。
```

前端生成文件只能通过生成器修改；不要手工删除 client 类型或 service 方法。

## Testing Strategy

**后端路由与数据保留测试（pytest，`backend/tests/api/routes/test_users.py`）**

- 删除原“普通用户通过 `DELETE /users/me` 成功删除自己”和“超级用户调用该接口返回 403”的测试。
- 新增路由移除契约测试（2026-11-25 批准的契约：三种凭证统一 405，经批准的 `{user_id:uuid}` 路由结构调整实现，不新增替代 handler）：
  - 创建普通用户并登录，带有效 token 调用 `DELETE /api/v1/users/me` 返回 405（该路径仅剩 GET/PATCH，Allow 头不含 DELETE）。
  - 同一用户使用超级用户 token 调用同样返回 405，不再返回旧的 403 业务错误。
  - 两次调用后查询数据库，目标用户记录仍存在，`user_code`、姓名、激活状态、密码哈希等未被该请求改变。
  - 不带 token 调用同一 URL 同样返回 405（路由层拒绝，不进入认证流程）；三种凭证统一以 405 为契约。
  - 管理员动态路由（GET/PATCH/DELETE `/{user_id}`、POST `/{user_id}/reset-password`）改为 `{user_id:uuid}`：合法 UUID 的既有行为不变；非 UUID 路径段一律在路由层返回 404（原按凭证 401/403/422），该副作用已于 2026-11-25 随契约一并批准。
- OpenAPI 不包含 `DELETE /api/v1/users/me` 的 operation；客户端生成结果不包含 `deleteUserMe` 及 `usersDeleteUserMe*` 类型。
- 保留并验证 `GET /users/me`、`PATCH /users/me`、`PATCH /users/me/password` 的现有行为。
- 保留并验证管理员用户管理：
  - 超级用户 `DELETE /users/{user_id}` 可删除其他用户，目标用户记录按原逻辑删除。
  - 不存在的用户仍返回 404。
  - 超级用户通过该管理端点删除自己仍返回 403 和 `USERS_SUPERUSER_DELETE_SELF`。
  - 普通用户调用 `DELETE /users/{user_id}` 仍返回 403。
  - 管理员创建、更新、列表和重置密码端点的现有测试继续通过。

**前端回归测试（Playwright，`frontend/tests/`）**

- 普通用户和管理员的设置页均只显示“我的资料”和“密码”两个 tab，不显示“危险操作”或删除账号按钮。
- 原 `danger-zone` 测试 id、自助注销确认弹窗和成功 toast 不再出现；删除旧自助注销交互测试，而不是让它们跳过。
- 我的资料、修改密码、登出、语言切换的现有测试继续通过。
- `admin.spec.ts` 中管理员删除其他用户、取消删除、无权限控制和重置密码等现有场景继续通过。
- 增加或保留测试，证明普通用户登出后回到登录页，但其账号记录没有被删除；可使用受控测试用户重新登录验证。

**验证要求**

- 运行后端完整测试和 lint、前端 lint 和构建、Playwright 回归测试及全栈测试。
- 不新增迁移，不运行任何用户数据清理或回填。
- 覆盖率门槛沿用现有测试脚本；不得通过跳过测试、删除管理员保护断言或降低阈值掩盖回归。

## Boundaries

**Always**

- 同时移除前端入口、后端路由、对应前端 mutation 和生成客户端契约，不能只隐藏 UI。
- 保留管理员删除其他用户的端点、前端组件、权限检查和所有相关测试。
- 保留 `GET/PATCH /users/me`、修改密码和登出功能。
- 后端路由变化后运行 `sh scripts/generate-client.sh` 并提交生成结果。
- 验证自助注销请求不会删除或修改已有用户记录。

**Ask first**

- 增加新的“联系管理员注销”流程、软删除/停用账号功能、数据导出或宽限期。
- 修改管理员删除用户的权限规则，或允许管理员删除自己。
- 进行用户数据删除、数据库 schema 变化或新增迁移。
- 删除本规格未明确授权的共享组件、翻译键或其他测试。

**Never**

- 保留 `DELETE /api/v1/users/me` 作为隐藏 API、兼容 API、禁用占位或仅前端不可见的后门。
- 删除 `frontend/src/components/Admin/DeleteUser.tsx` 或 `DELETE /users/{user_id}`。
- 因为错误码名称含 `DELETE_SELF` 而移除仍用于管理员保护的 `USERS_SUPERUSER_DELETE_SELF`。
- 把登出当作注销的替代实现，或在移除功能时清理任何已有用户数据。
- 手工编辑 `frontend/src/client/` 下的生成文件。
- 跳过管理员删除用户的回归验证。

## Success Criteria

1. 普通用户和管理员的设置页均没有危险操作 tab、删除账号按钮或自助注销确认弹窗；资料和密码 tab 正常。
2. `DeleteAccount.tsx`、`DeleteConfirmation.tsx` 及其专属前端逻辑和中英文案被删除，没有未使用的引用。
3. `DELETE /api/v1/users/me` 对有效普通用户 token、有效超级用户 token 和匿名请求均返回 405（2026-11-25 修订：经批准的 `{user_id:uuid}` 路由结构调整，原 404 要求作废）；请求前后对应用户数据不变。
4. OpenAPI 和生成客户端不再包含 `deleteUserMe` 或相关请求/响应类型。
5. `GET/PATCH /users/me`、修改密码和主动登出继续工作。
6. 管理员仍可删除其他用户；管理员删除自己、普通用户删除他人、目标不存在时的原权限与错误契约保持不变。
7. 管理员创建、查看、编辑用户及重置密码能力不受影响。
8. 没有新增数据库迁移，没有因本模块删除、回填或修改任何已有用户数据。
9. 后端测试与 lint、前端 lint 与构建、Playwright 回归测试及全栈测试全部通过。
10. 当前文档不再承诺用户自助注销；历史发布记录和已归档任务保持历史事实。

## Open Questions

无。自助注销彻底移除、已有用户数据保留，以及管理员用户管理能力不受影响均已确认。

## 契约决定记录（2026-11-25 人工答复）

- **响应契约（Open Question 1）**：`DELETE /api/v1/users/me` 对匿名、普通用户 token、超级用户 token 统一返回 **405**；实现方式为删除 handler 并将管理员动态路由改为 `{user_id:uuid}`，不新增替代 handler 或兼容占位。副作用已批准：管理员端点对非 UUID 路径段的请求在路由层返回 404（原按凭证 401/403/422）。
- **测试数据边界（Open Question 2）**：pytest 继续连接现有开发库；清理范围仅限测试会话中创建的用户，禁止 `delete(User)` 全表清空，禁止删除 first superuser `admin` 及任何非测试创建的既有用户。
- **根 `scripts/test.sh`（Open Question 3）**：推迟到 Task 9 前单独决定，未决定前不得执行。**2026-11-25 人工答复**：backend coverage 脚本（`cd backend && uv run bash scripts/test.sh`）执行（全绿，TOTAL 95%）；根全栈脚本不执行并记录原因（数据保留要求 + 预存 Dockerfile/health-check 基线缺陷，见 `tasks/todo.md` Task 9 执行记录），基线缺陷另立任务。
