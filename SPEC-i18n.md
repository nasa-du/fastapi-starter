# Spec: 简体中文支持(i18n 中英双语)

> 状态:**待人工评审**
> 范围决策:六个切片共享同一消费者(应用最终用户)与同一数据资产(zh-CN/en 字典);错误码契约是 i18n 的支撑性子契约而非可独立裁剪的能力(裁掉它「错误提示全面中文化」即不成立),故作为单一能力域处理(**无 capability map**,与 `SPEC.md` 认证改造同例),验收标准按切片 S1–S6 分区。
> 来源:`docs/ideas/i18n-zh-hans.md`(idea-refine 定稿,2026-11-19)

## 写作前假设(评审时一并确认)

1. 本 spec 保存为根目录 `SPEC-i18n.md`,与既有 `SPEC.md`(认证改造,已完成)并列同约定;`SPEC.md` 本体保持不动(历史决策记录)。
2. zh-CN 为源语言 + 兜底语言(fallbackLng);检测顺序 **localStorage → navigator.language → zh-CN**(非 zh 浏览器一律 en)。
3. 仅新增 `i18next` + `react-i18next` 两个依赖;检测/持久化/`<html lang>` 同步手写(~40 行),不引入 `i18next-browser-languagedetector` 等插件。
4. 错误码契约只覆盖 `HTTPException` 的 `detail`(实测 **24 处 raise 点、17 个去重 code**);后端成功响应 `Message.message` 不动(已核实前端成功提示用自有文案,如 `DeleteItem.tsx`,不渲染后端 message)。
5. 前端错误消费单点在 `frontend/src/utils.ts::extractErrorMessage`,回退链在此实现;`main.tsx` 的 401/403 跳转按 status 判断,不受契约影响。
6. `en.json` 目标为**全量覆盖**(模板资产性质);切片 3 结束时按 key 总量复核(doc 既定检查点)。
7. Pydantic 422 自动校验消息保持英文原样(既有 `errDetail[0].msg` 分支不变),由前端 zod 拦截兜底 —— Not Doing 红线。

## Objective

把中文为主的内部系统(及所有派生项目)的用户可见文案全面中文化,同时保留双语能力,并把「i18n 脚手架 + 错误码契约」沉淀为模板的继承资产。这是认证改造(`SPEC.md`)时被刻意延后的「界面中文化」落地。

**用户故事**

- 作为以中文为主的用户,我打开系统即看到中文界面(侧边栏、Items、Admin、Settings、表单校验、错误提示)。
- 作为偶发英文的用户,我可通过侧边栏切换器切换到英文,刷新后保持(localStorage)。
- 作为派生项目的开发者,我直接继承 i18n 脚手架与错误码规范,零成本复用。

**不在范围内**(承 idea doc,红线)

- Pydantic 422 自动校验消息中文化
- 集中式 Intl 日期/数字格式化层
- 语言偏好存后端账号(per-user 服务端偏好)
- README 英文版维护、繁体/伪本地化/RTL

## 错误码契约(后端语言中立,S4 的评审基准)

`HTTPException` 的 `detail` 从纯字符串改为结构化对象:

```json
{ "detail": { "code": "AUTH_LOGIN_INVALID", "message": "Incorrect user code/name or password" } }
```

- `code`:`UPPER_SNAKE_CASE` + 模块前缀(`AUTH_` / `USERS_` / `ITEMS_`),稳定机器键,前端字典翻译的索引。
- `message`:**固定英文**,语言中立兜底文案(不本地化)——「未知 code 回退原始 detail」的英文来源(承 idea 假设 4,故在 doc 的 `{"code"}` 简写上补 `message` 字段)。
- 前端回退链(单点在 `utils.ts`):`errors.{code}` 字典 → `detail.message` → 原始 detail(422 数组等非契约形状沿用既有分支)。

**契约表:24 处 raise 点 → 17 个 code**(状态码全部保持不变)

| Code(提议) | HTTP | 现 detail(message 兜底) | 位置 |
|---|---|---|---|
| `AUTH_LOGIN_NAME_CONFLICT` | 400 | Multiple users share this name, please log in with your user code | login.py:32 |
| `AUTH_LOGIN_INVALID` | 400 | Incorrect user code/name or password | login.py:37 |
| `AUTH_LOGIN_INACTIVE` | 400 | Inactive user | login.py:41 |
| `AUTH_CREDENTIALS_INVALID` | 403 | Could not validate credentials | deps.py:37 |
| `AUTH_USER_NOT_FOUND` | 403 | User not found(token 主体) | deps.py:46 |
| `AUTH_USER_INACTIVE` | 400 | Inactive user(已认证请求) | deps.py:50 |
| `AUTH_FORBIDDEN` | 403 | The user doesn't have enough privileges | deps.py:59 |
| `USERS_CODE_ALREADY_EXISTS` | 400 | The user with this user_code already exists in the system. | users.py:65 |
| `USERS_PASSWORD_INCORRECT` | 400 | Incorrect password | users.py:99 |
| `USERS_PASSWORD_UNCHANGED` | 400 | New password cannot be the same as the current one | users.py:101 |
| `USERS_SUPERUSER_DELETE_SELF` | 403 | Super users are not allowed to delete themselves | users.py:125, 198 |
| `USERS_FORBIDDEN` | 403 | The user doesn't have enough privileges | users.py:144 |
| `USERS_NOT_FOUND` | 404 | User not found | users.py:149, 196, 219 |
| `USERS_ID_NOT_FOUND` | 404 | The user with this id does not exist in the system | users.py:170 |
| `USERS_CODE_CONFLICT` | 409 | User with this user_code already exists | users.py:179 |
| `ITEMS_NOT_FOUND` | 404 | Item not found | items.py:55, 88, 108 |
| `ITEMS_FORBIDDEN` | 403 | Not enough permissions | items.py:57, 90, 110 |

## Tech Stack

- 前端(既有):React 19、TanStack Router/Query/Table、react-hook-form + zod、@hey-api/openapi-ts 生成客户端、Biome、Playwright、bun、Vite(+SWC)
- i18n(新增):`i18next` + `react-i18next`(安装时取最新稳定版,bun add);单 namespace、JSON 字典本地打包(经 Vite import 内联,无 HTTP 加载)
- 后端(既有):Python 3.14、FastAPI、SQLModel、Alembic、PostgreSQL、uv workspace —— **无新增后端依赖**
- 客户端契约:`scripts/generate-client.sh` 再生成(禁止手改 `frontend/src/client/`)

## Commands

```bash
# ---- 前端(根目录,bun workspace)----
bun run dev                     # Vite dev server(:5173)
bun run build                   # tsc -p tsconfig.build.json && vite build
bun run lint                    # biome check --write
bun run test                    # Playwright E2E(自动拉起前端 dev server;后端 + db 需先运行,见 development.md)
bun run test:ui                 # Playwright UI 模式

# ---- 客户端契约再生成(切片 4)----
sh scripts/generate-client.sh   # 导出 openapi.json → openapi-ts 再生成 → 自动 lint

# ---- 后端(backend/,uv workspace)----
docker compose up -d db         # 本地 Postgres
cd backend && uv run pytest     # 后端测试(FASTAPI_ENV=development)
bash scripts/test.sh            # coverage 版(CI 同款)
bash scripts/lint.sh            # mypy + ty + ruff
```

## Project Structure

```
SPEC-i18n.md                  → 本 spec(根目录,与 SPEC.md 并列)
docs/ideas/i18n-zh-hans.md    → 创意定稿(来源,不动)
frontend/src/i18n.ts          → i18next 初始化(~40 行):检测、localStorage 持久化、<html lang> 同步、changeLanguage 助手
frontend/src/locales/zh-CN.json → 源语言字典(keys 的唯一索引)
frontend/src/locales/en.json    → 第二语言字典
frontend/src/                 → 其余不动;组件内字面量替换为 t() 调用
backend/app/api/              → 24 处 raise 点改结构化 detail;其余不动
frontend/tests/               → E2E:关键路径 testid + 中文冒烟(仅 login.spec.ts 保留文案断言)
tasks/plan.md, tasks/todo.md  → 下一阶段产物(现有文件属已完成认证改造,不覆盖,新增章节或按约定归档)
```

## Code Style

```tsx
// 组件内:useTranslation + t(),key 按「页面.元素」分组(lowerCamelCase)
const { t } = useTranslation()
<h1 className="text-2xl font-semibold">{t("login.title")}</h1>

// 表单校验:zod message 一律走字典,不留字面量
username: z.string().min(1, { message: t("login.errors.usernameRequired") }),

// 后端:code + 固定英文 message,语言中立
raise HTTPException(
    status_code=400,
    detail={"code": "AUTH_LOGIN_INVALID", "message": "Incorrect user code/name or password"},
)
```

```jsonc
// src/locales/zh-CN.json:UI keys lowerCamelCase 分组;错误码 keys 原样用后端 code,统一收在 "errors" 组
{
  "login": { "title": "欢迎回来", "submit": "登录", "errors": { "usernameRequired": "请输入用户编码或姓名" } },
  "toast": { "success": "操作成功", "error": "出错了" },
  "errors": { "AUTH_LOGIN_INVALID": "用户编码或密码错误" }
}
```

```ts
// utils.ts —— 全部错误 toast 的唯一漏斗;回退链:字典 → detail.message → 原始形状
function extractErrorMessage(err: Error): string {
  const detail = (err.response?.data as any)?.detail
  if (detail?.code) return i18n.t(`errors.${detail.code}`, { defaultValue: detail.message ?? "" })
  // 422 数组等既有分支不变(范围外,保留英文)
  // ...
}
```

约定:key 命名「页面.元素.lowerCamelCase」;新增 code 必须同 PR 补 `errors` 组双字典;字典文件禁止注释以外的无效内容;`data-testid` 用语义化 lowerCamelCase(如 `login-submit`)。

## Testing Strategy

- **后端**(`backend/tests/`):S4 将 `test_items.py` / `test_users.py` / `test_login.py` 中 ~20 处 `detail` 英文断言改为 `detail.code` 断言(对照契约表,逐条对应,不允许顺手删断言);`uv run pytest` 全绿,coverage 不低于现状。
- **前端 E2E**(`frontend/tests/`,Playwright):
  - 关键交互路径(登录、Items CRUD、Admin、Settings)改/加 `data-testid` 定位,取代 `getByRole(name: "英文文案")` / `getByText("英文文案")`;
  - 文案断言仅保留 login.spec.ts 的中文冒烟级(登录成功/失败提示),改文案不碎测试;
  - 新增 1 个语言切换冒烟用例:切 en → 登录页变英文 → 刷新保持 → 切回 zh-CN。
- **验证矩阵**:每切片交付前 `bun run lint` + `bun run build` + 相关 e2e;S1/S4 加 `uv run pytest`;S4 加 `sh scripts/generate-client.sh` 后零手改 diff。
- 不新增覆盖率要求;现有 `scripts/test.sh` 门禁保持绿。

## Boundaries

- **Always**:
  - 每处文案改动同步双字典(zh-CN.json 必改;en.json 同 PR 补齐,切片交付前缺口清零)
  - 错误码变更「先字典、后后端」;新增 code 必带英文 message 兜底
  - 后端测试断言写 `detail.code`,不写英文文案断言
  - 切片交付前跑验证矩阵(见上)
  - 遵守既有代码风格(Biome/ruff/prek 全绿)
- **Ask first**:
  - 新增 npm 依赖(仅 i18next、react-i18next 已在本 spec 授权内)
  - 契约表(本文件)增删改 code、改命名规范
  - 重写/删除既有测试断言(S4/S5 涉及时逐条对照契约表与 testid 清单)
  - 文档口径事实变更(README/deployment 描述的部署事实)
- **Never**:
  - 后端返回本地化文案(语言中立红线;`detail.message` 固定英文)
  - 手改 `frontend/src/client/` 生成物
  - 本地化 Pydantic 422 自动消息(Not Doing)
  - 删除测试而不以等价断言替换
  - 修改 `SPEC.md`(历史记录)、`release-notes.md`(上游历史)、`docs/ideas/`(定稿存档)

## Success Criteria

**S1 脚手架 + 登录页样板**
- [ ] 登录页在 zh-CN / en 下完整双语渲染(标题、占位符、按钮、错误提示)
- [ ] 侧边栏语言切换器可用;localStorage 持久化(切换 → 刷新 → 语言保持)
- [ ] `<html lang>` 随语言切换即时更新(免硬刷新)
- [ ] 登录路由标题(`head:`)随语言切换即时更新
- [ ] 一天内跑通(idea 假设 1:i18next × Vite+SWC+React 19 无集成摩擦)
- [ ] 全套验证矩阵绿

**S2 主框架 + Items**
- [ ] 侧边栏、Dashboard、Items 页(含 CRUD 弹窗、actions menu、成功/失败 toast)可见文案零英文残留
- [ ] 全部 5 处路由标题 + `index.html` title 中文化且随语言切换
- [ ] ErrorComponent / NotFound 文案入字典
- [ ] **检查点:统计 keys 总量,>400 则重估后续工作量(idea 假设 3)**

**S3 Admin + Settings + zod 消息**
- [ ] Admin(含 columns、actions menu、增删改/重置密码弹窗)、Settings(三个 tab)、DeleteConfirmation 文案零英文残留
- [ ] 6 个文件的 zod message 全部走字典(login / AddUser / EditUser / AddItem / EditItem / ChangePassword)
- [ ] `useCustomToast` 标题(Success! / Something went wrong!)与 `utils.ts` 兜底文案入字典
- [ ] Radix/shadcn 内置 aria-label(如 sidebar):尽量本地化,遗留项列清单记录
- [ ] **检查点:en.json 全量 vs 核心路径 —— 决策并记录(预期:全量)**

**S4 后端错误码契约**
- [ ] 24 处 raise 点全部返回 `{"code", "message"}`(对照契约表,状态码不变);首个落地为 login 单点试点,pytest + E2E 全绿后再推广(idea 假设 2)
- [ ] `sh scripts/generate-client.sh` 再生成,`frontend/src/client/` 零手改
- [ ] 前端错误 toast 走字典;未知 code 回退英文 message(有 E2E 或单测证据)
- [ ] 后端测试 ~20 处断言改为 code 断言;`uv run pytest` 全绿
- [ ] `bash scripts/lint.sh` 全绿

**S5 测试改造**
- [ ] 登录 / Items / Admin / Settings 关键路径以 testid 定位;文案断言仅存于 login.spec.ts(中文冒烟)
- [ ] 语言切换冒烟用例通过
- [ ] E2E 全绿;抽查验证「改一个非登录文案,测试仍绿」

**S6 文档中文化**
- [ ] README.md / development.md / deployment.md / deployment-docker-compose.md 中文重写,与 `SPEC.md` 口径一致
- [ ] 根 README 保留模板继承说明:i18n 脚手架 + 错误码规范的使用方式(差异化价值)
- [ ] typos(prek)通过

**总体**
- [ ] 全站中文为主,偶发英文用户可切换且未知错误有英文兜底
- [ ] 模板继承资产成立:派生项目拷贝即得 i18n 脚手架 + 错误码契约

## 隐蔽英文源清单(实测盘点,S2/S3 清扫对象)

| 源 | 位置 | 切片 |
|---|---|---|
| 页面/组件字面量 | routes/、components/(全量) | S1–S3 |
| 路由标题 ×5 + index.html title/lang | routes/*.tsx、index.html | S1–S2 |
| zod message | 6 个表单文件 | S3 |
| toast 标题 | useCustomToast.ts | S3 |
| 错误兜底文案 | utils.ts("Something went wrong.") | S3 |
| 组件内成功提示 | 各 *ActionsMenu / Delete*.tsx(如 "The item was deleted successfully") | S2–S3 |
| 后端 detail ×24 | api/routes/、api/deps.py | S4(契约化,不翻译) |
| Pydantic 422 msg | 自动生成 | 范围外 |
| aria-label | Radix/shadcn 内置 | S3(低优先级) |

## 已知风险与缓解

1. **i18next × React 19/Vite/SWC 集成摩擦** → S1 一天内跑通即验证;不通过则回退方案(自研 ~60 行 context 方案)需重新评审。
2. **TanStack Router `head:` 为模块级静态定义** → 语言切换需 `router.invalidate()` + `document.documentElement.lang` 同步;S1 验收已含「免硬刷新即时更新」。
3. **key 膨胀** → S2 末 >400 keys 检查点重估。
4. **契约破坏唯一消费方** → login 单点先行 + 双测试全绿再推广。
5. **`extractErrorMessage` 漏斗外另有 `getApiErrorDescription` 类似逻辑**(若有遗漏消费点)→ S4 试点时全仓 grep `\.detail` 收口,确保回退链单点化。

## Open Questions

1. 语言切换器位置:侧边栏底部(建议,与主题切换并列)还是用户菜单?—— 实现时定,不影响架构。
2. `en.json` 全量 vs 核心路径 —— 建议**全量**(模板资产),S3 末按 key 总量复核。
3. 错误码命名 —— 本 spec 契约表已给出完整提议(UPPER_SNAKE + 模块前缀),**评审通过即冻结**,实现时不再改。
4. 字典目录命名 `src/locales/`(本 spec 提议)vs 其他 —— 无既有约定,评审时定。
