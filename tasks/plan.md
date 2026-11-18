# 实施计划：认证与用户账号体系改造（Email → user_code）

> 依据：`SPEC.md`（待人工评审版）｜任务明细见 `tasks/todo.md`
> 状态：**已完成——Phase 1–4 与收尾全部落地并验证（Task 1–9、检查点 A/B/C 与最终检查点）；Success Criteria A–E 已逐条核对（证据见 todo.md Task 9 核对记录）**

## 概述

把模板的「Email + 密码」账号体系改造为「用户编码（user_code）/姓名（full_name）+ 密码」的内部账号体系，同时收口生命周期：全量移除 Email 功能、删除自注册、新增管理员重置密码、主键改用 UUID v7。共 9 个任务、4 个阶段、4 个检查点。

## 已验证的代码库事实（规划依据）

- Python 3.14.4、`requires-python = ">=3.14"`，`uuid.uuid7` 内置可用 → 无需新依赖（符合 spec 禁令）。
- `backend/app/api/main.py` 挂载了 `utils` 路由（test-email），删除 `routes/utils.py` 时必须同步摘除挂载（spec 文件清单未列，已补入任务 4）。
- `login.py` 与 `users.py` 均 `import app.utils`（邮件工具）→ 邮件模块删除与路由改写必须同任务完成。
- `Settings` 通过 `env_file="../.env"` 加载配置 → `FIRST_SUPERUSER` 改名为 `FIRST_SUPERUSER_CODE` 时 `.env` 必须同步改名，否则所有测试启动即失败。
- `.github/workflows/deploy.yml` 也透传 `FIRST_SUPERUSER`（spec 仅列出 test-backend / deploy-docker-compose，已补入任务 8）。
- `conftest.py` → `tests/utils/utils.py::get_superuser_token_headers` 走 OAuth2 表单登录拿超级用户 headers，配置改名后需验证其引用链。
- 前端 `login.tsx` 的「Sign up / Forgot password?」是 TanStack 类型化 `<Link to="/signup">`，删除路由后 **不删链接则 tsc 报错** → 登录页改动被编译强耦合进任务 5。
- `scripts/generate-client.sh` 会导出 openapi.json → 重新生成 `frontend/src/client` → 自动跑 `bun run lint`。

## 架构决策

1. **遵守 spec §4：只新增 1 个 Alembic 迁移（4 步：加列 → 占位回填 → 非空+唯一 → 删列）。**
   后果：迁移删除 `email` 列的瞬间，models/crud/routes/config/db/tests 必须全部就位，因此**任务 4 是一个原子的大任务（约 16 个文件）**。已评估「先加 user_code 再删 email」的两段式迁移方案——每步都能保持代码树绿色、任务更小，但违背 spec「新增 1 个迁移」的明确要求，故不采用，列入开放问题请评审定夺。
2. **reset-password 端点先于大置换落地（任务 3）。** 它只依赖 `user_id` + 随机密码生成，与 email 无关，可提前以小任务交付并测试。
3. **契约同步单点化。** `sh scripts/generate-client.sh` 只在任务 5 执行一次（后端全部变更完成后），任务 9 复跑校验零 diff；全程禁止手改 `frontend/src/client/`。
4. **`.env` 最小改动并入任务 4**（`FIRST_SUPERUSER` → `FIRST_SUPERUSER_CODE`，残留 SMTP 键由 `extra="ignore"` 吸收），compose/CI/文档的全量清扫独立为任务 8，可与前端阶段并行。
5. **顺序「先加后删」仅用于代码内部**：任务 3 的新端点在任务 4 重写 `users.py` 时原样保留，避免重复劳动与合并冲突。

## 依赖图

```
Task 1: UUID v7 ──────────────┐
Task 2: generate_random_password ── Task 3: reset-password 端点 ── Task 4: 后端身份置换(原子)
                                                                      │
                                    ┌─────────────────────────────────┼──────────────┐
                                    │                                 │              │
                        Task 5: 客户端重生成+前端编译适配      Task 8: 基建/CI/文档清扫   │
                                    │                                 │              │
                        Task 6: 管理员重置密码弹窗                     │              │
                                    │                                 │              │
                        Task 7: Playwright e2e 重写                   │              │
                                    └──────────────┬──────────────────┘              │
                                                   └── Task 9: 全量验证与标准核对 ◄──┘
```

## 任务索引

### Phase 1：后端地基（每个任务保持代码树绿色）
- [x] Task 1：User/Item 主键改用 `uuid.uuid7` + 测试断言（S）
- [x] Task 2：`core/security.py` 新增 `generate_random_password()`（XS）
- [x] Task 3：管理员重置密码端点 `POST /users/{user_id}/reset-password` + 路由级测试（S）

### ✅ 检查点 A：后端地基（已完成）
- [x] `cd backend && uv run pytest` 全绿；`bash scripts/lint.sh` 通过

### Phase 2：后端身份置换（原子任务，见决策 1）
- [x] Task 4：user_code 替换 email 全链路置换（模型/迁移/config/db/crud/路由/删邮件模块/依赖/测试重写）（L，有意为之）

### ✅ 检查点 B：后端就绪（已完成）
- [x] 空库与含存量 email 数据的库均可 `alembic upgrade head`；`uv run pytest` 全绿；lint 通过；`POST /api/v1/utils/test-email/`、`password-recovery*`、`users/signup` 均 404

### Phase 3：前端（依赖 Task 4 的 OpenAPI 契约）— 可与 Phase 4 并行
- [x] Task 5：重生成客户端 + 编译级适配（删 signup/recover/reset 路由、useAuth、Admin/UserSettings/Sidebar 字段、登录页 testid 与链接）（L，编译强耦合）
- [x] Task 6：管理员「Reset password」弹窗（一次性展示 + 复制）（S）
- [x] Task 7：Playwright 用例重写（删 sign-up/reset-password/mailpit；改 identifier-input；新增重置密码 e2e）（M）

### ✅ 检查点 C：前端就绪（已完成）
- [x] `bun run lint` 与 `bun run --filter frontend build` 通过；手动冒烟：编码登录、管理员建号、重置密码弹窗可见可复制（e2e `bun run test` 45 passed；冒烟经人工确认）

### Phase 4：基建与文档清扫（依赖 Task 4；可与 Phase 3 并行）
- [x] Task 8：compose/CI/依赖工作区/文档中 email·SMTP·Mailpit 全量清除（M）

### 收尾
- [x] Task 9：全量验证 + Success Criteria A–E 逐条核对（XS）

### ✅ 检查点：完成
- [x] `sh scripts/test.sh` 全绿（按 CI 工作流同款序列执行：70 passed、coverage 94%；根脚本容器内 pytest 段系上游缺陷，见 todo.md Task 9 注记①）；`bun run test` 全绿（45 passed）；两端 lint 通过
- [x] `sh scripts/generate-client.sh` 复跑零 diff
- [x] Success Criteria A–E 全部勾选

## 并行化建议

- **串行链**：T1 → T2 → T3 → T4（同文件写入顺序依赖，不建议并行）。
- **并行窗口**：T4 完成后，T5→T6→T7（前端）与 T8（基建/文档）互不触碰同一文件，可双会话并行。
- T7 依赖 T5、T6；T9 依赖全部。

## 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| Task 4 原子任务过大（~16 文件），单会话完不成 | 中 | todo.md 内置严格有序的子步骤清单（模型→迁移→config→db→crud→login→users→private→删模块→依赖→.env→测试），机械执行；若确实过大，见开放问题 3 的两段式迁移备选 |
| 时序攻击防护回归（ authenticate 无命中时漏跑 DUMMY_HASH） | 高 | 保留 `verify_password(password, DUMMY_HASH)` 路径；新增 monkeypatch spy 测试断言其被调用（spec 测试策略明列） |
| Argon2 `verify_and_update` 的重哈希更新路径在 authenticate 重写中丢失 | 中 | 重写时保留 `updated_password_hash` 回写逻辑，crud 测试覆盖 |
| 删除路由后 `routeTree.gen.ts` 过期导致 tsc 报错 | 低 | 路由文件删除后立即 `bun run --filter frontend build` 由插件重生成；禁止手改 gen 文件 |
| 生成客户端与后端漂移 | 中 | 契约同步单点化（T5 一次 + T9 零 diff 校验） |
| 测试登录链路断裂（testid `email-input` → `identifier-input`）波及所有 e2e | 中 | `auth.setup.ts` 集中修改；`config.ts` 常量改为 `FIRST_SUPERUSER_CODE` 对应值 |
| 迁移占位回填 `left(id::text,8)` 理论上可能撞唯一索引 | 低 | spec 指定公式；v4 随机性下概率可忽略，迁移失败时人工处理该行 |
| `uv.lock` 与 `pyproject.toml` 漂移 | 低 | T4 内执行 `uv lock && uv sync`；T9 校验无新增第三方依赖 |
| OAuth2 表单字段 `username` 语义被误改 | 高 | Never 边界：路径/方法/表单形状不变，T9 手动验证 Swagger OAuth2 流程 |

## 开放问题（请评审时确认）

1. **user_code 生成方式**（spec 开放问题 1）：按默认实现——管理员创建时手工填写（必填、唯一），不做自动流水号。
2. **full_name 是否必填**（spec 开放问题 2）：按默认保持可空（为空仅能以编码登录）。
3. **（计划层新增）是否接受 Task 4 的原子性**：遵守 spec「单一迁移」则后端置换必须一次落地；若你愿意放宽为 2 个新迁移（先加列后删列），Task 4 可拆成两个绿色小任务。**默认遵守 spec，不放宽。**
