# Capability Map: 移除 Item 与用户自助注销

> 状态：已获人工批准
> 本文件是本能力域的索引，模块规格按稳定的 module id 命名。

| Module id | Responsibility | Depends on |
|---|---|---|
| `item-removal` | 删除 Item 前端页面与路由、后端 API、业务逻辑、应用数据模型、相关测试和客户端契约；新增 Alembic 迁移删除数据库表及数据 | — |
| `self-account-deletion-removal` | 删除用户自助注销的前端入口、后端 API 和业务逻辑；保留已有用户数据及管理员侧用户管理能力 | — |

Build order: `item-removal` → `self-account-deletion-removal`

两者无代码或数据依赖，可按上述顺序独立实施，也可分别验证。部署时，破坏性数据库迁移必须在移除 Item 读写代码之后执行。
