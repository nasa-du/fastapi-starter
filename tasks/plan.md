# Implementation Plan: item-removal

> 依据：`SPEC-item-removal.md`（已确认）与 `CAPABILITY-MAP.md`
> 状态：**待人工批准计划**，未开始功能代码修改
> 任务清单：`tasks/todo.md`
> 已完成的 i18n 计划归档至 `tasks/archive/i18n/`，未覆盖未完成任务。

## Overview

彻底移除 Item 页面、导航、后端 API、业务模型和客户端契约，并新增删除 `item` 表的 Alembic 迁移。共 13 个任务，按前端入口、后端实现、隔离迁移、用户回归和最终验收排序；每个任务最多修改 5 个源文件/测试文件，工具生成物另行记录。

用户自助注销不在本计划中。部署时必须先让所有运行中的应用版本停止读写 Item，再单独执行破坏性迁移；计划与测试均不直接操作当前开发库或生产库。

## 已验证的代码库事实

- 当前 Alembic head 为 `7125f2112706`。删表前 Item 结构：UUID 主键、非空 `owner_id` 外键（`ON DELETE CASCADE`）、`VARCHAR(255)` 标题/描述、可空带时区 `created_at`。
- `User.items`、`Item.owner`、`crud.create_item`、测试清理 fixture、User/Item UUID v7 联合断言和管理员删除用户时的 Item 清理构成同一模型依赖面。
- 原 API 为 `/api/v1/items/` 的 GET/POST 和 `/api/v1/items/{id}` 的 GET/PUT/DELETE，移除后均应得到未匹配路由的默认 404。
- TanStack Router 插件在构建时更新 `routeTree.gen.ts`；根级 Not Found 已有 `data-testid="not-found"`。
- 双字典除 `items` 和 `ITEMS_*` 外，还有 `nav.items`；管理员删除用户文案也提到 Item，但管理员组件和端点必须保留。
- `frontend/openapi.json` 与 `backend/app/frontend/` 被 Git 忽略；`frontend/src/client/` 与 `frontend/src/routeTree.gen.ts` 被跟踪。生成中间产物和构建产物不提交。
- 根目录 `scripts/test.sh` 会执行 `docker compose down -v`，最终全栈测试需要单独确认，不能作为普通测试隐式执行。

## Architecture Decisions

1. **先停止读写，再 contract**：Task 1–6 移除应用代码与客户端中的 Item；Task 7 才新增删表迁移。真实部署先完成代码全量切换并停止旧版本，再备份、审批并执行迁移。
2. **保留历史，新增一个迁移**：新迁移以 `7125f2112706` 为 `down_revision`。upgrade 删除 `item`；downgrade 重建上述最终空表结构，不能也不声称恢复数据。
3. **迁移测试使用显式隔离 URL**：pytest fixture 要求 `ITEM_REMOVAL_TEST_DATABASE_URL` 指向专用 PostgreSQL 的管理数据库，自动创建随机名数据库并在 finally 中销毁。未配置时只跳过这组高风险测试，最终验收必须显式配置并执行。
4. **Alembic 连接显式覆盖**：独立 `Config` 使用 `backend/alembic.ini`，设置自定义 `item_removal_database_url` 选项；`alembic/env.py` 仅在该选项存在时使用它，否则保持现有全局 Settings 行为。测试核对实际连接的 host/database，禁止把当前 `DATABASE_URL` 默认当隔离库。
5. **生成物只由工具维护**：客户端由 `sh scripts/generate-client.sh` 生成；路由树由 Vite/TanStack 插件生成。禁止手改。
6. **保留共享能力**：保留 `Message`、User UUID v7 和 `created_at`、通用 DataTable、管理员删除用户及权限保护。导航数组中通用的 `items` 变量或 Sidebar 的通用 `Item` 类型不是 Item 业务残留。
7. **默认串行**：双字典、模型、测试 fixture、生成物和迁移链均为共享边界。`self-account-deletion-removal` 不在本计划中并行实施。

## Dependency Graph

```
T1 路由/导航移除 ── T2 Item 组件删除 ── T3 文案/旧前端测试清理 ── ◆CP-A
                                                               │
T4 API 移除 ── T5 模型/CRUD/fixture 移除 ── T6 客户端与路由树再生成 ── ◆CP-B
                                                               │
                                      T7 删表迁移 + 隔离往返测试 ── ◆CP-C
                                                               │
T8 用户管理 API 回归 ── T9 双角色 UI 回归 ── T10 当前文档 ── T11 历史规格口径 ── ◆CP-D
                                                               │
                                             T12 残留审计 ── T13 全量验收 ── ◆CP-E
```

按 T1–T13 串行。新增或改写的移除断言先失败再删除实现；纯删除任务以引用扫描和构建失败/生成为 RED 证据，不保留已失效的 CRUD 行为测试。

## Task List

### Phase 1: 前端入口移除
- [ ] Task 1: 删除 Item 路由、加载组件和侧边栏入口
- [ ] Task 2: 删除 Item 组件目录
- [ ] Task 3: 删除 Item 文案与失效前端测试

### ◆ Checkpoint A: 前端源码无 Item 业务入口
- [ ] 前端 lint/build 通过，路由树无 `/items`
- [ ] 双字典和现有测试不再依赖 Item 页面

### Phase 2: 后端与生成契约移除
- [ ] Task 4: 删除 Item API 并添加未注册路由测试
- [ ] Task 5: 删除 Item 模型、CRUD、关系及 fixture 引用
- [ ] Task 6: 删除 Item 测试工具并再生成客户端/路由树

### ◆ Checkpoint B: 应用不再读写 Item
- [ ] 后端完整测试、前端 lint/build 通过
- [ ] OpenAPI 和生成客户端无 Item API/schema

### Phase 3: 数据库 contract
- [ ] Task 7: 新增删表迁移与隔离 PostgreSQL 往返测试

### ◆ Checkpoint C: 迁移安全验证
- [ ] 空库、含数据旧库、downgrade 和再次 upgrade 均通过
- [ ] User 数据保持不变；隔离库销毁；开发/生产库未操作

### Phase 4: 用户路径与文档
- [ ] Task 8: 回归用户管理和普通用户 API
- [ ] Task 9: 回归管理员/普通用户导航和 Not Found
- [ ] Task 10: 更新当前 README 并删除失效截图
- [ ] Task 11: 标注历史规格中的 Item 失效口径

### ◆ Checkpoint D: 用户和维护者路径一致
- [ ] 管理员其余能力及普通用户设置/登录不受影响
- [ ] 当前文档不再承诺 Item，历史记录保留

### Phase 5: 审计与验收
- [ ] Task 12: 审计当前代码、生成物和历史资料边界
- [ ] Task 13: 全量验证并逐条核对规格

### ◆ Checkpoint E: 完成
- [ ] 规格 10 条 Success Criteria 均有证据
- [ ] 后端测试/lint、前端 lint/build、Playwright 全量通过
- [ ] 全栈脚本经单独确认后执行，或记录未执行原因
- [ ] 人工评审后才进入下一模块

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| 删表不可恢复 | 高 | 仅隔离库自动验证；真实环境先代码全量切换、备份、单独审批 |
| downgrade 结构不完整 | 高 | 按最终旧结构逐列/约束断言，测试往返；不声称恢复数据 |
| Alembic 误连开发库 | 高 | 测试专用环境变量、随机库名、独立 Config 和 URL 覆盖、连接目标断言、finally 清理 |
| User→Item 残留破坏启动/管理员删除 | 高 | Task 5 同片清理模型、CRUD、关系、显式 delete 和 fixture；Task 8 回归 |
| 生成文件误手改/误提交 | 中 | 仅用生成器，检查幂等和 Git 跟踪/忽略清单 |
| E2E 双角色覆盖不足 | 中 | 管理员沿用 setup，普通用户用 private API 临时创建；/items 断言现有 Not Found |
| 全栈脚本删除数据卷 | 高 | T13 前单独确认；普通 pytest/构建不调用该脚本 |
| 历史 Item 引用误删或误留 | 低 | 历史事实保留；当前 README 与当前错误码口径明确指向新规格，语义审计而非全仓零字符串 |

## Open Questions

无规格层未决问题。Task 13 的 Docker 全栈测试需执行前单独确认，因为其会销毁 Compose 数据卷。
