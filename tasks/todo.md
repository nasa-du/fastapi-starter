# 任务清单:self-account-deletion-removal(移除用户自助注销)

> 依据 `SPEC-self-account-deletion-removal.md`(待人工评审)与 `tasks/plan.md`。每完成一项即勾选并在本文件记录验证证据。
> **当前状态:计划已编制,实现未开始。Tasks 1–9 全部被 Open Questions 1–3 阻塞,不得在人工答复前开始任何产品代码修改。**
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
- [ ] `SPEC-self-account-deletion-removal.md` 的响应契约与人工答复一致(404 或修订后的 405/422),文件被修改
- [ ] `tasks/plan.md` 的 Verified Codebase Facts、Architecture Decision 1 与 Open Questions 反映该决定,无遗留矛盾
- [ ] 隔离测试库与测试用户清理边界以书面形式记录在本任务执行记录中

**验证**:
- [ ] `grep -n "默认 404\|405\|422" SPEC-self-account-deletion-removal.md` 输出与人工答复一致
- [ ] 本文件与 plan.md 无互相矛盾的响应契约表述

**执行记录**:
- 待人工答复 Open Questions 1–3 后填写

**依赖**:人工答复(阻塞项)

**文件**:`SPEC-self-account-deletion-removal.md`、`tasks/plan.md`、`tasks/todo.md`(仅记录)

**规模**:S(2 文件 + 记录)

---

## Task 2:删除自助注销 UI、组件与旧交互测试,添加双角色入口移除断言

**描述**:RED 先行:`user-settings.spec.ts` 的共享 `tabs` 数组改为 `["my-profile", "password"]`,新增双角色断言——管理员(现有 setup storageState)与普通用户(独立 storageState + `createUser` 受控测试用户)设置页 tablist 均只有两个 tab,`settings-tab-danger-zone`、`delete-account`、`confirm-delete-account`、`account-deleted-toast` 均 `toHaveCount(0)`/不可见。跑定向测试确认 RED(旧 UI 仍有三个 tab)。GREEN:删除 `frontend/src/components/UserSettings/DeleteAccount.tsx` 与 `DeleteConfirmation.tsx` 两个文件;`settings.tsx` 删除 `DeleteAccount` 导入与 `danger-zone` tab 配置项,`tabsConfig` 只剩 profile/password 两项,并删除仅为区分超级用户而存在的 `finalTabs` 分支(所有用户同一份 tabsConfig);删除 spec 中 "Delete account" describe 块(两个旧交互测试)。UI 引用删除后,双字典中 `settings.tabs.danger`、`settings.deleteAccount.*`、`settings.deleteConfirmation.*` 暂时悬空,由 Task 3 清理(本任务不改字典,避免与后端任务共享文件边界)。

**验收标准**:
- [ ] `DeleteAccount.tsx`、`DeleteConfirmation.tsx` 删除;`settings.tsx` 无 `DeleteAccount` 导入、无 `danger-zone`、无 `is_superuser` tab 分支
- [ ] `user-settings.spec.ts` 的 `tabs` 数组为两项;无 "Delete account" describe;新增双角色两 tab 断言
- [ ] 双字典本任务零改动(Task 3 专属)

**验证**:
- [ ] RED 证据:改测试后、删实现前,定向 `bunx playwright test tests/user-settings.spec.ts` 失败于两 tab/否定断言
- [ ] GREEN:后端 + db 运行时定向 `bunx playwright test tests/user-settings.spec.ts` 全绿(资料/改密/语言/登出既有用例零删减)
- [ ] 引用扫描:`grep -rn "DeleteAccount\|DeleteConfirmation\|danger-zone\|deleteUserMe" frontend/src/routes frontend/src/components/UserSettings frontend/tests` 零命中(生成物 `src/client/` 除外,Task 5 清理)
- [ ] `bun run lint` + `bun run --filter frontend build` 通过

**执行记录**:
- (待实施)

**依赖**:Task 1(契约冻结后才开始实现)

**文件**:`frontend/src/routes/_layout/settings.tsx`、`frontend/src/components/UserSettings/DeleteAccount.tsx`(删)、`frontend/src/components/UserSettings/DeleteConfirmation.tsx`(删)、`frontend/tests/user-settings.spec.ts`

**规模**:M(4 文件)

---

## Task 3:删除自助注销专属双语文案

**描述**:纯删除任务,以引用扫描 + 构建为 RED 证据。双字典(en 与 zh-CN 同步)删除 `settings.tabs.danger`、`settings.deleteAccount` 组(title/description/toast)、`settings.deleteConfirmation` 组(title/descriptionStart/descriptionEmphasis/descriptionEnd/cancel/confirm)。保留所有共享文案:`settings.tabs.profile/password`、`menu.logout`、`admin.delete.*`、`errors.USERS_SUPERUSER_DELETE_SELF`(仍被管理员删除自己保护使用)及其余全部错误码。完成后双字典 key 集合 diff = 0。

**验收标准**:
- [ ] 双字典无 `settings.tabs.danger`、`settings.deleteAccount`、`settings.deleteConfirmation`;key 集合 diff = 0
- [ ] `errors.USERS_SUPERUSER_DELETE_SELF`、`menu.logout`、`admin.delete.*` 双字典均保留
- [ ] `frontend/src`、`frontend/tests` 无 `settings.tabs.danger`、`settings.deleteAccount.`、`settings.deleteConfirmation.` 引用

**验证**:
- [ ] 引用扫描:`grep -rn "tabs.danger\|deleteAccount\|deleteConfirmation" frontend/src frontend/tests` 零命中
- [ ] key 集合校验:flatten 双字典全路径 key 后 diff = 0
- [ ] `bun run lint` + `bun run --filter frontend build` 通过
- [ ] 定向 E2E(后端运行时):`bunx playwright test tests/language.spec.ts tests/user-settings.spec.ts` 全绿(确认无未翻译 key 泄漏到 UI)

**执行记录**:
- (待实施)

**依赖**:Task 2(UI 引用先删,避免中间状态 UI 显示未翻译 key)

**文件**:`frontend/src/locales/en.json`、`frontend/src/locales/zh-CN.json`

**规模**:S(2 文件)

---

## ◆ Checkpoint A:前端设置面自助注销移除完成

- [ ] 双角色设置页只有两个 tab;自助组件、旧交互测试和专属双语文案已删除,无悬空引用
- [ ] 资料、改密、语言切换和登出相关定向 E2E 通过,前端 lint/build 通过
- [ ] 管理员文案、`menu.logout` 与 `USERS_SUPERUSER_DELETE_SELF` 翻译保留
- [ ] 人工确认该阶段后进入后端删除

**执行记录**:
- (待实施)

---

## Task 4:删除自助 DELETE 路由,添加移除契约与数据不变测试

**描述**:RED 先行:改写 `backend/tests/api/routes/test_users.py` —— 删除 `test_delete_user_me`(成功自删)与 `test_delete_user_me_as_superuser`(403 旧契约)两个旧测试;新增移除契约测试:在经批准的隔离测试库创建随机普通用户并登录,快照其 `id/user_code/full_name/is_active/is_superuser/hashed_password/created_at`,分别以匿名、该用户 token、超级用户 token 调用 `DELETE /api/v1/users/me`,断言 Task 1 冻结的目标响应(404 或修订后的 405/422)且响应体不含 `USERS_SUPERUSER_DELETE_SELF` 旧业务错误;两次请求后 `db.refresh`/重查,逐字段比对用户记录未被改变;超级用户请求后管理员自身记录同样未变。另断言 OpenAPI `paths` 不含 `/api/v1/users/me` 的 delete operation。跑 RED(旧路由仍返回 200/403)。GREEN:删除 `users.py` 的 `delete_user_me` 整个 handler;若 Task 1 批准了路由结构调整(如 converter),一并实施并逐项回归管理端点。不增加任何替代 handler、兼容响应或占位。

**验收标准**:
- [ ] `users.py` 无 `delete_user_me`;按批准契约实现,无新增替代/兼容 handler
- [ ] 新契约测试覆盖三种凭证 + 数据不变 + OpenAPI 无 delete operation
- [ ] `test_delete_user_me`、`test_delete_user_me_as_superuser` 旧测试删除;其余全部用例(含管理员删除四例)保留且通过
- [ ] 若实施批准的路由结构调整:每个管理端点(GET/PATCH/DELETE `/{user_id}`、reset-password)授权与错误行为逐项验证不变

**验证**:
- [ ] RED 证据:新契约测试先跑,断言失败于旧路由行为(200/403),记录于本文件
- [ ] GREEN:`cd backend && uv run pytest` 全绿(隔离测试库;旧用例零删减除两个自助注销测试)
- [ ] `uv run bash scripts/lint.sh` 全绿
- [ ] 引用扫描:`grep -n "delete_user_me" backend/app backend/tests` 零命中
- [ ] 数据不变证据:测试输出/断言中临时用户与管理员记录字段快照逐一相等

**执行记录**:
- (待实施)

**依赖**:Task 1(契约决定)、Task 3(前端完成后端切片;后端技术上仅依赖 Task 1)

**文件**:`backend/app/api/routes/users.py`、`backend/tests/api/routes/test_users.py`

**规模**:M(2 文件;test_users.py 改动集中但为单一伴随测试文件)

---

## Task 5:生成器同步 OpenAPI 与前端客户端

**描述**:Task 4 后端路由已变,运行 `sh scripts/generate-client.sh` 再生成 OpenAPI 与 `frontend/src/client/`。核对生成结果:`UsersService.deleteUserMe`、`usersDeleteUserMeData/Response(s)` 类型与 `/api/v1/users/me` delete operation 全部消失;`readUserMe`、`updateUserMe`、`updatePasswordMe`、`deleteUser`、`readUserById`、`updateUser`、`resetUserPassword` 等保留方法完整。二次运行零 diff(幂等)。`routeTree.gen.ts` 本模块无路由增删,预期无变化(如有变化逐项说明)。

**验收标准**:
- [ ] `frontend/src/client/` 无 `deleteUserMe`、`usersDeleteUserMe`;其余 UsersService 方法保留
- [ ] 生成与路由树更新全部由工具完成,`git diff` 无手改痕迹
- [ ] 二次运行生成器零 diff

**验证**:
- [ ] `sh scripts/generate-client.sh` 成功;再跑一次零 diff
- [ ] `grep -rn "deleteUserMe\|usersDeleteUserMe" frontend/src/client` 零命中(exit 1)
- [ ] `grep -n "readUserMe\|updateUserMe\|updatePasswordMe\|deleteUser\b\|resetUserPassword" frontend/src/client/sdk.gen.ts` 保留方法均在
- [ ] `cd backend && uv run pytest`(确认生成过程不影响后端)+ `bun run lint` + `bun run --filter frontend build` 全绿

**执行记录**:
- (待实施)

**依赖**:Task 4

**文件**:生成物:`frontend/src/client/*`(生成器更新)、`frontend/openapi.json`(忽略,不提交)

**规模**:S(0 源文件 + 生成物)

---

## ◆ Checkpoint B:API 与客户端契约一致

- [ ] 三种凭证情形下旧 URL 均符合人工批准的响应契约,临时用户与管理员数据未改变
- [ ] GET/PATCH me、改密和管理员 API 回归通过;生成客户端无自删方法且保留管理方法
- [ ] `uv run pytest`、`uv run bash scripts/lint.sh`、前端 lint/build 和定向 E2E 均通过
- [ ] 人工确认该阶段后进入保留能力回归

**执行记录**:
- (待实施)

---

## Task 6:回归管理员用户管理 UI

**描述**:零或最小源码改动,以运行既有 E2E 为主。确认 `admin.spec.ts` 全部场景通过:管理员删除其他用户(成功、toast、行消失)、取消删除、非超用户无权限访问、创建/编辑/重置密码。额外验证管理员工具链在双角色设置页改动后仍正确:管理员行 `user-actions` 隐藏(不能删自己)与普通用户行可见的既有断言。仅在现有断言不足时补最小断言(如需,先 RED 后 GREEN);如零补充,记录「现有断言已充分」结论。

**验收标准**:
- [ ] `bunx playwright test tests/admin.spec.ts` 全绿,既有用例零删减零跳过
- [ ] 管理员删除自己入口在 UI 层仍不可达(既有断言);`Admin/DeleteUser.tsx` 零改动
- [ ] 如补充断言,记录 RED→GREEN;如零补充,记录充分性核查结论

**验证**:
- [ ] 后端 + db + 前端运行时定向 `bunx playwright test tests/admin.spec.ts` 全绿,记录通过数
- [ ] `git status` 确认 `frontend/src/components/Admin/` 零改动

**执行记录**:
- (待实施)

**依赖**:Task 5

**文件**:`frontend/tests/admin.spec.ts`(仅在断言不足时)

**规模**:S(0–1 文件)

---

## Task 7:验证普通用户登出不删除账号

**描述**:新增 `frontend/tests/account-preservation.spec.ts`(或并入 user-settings.spec.ts,视断言规模):受控测试用户(`createUser`)登录 → 设置页确认资料/改密 tab 正常 → `logOutUser` 登出回到 `/login` → 监听确认全程无 `DELETE **/api/v1/users/me` 请求 → 用原凭证重新登录成功(证明账号记录未被删除)。资料、改密、语言切换由既有 user-settings 用例覆盖,本任务不重复,只补「登出 ≠ 注销」的账号保留证明。RED 不可行(功能移除后即 GREEN),按 item-removal Task 9 先例直接 GREEN 并注明。

**验收标准**:
- [ ] 新测试证明:登出后回到登录页、无 DELETE me 请求、原凭证可重新登录
- [ ] 既有 user-settings 资料/改密/语言用例继续通过(全量回归确认)

**验证**:
- [ ] 定向:`bunx playwright test tests/account-preservation.spec.ts`(或并入后的 user-settings.spec.ts)全绿
- [ ] 全量:`PLAYWRIGHT_BASE_URL=... VITE_API_URL=... bun run test`(frontend/ 内)全绿,记录通过数,既有用例零删减

**执行记录**:
- (待实施)

**依赖**:Task 5(可与 Task 6 并行,默认串行)

**文件**:`frontend/tests/account-preservation.spec.ts`(新)或 `frontend/tests/user-settings.spec.ts`

**规模**:S(1 文件)

---

## ◆ Checkpoint C:保留能力回归完成

- [ ] 管理员创建、查看、编辑、停用、删除他人及重置密码均正常
- [ ] 普通用户登出到登录页后可用原凭证重新登录;不发生 DELETE me 请求
- [ ] 全量 Playwright 通过,未跳过或削弱管理员测试

**执行记录**:
- (待实施)

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
