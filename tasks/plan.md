# Implementation Plan: self-account-deletion-removal

> 依据：`SPEC-self-account-deletion-removal.md`（已评审，契约决定见「Open Questions（2026-11-25 人工答复记录）」）与已批准的 `CAPABILITY-MAP.md`
> 状态：**已完成**（Tasks 1–9 与 Checkpoint A–E 全部达成，2026-11-25 人工终审通过；Open Questions 1–3 均获人工答复——OQ3：backend coverage 脚本执行、根全栈脚本不执行并记录原因，见 Open Questions 节）
> 任务清单：`tasks/todo.md`（Tasks 1–9；完成状态与验证证据记录在 todo.md）
> 2026-11-25 人工答复已显式批准路由契约（405 + `{user_id:uuid}`）与测试数据清理边界（开发库 + 限制清理范围），记录见 Open Questions 节。
> 前计划：`item-removal` 已 100% 完成并通过人工终审，原文件完整归档至 `tasks/archive/item-removal/`，未删除任何未完成任务。

## Overview

彻底移除用户自助注销的设置入口、前端组件和 mutation、后端 `DELETE /api/v1/users/me`、OpenAPI operation 及生成客户端方法，同时保留已有用户数据、个人资料、改密、登出和管理员用户管理。采用九个按依赖排序的任务，在前后端能力删除后立即验证保留路径，再更新文档、审计残留并完成全量验收。

本次实现**无 schema 或 Alembic 变化，无用户数据清理、回填或替代注销流程**。Task 4 的测试只能使用经批准的隔离测试数据库和规格明确授权的 pytest 测试夹具，不能把它解释为允许清空或修改开发库中的已有用户。根 `scripts/test.sh` 会执行 `docker compose down -v --remove-orphans`，与该数据保留要求存在实际冲突；其执行方式和范围必须在 Task 9 前单独批准（见 Open Question 3）。

## Verified Codebase Facts

- 后端仅一个自助删除处理函数：`backend/app/api/routes/users.py` 的 `delete_user_me`（当前 L131–146）。`GET /me`、`PATCH /me`、`PATCH /me/password` 和 `DELETE /{user_id}` 均在同一文件中，后者是管理员能力，必须保留。
- 管理员删除自己仍在管理员处理函数中返回 `403` 和 `USERS_SUPERUSER_DELETE_SELF`；双字典中的同名翻译也仍被使用。删除自助处理函数时不得全局删除此错误码。
- 自助删除前端边界明确：`settings.tsx` 引入 `DeleteAccount`，两个专属组件调用 `UsersService.deleteUserMe()` 并注销本地会话；`UserInformation`、`ChangePassword` 和 `Admin/DeleteUser.tsx` 是独立且须保留的能力。
- 当前 `user-settings.spec.ts` 的共享 `tabs` 数组含三个 tab，并含两个真实自助删除交互测试。现有测试已有资料、改密、登出、语言和外观回归；`login.spec.ts` 亦有登出场景。
- 现有后端 `test_users.py` 已覆盖 GET/PATCH me、改密，以及管理员删除他人、不存在目标、删除自己和普通用户 403。保留并运行这些用例，不能为让移除测试通过而削弱它们。
- 当前生成物确有 `UsersService.deleteUserMe`、`usersDeleteUserMeData/Response(s)`。`sh scripts/generate-client.sh` 导出 OpenAPI、运行 openapi-ts 并调用前端 lint；`frontend/src/client/` 只能由该工具修改。
- `frontend/openapi.json` 和 `backend/app/frontend/` 被忽略；`frontend/src/client/` 和 `routeTree.gen.ts` 被跟踪。此变更不要求手改路由树。
- 当前 Alembic head 为 `d464f5951cc0`；本计划应保持迁移文件与 head 不变。此事实用于验证“无迁移”，不是要求执行迁移。
- **路由冲突（隔离探针实测，无产品代码或数据库改动；2026-11-25 复测并修正）**：仅删除 `DELETE /users/me`、保留普通 `{user_id}` 时，该 URL 按凭证分叉——匿名 401、普通用户 403（USERS_FORBIDDEN，认证依赖先于路径参数校验）、超级用户 422（uuid_parsing），并非单一 422。将管理员动态路由改为 `{user_id:uuid}` 后，三种凭证统一在路由层返回 405（Allow: GET, PATCH；不进入认证流程）。已批准采用后者（405 + uuid converter），见 Open Questions 节；不暗中增加规格禁止的替代处理函数、禁用占位或兼容 API。
- 上一模块已记录两个范围外基线问题：`backend/Dockerfile` 不复制 `backend/tests/`，根 `scripts/test.sh` 的容器内 pytest 腿因此失败；Docker Compose CI 使用的 `/api/v1/utils/health-check` 不存在。它们不在本规格范围内，不能混入本次删除工作；若阻塞最终验收，单独报告并请求决定。

## Architecture Decisions

1. **路由契约已冻结（2026-11-25 人工批准）。** `DELETE /api/v1/users/me` 对匿名、普通用户 token、超级用户 token 一律返回 **405**，实现方式为删除 handler 并把管理员动态路由（GET/PATCH/DELETE `/{user_id}`、POST `/{user_id}/reset-password`）改为 `{user_id:uuid}`；不新增替代 handler、禁用占位或兼容 API。已批准副作用：管理员端点对非 UUID 路径段一律路由层 404（原按凭证 401/403/422），合法 UUID 的既有授权与错误行为不变。Task 4 按此实施并逐项回归管理端点；契约测试断言 405，不得改写为 404/422。
2. **不保留后门或僵尸代码。** 删除整个自助 handler、组件、mutation 和专属文案；不以隐藏按钮、无操作函数、403 占位或兼容接口替代。管理员端点、组件和 `USERS_SUPERUSER_DELETE_SELF` 例外保留。
3. **能力删除采用小垂直切片。** 前端入口和专属组件（Task 2）与后端路由及数据保留契约（Task 4）分别形成可验证切片；客户端仅在真实后端 OpenAPI 改变后生成（Task 5），避免手改或生成陈旧契约。专属双语文案在 UI 引用删除后由 Task 3 单独清理，确保每项任务最多五个源文件/测试文件，且中间状态不出现未翻译文案。
4. **管理员能力作为跨切片不变量。** 每个相关测试阶段都保留并运行 `DELETE /users/{user_id}` 的授权、自删保护、404 和成功删除测试；前端 admin 组件和场景不得误删。若路由契约决策需要改变动态路由结构，须先单独证明各管理端点行为不变。
5. **测试先行且忠于旧行为。** 新“已移除”断言在实现前按批准后的响应契约运行并记录 RED；旧成功自删与 superuser 403 测试由新契约测试替换，不跳过。保留能力测试原则上不改断言；确需适配经批准的路由结构时，逐项说明并维持等价行为。
6. **数据保护优先于脚本便利。** 不新增迁移，不手动清理开发/生产用户。pytest 继续连接现有开发库（2026-11-25 批准），但清理范围收紧为**仅删除本次测试会话创建的用户**：Task 4 须把会话级 autouse fixture 的 `delete(User)` 全表清空改为按会话登记清理；禁止删除 first superuser `admin` 及任何非测试创建的既有用户；fixture 为既有 `test-user` 受控用户重置密码的既有约定保留，但会话结束不得删除该既有用户。
7. **测试数据以可控用户为单位验证。** 后端在专用测试库创建随机普通用户，快照其 `id/user_code/full_name/is_active/is_superuser/hashed_password/created_at`，对匿名、普通 token 和 superuser token 的移除请求逐一断言批准后的默认错误响应，并刷新/重查后逐字段比对。普通请求使用临时用户自己的 token；超级用户请求不得误删该临时用户，管理员自身记录也须保留。
8. **生成物只由工具维护。** Task 5 运行生成脚本，核对目标 operation、方法和类型消失，其他 UsersService 能力保留；再次生成后跟踪文件零额外 diff。忽略的中间 OpenAPI/构建产物不提交。
9. **文档语义区分当前与历史。** README 明确账号由管理员管理且不提供自助注销。`release-notes.md` 和 `tasks/archive/` 原样保留；`SPEC-i18n.md` 仅在 README 继续将其作为当前错误码契约时，修正其当前错误码位置并为历史 Settings/DeleteConfirmation 描述增加失效说明，不改写历史成果。
10. **默认串行，避免共享文件竞争。** `users.py`、`test_users.py`、`user-settings.spec.ts`、双字典和生成物均为共享边界。前端与后端前期任务技术上可独立，但当前有契约阻塞且仓库采用单清单证据记录，因此按 Task 1–9 串行；如未来并行，后端测试与路由文件归后端 lane，前端组件与测试归前端 lane，字典/文档/生成物由集成者独占。
11. **已执行的环境管理假设仅在人工批准后生效。** “审批策略不询问用户”只描述工具权限，不代表用户批准了规格冲突、数据破坏或实现方案。2026-11-25 人工答复已显式批准 OQ1（405 + uuid converter）与 OQ2（开发库 + 限制清理范围），记录见 Open Questions 节；OQ3（根脚本数据卷销毁）未授权，Task 9 前单独决定。

## Dependency Graph

```
H1/H2 已于 2026-11-25 人工答复（405 + uuid converter；开发库 + 限制清理范围）
  │
  └─ T1 冻结契约与测试数据安全基线
        │
        ├─ T2 设置 UI/专属组件删除 + 双角色 E2E
        │
        ├─ T3 专属双语文案清理 ── ◆CP-A
        │
        └─ T4 自助 DELETE 删除 + 响应契约/数据不变 + 管理端点 API 回归
              │
              └─ T5 OpenAPI/客户端生成 + 保留方法检查 ── ◆CP-B
                                                              │
                                     T6 管理 UI 回归 + T7 登出后账号仍可用 ── ◆CP-C
                                                                              │
                                                              T8 当前文档与历史边界 ── ◆CP-D
                                                                                       │
                                                                       T9 残留审计 + 全量验收 ── ◆CP-E

H3 根 scripts/test.sh 的数据卷销毁授权：Task 9 前另行明确
```

Tasks 6 与 7 可在实现阶段只读并行规划，但均依赖 Task 5 且共享 Playwright 环境，默认串行。Task 8 可与 Task 6/7 并行编辑互不重叠的文件，但默认由同一执行者顺序完成。

## Task List

### Phase 1: Contract and Removal

- [x] Task 1: 冻结已批准的路由契约、保留路径和测试数据安全基线（2026-11-25，证据见 todo.md 执行记录）
- [ ] Task 2: 删除自助注销 UI 和组件，添加双角色入口移除断言
- [ ] Task 3: 删除自助注销专属双语文案，保留共享与管理员文案
- [ ] Task 4: 删除自助 DELETE 业务逻辑，添加移除契约和用户数据不变测试
- [ ] Task 5: 通过生成器同步 OpenAPI 与前端客户端，验证保留契约

### ◆ Checkpoint A: Settings Surface Removed

- [ ] 双角色设置页只有两个 tab；自助组件、旧交互测试和专属双语文案已删除，无悬空引用
- [ ] 资料、改密、语言切换和登出相关定向 E2E 通过，前端 lint/build 通过
- [ ] 管理员文案、`menu.logout` 与 `USERS_SUPERUSER_DELETE_SELF` 翻译保留
- [ ] 人工确认该阶段后进入后端删除

### ◆ Checkpoint B: API and Client Agree

- [ ] 三种凭证情形下旧 URL 均符合人工批准的响应契约，临时用户与管理员数据未改变
- [ ] GET/PATCH me、改密和管理员 API 回归通过；生成客户端无自删方法且保留管理方法
- [ ] `uv run pytest`、`uv run bash scripts/lint.sh`、前端 lint/build 和定向 E2E 均通过
- [ ] 人工确认该阶段后进入保留能力回归

### Phase 2: Retained User and Admin Flows

- [ ] Task 6: 验证管理员删除他人、取消删除、自删隐藏/保护、权限控制和完整用户管理 UI
- [ ] Task 7: 验证普通用户登出不删除账号、资料/改密/语言切换继续工作

### ◆ Checkpoint C: Preserved Capabilities Work

- [ ] 管理员创建、查看、编辑、停用、删除他人及重置密码均正常
- [ ] 普通用户登出到登录页后可用原凭证重新登录；不发生 DELETE me 请求
- [ ] 全量 Playwright 通过，未跳过或削弱管理员测试

### Phase 3: Documentation

- [ ] Task 8: 更新当前账号说明，标注仍被引用的当前契约文档并保留历史记录

### ◆ Checkpoint D: Documentation Matches Behavior

- [ ] README 明确管理员管理账号且不提供自助注销
- [ ] 当前错误码契约不指向已删除 handler；历史发布与归档文件零改写

### Phase 4: Audit and Acceptance

- [ ] Task 9: 审计残留、无迁移/无数据变更，运行全量验证并逐条核对 Success Criteria

### ◆ Checkpoint E: Complete

- [ ] 规格 10 条 Success Criteria 均有对应测试、扫描或文档证据
- [ ] 后端测试/coverage/lint、前端 lint/build、Playwright 全绿，coverage 门槛不降低
- [ ] 客户端再生成幂等，无手改生成物、无新增迁移、无未经授权的数据操作
- [ ] 根全栈脚本已按明确批准执行并记录结果；任何数据风险或预存缺陷均单独报告，不以基线问题、重跑或部分通过代替规格要求的全栈测试通过
- [ ] 人工终审通过后才标记完成

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| 删除静态 DELETE 后动态路由返回 422/405 | 高 | 已解决（2026-11-25 批准 405 + `{user_id:uuid}`）；探针证实纯删除按凭证分叉 401/403/422，不采用 |
| 为满足 404 引入被禁止的兼容 handler 或改变管理员路由 | 高 | 只实施明确批准的路由设计；所有管理端点授权与行为逐项回归 |
| pytest fixture 或根全栈脚本清空开发数据 | 高 | 隔离测试库与测试用户范围先审批；根 `down -v` 单独授权，失败时手动清理也须同一授权覆盖 |
| 误删管理员自删保护、组件或错误码 | 高 | 跨阶段不变量；保留 `DeleteUser.tsx`、`DELETE /{user_id}`、`USERS_SUPERUSER_DELETE_SELF` 及完整测试 |
| 仅隐藏 UI，留下可绕过后端/API client | 高 | Task 4 删除 handler，Task 5 验证 OpenAPI/客户端，Task 9 语义审计 |
| 删除共享文案或 logout 逻辑 | 中 | 只删 `settings.tabs.danger/deleteAccount/deleteConfirmation`；保留 `menu.logout`、admin.delete 和 errors 中的自删保护翻译 |
| E2E 用文案或持久 session 掩盖双角色差异 | 中 | 明确 tablist 总数/testid 否定断言；管理员使用现有 setup，普通用户使用独立 storageState 和受控测试用户 |
| 生成文件被手改或漏提交 | 中 | 仅 Task 5 运行生成器；检查目标符号、其余 service 和二次生成零 diff |
| 历史资料被误改或当前文档继续宣传旧能力 | 低 | 历史/当前分域扫描；仅 README 和必要的 SPEC-i18n 当前契约说明，归档不动 |
| 基线 Docker 测试/health-check 缺陷造成假绿 | 中 | 预先记录已知基线；不顺手修复、不降低门槛，Task 9 单独报告并请求范围决定 |
| 全局 lint/format 改写并发或范围外文件 | 低 | 执行前后检查 `git status/diff`，只提交本任务授权文件；格式化改动逐项复核 |

## Open Questions（2026-11-25 人工答复记录，阻塞解除）

1. **响应契约（已答复）**：批准「405 + uuid converter」——删除 `delete_user_me` 并把管理员动态路由改为 `{user_id:uuid}`，三种凭证（匿名/普通用户 token/超级用户 token）统一返回 405；不新增替代 handler/兼容占位。副作用已批准：管理员端点对非 UUID 路径段一律路由层 404（原按凭证 401/403/422）。spec 的 Testing Strategy、Success Criterion 3 已同步修订。
2. **测试数据边界（已答复）**：批准「保留开发库，限制清理范围」——pytest 继续连接开发库 `app`；清理仅限测试会话中创建的用户（随机 `create_random_user` 用户及 fixture 创建的 `test-user`）；Task 4 重写 conftest fixture，禁止 `delete(User)` 全表清空，禁止删除 first superuser `admin` 及任何非测试创建的既有用户。
3. **根 `sh scripts/test.sh`（已答复：推迟）**：保持开放，进入 Task 9 前以专用可丢弃 Compose 项目/卷方式单独决定；未决定前不得执行该脚本，也不能将 Item-removal 的授权继承到本次。其预存 Dockerfile/health-check 缺陷仍另立任务，不纳入本规格。**2026-11-25 人工答复（Task 9 执行中、根脚本执行前，ask_user_question 逐题显式确认）**：backend coverage 脚本（`cd backend && uv run bash scripts/test.sh`）＝执行（已全绿，TOTAL 95%，`users.py` 100%）；根全栈脚本 `sh scripts/test.sh` ＝不执行，如实记录原因（数据保留要求 + 预存 Dockerfile/health-check 基线缺陷使容器内 pytest 腿无法全绿），两项缺陷另立任务请求决定（见 todo.md Task 9 范围外发现）。工具审批策略「不询问用户」不构成对该处置的批准（架构决定第 11 条）。

## Planning Notes

- 本计划仅进行了文件读取、搜索、Git 状态检查和不访问数据库的 FastAPI 路由探针，以及本计划文档的编写/归档；未修改产品代码、运行 pytest/生成器、连接/清理数据库或启动服务。
- 缺失的 skill 参考文件 `../../references/definition-of-done.md` 在 skill 安装目录和 `/home/fk/.dsh/references/` 均不存在；本计划直接落实可验证的 per-task 验收、coverage 门槛、无跳过/无弱化和人工终审要求，没有虚构引用内容。
