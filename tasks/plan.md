# 实施计划:简体中文支持(i18n 中英双语)

> 依据:`SPEC-i18n.md`(待人工评审 → 以调用规划技能作为批准信号)|任务明细见 `tasks/todo.md`
> 状态:**待人工评审**
> 前计划(认证改造)已 100% 完成(原 `tasks/{plan,todo}.md` 77/77 勾选),归档至 `tasks/archive/auth-user-code/`,git 可恢复。

## 概述

按 SPEC-i18n.md 的六个切片(S1–S6)实施中英双语改造:前端 i18next 脚手架 + 全量文案中文化、后端错误码契约(24 处 raise 点 → 17 个 code)、E2E 改造为 testid + 中文冒烟、四份文档中文重写。共 18 个任务、5 个阶段、5 个检查点。

## 已验证的代码库事实(规划依据)

- **错误契约面**:24 处 `raise HTTPException`(`items.py` 6、`deps.py` 4、`login.py` 3、`users.py` 11)→ 17 个去重 code;后端测试 ~20 处英文 `detail` 断言分布在 `test_items.py` / `test_users.py` / `test_login.py`。deps 类断言的归属文件需在 T14 用 grep 定位(可能跨 test_login.py)。
- **错误漏斗单点**:`frontend/src/utils.ts::extractErrorMessage`(全部 mutation 走 `handleError.bind(showErrorToast)`);`main.tsx` 的 401/403 跳转按 status 判断,不受契约影响;后端成功响应 `Message.message` 不被前端渲染(`DeleteItem.tsx` 等使用自有文案)→ 契约只覆盖 `detail`。
- **E2E 现状**:`auth.setup.ts` 以 `getByRole("button", { name: "Log In" })` 登录 → **登录按钮文案变更会打断全部 E2E 的 setup**,必须与登录页改造同任务处理;导航一律 `page.goto()`,侧边栏改名不影响导航;text 定位器密度:login 14 / items 33 / admin 36 / user-settings 17 处;user-settings.spec.ts 已有 23 处 `getByTestId` 基础。
- **登录页可见组件**:`AuthLayout` 渲染 `Appearance`(Light/Dark/System/Appearance 英文)与 `Footer`(产品名+年份)→ 主题切换文案属 S1;Footer 为产品名(品牌词,保留原文,见架构决策 5)。
- **切换器落点**:`AppSidebar` 的 `SidebarFooter` 已有 `SidebarAppearance` + `User`,语言切换器仿 `SidebarAppearance` 模式并列放入(spec Open Question 1 按建议执行)。
- **路由标题**:5 处 `head: () => ({ meta: [{ title }] })` 静态定义 → 语言切换需 `router.invalidate()` 重求值(风险 2)。
- **命令**:`bun run dev/build/lint/test`(根,bun workspace);E2E webServer 自动拉起前端,后端 + db 需先运行;`sh scripts/generate-client.sh` 导出 openapi.json → 再生成 client → 自动 lint。

## 架构决策

1. **字典文件是全局伴随文件**:每个任务都会 append `zh-CN.json` / `en.json`,**不计入单任务 ≤5 文件预算**(预算只数源/测试文件)。
2. **zod 消息随文件内联翻译**:某文件在本次任务中本来就要改,其 zod message 同任务字典化;不做独立批量任务,改由 T12 做 grep 审计门禁(`message: "` 零字面量)。
3. **E2E 随域配对改造**:哪个任务改某域文案,该任务同任务更新对应 spec 文件(定位器 testid 化 + 断言中文化)——保证每任务交付时代码树绿色,不出现「全红等 S5」;S5(T16)收口为审计而非批量转换。
4. **契约试点先行(T13)**:仅 login 单点打通「后端 code → openapi 再生成 → utils.ts 回退链 → 中文 toast → 双测试绿」全链路,T14/T15 纯机械推广;先字典后后端(Always 边界)。
5. **品牌/产品词保留原文**:Footer「Full Stack FastAPI Template」、社交 aria-label(GitHub/X/LinkedIn)、Logo 不入字典;S1「零英文残留」验收口径排除品牌词。**请评审确认**。
6. **错误码契约**:`detail = {"code", "message"}`,message 固定英文兜底(语言中立);契约表见 SPEC-i18n.md,评审通过即冻结。
7. **语言切换响应机制**:切换器 → `setAppLanguage(lang)`(localStorage + `i18n.changeLanguage` + `document.documentElement.lang`)→ 组件内 `router.invalidate()` 触发 `head()` 重求值;具体接线 T3 实现,S1 验收含「标题免硬刷新即时更新」。
8. **线性执行为默认**:双 lane(前端清扫 ∥ 后端契约)理论可行,但双字典 JSON 会被两条 lane 同时编辑,合并冲突风险高;如需并行,字典编辑必须串行化。

## 依赖图

```
T1: i18n 骨架 ── T2: 登录页双语(含 setup/spec)── T3: 切换器/响应 ── ◆CP-A(S1)
                                                                      │
              T4: 侧边栏 ── T5: Dashboard/全局 ── T6: Items 页 ── T7: Items 弹窗 ── ◆CP-B(S2, keys≤400)
                                                                                      │
              T8: Admin 页 ── T9: Admin 弹窗 ── T10: Settings ── T11: 清扫 ── T12: zod 审计 ── ◆CP-C(S3)
                                                                                              │
              T13: 契约试点(login)── T14: 推广 users+deps ── T15: 推广 items ── ◆CP-D(S4)
                                                                                │
              T16: E2E 审计(S5)── T17: 文档中文化(S6)── T18: 全量核对 ── ◆CP-E(完成)
```

- 严格线性(T13 依赖 T2 的登录页中文与 T11 的 utils.ts 归属);T17 理论上可与 P4 并行,默认仍线性。

## 任务索引

### Phase 1:S1 脚手架 + 登录页样板(高风险优先:i18next 集成摩擦在 T1–T3 暴露)
- [ ] Task 1:i18n 依赖与初始化骨架(i18n.ts + 双字典 + main.tsx 接线)(M)
- [ ] Task 2:登录页全量双语 + login.spec.ts 中文冒烟 + auth.setup.ts testid 化(M)
- [ ] Task 3:语言切换器 + `<html lang>`/标题响应 + language.spec.ts 冒烟(M)

### ◆ Checkpoint A(S1 验收)
- [ ] spec S1 清单逐项核对(双语渲染/持久化/html lang/标题即时更新/一天内跑通)
- [ ] `bun run lint` + `bun run build` + E2E 全绿;**人工评审后再进入 Phase 2**

### Phase 2:S2 主框架 + Items
- [ ] Task 4:侧边栏与用户菜单(Sidebar/Main、User、AppSidebar + login.spec logout 定位器)(M)
- [ ] Task 5:Dashboard 与全局组件(index.tsx、ErrorComponent、NotFound)(S)
- [ ] Task 6:Items 页与表格(items.tsx、columns、PendingItems + items.spec 定位器)(M)
- [ ] Task 7:Items 弹窗与操作(Add/Edit/Delete、ItemActionsMenu,含 zod 内联)(M)

### ◆ Checkpoint B(S2 验收)
- [ ] Dashboard/Items 域零英文残留(品牌词除外)
- [ ] **keys 统计 ≤400 检查点**(统计 zh-CN.json key 数;超限停下重估并回报)
- [ ] E2E 全绿

### Phase 3:S3 Admin + Settings + 清扫
- [ ] Task 8:Admin 页与表格(admin.tsx、columns、PendingUsers + admin.spec 部分)(M)
- [ ] Task 9:Admin 弹窗与操作(Add/Edit/DeleteUser、UserActionsMenu、ResetPasswordDialog,含 zod 内联)(M)
- [ ] Task 10:Settings(settings.tsx 三 tab、四个组件 + user-settings.spec)(M,6 文件:测试文件为伴随)
- [ ] Task 11:隐蔽英文源清扫(useCustomToast、utils.ts 兜底、shadcn aria;处置清单)(S)
- [ ] Task 12:zod 字面量审计(grep 门禁:src 内 `message: "` 零残留)(S)

### ◆ Checkpoint C(S3 验收)
- [ ] Admin/Settings 零英文;aria 处置清单记录
- [ ] **双字典 key 集合 diff = 0**(en 缺口清零;en 全量决策复核点)
- [ ] E2E 全绿

### Phase 4:S4 后端错误码契约
- [ ] Task 13:login 单点试点(3 处 + test_login + utils.ts 回退链 + client 再生成)(M)
- [ ] Task 14:推广 users + deps(15 处 + 对应测试 + 字典 12 codes)(M)
- [ ] Task 15:推广 items(6 处 + test_items)+ 契约表 17 code 全量核对(S)

### ◆ Checkpoint D(S4 验收)
- [ ] 契约表逐项核对(24 处 / 17 code,状态码不变);`uv run pytest` + E2E 全绿
- [ ] `sh scripts/generate-client.sh` 后 `frontend/src/client/` 零手改 diff

### Phase 5:S5 + S6 收口
- [ ] Task 16:E2E 收口审计(英文文案断言清零、抽查「改文案不碎测试」演练)(S)
- [ ] Task 17:文档中文化(README / development / deployment ×2 + 继承说明)(S)
- [ ] Task 18:全量验证与 SPEC-i18n.md 总体验收逐条核对(XS)

### ◆ Checkpoint E(完成)
- [ ] SPEC-i18n.md「Success Criteria」总体四项全绿
- [ ] 人工终审

## 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| i18next × React 19/Vite/SWC 集成摩擦 | 高(脚手架重来) | T1–T3 最小面暴露;不通过则回退自研 context 方案需重新评审 |
| `head:` 静态导致标题不随语言更新 | 中 | T3 用 `router.invalidate()`;S1 验收含免硬刷新断言 |
| keys 膨胀 >400 | 中 | CP-B 统计检查点,超限停下重估(idea 假设 3) |
| 契约破坏唯一消费方 | 高 | T13 login 单点先行,双测试全绿再推广(idea 假设 2) |
| E2E setup 依赖登录 UI 文案 | 高(全 E2E 崩) | T2 同任务改造 auth.setup.ts(testid 化) |
| 双字典漂移(en 缺 key) | 低 | Always 边界同 PR 双改;CP-C key 集合 diff 门禁 |
| deps 断言归属文件不明 | 低 | T14 以 grep `detail` 定位后逐条改,不许删断言 |

## Open Questions(评审时定,不阻塞)

1. Footer 产品名与社交 aria-label 保留原文(架构决策 5)—— 请确认。
2. T17 文档重写口径:README 是否保留英文 quick-start 摘要?(spec 决策「不维护英文版」,默认纯中文)
3. 并行 lane(架构决策 8)是否启用?默认线性。
