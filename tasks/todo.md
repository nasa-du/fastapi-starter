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
- [x] 双字典无 `items` 组、`nav.items`、`ITEMS_*`;key 集合 diff = 0
- [x] `random.ts` 无 Item 专属函数,其余函数保留
- [x] `frontend/src` 中 `t("items.` 与 `nav.items` 零引用

**验证**:
- [x] 引用扫描:`grep -rn "t(\"items\.\|nav\.items\|randomItem" frontend/src frontend/tests` 零命中
- [x] `bun run lint` + `bun run --filter frontend build` 通过
- [x] 定向 E2E(后端运行时):`bunx playwright test tests/language.spec.ts` 全绿

**执行记录**(2026-11-23):
- RED 先行:一次性脚本断言「双字典无 `items` 组/`nav.items`/`ITEMS_*`、key 集合一致、`random.ts` 无 `randomItem`」运行失败(en/zh-CN 各报 Item 文案存在 + random.ts 报 Item 工具存在),符合预期
- GREEN:双字典各删 `items` 组(39 行)、`nav.items`、`errors` 尾部 `ITEMS_NOT_FOUND`/`ITEMS_FORBIDDEN`;`random.ts` 删 `randomItemTitle`/`randomItemDescription`,其余函数(`randomUserCode`/`randomTeamName`/`randomPassword`/`slugify`)保留
- key 集合校验:flatten 双字典全路径 key 后 diff = 0;引用扫描 `t("items.`/`nav.items`/`randomItem` 于 `frontend/src`、`frontend/tests` 零命中
- `bun run lint`(67 files,无需修复)绿;`bun run --filter frontend build` 绿(i18n chunk 正常产出,构建产物无 items chunk)
- 定向 E2E:数据库容器复用 Task 1 的 `docker compose up -d db`;后端 `uvicorn`(8000)与前端 `vite dev`(5173)以后台任务临时启动,`PLAYWRIGHT_BASE_URL`/`VITE_API_URL` 显式传递;`bunx playwright test tests/language.spec.ts` — **7 passed**(11.5s);E2E 后两个服务已停止
- 提交:`b1744ca`(纯删除 commit)

**依赖**:Task 1、Task 2

**文件**:`frontend/src/locales/en.json`、`frontend/src/locales/zh-CN.json`、`frontend/tests/utils/random.ts`

**规模**:S(3–4 文件)

---

## ◆ Checkpoint A:前端源码无 Item 业务入口

- [x] `bun run lint` + `bun run --filter frontend build` 通过;路由树无 `/items`
- [x] 双字典与现有测试不再依赖 Item 页面;`backend/app/frontend/` 构建产物不含 items chunk(本地验证,不提交)
- [x] 人工确认后进入 Phase 2

---

## Task 4:删除 Item API 并添加未注册路由契约测试

**描述**:RED 先行:新建 `backend/tests/api/routes/test_items_removed.py`,断言 `/api/v1/items/` 的 GET/POST 与 `/api/v1/items/{id}` 的 GET/PUT/DELETE 均返回 FastAPI 默认 404(带有效 token 与匿名均为未匹配路由行为,而非 401/405/旧 CRUD 响应)。随后删除 `routes/items.py` 并从 `api/main.py` 移除注册;删除旧 `test_items.py`。

**验收标准**:
- [x] `backend/app/api/routes/items.py`、`backend/tests/api/routes/test_items.py` 删除;`api/main.py` 不再注册 items
- [x] 新契约测试断言五个原端点默认 404,且 OpenAPI 无 items 路径
- [x] 其余路由(login、users、private)不受影响

**验证**:
- [x] RED:契约测试先跑,5 处断言失败(旧路由仍返回 200/404-by-id 等旧行为)
- [x] GREEN:`cd backend && uv run pytest` 全绿
- [x] `uv run ruff check app && uv run ruff format app --check`(等效 lint 的 uv 调用,见归档备注)

**执行记录**(2026-11-23):
- RED 先行:提交 `9d172ca`(新建 `test_items_removed.py`)。定向运行 **6 failed, 1 passed**——五个端点断言逐个失败:GET 列表 200、POST/PUT 422(路由已注册触发校验)、GET/DELETE by-id 404 但 body 为 `{"code": "ITEMS_NOT_FOUND"}`(非默认 404);OpenAPI 含 items 路径断言失败;`test_other_routes_still_registered` 基线通过。带有效 token 断言 404 同时证明未注册路由不进入认证层(旧路由匿名为 401)
- GREEN:删除 `routes/items.py`(131 行)与旧 `test_items.py`(182 行);`api/main.py` 移除 items 导入与注册(净 -315/+1 行)。定向契约测试 **7 passed**
- 全量 `uv run pytest` **70 passed**(5.4s);`uv run ruff check app` + `ruff format app --check` 全绿(16 files)
- 备注:`ruff check tests` 在 `test_login.py` 有 2 个既有 ARG001 命中(经 `git stash` 对照 HEAD 确认为历史遗留,与本任务无关且不在本任务文件范围;任务验证命令仅要求 `app`)
- 环境验证补充:删除前实测旧路由匿名 401 / 带有效 token 走 CRUD;未知路径(默认 JSON 客户端,无 `Accept: text/html`)返回 `404 {"detail": "Not Found"}`——SPA fallback 仅为浏览器导航请求(text/html)服务,JSON API 客户端与前端 HTTP 调用不受影响
- E2E 环境说明:数据库容器沿用(healthy);本任务验证清单未列 E2E,未启动后端/前端服务
- 提交:`9d172ca`(RED 契约测试,含 ruff format 修正)、`469012e`(GREEN 删路由与旧测试)

**依赖**:Task 3(串行默认;后端实际不依赖前端任务)

**文件**:`backend/app/api/routes/items.py`(删)、`backend/app/api/main.py`、`backend/tests/api/routes/test_items.py`(删)、`backend/tests/api/routes/test_items_removed.py`(新)

**规模**:S(4 文件)

---

## Task 5:删除 Item 模型、CRUD、关系与引用

**描述**:`models.py` 删除 `ItemBase/ItemCreate/ItemUpdate/Item/ItemPublic/ItemsPublic` 与 `User.items` 关系;`crud.py` 删除 `create_item` 与 Item 导入;`users.py` 的 `delete_user` 移除显式 Item 清理语句与 Item 导入(管理员删除用户本身保留,依赖数据库 CASCADE 行为由迁移 downgrade 结构保证);`tests/conftest.py` 清理 fixture 去掉 Item 删除;`tests/test_models.py` 保留 User UUID v7 断言、删除 Item 相关构造与断言。

**验收标准**:
- [x] `backend/app` 中 `Item`、`ItemCreate`、`ItemUpdate`、`ItemPublic`、`ItemsPublic`、`create_item`、`items` 关系零引用
- [x] `test_models.py` 仍断言新建 User id 为 UUID v7
- [x] `Message`、`User.created_at`、UUID v7 等共享能力不受影响

**验证**:
- [x] 引用扫描:`grep -rn "\bItem\b\|create_item" backend/app backend/tests --include="*.py"` 仅剩历史迁移与历史文档命中
- [x] `cd backend && uv run pytest` 全绿(含管理员删除用户、登录、密码重置)
- [x] `uv run mypy app && uv run ty check app && uv run ruff check app && uv run ruff format app --check` 全绿

**执行记录**(2026-11-24):
- 纯删除任务,按约定以引用扫描 + 测试/构建为 RED 证据:删除前 `grep -rn "\bItem\b\|create_item" backend/app backend/tests --include="*.py"` 命中恰好为 5 个任务文件(models.py 六个类 + `User.items` 关系、crud.py `create_item` 与导入、users.py Item 导入与显式清理语句、conftest.py fixture、test_models.py)加历史迁移与 `tests/utils/item.py`(Task 6 文件);删除前基线 `uv run pytest` **70 passed**(Task 4 后绿基线)
- GREEN:五个文件按任务删除(净 -63/+6 行);连带清理因删除而悬空的导入(`models.py` 的 `Relationship`、`crud.py` 的 `uuid`、`users.py` 的 sqlmodel `delete`),均由 ruff/tsc 等价检查确认无未用导入
- `delete_user` 移除显式 Item 清理后依赖数据库 `ON DELETE CASCADE`(迁移 `1a31ce608336` 建立的 `item_owner_id_fkey` 结构保证);管理员删除用户全链路由既有 `test_users.py` 六个 delete 用例覆盖,全量 **70 passed**(5.4s)
- `test_models.py` 改写为 `test_new_user_ids_are_uuid7`(单文件定向 2 passed);`Message`/`Token`/`User.created_at`/UUID v7 等共享能力经全量测试与 mypy/ty 确认不受影响
- 删除后引用扫描:`backend/app` 仅剩 2 个历史迁移文件中的 `Item` 注释/文档串(`fe56fa70289e`、`9c0a54914c78`,按约定保留);`backend/tests` 仅剩 `tests/utils/item.py`(Task 6 删除对象)与 `test_items_removed.py:29` 契约测试自身 docstring(历史文档性命中,允许)
- `uv run mypy app`(16 files)+ `uv run ty check app` + `uv run ruff check app` + `uv run ruff format app --check` 全绿
- E2E 环境说明:数据库容器 `docker compose up -d db` 启动并 healthy;本任务验证清单未列 E2E,未启动后端/前端服务
- 提交:`5ddd60f`(纯删除 commit)

**依赖**:Task 4

**文件**:`backend/app/models.py`、`backend/app/crud.py`、`backend/app/api/routes/users.py`、`backend/tests/conftest.py`、`backend/tests/test_models.py`

**规模**:M(5 文件)

---

## Task 6:删除 Item 测试工具并再生成客户端与路由树

**描述**:删除 `backend/tests/utils/item.py`(Task 4 后已无消费者);运行 `sh scripts/generate-client.sh` 再生成 OpenAPI 与 `frontend/src/client/`;前端构建刷新 `routeTree.gen.ts`。生成后核对无 Item service/DTO,且二次运行零 diff(幂等)。

**验收标准**:
- [x] `backend/tests/utils/item.py` 删除;`backend/tests` 无 Item 引用
- [x] `frontend/src/client/` 无 `ItemsService`、`ItemPublic`、`ItemCreate`、`ItemUpdate`、`items*` 类型与路径
- [x] 生成与路由树更新全部由工具完成,`git diff` 无手改痕迹

**验证**:
- [x] `sh scripts/generate-client.sh` 成功;再跑一次零 diff
- [x] `grep -rni "items" frontend/src/client frontend/src/routeTree.gen.ts` 零命中(exit 1)
- [x] `cd backend && uv run pytest`(70 passed)+ `bun run lint`(67 files 绿)+ `bun run --filter frontend build` 全绿

**执行记录**(2026-11-24):
- RED 证据(删除前状态):`tests/utils/item.py` 悬空(导入 Task 5 已删的 `Item`/`ItemCreate`/`create_item`,因无消费者未被收集);生成物过期——`frontend/openapi.json` 40 处、`sdk.gen.ts` 27 处、`types.gen.ts` 45 处、`index.ts` 2 处 item 命中(Task 4 删路由前生成);消费者扫描 `utils.item`/`create_random_item` 于 `backend/tests`/`backend/app` 零命中
- GREEN:`git rm backend/tests/utils/item.py`;`sh scripts/generate-client.sh` 重生成 `frontend/src/client/`(index.ts/sdk.gen.ts/types.gen.ts 净 -300/+3 行,`ItemsService`/`Item*`/`items*` 导出全部移除,biome 格式化为脚本自带 lint 步骤);`routeTree.gen.ts` 无变化(Task 1 构建后已无 `/items`),构建产物无 items chunk
- 幂等性:生成脚本连续三次运行,第二、三次后 `md5sum -c` 四个生成文件哈希全部一致(biome "Fixed N files" 为格式化计数,内容稳定)
- 后端 `uv run pytest` **70 passed**(6.2s,删除 item.py 后运行;后续仅前端生成物变化,后端代码未动);`bun run lint`(67 files)绿;`bun run --filter frontend build` 绿(1.77s)
- 剩余命中归类:`backend/tests` 仅剩 `test_users.py` 通用循环变量 `item` 与 `test_items_removed.py` 契约测试自身(允许);再生成后 `frontend/openapi.json` 仅 3 处大小写不敏感命中,均为 JSON Schema 通用 `"items"` 数组关键字(`ValidationError`/`UserPublic`/anyOf 分页参数),非 Item 业务
- 范围外观察(未动):`frontend/src/client/client/` 嵌套目录为旧生成器配置遗留,git 跟踪且 0 处 item 命中,留待 Task 12 审计归类
- 提交:`3f15bb9`

**依赖**:Task 5

**文件**:`backend/tests/utils/item.py`(删);生成物:`frontend/openapi.json`(忽略,不提交)、`frontend/src/client/*`、`frontend/src/routeTree.gen.ts`

**规模**:S(1 源文件 + 生成物)

---

## ◆ Checkpoint B:应用不再读写 Item

- [x] 后端完整测试、前端 lint/build 通过
- [x] OpenAPI 与生成客户端无 Item API/schema;路由树无 `/items`
- [x] 当前开发库未执行删表;人工确认后进入 Task 7

**执行记录**(2026-11-24,代码状态 = Task 6 提交 `637f064`,零未提交改动):
- 静态证据(Task 6 已验,代码未变不重复跑):`uv run pytest` 70 passed;`bun run lint`(67 files)绿;`bun run --filter frontend build` 绿;`grep -rni "items" frontend/src/client frontend/src/routeTree.gen.ts` 零命中
- 开发库核查(容器内 psql):`\dt` 显示 `item` 表仍存在(未删表);`alembic_version` = `7125f2112706` = repo head;`user` 表 0 行(pytest 清库),已 `uv run python app/initial_data.py` 重建管理员后再拉服务
- 运行时实测(后端 uvicorn :8000 + 前端 vite :5173 后台运行,沿用显式 env 约定):
  - live `/api/v1/openapi.json` 路径列表仅 8 条(login×2、private×1、users×5),无任何 items 路径
  - `GET`/`POST /api/v1/items/` 与 `GET /api/v1/items/{uuid}`(JSON 客户端)均返回 FastAPI 默认 `404 {"detail":"Not Found"}`,非旧 CRUD 响应
  - 浏览器导航 `GET /items`(Accept: text/html)仍走 SPA fallback 返回 200 HTML(前端路由层 Not Found 渲染,Task 9 将以 `data-testid="not-found"` 断言)
  - 共享能力实测:管理员登录 token 获取成功,`GET /api/v1/users/me` 返回完整 UserPublic(admin/超级用户/UUID v7)
  - 定向 E2E:`PLAYWRIGHT_BASE_URL=http://localhost:5173 VITE_API_URL=http://localhost:8000 bunx playwright test tests/login.spec.ts tests/language.spec.ts` — **28 passed**(29.2s)
- 人工确认:环境保持运行(前端 http://localhost:5173 / 后端 http://localhost:8000/docs),待用户核对后勾选第三项并进入 Task 7

---

## Task 7:新增删表迁移与隔离 PostgreSQL 往返测试

**描述**:新增迁移 `down_revision='7125f2112706'`:upgrade 仅 `op.drop_table("item")`;downgrade 按删表前最终结构重建空表(UUID 主键、非空 `owner_id` 外键 `ON DELETE CASCADE` → `user.id`、`title VARCHAR(255)` 非空、`description VARCHAR(255)` 可空、带时区 `created_at` 可空),注释明确不恢复数据。`alembic/env.py` 支持自定义选项 `item_removal_database_url`(仅存在时采用,否则维持全局 Settings)。新增 `backend/tests/migrations/test_drop_item_migration.py`:fixture 要求 `ITEM_REMOVAL_TEST_DATABASE_URL` 指向专用实例的管理库,随机库名建库/销毁,独立 `Config` 读 `backend/alembic.ini` 并注入 URL,连接前断言目标 host/database 非当前 `DATABASE_URL`;未配置该变量时 `pytest.skip`。

**验收标准**:
- [x] 迁移文件存在且 upgrade/downgrade 均实现;`uv run alembic heads` 单一 head
- [x] 隔离库四步通过:空库 `upgrade head`(item 不存在)→ 旧 head 库含 User+Item 数据升级(item 表与数据消失,User 表行数/字段/主键不变)→ `downgrade -1`(空表结构逐列/约束符合)→ 再 `upgrade head`(item 再消失,User 数据保留)
- [x] `uv run alembic check` 无 Item 相关漂移;历史迁移文件零改动
- [x] 测试结束隔离库已销毁;当前开发库无任何变更

**验证**:
- [x] `ITEM_REMOVAL_TEST_DATABASE_URL=<专用测试实例> cd backend && uv run pytest tests/migrations -v` 全绿,日志记录实际连接目标与随机库名
- [x] `uv run alembic check` 输出记录(区分既有非 Item 差异)
- [x] `git diff backend/app/alembic/versions/` 仅新增文件
- [x] 未配置变量时:`uv run pytest tests/migrations` 全部 skip(证明不会误连)

**执行记录**(2026-11-24):
- 隔离实例:专用一次性容器 `rs-template-mig-test-pg`(`postgres:18`,`127.0.0.1:5434→5432`,无数据卷,容器级销毁),与开发库(5432/app)、无关实例(5433)完全隔离;`ITEM_REMOVAL_TEST_DATABASE_URL=postgresql://postgres:…@127.0.0.1:5434/postgres`
- RED 先行:提交 `f9fe0db`(tests/migrations/ 往返测试 + conftest + env.py 隔离分支)。RED 运行 **4 failed** 且失败原因全部正确:upgrade head 后 item 仍在(迁移缺失)、downgrade -1 从旧 head 掉到 `fe56fa70289e` 而非停在旧 head、降级后 user 行快照不符(退回带 email 旧结构);全部引擎 URL 为隔离库随机名
- RED 环境事故(如实记录):首次 RED 运行时 env.py 尚未加入隔离分支,`command.downgrade/-upgrade` 经全局 `settings.DATABASE_URL` 打到开发库,开发库被降级至 `fe56fa70289e` 后又升级回来——净模式零变化(版本回到 head,7 列无 email),但 user_code 被迁移回填逻辑重新生成,管理员原码 `admin` 丢失;已用 `UPDATE "user" SET user_code='admin' WHERE is_superuser`(与 `.env` 的 FIRST_SUPERUSER_CODE 一致)还原,另一 E2E 临时用户码随全量清库惯例本即弃用。教训已制度化:env.py 隔离分支与测试同批提交;每个测试在任何破坏性 downgrade 前先断言隔离库的 `alembic_version`(`_assert_isolation_pinned`),误路由时在断言处失败且开发库只经历 no-op upgrade;修复后 RED 复跑与后续全部运行开发库零接触(逐次核对 version/user_code/行数)
- 测试实现要点:`SQLAlchemy 2.0.51` 的 `str(URL)` 渲染**掩码密码**,注入 Alembic 的连接串必须用 `render_as_string(hide_password=False)`(admin 引擎用 URL 对象故未受影响);psycopg 3 需显式 `set(drivername="postgresql+psycopg")`;`tests/migrations/conftest.py` 影子化 session 级 autouse `db` fixture,保证该包绝不连开发库(含 teardown 清库);连接目标与随机库名经 `logger.info` 记录(`-o log_cli=true --log-cli-level=INFO` 可见)
- GREEN:提交 `323d5e4`(迁移 `d464f5951cc0_drop_item_table.py`,down_revision=`7125f2112706`;upgrade 仅 `op.drop_table('item')`;downgrade 按开发库实测的删表前最终结构重建空表:列序 description/title/id/owner_id/created_at、varchar(255)×2、UUID pk `item_pkey`、FK `item_owner_id_fkey`→user.id `ON DELETE CASCADE`、timestamptz 可空、无默认值;注释明确只恢复结构、数据不可恢复)
- 隔离库四步(pytest,4 个独立随机库各自往返):空库 upgrade head(item 不存在,版本=head)→ 旧 head+User2/Item3 数据升级(item 表与数据消失,user 列/类型/可空性/主键/行数据逐一快照相等)→ downgrade -1(空表逐列 data_type/长度/可空性 + PK + FK ondelete=CASCADE 符合,行数 0)→ downgrade 后再 upgrade head(item 再消失,user 数据保留)。最终 **4 passed**(1.2s)
- CLI 三步往返(SPEC Commands 原样,隔离实例 `cli_roundtrip` 库):`alembic upgrade head`(日志含 `7125f2112706 -> d464f5951cc0, drop item table`,item=0)→ `downgrade -1`(item=1)→ `upgrade head`(item=0);`alembic check` 于新 head 库输出 **`No new upgrade operations detected.`**(零漂移,无任何非 Item 差异),库已销毁
- 开发库上的 `alembic check` 输出 `FAILED: Target database is not up to date.`——符合设计:开发库按约定停留在旧 head `7125f2112706`,存在待执行迁移时 check 拒绝比较,不产生任何 Item schema 漂移评估;新 head 库上的 check 即权威结论
- `uv run alembic heads` 单一 head `d464f5951cc0`;`git status app/alembic/versions/` 仅新增文件,既有 6 个历史迁移零改动
- 未配置变量时 `uv run pytest tests/migrations -v` — **4 skipped**(0.09s),普通 pytest 不会误连;全量 `uv run pytest` — **70 passed, 4 skipped**(新增 4 skip 即本模块)
- `uv run ruff check app tests/migrations`、`ruff format app tests/migrations --check`、`uv run mypy app`(16 files)、`uv run ty check app` 全绿(中途修复 ruff T201:print→logging;长行 format)
- 开发库终态:alembic_version=`7125f2112706`(旧 head,未执行删表),item 0 行;全量 pytest 后按既有约定 `uv run python app/initial_data.py` 重建管理员(`admin`/superuser;全量 pytest 清空 User 表为仓库已知行为,非本任务迁移所致);隔离容器 `docker rm -f` 销毁,`docker ps` 仅剩开发库与无关实例
- 提交:`f9fe0db`(RED 测试基础设施)、`323d5e4`(GREEN 迁移)

**依赖**:Task 6

**文件**:`backend/app/alembic/versions/<rev>_drop_item_table.py`(新)、`backend/app/alembic/env.py`、`backend/tests/migrations/__init__.py`(新)、`backend/tests/migrations/test_drop_item_migration.py`(新)

**规模**:M(4 文件)

---

## ◆ Checkpoint C:迁移安全验证

- [x] 隔离库升级/降级/再升级全部通过;User 数据不变;downgrade 仅空表
- [x] 历史迁移未修改;测试库销毁;开发/生产库零操作(执行记录核对)
- [x] 人工确认后进入 Phase 4

**执行记录**(2026-11-24,代码状态 = Task 7 提交 `323d5e4`):
- 证据即 Task 7 执行记录:pytest 四步往返 4 passed;CLI 三步往返 + 新 head 库 `alembic check` 零漂移;`git status` 确认历史迁移零改动;隔离容器已销毁;开发库全程旧 head、未执行任何删表(中途 user_code 事故已在 Task 7 记录如实还原,修复后运行零接触)
- 待人工核对后勾选第三项进入 Phase 4(Task 8)

---

## Task 8:回归用户管理与普通用户 API

**描述**:确认 Task 5 后管理员 `DELETE /users/{user_id}` 全链路正常(删除他人成功、404、删除自己 403 `USERS_SUPERUSER_DELETE_SELF`、普通用户 403);普通用户登录/资料/改密不受影响。仅在现有断言不足时补最小回归(如管理员删除用户后断言无 SQL 错误且用户消失)。

**验收标准**:
- [x] `cd backend && uv run pytest` 全量绿,含 `test_users.py`/`test_login.py`/`test_private.py`/`test_models.py`
- [x] 如补充断言,不改既有断言、不降覆盖率(结论:现有断言已充分,零补充,见执行记录)

**验证**:
- [x] 全量 pytest 绿;新增断言(如有)先 RED 后 GREEN(本任务无新增断言,纯回归)
- [x] `uv run bash scripts/test.sh` 的 coverage 流程暂不执行,留 Task 13

**执行记录**(2026-11-24,代码状态 = Checkpoint C 后 `36adfd4`,零源码改动):
- 断言充分性核查(任务描述列举的全部路径,逐一比对 `test_users.py` 现有断言):
  - 管理员删除他人成功:`test_delete_user_super_user` 断言 200 + `User deleted successfully` + 删除后 `db.exec(select(User).where(User.id == user_id)).first() is None`(用户消失,Task 5 移除显式 Item 清理后该断言即「无 SQL 错误且用户消失」的直接证明)
  - 404:`test_delete_user_not_found`;删除自己 403 `USERS_SUPERUSER_DELETE_SELF`:`test_delete_user_current_super_user_error`(断言完整 detail code+message);普通用户 403:`test_delete_user_without_privileges`(断言 `AUTH_FORBIDDEN` detail)
  - 普通用户登录/资料/改密:`test_login.py` 15 用例(含 user_code/full-name 登录、argon2 升级、错误凭证统一消息)+ `test_update_user_me`/`test_update_password_me*`/`test_delete_user_me*` 全绿
  - 结论:现有断言完整覆盖任务范围,**不补充任何断言**(文件清单 0 文件,任务允许的 0 下限)
- 定向回归:`uv run pytest tests/api/routes/test_users.py tests/api/routes/test_login.py tests/api/routes/test_private.py tests/test_models.py -v` — **48 passed**(test_users 29、test_login 15、test_private 1、test_models 2;含 UUID v7 断言)
- 全量:`uv run pytest` — **70 passed, 4 skipped**(5.40s;4 skip 为 Task 7 迁移测试未配置 `ITEM_REMOVAL_TEST_DATABASE_URL` 的预期跳过);既有 `test_users.py:207-208` 的 `item` 命中经核对为分页数据循环变量,非 Item 业务
- 实现复核:`users.py` `delete_user` 现为 `session.get` → 404/自删 403 检查 → `session.delete(user); session.commit()`,无 Item 引用,依赖 DB `ON DELETE CASCADE`(结构由历史迁移保证)
- 覆盖率流程按约定未执行,留 Task 13;`uv run bash scripts/test.sh` 未运行(会销毁数据卷,Task 13 单独确认)
- 开发库核查:pytest 前后均连 `DATABASE_URL=postgresql://postgres:***@localhost:5432/app`(开发库);pytest 清空 User 表为仓库已知行为,已按既有约定 `uv run python app/initial_data.py` 重建管理员(`admin`/superuser 实测确认);alembic_version 保持 `7125f2112706`(旧 head,零迁移操作)
- 提交:仅本文件记录,无源码改动

**依赖**:Task 7

**文件**:`backend/tests/api/routes/test_users.py`(仅在断言不足时)

**规模**:S(0–1 文件)

---

## Task 9:回归管理员/普通用户导航与 Not Found 行为

**描述**:新增 `frontend/tests/items-removed.spec.ts`:管理员(现有 setup)与临时普通用户(`privateApi.createUser`)侧边栏均无 Items 链接;两角色访问 `/items` 均呈现现有 Not Found(`data-testid="not-found"`),无重定向、无 Item 页面痕迹。运行全量 E2E 回归。注意:全量 pytest 后 User 表被清空,先 `cd backend && uv run python app/initial_data.py` 重建开发管理员再跑 E2E(沿用归档环境备注)。

**验收标准**:
- [x] 双角色侧边栏无 Items;`/items` → Not Found 断言通过
- [x] 全量 E2E(`bun run test`)绿,既有用例零删减(除 Task 1 已处理的失效用例)

**验证**:
- [x] RED:新 spec 先在未改 UI 前不可行——本任务在 Task 1–3 完成后执行,直接 GREEN(定向 3 passed,含 setup;若意外失败按缺陷处理,本次无失败)
- [x] `PLAYWRIGHT_BASE_URL=http://localhost:5173 bun run test`(frontend/ 内)全量绿,记录通过数(**69 passed**,42.0s)

**执行记录**(2026-11-25):
- 新 spec `frontend/tests/items-removed.spec.ts`(2 用例,`locale: "zh-CN"`):管理员用例走既有 setup storageState,断言侧边栏无「项目」链接、有「仪表盘/管理」;普通用户用例以 `storageState: { cookies: [], origins: [] }` 隔离 + `createUser`(privateApi)建临时用户经 `logInUser` 登录,断言无「项目」、有「仪表盘」、无「管理」(非超用户);两用例均 `goto("/items")` 后断言 `not-found` testid 可见且 URL 停留在 `/items`(无重定向)
- RED 说明:按任务约定本任务在 Task 1–3 完成后执行,新断言(UI 已无 Items)直接 GREEN;沿用 Task 1 在 login.spec.ts 已落地的「项目链接不存在」断言模式(RED→GREEN 证据见 Task 1 执行记录)
- 环境:开发库容器 `docker compose up -d db` healthy(alembic_version=`7125f2112706` 旧 head,item 表未删,符合约定);`uv run python app/initial_data.py` 重建管理员(幂等,admin 已存在);后端 `uv run uvicorn app.main:app`(8000,dev 模式含 `/api/v1/private/users/`)与前端 `bun run dev`(5173)以后台任务运行,`PLAYWRIGHT_BASE_URL`/`VITE_API_URL` 显式传递(沿用归档踩坑记录:须在 `frontend/` 内运行)
- 定向:`bunx playwright test tests/items-removed.spec.ts` — **3 passed**(5.9s,setup + 2 新用例)
- 全量:`PLAYWRIGHT_BASE_URL=http://localhost:5173 VITE_API_URL=http://localhost:8000 bun run test` — **69 passed**(42.0s)= 既有 67(admin 20 + language 6 + login 21 + user-settings 19 + setup 1)+ 新增 2;既有用例零删减
- `bun run lint`(68 files)绿(新 spec 经 biome 格式化);E2E 后 uvicorn/vite 已停止(5173/8000 端口释放),开发库容器保留运行
- 提交:spec 提交 + 本文件记录

**依赖**:Task 8

**文件**:`frontend/tests/items-removed.spec.ts`(新;`frontend/tests/utils/user.ts` 无需微调,`logInUser` 现有签名已满足)

**规模**:S(1 文件)

---

## Task 10:更新当前 README 并删除失效截图

**描述**:`README.md` 删除「Items 页」截图小节与 `img/dashboard-items.png`;「账号与数据约定」中「新建的 User 与 Item 使用 UUID v7」改为仅 User;如正文仍有 Item 功能描述一并清除。历史 `release-notes.md` 不动。

**验收标准**:
- [x] 当前 README 不再展示/承诺 Item 功能;失效截图删除
- [x] UUID v7 描述仅保留 User;文档内链接与图片引用有效

**验证**:
- [x] `grep -n "Item\|items" README.md` 零命中(exit 1,连历史性提及也无)
- [x] `uv run prek run typos --files README.md` 通过;图片引用检查无断链

**执行记录**(2026-11-25):
- 删除前扫描:`README.md` 共 3 处 Item 命中——L126–128「Items 页」截图小节(含 `img/dashboard-items.png` 引用)、L64 错误码前缀示例 `ITEMS_`、L79「新建的 User 与 Item 使用 UUID v7」;另有 `img/dashboard-items.png` 被引用于 SPEC-item-removal.md(任务清单自身,历史资料不动)与 todo.md
- GREEN:`git rm img/dashboard-items.png`;README 删「Items 页」小节;L79 改为「新建的 User 使用 Python 3.14 标准库的 UUID v7」;L64 前缀示例列表去掉 `ITEMS_`(当前契约中该前缀已无任何错误码,SPEC-i18n.md 的 ITEMS 条目失效标注属 Task 11 范围)
- 验证:`grep -n "Item\|items" README.md` **零命中**(exit 1);`uv run prek run typos --files ../README.md` — **Passed**;链接检查——4 个本地图片引用(login/dashboard/dashboard-dark/docs)全部存在,9 个相对链接文档全部存在,仅 2 处 GitHub badge 相对路径(`../../actions/workflows/…`)本地不存在,属 GitHub 平台渲染的标准 badge 写法且对应 workflow 文件(`test-docker-compose.yml`/`test-backend.yml`)均在 `.github/workflows/` 存在,非断链
- `img/` 目录终态:8 个跟踪文件,`dashboard-items.png` 已移除,其余图片均有或属历史文档引用(release-notes.md 不动,mailpit/react-email 等为既有保留)
- 历史 `release-notes.md` 未改动(`git status` 仅 README.md 与删除的截图)
- 提交:README + 截图删除一个 commit,本文件记录一个 commit

**依赖**:Task 8(可与 Task 9 并行,默认串行)

**文件**:`README.md`、`img/dashboard-items.png`(删)

**规模**:S(2 文件)

---

## Task 11:标注历史规格中的 Item 失效口径

**描述**:`SPEC-i18n.md` 仍被 README 引用为当前错误码契约:在 `ITEMS_NOT_FOUND`/`ITEMS_FORBIDDEN` 契约表行与相关叙述处标注「随 item-removal 移除,见 SPEC-item-removal.md」;S2/S5 清单中的 Items 描述加历史标注。`SPEC.md`、`docs/`、归档任务为历史资料,不改写事实。

**验收标准**:
- [x] 当前契约文档(SPEC-i18n.md)的 ITEMS 条目均有失效标注与指向
- [x] 历史文档未被改写

**验证**:
- [x] `grep -n "ITEMS_" SPEC-i18n.md` 逐条核对标注
- [x] `uv run prek run typos --files SPEC-i18n.md` 通过

**执行记录**(2026-11-25):
- RED 证据(标注前基线):`grep -n "ITEMS_\|Items 页\|Items CRUD" SPEC-i18n.md` 命中 5 处均无失效标注——L42 模块前缀叙述、L65/L66 契约表 `ITEMS_NOT_FOUND`/`ITEMS_FORBIDDEN` 两行、L151 Testing Strategy「Items CRUD」、L188 S2 清单「Items 页」;旁证:README L71/L114 仍引用 SPEC-i18n.md 为当前错误码契约,`SPEC-item-removal.md` 存在
- GREEN:5 处就地追加标注,历史事实零改写(spec 状态「已完成」、契约表数据、S2/S5 勾选结果均保持原样):
  - 头部 blockquote 新增「失效口径标注(2026-11-25)」总注:Item 功能已随 item-removal 移除、当前契约不含任何 `ITEMS_*` code,统一覆盖叙述性命中(user story L23、Testing Strategy L151、隐蔽英文源清单 L230 等)
  - L43 模块前缀括注失效指向;L66/L67 契约表两行 Code 列加粗标注「已随 item-removal 移除,见 SPEC-item-removal.md」;L189(S2)与 L209(S5)清单条目尾注「历史标注」
- 验证:`grep -n "ITEMS_" SPEC-i18n.md` — **4 处命中(L6 总注、L43 前缀、L66/L67 表行)全部带失效标注与指向**;`uv run prek run typos --files SPEC-i18n.md` — **Passed**
- 历史资料核查:`git status` 仅 `SPEC-i18n.md` 修改;`SPEC.md`、`docs/`、归档任务、`release-notes.md` 零改动(按约定不改写事实)
- 提交:SPEC-i18n.md 标注一个 commit,本文件记录一个 commit

**依赖**:Task 10

**文件**:`SPEC-i18n.md`

**规模**:XS(1 文件)

---

## ◆ Checkpoint D:用户与维护者路径一致

- [x] 管理员用户管理、普通用户设置/登录/登出回归全绿(Task 8 定向 48 passed + 全量 pytest 70 passed, 4 skipped;Task 9 全量 E2E 69 passed)
- [x] 当前文档不再承诺 Item;历史记录保留(Task 10 README 零命中 + 失效截图删除;Task 11 SPEC-i18n.md ITEMS 条目全部带失效标注)
- [x] 人工确认后进入 Phase 5(依据:用户连续「继续」指令推进且会话审批策略改为 never ask,视为放行 Phase 5 并已执行 Task 12;Task 13 的全栈 Docker 测试(销毁数据卷)仍须单独确认)

---

## Task 12:审计当前代码、生成物与历史资料边界

**描述**:语义审计而非全仓零字符串:当前代码(`backend/app`、`backend/tests`、`frontend/src`、`frontend/tests`)无 Item 业务实现;生成物与忽略规则核对(`frontend/src/client/`、`routeTree.gen.ts` 跟踪且无 Item;`frontend/openapi.json`、`backend/app/frontend/` 忽略);历史迁移/`release-notes.md`/归档/`docs/` 原样保留;`img/` 与文档引用一致。结果记录到本任务。

**验收标准**:
- [x] 各扫描命令输出与结论记录(允许历史性命中,逐条说明归类)
- [x] Git 跟踪清单无被忽略产物误入;无遗留失效引用

**验证**:
- [x] `grep -rni "\bitem" backend/app frontend/src --include="*.py" --include="*.ts" --include="*.tsx"` 逐条归类(结果:仅历史迁移/迁移工具/通用命名,非 Item 业务)
- [x] `git ls-files` 核对生成物;`git status` 干净
- [x] `cd backend && uv run alembic heads`(单 head)与 `uv run alembic check`(无 Item 漂移)复核

**执行记录**(2026-11-25,代码状态 = Task 11 提交 `b0f0dd5`,本任务零源码改动):
- 语义审计扫描(`grep -rni "\bitem"`,四目录逐条归类):
  - `backend/app`(*.py)54 处命中,全部位于 `alembic/`:历史迁移 5 个(e2412789c190 建表、d98dd8ec85a3 UUID 改造、fe56fa70289e created_at、1a31ce608336 CASCADE、9c0a54914c78 varchar 长度,按约定原样保留)+ 本计划新增的 `d464f5951cc0` 删表迁移自身 + `env.py:37` 隔离选项 `item_removal_database_url`(Task 7 设施);models/crud/api 零 Item 业务
  - `frontend/src`(*.{ts,tsx})108 处命中,全部为通用命名:Tailwind `items-center`/`items-start`/`items-stretch` 类串、shadcn/Radix 原语标识(`SelectPrimitive.Item`、`DropdownMenuPrimitive.Item`、`FormItemContext`、`data-slot="form-item"`、`sidebar-menu-item`、`pagination-item`)、侧边栏通用 `Item`/`items`(Main.tsx、AppSidebar.tsx);生成物 `src/client/` 与 `routeTree.gen.ts` 零命中(再次覆盖 Task 6 结论)
  - `backend/tests`(*.py)48 处命中:`test_items_removed.py`(契约测试自身)、`test_drop_item_migration.py`(隔离往返测试自身)、`test_users.py:207-208` 通用循环变量 `item`(Task 8 已归类)
  - `frontend/tests`(*.{ts,tsx})9 处命中:`items-removed.spec.ts`(回归 spec 自身)+ `login.spec.ts:312` Task 1 落地的否定断言(`toHaveCount(0)`,实读确认)
- 生成物与忽略规则:`git ls-files` — `frontend/src/client/`(16 文件)与 `routeTree.gen.ts` 跟踪;`frontend/openapi.json`(`frontend/.gitignore:14`)与 `backend/app/frontend/`(根 `.gitignore:4`)被忽略且未跟踪,无误入
- `img/` 一致性:8 个跟踪文件,`dashboard-items.png` 已删;现存引用仅 `SPEC-item-removal.md:90`(该 spec 自身文件操作表,历史资料)与 `tasks/todo.md`(任务记录),当前文档无失效图片引用
- Alembic 复核:开发库容器 healthy;`uv run alembic heads` 单一 head `d464f5951cc0`;`uv run alembic check` 于开发库输出 `FAILED: Target database is not up to date.`(exit 255)——符合设计:开发库按约定停于旧 head `7125f2112706`,存在待执行迁移时 check 拒绝比较(与 Task 7 记录一致,非 Item 漂移);零漂移权威结论仍为 Task 7 隔离新 head 库的 `No new upgrade operations detected.`;check 只读,开发库未触碰
- Git 边界:`git status` 干净;历史资料(SPEC.md、docs/、release-notes.md、归档任务)全程零改动
- 范围外观察(未动,留后续任务):`frontend/src/components/Sidebar/Main.tsx:14` `NavItemKey` 联合类型仍含 `"items"` 死成员(Task 3 已删字典 key,现无任何构造点)——XS 清理候选,不在本审计任务范围
- 结论:当前代码无 Item 业务实现;生成物/忽略规则/历史资料边界清晰,无遗留失效引用

**文件**:无源码改动(仅本文件记录)

**依赖**:Task 11

**文件**:无源码改动(仅本文件记录)

**规模**:XS

---

## Task 13:全量验证并逐条核对规格

**描述**:运行全部验证命令,逐条核对 `SPEC-item-removal.md` 的 10 条 Success Criteria 并记录证据。全栈 Docker 测试(`sh scripts/test.sh`,会 `docker compose down -v` 销毁数据卷)**必须在执行前单独向用户确认**;未确认则记录「未执行及环境原因」。

**验收标准**:
- [x] 10 条 Success Criteria 逐条勾选并附证据
- [x] `cd backend && uv run pytest`、`uv run bash scripts/test.sh`(coverage)、`bash scripts/lint.sh`、`bun run lint`、`bun run --filter frontend build`、全量 E2E 全绿(scripts/test.sh 的容器内 pytest 腿为预存缺陷,见执行记录第 7 条;栈与 CI 等效验证绿)
- [x] `sh scripts/generate-client.sh` 后零 diff
- [x] 全栈测试:已确认执行并绿,或记录未执行原因(经用户确认执行;结果如实记录)

**验证**:
- [x] 上述命令逐条运行并记录结果与日期(2026-11-25)
- [x] SPEC 核对表写入本任务;人工终审后勾选 Checkpoint E

**执行记录**(2026-11-25,代码状态 = Task 12 提交 `ba27d40`,验证期间零源码改动):

验证命令逐条:
1. `cd backend && uv run pytest` — **70 passed, 4 skipped**(6.14s;4 skip = Task 7 迁移测试未配置 `ITEM_REMOVAL_TEST_DATABASE_URL` 的预期跳过)
2. `cd backend && uv run bash scripts/lint.sh` — mypy 16 files no issues + ty All checks passed + ruff check All checks passed + ruff format 16 files already formatted(备注:lint.sh 须经 `uv run` 调用,裸 bash 找不到 venv 内 mypy,与归档「等效 uv 调用」备注一致)
3. `bun run lint` — 68 files code 0(biome "Fixed 2 files" 经 `git diff` 核实均为被忽略文件,跟踪文件零改动)
4. `bun run --filter frontend build` — 绿(1.03s;产物写入被忽略的 `backend/app/frontend/`)
5. 全量 E2E(frontend/ 内,`PLAYWRIGHT_BASE_URL`/`VITE_API_URL` 显式传递):首跑 **68 passed + 1 failed**——`user-settings.spec.ts:349「Selected mode is preserved across sessions」在 language-en 点击处 30s 超时(radix 菜单 "element is not stable"×2 后 detached,与 Task 1 执行记录的下拉不稳定模式同源;Task 1–12 未触碰该 spec 与相关组件)→ 零改动复跑 **69 passed(44.0s)** 确认时序 flake,非回归;既有用例零删减
6. `sh scripts/generate-client.sh` — exit 0,运行后 `git status`/`git diff` 零输出(**零 diff**);`frontend/openapi.json` 确认被忽略(`frontend/.gitignore:14`)
7. 全栈测试 `sh scripts/test.sh`(经用户 ask 确认「执行」):
   - `docker compose build` 绿;`down -v` 销毁旧开发库数据卷;容器内 `prestart.sh` 绿(迁移 + initial data);`up -d` 全服务 healthy;容器内 pytest 腿 **失败**:`coverage run -m pytest tests/` 报 `file or directory not found: tests/`——backend/Dockerfile 自基线提交 `9871a59` 起仅 COPY `scripts/pyproject/alembic.ini/app`,**不含 tests/**;该 pytest 腿为本计划零改动的上游遗留路径,本仓库 CI(`test-docker-compose.yml`)从不触发它(仅 build + curl + down);`set -e` 使脚本于 pytest 腿中断,末尾 down -v 未执行
   - CI 等效补验(栈运行中实测):前端 `GET :8000` **200**、`/docs` **200**;CI 的 `GET /api/v1/utils/health-check` 返回默认 404——本变体 `routes/` 仅 login/private/users,**无 utils.py**,该端点自基线不存在(同类上游遗留)
   - 脚本中断后手动补齐清理:`docker compose down -v --remove-orphans`(测试栈与卷已销毁)
   - 开发库恢复:新空卷按仓库标准 `prestart.sh` 重建(alembic upgrade head → **`d464f5951cc0`** = repo head;空库全链升级净效果 **item 表不存在**,仅 `alembic_version`+`user` 两表),管理员已重建(psql 实测 admin/superuser);原「不对开发库执行迁移」约定所保护的数据已随用户确认的 down -v 销毁,新库为全新初始化而非对既有数据执行迁移,口径变化如实记录

SPEC-item-removal.md 10 条 Success Criteria 核对(2026-11-25):
1. ✔ 前端源码无 Item 页面/组件/导航/文案;路由树与构建产物无 `/items` — Task 1–3 + Task 12(源码零业务命中;routeTree.gen.ts 零 items)
2. ✔ 双角色无 Items 导航;`/items` → Not Found;Dashboard/Admin/Settings/语言切换正常 — Task 9(`items-removed.spec.ts` 双角色断言)+ 全量 E2E 69 passed(含 language/user-settings)
3. ✔ 后端不注册 Item 路由;五端点默认 404;OpenAPI/生成客户端无 Item — Task 4(契约测试 7 passed,RED→GREEN)+ Task 6/12(生成物零 Item)
4. ✔ `ItemBase/ItemCreate/ItemUpdate/Item/ItemPublic/ItemsPublic/User.items/create_item` 及 Item 测试工具全删 — Task 5 + Task 6(引用扫描仅剩历史迁移与测试自身)
5. ✔ 管理员删除用户正常且不再清理 Item — Task 5(`delete_user` 依赖 DB CASCADE)+ Task 8(定向 48 passed,断言充分零补充)
6. ✔ 新迁移空库与含数据旧结构均升级成功,item 删,User 数据不变 — Task 7(隔离库四步 pytest 4 passed,行/列/类型/主键快照逐一相等)
7. ✔ downgrade 重建空表结构、再 upgrade 删除;不触开发/生产库 — Task 7(downgrade 逐列/约束断言;隔离容器销毁;验证期开发库零迁移)
8. ✔ 单一 head;无 Item 漂移;历史迁移未改 — Task 7 + Task 12(`heads`=`d464f5951cc0` 唯一;隔离新 head 库 check 零漂移;versions 目录仅新增文件;本任务开发库重建后 `alembic current`=head 且 item 表不存在,再次印证)
9. ✔ 后端测试/lint、前端 lint/build、Playwright 全绿;全栈测试经用户确认执行——栈 build/prestart/up 与前端服务 200 全绿,容器内 pytest 腿因预存打包缺陷失败(基线即如此、CI 不使用该路径、与本计划无关,见第 7 条)
10. ✔ README 不再展示/承诺 Item;历史发布记录与归档保留 — Task 10(README 零命中 + 失效截图删除)+ Task 11(SPEC-i18n 失效标注)+ Task 12(历史资料零改动)

范围外发现(未动,建议后续任务):
- backend/Dockerfile 不 COPY `backend/tests/`,根 `scripts/test.sh` 的容器内 pytest 腿与 CI 的 `utils/health-check` 腿自基线即不可用(上游模板遗留);候选修复:镜像补 COPY tests + dev 依赖组,或裁剪 test.sh/CI 口径
- (沿用 Task 12)`frontend/src/components/Sidebar/Main.tsx` `NavItemKey` 死成员 `"items"`

**依赖**:Task 12

**文件**:`tasks/todo.md`(验收记录)

**规模**:XS

**依赖**:Task 12

**文件**:`tasks/todo.md`(验收记录)

**规模**:XS

---

## ◆ Checkpoint E:完成

- [x] SPEC-item-removal.md Success Criteria 全部达成并附证据(第 9 条附全栈预存缺陷说明,与本计划无关,见 Task 13)
- [x] 后端测试/lint、前端 lint/build、Playwright 全量通过;隔离迁移验证通过
- [x] 全栈测试经单独确认执行或记录未执行原因(2026-11-25 用户确认执行;结果与预存缺陷说明见 Task 13 执行记录第 7 条)
- [x] 人工终审通过后,按能力地图进入 `self-account-deletion-removal` 的规格评审/计划(**人工终审通过:2026-11-25,用户于运行时环境(前端 5173/后端 8000)审核侧边栏无 Items、`/items` Not Found、Settings/语言切换与文档口径后确认通过**)
