# 任务清单:self-account-deletion-removal(移除用户自助注销)

> 依据 `SPEC-self-account-deletion-removal.md`(已评审,2026-11-25 契约批准)与 `tasks/plan.md`。每完成一项即勾选并在本文件记录验证证据。
> **当前状态:Open Questions 1–2 已于 2026-11-25 获人工答复(405 + uuid converter;开发库 + 限制清理范围),契约已冻结,Task 1 完成,Tasks 2–8 解除阻塞。Open Question 3(根脚本数据卷销毁)推迟至 Task 9 前决定。**
> 环境前提:后端测试需 PostgreSQL;E2E 需后端 + 数据库运行(在 `frontend/` 内运行并显式传 `PLAYWRIGHT_BASE_URL`/`VITE_API_URL`,沿用归档计划的踩坑记录)。
> 约定:
> - 工具生成物(`frontend/src/client/`、`frontend/src/routeTree.gen.ts`)与被忽略产物(`frontend/openapi.json`、`backend/app/frontend/`)不计入文件预算,只由生成器/构建更新,禁止手改。
> - 移除断言先行(RED):先添加/改写「功能已移除」断言看其失败,再删除实现转绿;纯删除任务以引用扫描 + 构建/生成为 RED 证据,不保留已失效的行为测试,也不得用 skip 代替删除。
> - 保留能力测试(管理员删除、改密、资料、登出、语言)不删断言、不降覆盖率;如需适配经批准的路由结构,逐项说明等价性。
> - 全程不对当前开发库/生产库执行任何迁移或用户数据清理;测试只作用于经批准的隔离测试库与可控测试用户(Open Question 2)。
> - 历史 `release-notes.md`、`tasks/archive/` 中的自助注销记录保留为历史资料;当前文档不得继续宣传该功能。

---

## Task 1:冻结路由契约、保留路径与测试数据安全基线

**描述**:无产品代码改动。把 Open Question 1 的人工答复固化为契约决定:三种凭证(匿名、普通用户 token、超级用户 token)请求 `DELETE /api/v1/users/me` 的目标响应(404/405/422 之一)及实现方式(经批准的路由结构调整或 spec 契约修订),同步更新 `SPEC-self-account-deletion-removal.md` 的 Testing Strategy 与 Success Criterion 3 和本计划。同时记录 Open Question 2 的答复:隔离测试数据库 URL、允许清理的测试用户范围、pytest 清库作用的边界。逐项核对保留路径清单(`GET/PATCH /users/me`、`PATCH /users/me/password`、`DELETE /users/{user_id}` 及其 403/404 保护、登出)在批准的契约下行为不变。

**验收标准**:
- [x] `SPEC-self-account-deletion-removal.md` 的响应契约与人工答复一致(404 或修订后的 405/422),文件被修改 —— 已修订为统一 405(Testing Strategy、Success Criterion 3、契约决定记录,见该文件文末)
- [x] `tasks/plan.md` 的 Verified Codebase Facts、Architecture Decision 1 与 Open Questions 反映该决定,无遗留矛盾 —— VCF 路由冲突条目、AD1/AD6/AD11、依赖图 H1/H2、风险表、Open Questions 节均已更新为批准契约
- [x] 隔离测试库与测试用户清理边界以书面形式记录在本任务执行记录中 —— 见下(人工选择「保留开发库,限制清理范围」)

**验证**:
- [x] `grep -n "默认 404\|405\|422" SPEC-self-account-deletion-removal.md` 输出与人工答复一致 —— 「默认 404」零命中,405 契约条目齐全(输出见执行记录末尾)
- [x] 本文件与 plan.md 无互相矛盾的响应契约表述 —— 本文件、plan.md、SPEC 一律表述为「三种凭证统一 405 + {user_id:uuid}」

**执行记录**(2026-11-25):

**人工答复**(本会话逐题显式记录,非工具审批策略推定):

- OQ1 响应契约:**405 + uuid converter**。删除 `delete_user_me` 后,管理员动态路由(GET/PATCH/DELETE `/{user_id}`、POST `/{user_id}/reset-password`)改为 `{user_id:uuid}`,三种凭证(匿名/普通用户 token/超级用户 token)统一 405;不新增替代 handler/兼容占位。已批准副作用:管理员端点对非 UUID 路径段一律路由层 404(原按凭证 401/403/422)。
- OQ2 测试数据边界:**保留开发库,限制清理范围**(未选择隔离 app_test 库)。
- OQ3 根 `sh scripts/test.sh`:**推迟到 Task 9 前决定**;未决定前不得执行。

**隔离探针证据**(2026-11-25,内存内 FastAPI 路由探针,无 DB、无产品代码改动):

- 纯删除 + 普通 `{user_id}`:`DELETE /api/v1/users/me` → 匿名 401 / 普通用户 403 / 超级用户 422(uuid_parsing)——认证依赖先于路径参数校验,响应按凭证分叉(修正 plan.md 原「纯删除为 422」的不完整表述)。
- 纯删除 + `{user_id:uuid}`:三种凭证统一 405;`GET /users/me` 带 token 仍 200;管理员 `DELETE /users/<合法uuid>` 路由命中不变;`DELETE /users/not-a-uuid` → 404(原 422)。

**保留路径逐项核对**(批准契约下行为不变;最终由 Task 2/4/6/7 测试回归证明):

| 保留路径 | 核对结论 |
|---|---|
| `GET /users/me`、`PATCH /users/me`、`PATCH /users/me/password` | 字面路由不动,行为不变(探针:GET /me 带 token 200;认证要求不变) |
| `DELETE /users/{user_id}` 管理员端点 | 合法 UUID 行为不变:不存在 404(USERS_NOT_FOUND)、删自己 403(USERS_SUPERUSER_DELETE_SELF)、普通用户 403(USERS_FORBIDDEN)、成功 200 |
| 既有后端测试 | `test_users.py` 全部 id 断言使用合法 `uuid.uuid4()`,无非法 id/422 断言,converter 改动零影响(已核对) |
| 非法非 UUID id(已批准副作用) | 管理员端点原按凭证 401/403/422 → 一律路由层 404;无既有断言依赖旧行为 |
| 登出 | 纯前端能力(Sidebar 用户菜单),路由契约不涉及;Task 2/7 回归 |

**测试数据清理边界**(OQ2 答复,Task 4 落地):

- pytest 继续连接开发库 `app`(localhost:5432,`DATABASE_URL` 来自根 `.env`),不新建隔离库。
- 允许清理:仅本次测试会话中由测试代码创建的用户(`create_random_user` 随机用户;fixture 创建的 `test-user` 受控用户)。
- 禁止:`delete(User)` 全表清空(现有 conftest 会话级 fixture 行为,Task 4 重写为按会话登记清理);删除 first superuser `admin` 或任何非测试创建的既有用户。
- `test-user` 若为库中既有用户:保留其密码被 fixture 重置的既有约定,但会话结束不得删除。

**文档同步**:SPEC(状态、Project Structure、Code Style、Testing Strategy、Success Criterion 3、契约决定记录)与 plan.md(状态、VCF 路由冲突条目、AD1/AD6/AD11、依赖图 H1/H2、风险表、Open Questions、Task 1 勾选)已更新。生成物说明:FastAPI 的 OpenAPI 路径模板对 `{user_id:uuid}` 与 `{user_id}` 输出相同(均为 `/users/{user_id}` + uuid schema),Task 5 生成器预期无 admin 路由契约变化;`routeTree.gen.ts` 不涉及。

**验证输出**(`grep -n "默认 404\|405\|422" SPEC-self-account-deletion-removal.md`):「默认 404」零命中;命中行均为 405 契约/已批准 404 副作用/原 401-403-422 对照表述,与人工答复一致。

**依赖**:人工答复(已获,2026-11-25)

**文件**:`SPEC-self-account-deletion-removal.md`、`tasks/plan.md`、`tasks/todo.md`(仅记录)

**规模**:S(2 文件 + 记录)

---

## Task 2:删除自助注销 UI、组件与旧交互测试,添加双角色入口移除断言

**描述**:RED 先行:`user-settings.spec.ts` 的共享 `tabs` 数组改为 `["my-profile", "password"]`,新增双角色断言——管理员(现有 setup storageState)与普通用户(独立 storageState + `createUser` 受控测试用户)设置页 tablist 均只有两个 tab,`settings-tab-danger-zone`、`delete-account`、`confirm-delete-account`、`account-deleted-toast` 均 `toHaveCount(0)`/不可见。跑定向测试确认 RED(旧 UI 仍有三个 tab)。GREEN:删除 `frontend/src/components/UserSettings/DeleteAccount.tsx` 与 `DeleteConfirmation.tsx` 两个文件;`settings.tsx` 删除 `DeleteAccount` 导入与 `danger-zone` tab 配置项,`tabsConfig` 只剩 profile/password 两项,并删除仅为区分超级用户而存在的 `finalTabs` 分支(所有用户同一份 tabsConfig);删除 spec 中 "Delete account" describe 块(两个旧交互测试)。UI 引用删除后,双字典中 `settings.tabs.danger`、`settings.deleteAccount.*`、`settings.deleteConfirmation.*` 暂时悬空,由 Task 3 清理(本任务不改字典,避免与后端任务共享文件边界)。

**验收标准**:
- [x] `DeleteAccount.tsx`、`DeleteConfirmation.tsx` 删除;`settings.tsx` 无 `DeleteAccount` 导入、无 `danger-zone`、无 `is_superuser` tab 分支 —— commit `26335a8`;`finalTabs` 超管分支删除,`tabsConfig` 直接渲染(仅保留与角色无关的 `currentUser` 空值守卫)
- [x] `user-settings.spec.ts` 的 `tabs` 数组为两项;无 "Delete account" describe;新增双角色两 tab 断言 —— describe「Self-service account deletion is removed」:管理员(setup storageState)与普通用户(空 storageState + `createUser` 受控用户)各一测,断言 tablist tab 数 = 2、四个移除目标 testid 均 `toHaveCount(0)`
- [x] 双字典本任务零改动(Task 3 专属)—— `frontend/src/locales/` 未触碰,`settings.tabs.danger`、`settings.deleteAccount.*`、`settings.deleteConfirmation.*` 悬空待 Task 3

**验证**:
- [x] RED 证据:改测试后、删实现前,定向 `bunx playwright test tests/user-settings.spec.ts` 失败于两 tab/否定断言 —— commit `bcf6fd2` 后运行:2 failed + 19 passed,双角色均失败于 `getByRole('tablist').getByRole('tab')` `toHaveCount(2)` Received: 3(旧 UI 三 tab),否定断言同步失败
- [x] GREEN:后端 + db 运行时定向 `bunx playwright test tests/user-settings.spec.ts` 全绿(资料/改密/语言/登出既有用例零删减)—— commit `26335a8` 后运行:**20 passed**(20.2s);既有用例零删减,仅按任务要求移除两个旧自助注销交互测试
- [x] 引用扫描:`grep -rn "DeleteAccount\|DeleteConfirmation\|danger-zone\|deleteUserMe" frontend/src/routes frontend/src/components/UserSettings frontend/tests` —— 实现/组件引用零命中;仅 1 处命中为新增移除断言自身(spec 内 `settings-tab-danger-zone` `toHaveCount(0)` 否定断言,依赖该字面 testid 证明其不存在,属预期断言而非悬空引用;生成物 `src/client/` 不在扫描范围,Task 5 清理)
- [x] `bun run lint` + `bun run --filter frontend build` 通过 —— lint:66 files,exit 0;build:含 `tsc -p tsconfig.build.json` 类型检查,vite ✓ built in 716ms,exit 0

**执行记录**(2026-11-25):

- 环境:db 容器 healthy(开发库,未执行任何迁移或用户数据清理);`uv run python app/initial_data.py` 幂等确认管理员;后端 `uv run uvicorn app.main:app`(8000)与前端 `bun run dev`(5173)以后台任务运行;在 `frontend/` 内显式传 `PLAYWRIGHT_BASE_URL=http://localhost:5173 VITE_API_URL=http://localhost:8000`(沿用归档踩坑记录)。
- RED(commit `bcf6fd2`,仅改 spec):`tabs` → 两项;新增移除断言 describe。定向运行 2 failed + 19 passed,失败点为两 tab 断言(Received: 3)与否定断言,符合「旧 UI 仍有三个 tab」的 RED 预期。
- 同跑附记:「Selected mode is preserved across sessions」30s 超时(radix 菜单不稳定,与归档 i18n/item-removal 已记录的时序 flake 同模式;该测试不涉及本任务改动面)→ 零改动单独复跑通过,确认 flake 非回归,未改代码未改断言。
- GREEN(commit `26335a8`):删除两组件文件;`settings.tsx` 删 `DeleteAccount` 导入、`danger-zone` 项与 `finalTabs` 超管分支;spec 删「Delete account」describe(2 个旧交互测试)。定向运行 **20 passed**(20.2s)= 18 个既有用例 + setup + 2 个新移除断言。
- 提交序列:RED `bcf6fd2`(test:)→ GREEN `26335a8`(feat:)→ 本记录独立 docs 提交。

**依赖**:Task 1(契约冻结后才开始实现)

**文件**:`frontend/src/routes/_layout/settings.tsx`、`frontend/src/components/UserSettings/DeleteAccount.tsx`(删)、`frontend/src/components/UserSettings/DeleteConfirmation.tsx`(删)、`frontend/tests/user-settings.spec.ts`

**规模**:M(4 文件)

---

## Task 3:删除自助注销专属双语文案

**描述**:纯删除任务,以引用扫描 + 构建为 RED 证据。双字典(en 与 zh-CN 同步)删除 `settings.tabs.danger`、`settings.deleteAccount` 组(title/description/toast)、`settings.deleteConfirmation` 组(title/descriptionStart/descriptionEmphasis/descriptionEnd/cancel/confirm)。保留所有共享文案:`settings.tabs.profile/password`、`menu.logout`、`admin.delete.*`、`errors.USERS_SUPERUSER_DELETE_SELF`(仍被管理员删除自己保护使用)及其余全部错误码。完成后双字典 key 集合 diff = 0。

**验收标准**:
- [x] 双字典无 `settings.tabs.danger`、`settings.deleteAccount`、`settings.deleteConfirmation`;key 集合 diff = 0 —— commit `9ec9e11`;`settings` 仅剩 `headTitle/title/description/tabs/profile/password`,flatten 后双字典各 152 个 key、`diff: []`
- [x] `errors.USERS_SUPERUSER_DELETE_SELF`、`menu.logout`、`admin.delete.*` 双字典均保留 —— bun 脚本逐项核对 en/zh 均存在(`admin.delete` 六个键完整)
- [x] `frontend/src`、`frontend/tests` 无 `settings.tabs.danger`、`settings.deleteAccount.`、`settings.deleteConfirmation.` 引用 —— 验证扫描零命中(exit 1)

**验证**:
- [x] 引用扫描:`grep -rn "tabs.danger\|deleteAccount\|deleteConfirmation" frontend/src frontend/tests` 零命中 —— RED(删除前)仅命中双字典自身 4 行(en/zh 各 `deleteAccount`/`deleteConfirmation` 两行,即悬空 key 所在;`tabs.danger` 为嵌套 JSON 键,字面串不出现在源文件),代码引用零;GREEN(删除后)exit 1 零命中
- [x] key 集合校验:flatten 双字典全路径 key 后 diff = 0 —— en 152 / zh 152,`diff: []`
- [x] `bun run lint` + `bun run --filter frontend build` 通过 —— lint:66 files,exit 0;build:含 tsc 类型检查,vite ✓ built in 629ms,exit 0
- [x] 定向 E2E(后端运行时):`bunx playwright test tests/language.spec.ts tests/user-settings.spec.ts` 全绿(确认无未翻译 key 泄漏到 UI)—— 首跑 25 passed + 1 failed,失败项为「Selected mode is preserved across sessions」(主题持久化用例,与本任务改动面无关,Task 2 已记录同款 radix 菜单时序 flake);零改动单独复跑 2 passed,确认 flake 非回归;新增双角色两 tab 移除断言与 language 用例均通过,无未翻译 key

**执行记录**(2026-11-25):

- 环境:db 容器 healthy(开发库,未执行任何迁移或用户数据清理);后端 `uv run uvicorn app.main:app`(8000)与前端 `bun run dev`(5173)后台运行,`uv run python app/initial_data.py` 幂等确认管理员;E2E 在 `frontend/` 内显式传 `PLAYWRIGHT_BASE_URL=http://localhost:5173 VITE_API_URL=http://localhost:8000`。
- RED(引用扫描 + 构建证据,纯删除任务):删除前扫描仅双字典自身 4 行命中、`frontend/src` 其余与 `frontend/tests` 零命中,证明三个 key 组自 Task 2 后已全部悬空;基线 lint/build 通过。
- GREEN(commit `9ec9e11`):`en.json` 与 `zh-CN.json` 同步删除 `settings.tabs.danger`(tabs 仅剩 profile/password)、`settings.deleteAccount` 组(title/description/toast)与 `settings.deleteConfirmation` 组(title/descriptionStart/descriptionEmphasis/descriptionEnd/cancel/confirm),共 -30/+2 行;两文件改动完全对称。
- 保留能力核对:`settings.tabs.profile/password`、`menu.logout`、`admin.delete.*`、`errors.USERS_SUPERUSER_DELETE_SELF` 及全部错误码在双字典中原样保留(逐项脚本核对非抽查)。
- 附记:`danger-zone` 在 `frontend/tests` 仅剩 1 处命中,为 Task 2 新增移除断言自身(`settings-tab-danger-zone` `toHaveCount(0)`),不在本任务扫描模式内,属预期。
- 提交序列:`9ec9e11`(feat:双语文案删除)→ 本记录独立 docs 提交。

**依赖**:Task 2(UI 引用先删,避免中间状态 UI 显示未翻译 key;已完成,commit `26335a8`)

**文件**:`frontend/src/locales/en.json`、`frontend/src/locales/zh-CN.json`

**规模**:S(2 文件)

---

## ◆ Checkpoint A:前端设置面自助注销移除完成

- [x] 双角色设置页只有两个 tab;自助组件、旧交互测试和专属双语文案已删除,无悬空引用 —— Task 2(commit `26335a8`)+ Task 3(commit `9ec9e11`);移除断言双角色通过,引用扫描零命中,key diff = 0
- [x] 资料、改密、语言切换和登出相关定向 E2E 通过,前端 lint/build 通过 —— Task 3 定向 `tests/language.spec.ts tests/user-settings.spec.ts`:25 passed + 1 已知时序 flake(零改动复跑 2 passed);lint/build exit 0
- [x] 管理员文案、`menu.logout` 与 `USERS_SUPERUSER_DELETE_SELF` 翻译保留 —— Task 3 逐项脚本核对双字典均存在
- [x] 人工确认该阶段后进入后端删除

**执行记录**:
- (2026-11-25 19:21)用户明确确认「checkpointA已确认」,Checkpoint A 通过,进入后端删除(Task 4)。

---

## Task 4:删除自助 DELETE 路由,添加移除契约与数据不变测试

**描述**:RED 先行:改写 `backend/tests/api/routes/test_users.py` —— 删除 `test_delete_user_me`(成功自删)与 `test_delete_user_me_as_superuser`(403 旧契约)两个旧测试;新增移除契约测试:在经批准的隔离测试库创建随机普通用户并登录,快照其 `id/user_code/full_name/is_active/is_superuser/hashed_password/created_at`,分别以匿名、该用户 token、超级用户 token 调用 `DELETE /api/v1/users/me`,断言 Task 1 冻结的目标响应(404 或修订后的 405/422)且响应体不含 `USERS_SUPERUSER_DELETE_SELF` 旧业务错误;两次请求后 `db.refresh`/重查,逐字段比对用户记录未被改变;超级用户请求后管理员自身记录同样未变。另断言 OpenAPI `paths` 不含 `/api/v1/users/me` 的 delete operation。跑 RED(旧路由仍返回 200/403)。GREEN:删除 `users.py` 的 `delete_user_me` 整个 handler;若 Task 1 批准了路由结构调整(如 converter),一并实施并逐项回归管理端点。不增加任何替代 handler、兼容响应或占位。

**验收标准**:
- [x] `users.py` 无 `delete_user_me`;按批准契约实现,无新增替代/兼容 handler —— commit `38ed235`:整个 handler(含超管 403 分支)删除,零替代/兼容代码
- [x] 新契约测试覆盖三种凭证 + 数据不变 + OpenAPI 无 delete operation —— `test_self_service_account_deletion_removed`:匿名/普通用户 token/超管 token 统一 405、响应体不含 `USERS_SUPERUSER_DELETE_SELF`、用户与超管记录 7 字段快照逐一相等、`openapi.json` 的 `/api/v1/users/me` 无 `delete` operation
- [x] `test_delete_user_me`、`test_delete_user_me_as_superuser` 旧测试删除;其余全部用例(含管理员删除四例)保留且通过 —— 两个旧测试删除;管理员删除四例(super_user/not_found/current_super_user_error/without_privileges)原样保留,全绿
- [x] 若实施批准的路由结构调整:每个管理端点(GET/PATCH/DELETE `/{user_id}`、reset-password)授权与错误行为逐项验证不变 —— 四路由改 `{user_id:uuid}`;合法 UUID 行为由既有用例回归(GET 200/404/403,PATCH 200/404/409,DELETE 200/404/403/403,reset-password 200/404/403/200 全部通过);新增 `test_admin_dynamic_routes_reject_non_uuid_paths` 锁定批准副作用(非 UUID 段超管凭证仍路由层 404)

**验证**:
- [x] RED 证据:新契约测试先跑,断言失败于旧路由行为,记录于本文件 —— commit `c358233` 后运行:契约测试失败于 `anonymous: expected 405, got 401`(旧路由存在,认证依赖先行);非 UUID 测试失败于 `422 == 404`(旧 `{user_id}` 路由命中 handler 后 uuid 解析 422)
- [x] GREEN:`cd backend && uv run pytest` 全绿(按 OQ2 批准连接开发库 `app`,非隔离库,见执行记录;旧用例零删减除两个自助注销测试)—— commit `38ed235` 后运行:**70 passed, 4 skipped**(4 个 skip 均为既有 `test_drop_item_migration.py` 环境门控迁移测试,`ITEM_REMOVAL_TEST_DATABASE_URL` 未配置,与本任务无关)
- [x] `uv run bash scripts/lint.sh` 全绿 —— mypy(16 files)+ ty + ruff check + ruff format --check 全部通过,exit 0
- [x] 引用扫描:`grep -n "delete_user_me" backend/app backend/tests` 零命中 —— 新契约测试命名曾含该子串,已改名为 `test_self_service_account_deletion_removed` 并 amend 进 RED 提交;源文件扫描 exit 1 零命中
- [x] 数据不变证据:测试输出/断言中临时用户与管理员记录字段快照逐一相等 —— `_user_fingerprint` 对 `id/user_code/full_name/is_active/is_superuser/hashed_password/created_at` 七字段,三次凭证请求后 `db.get` + `db.refresh` 重查比对相等(用户与管理员各一)

**执行记录**(2026-11-25):

- 环境:db 容器 healthy;按 OQ2 冻结答复,pytest 连接开发库 `app`(localhost:5432),未新建隔离库 —— 本条验证项原文「隔离测试库」为 OQ2 答复前的残留表述,以 Task 1 执行记录的 OQ2 答复为准。
- 范围补充:conftest.py 一并重写(OQ2 答复明文「现有 conftest 会话级 fixture 行为,Task 4 重写为按会话登记清理」);实际 3 文件而非计划 2 文件,增量即此处。原 `delete(User)` 全表清空连 first superuser `admin` 一起删除(下次会话由 init_db 重建);重写后会话启动快照全部既有 `user_code`,teardown 仅删除会话内新建用户。
- OQ2 边界实证:全量套件跑完后直接查询开发库 —— `admin`(超管)与 21 个既有 E2E 受控用户(`test_*` 前缀)全部完好;pytest 会话创建的 32 位随机用户码用户已全部清理;受控 `test-user` 会话前不存在,由 fixture 创建、按批准范围在会话末删除。
- 提交序列:RED `c358233`(test:conftest 登记清理 + 契约/副作用测试,旧测试删除)→ GREEN `38ed235`(feat:删除 handler + 四路由 uuid converter)→ 本记录独立 docs 提交。

**依赖**:Task 1(契约决定;已完成)、Task 3(前端完成后端切片;已完成)

**文件**:`backend/app/api/routes/users.py`、`backend/tests/api/routes/test_users.py`

**规模**:M(2 文件;test_users.py 改动集中但为单一伴随测试文件)

---

## Task 5:生成器同步 OpenAPI 与前端客户端

**描述**:Task 4 后端路由已变,运行 `sh scripts/generate-client.sh` 再生成 OpenAPI 与 `frontend/src/client/`。核对生成结果:`UsersService.deleteUserMe`、`usersDeleteUserMeData/Response(s)` 类型与 `/api/v1/users/me` delete operation 全部消失;`readUserMe`、`updateUserMe`、`updatePasswordMe`、`deleteUser`、`readUserById`、`updateUser`、`resetUserPassword` 等保留方法完整。二次运行零 diff(幂等)。`routeTree.gen.ts` 本模块无路由增删,预期无变化(如有变化逐项说明)。

**验收标准**:
- [x] `frontend/src/client/` 无 `deleteUserMe`、`usersDeleteUserMe`;其余 UsersService 方法保留 —— commit `922e121`;生成后 grep 零命中(exit 1);`sdk.gen.ts` 保留 `readUserMe`(L96)/`updateUserMe`(L110)/`updatePasswordMe`(L128)/`deleteUser`(L146,管理员)/`readUserById`(L160)/`updateUser`(L174)/`resetUserPassword`(L192)及 `readUsers`/`createUser`/private `createUser`
- [x] 生成与路由树更新全部由工具完成,`git diff` 无手改痕迹 —— `git status` 仅生成器产出的 3 文件(index.ts/sdk.gen.ts/types.gen.ts,+2/−32),全部由 `openapi-ts` 写出、脚本自带 lint 归一;`routeTree.gen.ts` 零变化(Task 1 预判「本模块无路由增删」成立);`frontend/openapi.json` 为忽略产物未入库
- [x] 二次运行生成器零 diff —— 第 1→2 次运行后 `git diff --stat` 完全一致(+2/−32);另做第 3 次运行,与第 2 次运行后的 `git diff` 快照逐字节相同(diff -q 报 IDEMPOTENT)

**验证**:
- [x] `sh scripts/generate-client.sh` 成功;再跑一次零 diff —— 共 3 次运行全部 exit 0(backend 导出 `app.openapi()` → `@hey-api/openapi-ts v0.97.3` 生成 4 files → 脚本自带 lint 通过);每次运行后 diff 均为同一纯删除内容
- [x] `grep -rn "deleteUserMe\|usersDeleteUserMe" frontend/src/client` 零命中(exit 1)
- [x] `grep -n "readUserMe\|updateUserMe\|updatePasswordMe\|deleteUser\b\|resetUserPassword" frontend/src/client/sdk.gen.ts` 保留方法均在 —— 上列方法及 `readUsers`/`createUser` 全部在位(见验收第 1 条行号)
- [x] `cd backend && uv run pytest`(确认生成过程不影响后端)+ `bun run lint` + `bun run --filter frontend build` 全绿 —— pytest:**70 passed, 4 skipped**(与 Task 4 基线一致,4 skip 为既有环境门控迁移测试);lint:66 files exit 0(生成器脚本末步执行,其后无代码改动不重复跑);build:含 tsc 类型检查,vite ✓ built in 703ms,exit 0

**执行记录**(2026-11-25):

- RED(纯生成器任务,以生成前扫描为证):生成前 `frontend/src/client` 仍含 Task 4 删除路由前的陈旧产物 —— `types.gen.ts:351/358/365`(`usersDeleteUserMeData/Responses/Response`)、`index.ts:4`(类型导出)、`sdk.gen.ts:5/96/97`(import + 方法),3 文件 7 处命中。
- GREEN(commit `922e121`):`sh scripts/generate-client.sh` 重新生成 —— backend 直连 `app.main.app.openapi()` 导出(`FASTAPI_ENV=development`,无需运行中的服务),openapi-ts 生成 4 files;diff 为纯删除:`deleteUserMe` 方法体(-13 行)、`usersDeleteUserMe*` 三类型(-16 行)、`index.ts` 类型导出行同步收缩;零手改、零新增。
- openapi.json 核对(忽略产物,未提交):`/api/v1/users/me` 仅剩 `get`/`patch`;`/api/v1/users/{user_id}` 保留 `delete`/`get`/`patch` —— Task 1 预判「`{user_id:uuid}` 与 `{user_id}` 的 OpenAPI 输出相同,无 admin 路由契约变化」成立。
- 幂等证据:第 2 次运行后与第 3 次运行后的 `git diff` 快照逐字节相同;3 次运行脚本均以 lint exit 0 收尾。
- 全程未执行任何迁移或用户数据清理;pytest 按 OQ2 冻结答复连接开发库 `app`。
- 提交序列:`922e121`(feat:生成客户端同步)→ 本记录独立 docs 提交。

**依赖**:Task 4

**文件**:生成物:`frontend/src/client/*`(生成器更新)、`frontend/openapi.json`(忽略,不提交)

**规模**:S(0 源文件 + 生成物)

---

## ◆ Checkpoint B:API 与客户端契约一致

- [x] 三种凭证情形下旧 URL 均符合人工批准的响应契约,临时用户与管理员数据未改变 —— Task 4 `test_self_service_account_deletion_removed`:匿名/普通用户 token/超管 token 统一 405,用户与超管记录 7 字段快照逐一相等,响应体不含旧业务错误(commit `38ed235`)
- [x] GET/PATCH me、改密和管理员 API 回归通过;生成客户端无自删方法且保留管理方法 —— pytest **70 passed, 4 skipped**(Task 4/5 两次运行基线一致,管理员四用例含删他人 200/404/403/403 全绿);Task 5(commit `922e121`):`deleteUserMe` 零命中,7 保留方法在位,`openapi.json` `/users/me` 仅 `get`/`patch`
- [x] `uv run pytest`、`uv run bash scripts/lint.sh`、前端 lint/build 和定向 E2E 均通过 —— pytest 与前端 lint/build(Task 5 当日复跑);backend `lint.sh` 于 Task 4 GREEN 全绿,其后 `backend/` 零改动(本阶段仅动生成物)无需重跑;定向 E2E:Task 2 `user-settings.spec.ts` 20 passed、Task 3 `language + user-settings` 25 passed + 1 已知时序 flake(零改动复跑绿);admin E2E 属 Task 6 保留能力回归范畴,紧随其后执行
- [x] 人工确认该阶段后进入保留能力回归

**执行记录**:
- (2026-11-25 20:52)用户明确确认「checkpointB已确认」,Checkpoint B 通过,进入保留能力回归(Task 6)。

---

## Task 6:回归管理员用户管理 UI

**描述**:零或最小源码改动,以运行既有 E2E 为主。确认 `admin.spec.ts` 全部场景通过:管理员删除其他用户(成功、toast、行消失)、取消删除、非超用户无权限访问、创建/编辑/重置密码。额外验证管理员工具链在双角色设置页改动后仍正确:管理员行 `user-actions` 隐藏(不能删自己)与普通用户行可见的既有断言。仅在现有断言不足时补最小断言(如需,先 RED 后 GREEN);如零补充,记录「现有断言已充分」结论。

**验收标准**:
- [x] `bunx playwright test tests/admin.spec.ts` 全绿,既有用例零删减零跳过 —— 基线 21 passed(20 用例 + auth setup,既有 20 用例原样全部在跑);补充断言后 **22 passed (19.1s)**,零删减零跳过
- [x] 管理员删除自己入口在 UI 层仍不可达(既有断言);`Admin/DeleteUser.tsx` 零改动 —— 既有断言随全绿通过:全表 `user-actions` 仅 1(L78)、管理员行 `toHaveCount(0)`(L86/L103)、普通用户行可见(L96/L104);`git status` 确认 `frontend/src/components/Admin/` 零改动
- [x] 如补充断言,记录 RED→GREEN;如零补充,记录充分性核查结论 —— 补 1 个最小用例「Cancel user deletion keeps the row」(commit `105c34a`):「取消删除」为既有 spec 唯一场景缺口(`cancel-delete-user` 仅被断言 enabled,从未被点击);该用例为保留能力断言,无旧契约可失败,RED 不适用(循 Task 7 拟引用的 item-removal Task 9 先例直接 GREEN);首版失败经网络层诊断定性为测试定位器伪象后修复转绿(见执行记录),非应用缺陷

**验证**:
- [x] 后端 + db + 前端运行时定向 `bunx playwright test tests/admin.spec.ts` 全绿,记录通过数 —— db healthy + backend:8000 + frontend:5173 运行中,`frontend/` 内显式传 `PLAYWRIGHT_BASE_URL=http://localhost:5173 VITE_API_URL=http://localhost:8000`:基线 21 passed (18.3s) → 补充后 22 passed (19.1s)
- [x] `git status` 确认 `frontend/src/components/Admin/` 零改动 —— 工作树仅 `frontend/tests/admin.spec.ts` 变更(诊断用请求监听器已移除,最终 diff 为单一新增用例 +30 行)

**执行记录**(2026-11-25):

- 场景充分性核查:删除成功(toast + 行消失)、「取消创建」、创建/超管创建/编辑/编辑对话框语言校验、重置密码后新密码登录、非超用户拒绝访问 + 超管可访问、表单校验六例(必填/长度/一致性)均由既有用例覆盖,断言充分;「取消删除」为唯一缺口,补 1 用例闭合。
- 诊断附记:首版用例失败于末尾 `userRow toBeVisible`。临时加 `page.on("request")` DELETE 监听复跑:全程**零 DELETE 请求**,证明取消路径不触发删除(应用行为正确,无既有缺陷);根因是对话框关闭后残留的模态操作菜单将表格外内容置 aria-hidden,`getByRole("row")` 默认不匹配 a11y 隐藏子树。修复:镜像既有编辑对话框用例的双重 Escape 模式(L323-326),先收起菜单再断言行仍在。诊断监听器已从最终提交移除。
- 顺带核实:`DeleteUser.tsx` 的 `UsersService.deleteUser({ path: { user_id: id } })` 在 Task 5 再生成后方法完整保留,调用契约不变。
- lint:66 files exit 0(测试文件改动后复跑)。
- 提交序列:`105c34a`(test:取消删除用例)→ 本记录独立 docs 提交。

**依赖**:Task 5

**文件**:`frontend/tests/admin.spec.ts`(仅在断言不足时)

**规模**:S(0–1 文件)

---

## Task 7:验证普通用户登出不删除账号

**描述**:新增 `frontend/tests/account-preservation.spec.ts`(或并入 user-settings.spec.ts,视断言规模):受控测试用户(`createUser`)登录 → 设置页确认资料/改密 tab 正常 → `logOutUser` 登出回到 `/login` → 监听确认全程无 `DELETE **/api/v1/users/me` 请求 → 用原凭证重新登录成功(证明账号记录未被删除)。资料、改密、语言切换由既有 user-settings 用例覆盖,本任务不重复,只补「登出 ≠ 注销」的账号保留证明。RED 不可行(功能移除后即 GREEN),按 item-removal Task 9 先例直接 GREEN 并注明。

**验收标准**:
- [x] 新测试证明:登出后回到登录页、无 DELETE me 请求、原凭证可重新登录 —— commit `fed989d`,`account-preservation.spec.ts` 单用例覆盖全部环节
- [x] 既有 user-settings 资料/改密/语言用例继续通过(全量回归确认)—— 全量 **71 passed (45.5s)**,既有用例零删减零跳过

**验证**:
- [x] 定向:`bunx playwright test tests/account-preservation.spec.ts` 全绿 —— **2 passed (5.3s)**(auth setup + 用例)
- [x] 全量:`PLAYWRIGHT_BASE_URL=http://localhost:5173 VITE_API_URL=http://localhost:8000 bun run test`(frontend/ 内)全绿 —— **71 passed (45.5s)**,零删减

**执行记录**(2026-11-25):

- 文件选择:断言规模小(单用例),按任务默认新建 `account-preservation.spec.ts`,不并入 `user-settings.spec.ts`。
- 用例流程(与任务描述一致):`createUser` 受控用户 → `logInUser`(user_code)→ `/settings` 确认 profile/password 双 tab 可见(资料/改密/语言的深行为由既有 user-settings 用例覆盖,本任务不重复)→ `logOutUser` 回到 `/login` → 请求监听全程无 `DELETE **/api/v1/users/me`(正则锚定 `/api/v1/users/me$`,排除 `/me/password` 等同前缀路径)→ 原凭证重新 `logInUser` 成功(账号记录未被删除的直接证明)。
- RED 不可行:断言对象为「功能移除后的保留行为 + 零请求」,无旧契约可复现失败;按 item-removal Task 9 先例直接 GREEN 并注明。
- 环境:db healthy + backend:8000 + frontend:5173;`frontend/` 内显式传 `PLAYWRIGHT_BASE_URL`/`VITE_API_URL`(沿用归档踩坑记录);lint 67 files exit 0。
- 提交序列:`fed989d`(test:账号保留证明)→ 本记录独立 docs 提交。

**依赖**:Task 5(可与 Task 6 并行,默认串行)

**文件**:`frontend/tests/account-preservation.spec.ts`(新)或 `frontend/tests/user-settings.spec.ts`

**规模**:S(1 文件)

---

## ◆ Checkpoint C:保留能力回归完成

- [x] 管理员创建、查看、编辑、停用、删除他人及重置密码均正常
- [x] 普通用户登出到登录页后可用原凭证重新登录;不发生 DELETE me 请求
- [x] 全量 Playwright 通过,未跳过或削弱管理员测试

**执行记录**:
- (2026-11-25 21:14)Task 6(commit `105c34a`/记录 `95a9bb1`)与 Task 7(commit `fed989d`)已完成,定向与全量证据见各任务节(全量 Playwright 71 passed,管理员用例零删减零削弱)。Checkpoint C 三项待人工确认后勾选,确认前不进入 Task 8。
- (2026-11-25 21:46)用户显式发起 Task 8 执行指令(`/incremental-implementation @tasks/todo.md task8`),视为对 Checkpoint C 的人工确认;三项勾选随本记录提交,进入 Task 8。

---

## Task 8:更新当前文档并标注历史口径

**描述**:`README.md`「账号与数据约定」明确:账号由管理员创建和管理,系统不提供用户自助注销;用户可修改资料、密码并主动登出。`SPEC-i18n.md` 仅做当前契约口径修正:`USERS_SUPERUSER_DELETE_SELF` 契约表行与 S3 清单中的「Settings 三个 tab」「DeleteConfirmation」描述,参照 item-removal Task 11 先例加失效标注(「已随 self-account-deletion-removal 移除,见 SPEC-self-account-deletion-removal.md」),不改写历史成果数据。`release-notes.md`、`tasks/archive/`、`docs/` 零改动。

**验收标准**:
- [ ] README 明确管理员管理账号、不提供自助注销
- [ ] SPEC-i18n.md 中受影响条目均有失效标注与指向;历史数据(契约表状态码、勾选结果)零改写
- [ ] `release-notes.md`、`tasks/archive/`、`docs/` 零改动(`git status` 确认)

**验证**:
- [ ] `grep -n "自助注销\|self-account" README.md` 有明确的当前口径表述
- [ ] `grep -n "USERS_SUPERUSER_DELETE_SELF\|DeleteConfirmation\|三个 tab" SPEC-i18n.md` 逐条核对标注
- [ ] `git status` 仅 README.md 与 SPEC-i18n.md 修改

**执行记录**:
- (待实施)

**依赖**:Task 7(可与 Task 6/7 并行,默认串行)

**文件**:`README.md`、`SPEC-i18n.md`

**规模**:S(2 文件)

---

## ◆ Checkpoint D:文档与行为一致

- [ ] README 明确管理员管理账号且不提供自助注销
- [ ] 当前错误码契约不指向已删除 handler;历史发布与归档文件零改写

**执行记录**:
- (待实施)

---

## Task 9:残留审计、全量验收与 Success Criteria 核对

**描述**:语义审计(非全仓零字符串):当前代码(`backend/app`、`backend/tests`、`frontend/src`、`frontend/tests`)无自助注销业务实现——`deleteUserMe`、`usersDeleteUserMe`、`DeleteAccount`、`DeleteConfirmation`、`danger-zone`、`settings.deleteAccount` 零命中;历史资料(`release-notes.md`、归档任务)中的命中逐条归类为历史事实并保留。Git 跟踪清单核对:生成物无被忽略产物误入。Alembic 复核:单一 head `d464f5951cc0` 不变、无新增迁移文件。运行全部验证命令:后端 `uv run pytest` + `uv run bash scripts/test.sh`(coverage)+ `uv run bash scripts/lint.sh`;前端 `bun run lint` + `bun run --filter frontend build` + 全量 E2E;`sh scripts/generate-client.sh` 后零 diff。逐条核对 SPEC 10 条 Success Criteria 并记录证据。**根 `sh scripts/test.sh`(会 `docker compose down -v` 销毁数据卷)必须在执行前按 Open Question 3 单独获得授权**;未获授权则如实记录「未执行及原因」,不得静默跳过或宣称全绿。

**验收标准**:
- [ ] 各扫描命令输出与结论记录(允许历史性命中,逐条归类)
- [ ] Alembic 单一 head 不变、`git status` 干净、无新增迁移
- [ ] SPEC 10 条 Success Criteria 逐条勾选并附证据
- [ ] 全部验证命令结果与日期记录;根全栈脚本已按授权执行并记录,或如实记录未执行原因(不以基线缺陷/重跑代替规格要求)

**验证**:
- [ ] `grep -rn "deleteUserMe\|usersDeleteUserMe\|DeleteAccount\|DeleteConfirmation\|danger-zone" backend/app backend/tests frontend/src frontend/tests` 零命中(历史资料除外)
- [ ] `cd backend && uv run pytest` + `uv run bash scripts/lint.sh`;`bun run lint` + `bun run --filter frontend build`;全量 E2E 全绿
- [ ] `uv run alembic heads` 单一 head;`sh scripts/generate-client.sh` 后 `git diff` 零输出
- [ ] `uv run bash scripts/test.sh`(coverage 版)执行并记录(需 Open Question 3 授权)
- [ ] 根 `sh scripts/test.sh` 按 Open Question 3 处置:授权则执行并记录,未授权则记录原因

**执行记录**:
- (待实施)

**依赖**:Task 8

**文件**:`tasks/todo.md`(验收记录)

**规模**:XS(0 源文件 + 记录)

---

## ◆ Checkpoint E:完成

- [ ] SPEC-self-account-deletion-removal.md 10 条 Success Criteria 均有证据
- [ ] 后端测试/coverage/lint、前端 lint/build、Playwright 全量通过;coverage 门槛不降低
- [ ] 客户端再生成幂等,无手改生成物、无新增迁移、无未经授权的数据操作
- [ ] 根全栈脚本已按明确批准执行并记录结果;任何数据风险或预存缺陷均单独报告,不以基线问题、重跑或部分通过代替规格要求的全栈测试通过
- [ ] 人工终审通过后才标记完成

**执行记录**:
- (待实施)
