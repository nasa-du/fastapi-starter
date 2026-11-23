# 任务清单:item-removal(移除 Item 功能)

> 依据 `SPEC-item-removal.md`(已确认)与 `tasks/plan.md`。每完成一项即勾选并在本文件记录验证证据。
> 环境前提:后端测试需 `docker compose up -d db`;E2E 需后端 + 数据库运行(在 `frontend/` 内运行并显式传 `PLAYWRIGHT_BASE_URL`/`VITE_API_URL`,见归档 i18n 计划的踩坑记录)。
> 约定:
> - 工具生成物(`frontend/src/client/`、`frontend/src/routeTree.gen.ts`)与被忽略产物(`frontend/openapi.json`、`backend/app/frontend/`)不计入文件预算,只由生成器/构建更新。
> - 移除断言先行(RED):先添加/改写「功能已移除」断言看其失败,再删除实现转绿;纯删除任务以引用扫描 + 构建/生成为 RED 证据,不保留已失效的 CRUD 行为测试。
> - 历史迁移、`release-notes.md`、已归档任务中的 Item 记录保留为历史资料;当前文档与当前契约文档不得继续把 Item 描述为可用功能。
> - 全程不对当前开发库/生产库执行任何迁移;破坏性迁移仅在 Task 7 的隔离库中验证。

---

## Task 1:删除 Item 路由、加载组件、侧边栏入口及直接断言

**描述**:删除 `routes/_layout/items.tsx` 与其唯一消费者 `components/Pending/PendingItems.tsx`;`AppSidebar.tsx` 移除 Items 导航项与仅为其存在的 `Briefcase` 导入。同步处理直接指向该页面的前端测试:删除 `tests/items.spec.ts`;`login.spec.ts` 侧边栏断言由「项目链接可见」改为「断言不存在」;`language.spec.ts` 路由标题矩阵移除 `/items` 行。

**验收标准**:
- [x] `frontend/src/routes/_layout/items.tsx`、`frontend/src/components/Pending/PendingItems.tsx`、`frontend/tests/items.spec.ts` 删除
- [x] `AppSidebar.tsx` 无 Items 导航项,`Briefcase` 导入删除;`login.spec.ts` 断言侧边栏无「项目/Items」链接(双语)
- [x] `language.spec.ts` 不再访问 `/items`

**验证**:
- [x] 引用扫描:`grep -rn "routes/_layout/items\|PendingItems\|Briefcase" frontend/src` 零命中
- [x] `bun run lint` + `bun run --filter frontend build` 通过(构建重写 `routeTree.gen.ts`,不再含 `/items`)
- [x] 定向 E2E(后端运行时):`bunx playwright test tests/login.spec.ts tests/language.spec.ts` 全绿

**执行记录**(2026-11-23):
- RED 先行:提交 `ea35330`(login.spec.ts 侧边栏断言改「项目链接不存在」),定向运行失败于 `toHaveCount(0)`(定位到 1 个元素),符合预期
- GREEN:删除三个文件;`AppSidebar.tsx` 移除 Items 项与 `Briefcase` 导入;`language.spec.ts` 路由标题矩阵移除 `/items` 行;`routeTree.gen.ts` 由 build 重生成(grep `items` 零命中);构建产物无 items chunk
- 双语断言布局调整:中文「项目」不存在断言保留在「Sidebar and user menu use localized labels」用例;英文「Items」不存在断言落在「Sidebar controls respond to language changes」用例(已切至 en 状态)。原因:在用户菜单 Escape 后紧接着连续开关语言下拉,radix 菜单元素不稳定导致确定性超时(等待 `language-zh` 挂起,含 60s 超时复现),故复用既有已切英的用例而非新开菜单往返
- `bunx playwright test tests/login.spec.ts tests/language.spec.ts` — **28 passed**(GREEN 提交后复跑仍 28 passed);`bun run lint`(72 files)绿;`bun run --filter frontend build` 绿
- E2E 环境:开发库 `docker compose up -d db` + `uv run python app/initial_data.py` 重建管理员;后端 `uvicorn`(8000)与前端 `vite dev`(5173)以后台任务运行,`PLAYWRIGHT_BASE_URL`/`VITE_API_URL` 显式传递上下文沿用既有踩坑记录

**依赖**:无

**文件**:`frontend/src/routes/_layout/items.tsx`(删)、`frontend/src/components/Pending/PendingItems.tsx`(删)、`frontend/src/components/Sidebar/AppSidebar.tsx`、`frontend/tests/items.spec.ts`(删)、`frontend/tests/login.spec.ts`

**规模**:M(5 文件;language.spec.ts 的 `/items` 行同属本任务测试伴随)

---

## Task 2:删除 Item 组件目录

**描述**:整目录删除 `frontend/src/components/Items/`(AddItem、EditItem、DeleteItem、ItemActionsMenu、columns)。Task 1 已移除其全部消费者,本任务为纯删除。

**验收标准**:
- [x] `frontend/src/components/Items/` 目录不存在
- [x] 无任何源文件导入这五个组件

**验证**:
- [x] 引用扫描:`grep -rn "components/Items\|AddItem\|EditItem\|DeleteItem\|ItemActionsMenu" frontend/src` 零命中
- [x] `bun run lint` + `bun run --filter frontend build` 通过(tsc 无悬空导入)

**执行记录**(2026-11-23):
- 纯删除任务,按约定以引用扫描 + 构建/生成为 RED 证据:删除前扫描命中均为 `components/Items/` 内部互引(`columns` → `ItemActionsMenu` → `EditItem`/`DeleteItem`)与生成物 `src/client/` 中的 `items*` 类型名,手写源码零外部消费者
- `git rm -r src/components/Items/`(5 文件);删除后 `frontend/src` 手写源码扫描零命中,目录不存在
- 生成物 `src/client/` 仍含 `itemsDeleteItem*` 等类型名(子串命中,非组件导入):按本文件头部约定生成物仅由生成器更新,待 Task 4 删后端路由后 Task 6 再生成清零
- `bun run lint`(67 files)绿;`bun run --filter frontend build` 绿(tsc 无悬空导入);无 E2E 要求(本任务验证清单未列)
- 提交:`e44c802` 之后本任务提交为纯删除 commit(见 git log `feat: delete Items component directory`)

**依赖**:Task 1

**文件**:`frontend/src/components/Items/{AddItem,EditItem,DeleteItem,ItemActionsMenu,columns}.tsx`(全删)

**规模**:S(5 个删除)

---

## Task 3:删除 Item 文案与 Item 专属测试工具

**描述**:双字典删除 `items` 组、`nav.items`、`ITEMS_NOT_FOUND`、`ITEMS_FORBIDDEN`(en 与 zh-CN 同步);`tests/utils/random.ts` 删除 `randomItemTitle`/`randomItemDescription`。完成后双字典 key 集合 diff = 0。

**验收标准**:
- [ ] 双字典无 `items` 组、`nav.items`、`ITEMS_*`;key 集合 diff = 0
- [ ] `random.ts` 无 Item 专属函数,其余函数保留
- [ ] `frontend/src` 中 `t("items.` 与 `nav.items` 零引用

**验证**:
- [ ] 引用扫描:`grep -rn "t(\"items\.\|nav\.items\|randomItem" frontend/src frontend/tests` 零命中
- [ ] `bun run lint` + `bun run --filter frontend build` 通过
- [ ] 定向 E2E(后端运行时):`bunx playwright test tests/language.spec.ts` 全绿

**依赖**:Task 1、Task 2

**文件**:`frontend/src/locales/en.json`、`frontend/src/locales/zh-CN.json`、`frontend/tests/utils/random.ts`

**规模**:S(3–4 文件)

---

## ◆ Checkpoint A:前端源码无 Item 业务入口

- [ ] `bun run lint` + `bun run --filter frontend build` 通过;路由树无 `/items`
- [ ] 双字典与现有测试不再依赖 Item 页面;`backend/app/frontend/` 构建产物不含 items chunk(本地验证,不提交)
- [ ] 人工确认后进入 Phase 2

---

## Task 4:删除 Item API 并添加未注册路由契约测试

**描述**:RED 先行:新建 `backend/tests/api/routes/test_items_removed.py`,断言 `/api/v1/items/` 的 GET/POST 与 `/api/v1/items/{id}` 的 GET/PUT/DELETE 均返回 FastAPI 默认 404(带有效 token 与匿名均为未匹配路由行为,而非 401/405/旧 CRUD 响应)。随后删除 `routes/items.py` 并从 `api/main.py` 移除注册;删除旧 `test_items.py`。

**验收标准**:
- [ ] `backend/app/api/routes/items.py`、`backend/tests/api/routes/test_items.py` 删除;`api/main.py` 不再注册 items
- [ ] 新契约测试断言五个原端点默认 404,且 OpenAPI 无 items 路径
- [ ] 其余路由(login、users、private)不受影响

**验证**:
- [ ] RED:契约测试先跑,5 处断言失败(旧路由仍返回 200/404-by-id 等旧行为)
- [ ] GREEN:`cd backend && uv run pytest` 全绿
- [ ] `uv run ruff check app && uv run ruff format app --check`(等效 lint 的 uv 调用,见归档备注)

**依赖**:Task 3(串行默认;后端实际不依赖前端任务)

**文件**:`backend/app/api/routes/items.py`(删)、`backend/app/api/main.py`、`backend/tests/api/routes/test_items.py`(删)、`backend/tests/api/routes/test_items_removed.py`(新)

**规模**:S(4 文件)

---

## Task 5:删除 Item 模型、CRUD、关系与引用

**描述**:`models.py` 删除 `ItemBase/ItemCreate/ItemUpdate/Item/ItemPublic/ItemsPublic` 与 `User.items` 关系;`crud.py` 删除 `create_item` 与 Item 导入;`users.py` 的 `delete_user` 移除显式 Item 清理语句与 Item 导入(管理员删除用户本身保留,依赖数据库 CASCADE 行为由迁移 downgrade 结构保证);`tests/conftest.py` 清理 fixture 去掉 Item 删除;`tests/test_models.py` 保留 User UUID v7 断言、删除 Item 相关构造与断言。

**验收标准**:
- [ ] `backend/app` 中 `Item`、`ItemCreate`、`ItemUpdate`、`ItemPublic`、`ItemsPublic`、`create_item`、`items` 关系零引用
- [ ] `test_models.py` 仍断言新建 User id 为 UUID v7
- [ ] `Message`、`User.created_at`、UUID v7 等共享能力不受影响

**验证**:
- [ ] 引用扫描:`grep -rn "\bItem\b\|create_item" backend/app backend/tests --include="*.py"` 仅剩历史迁移与历史文档命中
- [ ] `cd backend && uv run pytest` 全绿(含管理员删除用户、登录、密码重置)
- [ ] `uv run mypy app && uv run ty check app && uv run ruff check app && uv run ruff format app --check` 全绿

**依赖**:Task 4

**文件**:`backend/app/models.py`、`backend/app/crud.py`、`backend/app/api/routes/users.py`、`backend/tests/conftest.py`、`backend/tests/test_models.py`

**规模**:M(5 文件)

---

## Task 6:删除 Item 测试工具并再生成客户端与路由树

**描述**:删除 `backend/tests/utils/item.py`(Task 4 后已无消费者);运行 `sh scripts/generate-client.sh` 再生成 OpenAPI 与 `frontend/src/client/`;前端构建刷新 `routeTree.gen.ts`。生成后核对无 Item service/DTO,且二次运行零 diff(幂等)。

**验收标准**:
- [ ] `backend/tests/utils/item.py` 删除;`backend/tests` 无 Item 引用
- [ ] `frontend/src/client/` 无 `ItemsService`、`ItemPublic`、`ItemCreate`、`ItemUpdate`、`items*` 类型与路径
- [ ] 生成与路由树更新全部由工具完成,`git diff` 无手改痕迹

**验证**:
- [ ] `sh scripts/generate-client.sh` 成功;再跑一次零 diff
- [ ] `grep -rn "items" frontend/src/client frontend/src/routeTree.gen.ts` 零命中(大小写不敏感)
- [ ] `cd backend && uv run pytest` + `bun run lint` + `bun run --filter frontend build` 全绿

**依赖**:Task 5

**文件**:`backend/tests/utils/item.py`(删);生成物:`frontend/openapi.json`(忽略,不提交)、`frontend/src/client/*`、`frontend/src/routeTree.gen.ts`

**规模**:S(1 源文件 + 生成物)

---

## ◆ Checkpoint B:应用不再读写 Item

- [ ] 后端完整测试、前端 lint/build 通过
- [ ] OpenAPI 与生成客户端无 Item API/schema;路由树无 `/items`
- [ ] 当前开发库未执行删表;人工确认后进入 Task 7

---

## Task 7:新增删表迁移与隔离 PostgreSQL 往返测试

**描述**:新增迁移 `down_revision='7125f2112706'`:upgrade 仅 `op.drop_table("item")`;downgrade 按删表前最终结构重建空表(UUID 主键、非空 `owner_id` 外键 `ON DELETE CASCADE` → `user.id`、`title VARCHAR(255)` 非空、`description VARCHAR(255)` 可空、带时区 `created_at` 可空),注释明确不恢复数据。`alembic/env.py` 支持自定义选项 `item_removal_database_url`(仅存在时采用,否则维持全局 Settings)。新增 `backend/tests/migrations/test_drop_item_migration.py`:fixture 要求 `ITEM_REMOVAL_TEST_DATABASE_URL` 指向专用实例的管理库,随机库名建库/销毁,独立 `Config` 读 `backend/alembic.ini` 并注入 URL,连接前断言目标 host/database 非当前 `DATABASE_URL`;未配置该变量时 `pytest.skip`。

**验收标准**:
- [ ] 迁移文件存在且 upgrade/downgrade 均实现;`uv run alembic heads` 单一 head
- [ ] 隔离库四步通过:空库 `upgrade head`(item 不存在)→ 旧 head 库含 User+Item 数据升级(item 表与数据消失,User 表行数/字段/主键不变)→ `downgrade -1`(空表结构逐列/约束符合)→ 再 `upgrade head`(item 再消失,User 数据保留)
- [ ] `uv run alembic check` 无 Item 相关漂移;历史迁移文件零改动
- [ ] 测试结束隔离库已销毁;当前开发库无任何变更

**验证**:
- [ ] `ITEM_REMOVAL_TEST_DATABASE_URL=<专用测试实例> cd backend && uv run pytest tests/migrations -v` 全绿,日志记录实际连接目标与随机库名
- [ ] `uv run alembic check` 输出记录(区分既有非 Item 差异)
- [ ] `git diff backend/app/alembic/versions/` 仅新增文件
- [ ] 未配置变量时:`uv run pytest tests/migrations` 全部 skip(证明不会误连)

**依赖**:Task 6

**文件**:`backend/app/alembic/versions/<rev>_drop_item_table.py`(新)、`backend/app/alembic/env.py`、`backend/tests/migrations/__init__.py`(新)、`backend/tests/migrations/test_drop_item_migration.py`(新)

**规模**:M(4 文件)

---

## ◆ Checkpoint C:迁移安全验证

- [ ] 隔离库升级/降级/再升级全部通过;User 数据不变;downgrade 仅空表
- [ ] 历史迁移未修改;测试库销毁;开发/生产库零操作(执行记录核对)
- [ ] 人工确认后进入 Phase 4

---

## Task 8:回归用户管理与普通用户 API

**描述**:确认 Task 5 后管理员 `DELETE /users/{user_id}` 全链路正常(删除他人成功、404、删除自己 403 `USERS_SUPERUSER_DELETE_SELF`、普通用户 403);普通用户登录/资料/改密不受影响。仅在现有断言不足时补最小回归(如管理员删除用户后断言无 SQL 错误且用户消失)。

**验收标准**:
- [ ] `cd backend && uv run pytest` 全量绿,含 `test_users.py`/`test_login.py`/`test_private.py`/`test_models.py`
- [ ] 如补充断言,不改既有断言、不降覆盖率

**验证**:
- [ ] 全量 pytest 绿;新增断言(如有)先 RED 后 GREEN
- [ ] `uv run bash scripts/test.sh` 的 coverage 流程暂不执行,留 Task 13

**依赖**:Task 7

**文件**:`backend/tests/api/routes/test_users.py`(仅在断言不足时)

**规模**:S(0–1 文件)

---

## Task 9:回归管理员/普通用户导航与 Not Found 行为

**描述**:新增 `frontend/tests/items-removed.spec.ts`:管理员(现有 setup)与临时普通用户(`privateApi.createUser`)侧边栏均无 Items 链接;两角色访问 `/items` 均呈现现有 Not Found(`data-testid="not-found"`),无重定向、无 Item 页面痕迹。运行全量 E2E 回归。注意:全量 pytest 后 User 表被清空,先 `cd backend && uv run python app/initial_data.py` 重建开发管理员再跑 E2E(沿用归档环境备注)。

**验收标准**:
- [ ] 双角色侧边栏无 Items;`/items` → Not Found 断言通过
- [ ] 全量 E2E(`bun run test`)绿,既有用例零删减(除 Task 1 已处理的失效用例)

**验证**:
- [ ] RED:新 spec 先在未改 UI 前不可行——本任务在 Task 1–3 完成后执行,直接 GREEN;若意外失败按缺陷处理
- [ ] `PLAYWRIGHT_BASE_URL=http://localhost:5173 bun run test`(frontend/ 内)全量绿,记录通过数

**依赖**:Task 8

**文件**:`frontend/tests/items-removed.spec.ts`(新;必要时 `frontend/tests/utils/user.ts` 微调)

**规模**:S(1–2 文件)

---

## Task 10:更新当前 README 并删除失效截图

**描述**:`README.md` 删除「Items 页」截图小节与 `img/dashboard-items.png`;「账号与数据约定」中「新建的 User 与 Item 使用 UUID v7」改为仅 User;如正文仍有 Item 功能描述一并清除。历史 `release-notes.md` 不动。

**验收标准**:
- [ ] 当前 README 不再展示/承诺 Item 功能;失效截图删除
- [ ] UUID v7 描述仅保留 User;文档内链接与图片引用有效

**验证**:
- [ ] `grep -n "Item\|items" README.md` 逐条核对(仅允许历史性提及且明确已移除,或无命中)
- [ ] `uv run prek run typos --files README.md` 通过;图片引用检查无断链

**依赖**:Task 8(可与 Task 9 并行,默认串行)

**文件**:`README.md`、`img/dashboard-items.png`(删)

**规模**:S(2 文件)

---

## Task 11:标注历史规格中的 Item 失效口径

**描述**:`SPEC-i18n.md` 仍被 README 引用为当前错误码契约:在 `ITEMS_NOT_FOUND`/`ITEMS_FORBIDDEN` 契约表行与相关叙述处标注「随 item-removal 移除,见 SPEC-item-removal.md」;S2/S5 清单中的 Items 描述加历史标注。`SPEC.md`、`docs/`、归档任务为历史资料,不改写事实。

**验收标准**:
- [ ] 当前契约文档(SPEC-i18n.md)的 ITEMS 条目均有失效标注与指向
- [ ] 历史文档未被改写

**验证**:
- [ ] `grep -n "ITEMS_" SPEC-i18n.md` 逐条核对标注
- [ ] `uv run prek run typos --files SPEC-i18n.md` 通过

**依赖**:Task 10

**文件**:`SPEC-i18n.md`

**规模**:XS(1 文件)

---

## ◆ Checkpoint D:用户与维护者路径一致

- [ ] 管理员用户管理、普通用户设置/登录/登出回归全绿
- [ ] 当前文档不再承诺 Item;历史记录保留
- [ ] 人工确认后进入 Phase 5

---

## Task 12:审计当前代码、生成物与历史资料边界

**描述**:语义审计而非全仓零字符串:当前代码(`backend/app`、`backend/tests`、`frontend/src`、`frontend/tests`)无 Item 业务实现;生成物与忽略规则核对(`frontend/src/client/`、`routeTree.gen.ts` 跟踪且无 Item;`frontend/openapi.json`、`backend/app/frontend/` 忽略);历史迁移/`release-notes.md`/归档/`docs/` 原样保留;`img/` 与文档引用一致。结果记录到本任务。

**验收标准**:
- [ ] 各扫描命令输出与结论记录(允许历史性命中,逐条说明归类)
- [ ] Git 跟踪清单无被忽略产物误入;无遗留失效引用

**验证**:
- [ ] `grep -rni "\bitem" backend/app frontend/src --include="*.py" --include="*.ts" --include="*.tsx"` 逐条归类(预期仅 `nav`/侧边栏通用 `items` 变量等通用命名,非 Item 业务)
- [ ] `git ls-files` 核对生成物;`git status` 干净
- [ ] `cd backend && uv run alembic heads`(单 head)与 `uv run alembic check`(无 Item 漂移)复核

**依赖**:Task 11

**文件**:无源码改动(仅本文件记录)

**规模**:XS

---

## Task 13:全量验证并逐条核对规格

**描述**:运行全部验证命令,逐条核对 `SPEC-item-removal.md` 的 10 条 Success Criteria 并记录证据。全栈 Docker 测试(`sh scripts/test.sh`,会 `docker compose down -v` 销毁数据卷)**必须在执行前单独向用户确认**;未确认则记录「未执行及环境原因」。

**验收标准**:
- [ ] 10 条 Success Criteria 逐条勾选并附证据
- [ ] `cd backend && uv run pytest`、`uv run bash scripts/test.sh`(coverage)、`bash scripts/lint.sh`、`bun run lint`、`bun run --filter frontend build`、全量 E2E 全绿
- [ ] `sh scripts/generate-client.sh` 后零 diff
- [ ] 全栈测试:已确认执行并绿,或记录未执行原因

**验证**:
- [ ] 上述命令逐条运行并记录结果与日期
- [ ] SPEC 核对表写入本任务;人工终审后勾选 Checkpoint E

**依赖**:Task 12

**文件**:`tasks/todo.md`(验收记录)

**规模**:XS

---

## ◆ Checkpoint E:完成

- [ ] SPEC-item-removal.md Success Criteria 全部达成并附证据
- [ ] 后端测试/lint、前端 lint/build、Playwright 全量通过;隔离迁移验证通过
- [ ] 全栈测试经单独确认执行或记录未执行原因
- [ ] 人工终审通过后,按能力地图进入 `self-account-deletion-removal` 的规格评审/计划
