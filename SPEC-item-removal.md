# Spec: item-removal

> 状态：待人工评审
> 所属能力地图：`CAPABILITY-MAP.md` → `item-removal`
> 本规格仅覆盖 Item 功能的移除；用户自助注销由独立模块规格处理。

## Objective

彻底移除 Item 示例业务：用户不再看到 Item 页面或导航入口，后端不再提供 Item API 或业务实现，应用中不再存在 Item 数据模型；通过新增 Alembic 迁移删除 `item` 数据库表及其中数据。

这是无替代功能的功能下线，不新增兼容页面、替代 API、软删除标记或数据导出能力。

**用户故事**

- 作为普通用户，我不再看到或使用 Item 页面，其余登录、Dashboard、设置功能保持可用。
- 作为管理员，我不再看到 Item 页面，但用户管理能力不受影响。
- 作为维护者，代码、API 契约和当前数据库结构不再保留 Item 专属实现。

## Tech Stack

沿用现有技术栈，不新增依赖：

- 后端：Python 3.14、FastAPI、SQLModel、Alembic、PostgreSQL、pytest、uv。
- 前端：React 19、TypeScript、TanStack Router/Query/Table、i18next、Biome、Playwright、bun。
- API 客户端：@hey-api/openapi-ts，由 `scripts/generate-client.sh` 统一生成。

## Commands

```bash
# 准备数据库；迁移验证必须使用隔离的测试数据库
docker compose up -d db

# 后端（在 backend/ 下执行）
uv run pytest
uv run bash scripts/test.sh
uv run bash scripts/lint.sh

# 新迁移及其回滚路径（在 backend/ 下执行）
uv run alembic revision -m "drop item table"  # 生成后手工检查 upgrade/downgrade
DATABASE_URL=<隔离测试数据库 URL> uv run alembic upgrade head
DATABASE_URL=<隔离测试数据库 URL> uv run alembic downgrade -1
DATABASE_URL=<隔离测试数据库 URL> uv run alembic upgrade head
uv run alembic check

# 同步 OpenAPI 与前端生成客户端（在项目根目录执行）
sh scripts/generate-client.sh

# 前端（在项目根目录执行）
bun run lint
bun run --filter frontend build
bun run test

# 全栈验证
sh scripts/test.sh
```

`DATABASE_URL` 的目标必须是可丢弃的隔离测试数据库。不得用上述迁移验证命令直接操作当前开发库或生产库。

## Project Structure

```
CAPABILITY-MAP.md                         # 已批准的能力地图
SPEC-item-removal.md                     # 本模块规格
backend/
  app/
    api/main.py                          # 移除 items 路由注册
    api/routes/items.py                  # 整个删除
    api/routes/users.py                  # 保留管理员删除用户，移除其中 Item 清理
    crud.py                              # 删除 create_item 及 Item 导入
    models.py                            # 删除 Item 模型/契约及 User.items 关系
    alembic/versions/<new>_drop_item_table.py  # 新增删表迁移
  tests/
    api/routes/test_items.py             # 删除 Item 行为测试，另增路由移除契约测试
    utils/item.py                        # 整个删除
    conftest.py / test_models.py          # 清理 Item fixture 与模型断言
    migrations/                          # 隔离库迁移升级/降级验证
frontend/
  src/
    components/Items/                    # 整个删除
    components/Pending/PendingItems.tsx   # 整个删除
    components/Sidebar/AppSidebar.tsx     # 删除 Item 导航及无用图标导入
    routes/_layout/items.tsx             # 整个删除
    locales/{en,zh-CN}.json               # 删除 Item 专属文案与错误码
    client/                              # 仅生成器修改，移除 Item 类型和 service
    routeTree.gen.ts                     # 仅路由生成器修改
  tests/
    items.spec.ts                        # 整个删除
    language.spec.ts                     # 删除 Items 路由标题断言
    utils/random.ts                      # 删除 Item 专属测试数据函数
img/dashboard-items.png                  # 删除失效截图
README.md                                # 删除 Item 功能、截图及 UUID v7 描述
```

历史 Alembic 文件、`release-notes.md` 和已归档任务中的 Item 记录保留，作为历史资料；当前文档与测试配置不得继续把 Item 描述为可用功能。历史文档若含会误导当前用户的 Item 说明，应更新说明，但不重写历史事实。

## Code Style

沿用项目现有风格：后端使用明确的 SQLModel 类型与路由注册；前端由生成器维护路由树和 API 客户端，不手工编辑生成文件。

```python
# backend/app/api/main.py：只保留仍在提供的路由
from app.api.routes import login, private, users

api_router.include_router(login.router)
api_router.include_router(users.router)

# 新迁移：破坏性 upgrade 与结构可重建的 downgrade 必须同时提供
def upgrade() -> None:
    op.drop_table("item")


def downgrade() -> None:
    # 按删表前的最终结构重建 item 表及其外键。
    # 只能恢复空表结构，不能恢复任何已删除的数据。
    ...
```

保留 `Message` 模型；用户管理端点仍使用它，不能因为它也出现在已删除的 Item 路由中而误删。删除组件时同步删除变得未使用的 import、翻译键和测试工具，但不要删除仍有其他消费者的通用组件或依赖。

## Testing Strategy

**后端契约与回归测试（pytest，`backend/tests/`）**

- 删除 Item 原有 CRUD 行为测试及 Item 专属造数工具。
- 添加小型路由移除契约测试：对 `/api/v1/items/` 的 `GET`、`POST`，以及 `/api/v1/items/{id}` 的 `GET`、`PUT`、`DELETE`，应用响应为 404（FastAPI 对未匹配路由的默认 404），而不是 401、405 或原 CRUD 响应。
- OpenAPI 中不得出现 `/api/v1/items/`、`/api/v1/items/{id}` 或 Item schema。
- 更新 `conftest.py`，只清理仍存在的表；更新 `test_models.py`，继续断言新建 User 使用 UUID v7，删除 Item 的模型与 UUID 断言。
- 保留并验证管理员删除其他用户、登录、用户资料、管理员重置密码等现有行为。

**迁移测试（隔离 PostgreSQL 数据库）**

1. 从新数据库执行完整 `alembic upgrade head`，验证迁移链有效且 `item` 表不存在。
2. 在旧 head 的数据库中同时放入 User 与 Item 数据，执行新迁移，验证 `item` 表及其数据消失，User 表、行数、字段和主键不变。
3. 执行一次 `downgrade -1`，验证 `item` 表按删表前结构恢复：`id` UUID 主键、`owner_id` UUID 非空外键、`title` 非空、`description` 可空、带时区 `created_at` 可空，以及到 `user.id` 的 `ON DELETE CASCADE` 外键。
4. 再执行 `upgrade head`，验证 `item` 表再次消失，User 数据仍保留。
5. 明确验证 downgrade 只能重建空表；不得声称它恢复 Item 数据。
6. 在删除 Item 模型后运行 `uv run alembic check`，不得出现待删除 `item` 表的漂移；不得为了实现零漂移而改写历史迁移。

**前端测试（Playwright，`frontend/tests/`）**

- 删除 `items.spec.ts` 及 Item 专属工具函数和语言断言。
- 添加导航移除回归测试：普通用户和管理员侧边栏均无 Items 链接；访问 `/items` 使用应用现有的未匹配路由/Not Found 行为，不显示 Item 页面、不重定向到新的替代页面。
- Dashboard、Admin、Settings、语言切换及登录相关测试继续通过。

**验证要求**

- 运行后端完整测试、后端 lint、前端 lint、前端构建和 Playwright 回归测试。
- 生成客户端后重新检查 OpenAPI 和前端类型，不能保留 Item service 或 Item DTO。
- 覆盖率门槛沿用现有测试脚本；不得通过跳过测试、注释断言或降低阈值掩盖回归。

## Boundaries

**Always**

- 先移除所有应用代码的 Item 读写引用，再执行破坏性删表迁移。
- 新增一个 Alembic head 迁移；保留既有迁移历史及 revision id。
- 迁移必须同时提供并测试 upgrade/downgrade；downgrade 文档必须明确数据不可恢复。
- 迁移测试使用隔离数据库，并在执行前检查目标环境；保留 User 数据和管理员管理能力。
- 后端路由/模型变化后运行 `sh scripts/generate-client.sh`，提交生成结果。
- 完成各层修改后运行对应测试，并检查工作区中残留的当前代码引用。

**Ask first**

- 对当前开发库、预发布库或生产库实际执行 `upgrade head` 删表。
- 修改或删除任何已有 Alembic 历史迁移。
- 增加依赖、保留兼容路由、重定向 `/items`、导出/备份 Item 数据或改变其他业务 API。
- 删除本规格未明确授权的共享代码、历史文档或非 Item 测试。

**Never**

- 直接修改或删除历史迁移来掩盖当前 schema 漂移。
- 在旧版应用仍可能读写 Item 表时先执行删表迁移。
- 保留可调用但无 UI 的 Item API、僵尸模型或仅为未来可能复用而保留的实现。
- 误删 `User`、`created_at`、UUID v7、通用 DataTable、Message 或其他仍有消费者的功能。
- 手工编辑 `frontend/src/client/` 或 `frontend/src/routeTree.gen.ts`。
- 在真实环境无数据库备份和明确批准时执行删表；声称 downgrade 能恢复已删除数据。

## Success Criteria

1. 前端源码中不存在 Item 页面、Item 组件、Item 导航或 Item 专属文案；路由生成树和构建产物不再提供 `/items` 页面。
2. 普通用户和管理员均看不到 Items 导航；`/items` 进入现有 Not Found 行为；Dashboard、Admin、Settings 和语言切换正常。
3. 后端不再注册 Item 路由，五个原 Item API 均返回默认 404；OpenAPI 和生成客户端无 Item API、service 或 schema。
4. `ItemBase`、`ItemCreate`、`ItemUpdate`、`Item`、`ItemPublic`、`ItemsPublic`、`User.items`、`create_item` 及 Item 专属测试工具均从当前应用源码删除。
5. 管理员删除其他用户的端点仍存在且工作正常，不再尝试清理 Item；管理员其余用户管理能力不受影响。
6. 新迁移在空库与含数据的旧结构上均升级成功，`item` 表被删除，User 表及已有用户数据保持不变。
7. downgrade 能重建正确的空 `item` 表结构，再次 upgrade 能删除它；验证过程不触碰当前开发库或生产库。
8. Alembic 迁移链为单一有效 head，模型无 Item 相关 schema 漂移，历史迁移未被修改。
9. 后端测试与 lint、前端 lint 与构建、Playwright 回归测试及全栈测试全部通过。
10. 当前 README 不再展示或承诺 Item 功能；历史发布记录和已归档任务保留。

## Open Questions

无。迁移历史保留、隔离数据库验证、删表数据不可恢复，以及 `/items` 使用现有 Not Found 行为均已确认。
