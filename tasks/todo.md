# 任务清单:简体中文支持(i18n 中英双语)

> 依据 `SPEC-i18n.md` 与 `tasks/plan.md`。每完成一项即勾选并运行该任务的验证命令。
> 验证前提:`docker compose up -d db`(后端测试);`bun run test` 需后端+数据库运行中。
> 约定:所有任务都会同步 `frontend/src/locales/zh-CN.json` 与 `en.json`(全局伴随文件,不计入文件预算);品牌/产品词(GitHub、X、LinkedIn、「Full Stack FastAPI Template」)保留原文。

---

## Task 1:i18n 依赖与初始化骨架

**描述**:安装 `i18next` + `react-i18next`,新建 `src/i18n.ts`(~40 行:资源内联、localStorage("app-language") → navigator.language(zh* → zh-CN,否则 en)→ fallbackLng zh-CN 的检测链、`setAppLanguage` 助手同步 `document.documentElement.lang`),`main.tsx` 在渲染前 import 初始化。不引入 languagedetector 等插件。

**验收标准**:
- [x] `frontend/package.json` 仅新增 i18next、react-i18next 两个依赖
- [x] `src/i18n.ts` 实现检测链与 setAppLanguage;`src/locales/zh-CN.json`、`en.json` 存在(骨架 + `errors: {}` 组)
- [x] `bun run build` 通过;dev 启动 console 无 i18n 报错

**验证**:
- [x] 构建通过:`bun run build`(根目录无 build 脚本,实际执行 `frontend/` 内 `bun run build`,tsc + vite 绿)
- [x] lint 通过:`bun run lint`(根目录转发至 frontend,biome 绿)
- [x] 手动检查:dev 起服务,`<html lang>` 为检测结果,无 console 报错(headless chromium 冒烟 4 场景:zh 浏览器→zh-CN、en 浏览器→en、存储 en 覆盖 zh 浏览器→en、存储 zh-CN→zh-CN;console 零报错)

**依赖**:无

**文件**:`frontend/package.json`、`frontend/src/i18n.ts`(新)、`frontend/src/locales/{zh-CN,en}.json`(新)、`frontend/src/main.tsx`

**规模**:M(5 文件)

---

## Task 2:登录页全量双语 + E2E setup 冒烟改造

**描述**:登录页可见文案全部 t() 化:login.tsx(zod ×3、「Login to your account」、两个 label、两个 placeholder、「Log In」按钮、head 标题)+ Appearance.tsx(Appearance/Light/Dark/System/sr-only,登录页经 AuthLayout 可见)。提交按钮加 `data-testid="login-submit"`。login.spec.ts 英文文案断言改为中文冒烟(testid 优先);auth.setup.ts 的 `name: "Log In"` 改 `getByTestId("login-submit")`。Footer 产品名保留(决策 5)。

**验收标准**:
- [ ] 登录页(含主题下拉)中英文可切换、zod 校验消息来自字典;head 标题来自字典
- [ ] login.spec.ts 无英文文案断言(中文冒烟 + testid);auth.setup.ts 不再依赖按钮文案
- [ ] 字典新增 `login` 组与主题组(双字典同步)

**验证**:
- [ ] E2E:`bunx playwright test tests/login.spec.ts`(需后端+db)
- [ ] 构建通过:`bun run build`
- [ ] 手动检查:错误登录 → 中文提示 toast;切 en 后登录页变英文

**依赖**:Task 1

**文件**:`frontend/src/routes/login.tsx`、`frontend/src/components/Common/Appearance.tsx`、`frontend/tests/login.spec.ts`、`frontend/tests/auth.setup.ts`

**规模**:M(4 文件)

---

## Task 3:语言切换器与语言响应

**描述**:新建 `LanguageSwitcher.tsx`(仿 SidebarAppearance 的 dropdown:中文 / English + tooltip),放入 AppSidebar 的 SidebarFooter(Appearance 旁)。`setAppLanguage` 完成持久化 + `<html lang>` 同步;切换后 `router.invalidate()` 触发 `head()` 重求值(接线方式实现时定)。新增 tests/language.spec.ts 冒烟:切 en → 登录页英文 → 刷新保持 → `<html lang>` 断言。

**验收标准**:
- [ ] 侧边栏底部出现语言切换器,与主题切换并列;切换即时生效且免硬刷新(路由标题、`<html lang>`)
- [ ] 刷新后语言保持(localStorage)
- [ ] language.spec.ts 通过

**验证**:
- [ ] E2E:`bunx playwright test tests/language.spec.ts`
- [ ] 手动检查:切换后 Dashboard 标题即时更新

**依赖**:Task 2

**文件**:`frontend/src/components/Common/LanguageSwitcher.tsx`(新)、`frontend/src/components/Sidebar/AppSidebar.tsx`、`frontend/src/i18n.ts`、`frontend/tests/language.spec.ts`(新)

**规模**:M(4 文件)

---

## ◆ Checkpoint A:S1 验收(人工评审后再进入 Phase 2)

- [ ] SPEC-i18n.md S1 清单逐项核对(双语渲染/切换器/持久化/html lang/标题即时更新)
- [ ] `bun run lint` + `bun run build` + `bun run test` 全绿
- [ ] i18next × Vite+SWC+React 19 集成摩擦已排除(idea 假设 1)

---

## Task 4:侧边栏与用户菜单

**描述**:Sidebar/Main.tsx(导航项 title → 字典)、Sidebar/User.tsx(用户菜单各项)、AppSidebar.tsx(baseItems 的 title 改为 key 映射)。User 菜单登出项加 `data-testid="logout"`,login.spec.ts 的 `"Log out"` 定位器同步改 testid。

**验收标准**:
- [ ] 侧边栏与用户菜单(含 collapse tooltip)文案来自字典
- [ ] login.spec.ts 无 `"Log out"` 文本依赖
- [ ] 字典新增 `nav` / `menu` 组(双字典)

**验证**:
- [ ] E2E:`bunx playwright test tests/login.spec.ts`
- [ ] lint + build 通过

**依赖**:Task 3

**文件**:`frontend/src/components/Sidebar/Main.tsx`、`frontend/src/components/Sidebar/User.tsx`、`frontend/src/components/Sidebar/AppSidebar.tsx`、`frontend/tests/login.spec.ts`

**规模**:M(4 文件)

---

## Task 5:Dashboard 与全局组件

**描述**:routes/_layout/index.tsx(Dashboard 标题 + 页内文案)、Common/ErrorComponent.tsx、Common/NotFound.tsx 全部 t() 化。

**验收标准**:
- [ ] Dashboard 页、错误组件、404 页零英文残留(品牌词除外)
- [ ] 字典新增 `dashboard` / `error` 组(双字典)

**验证**:
- [ ] 手动检查:访问不存在路由看 404 文案
- [ ] build + lint 通过

**依赖**:Task 4

**文件**:`frontend/src/routes/_layout/index.tsx`、`frontend/src/components/Common/ErrorComponent.tsx`、`frontend/src/components/Common/NotFound.tsx`

**规模**:S(3 文件)

---

## Task 6:Items 页与表格

**描述**:routes/_layout/items.tsx(head 标题 + 页面文案)、Items/columns.tsx(表头/单元格)、Pending/PendingItems.tsx t() 化。关键交互(如新增按钮)加 testid;tests/items.spec.ts 定位器改造(testid 优先)与断言中文化。

**验收标准**:
- [ ] Items 列表页零英文残留;关键交互以 testid 定位
- [ ] items.spec.ts 无英文文案定位/断言依赖
- [ ] 字典新增 `items` 组(双字典)

**验证**:
- [ ] E2E:`bunx playwright test tests/items.spec.ts`
- [ ] build 通过

**依赖**:Task 5

**文件**:`frontend/src/routes/_layout/items.tsx`、`frontend/src/components/Items/columns.tsx`、`frontend/src/components/Pending/PendingItems.tsx`、`frontend/tests/items.spec.ts`

**规模**:M(4 文件)

---

## Task 7:Items 弹窗与操作

**描述**:Items/AddItem.tsx、EditItem.tsx、DeleteItem.tsx(弹窗文案 + zod message 内联字典化)、ItemActionsMenu.tsx(菜单项 + 成功 toast 文案如 "The item was deleted successfully")。items.spec.ts 弹窗断言同步。

**验收标准**:
- [ ] Items CRUD 全链路(弹窗、菜单、成功/失败 toast)零英文残留
- [ ] 该 4 文件内 zod message 零字面量
- [ ] items.spec.ts 全绿

**验证**:
- [ ] E2E:`bunx playwright test tests/items.spec.ts`
- [ ] 手动检查:新增/编辑/删除流程中文提示

**依赖**:Task 6

**文件**:`frontend/src/components/Items/{AddItem,EditItem,DeleteItem,ItemActionsMenu}.tsx`、`frontend/tests/items.spec.ts`

**规模**:M(4+1 文件)

---

## ◆ Checkpoint B:S2 验收

- [ ] Dashboard/Items 域零英文残留(品牌词除外);E2E 全绿
- [ ] **keys 统计 ≤400**(统计 zh-CN.json key 总数;>400 停下重估并回报,idea 假设 3)

---

## Task 8:Admin 页与表格

**描述**:routes/_layout/admin.tsx(head 标题 + 页面文案)、Admin/columns.tsx、Pending/PendingUsers.tsx t() 化;admin.spec.ts 定位器/断言随域改造(本任务先改页面级,弹窗级留给 T9)。

**验收标准**:
- [ ] Admin 列表页零英文残留
- [ ] admin.spec.ts 页面级断言中文化/testid 化,测试绿
- [ ] 字典新增 `admin` 组(双字典)

**验证**:
- [ ] E2E:`bunx playwright test tests/admin.spec.ts`

**依赖**:Task 7

**文件**:`frontend/src/routes/_layout/admin.tsx`、`frontend/src/components/Admin/columns.tsx`、`frontend/src/components/Pending/PendingUsers.tsx`、`frontend/tests/admin.spec.ts`

**规模**:M(4 文件)

---

## Task 9:Admin 弹窗与操作

**描述**:Admin/AddUser.tsx、EditUser.tsx、DeleteUser.tsx(zod 内联)、UserActionsMenu.tsx、ResetPasswordDialog.tsx(临时密码弹窗文案)t() 化;admin.spec.ts 弹窗断言同步。

**验收标准**:
- [ ] Admin 全操作链路(增删改、重置密码、菜单)零英文残留;zod 零字面量
- [ ] admin.spec.ts 全绿

**验证**:
- [ ] E2E:`bunx playwright test tests/admin.spec.ts`
- [ ] 手动检查:创建用户/重置密码流程中文

**依赖**:Task 8

**文件**:`frontend/src/components/Admin/{AddUser,EditUser,DeleteUser,UserActionsMenu,ResetPasswordDialog}.tsx`、`frontend/tests/admin.spec.ts`

**规模**:M(5+1 文件)

---

## Task 10:Settings

**描述**:routes/_layout/settings.tsx(三个 tab 标题 + head 标题)、UserSettings/{UserInformation,ChangePassword,DeleteAccount,DeleteConfirmation}.tsx(zod 内联)t() 化;user-settings.spec.ts 文案定位器改造(已有 23 处 testid 基础,剩 tab 名/按钮名/断言)。

**验收标准**:
- [ ] Settings 三 tab 及全部弹窗零英文残留;zod 零字面量
- [ ] user-settings.spec.ts 全绿

**验证**:
- [ ] E2E:`bunx playwright test tests/user-settings.spec.ts`

**依赖**:Task 9

**文件**:`frontend/src/routes/_layout/settings.tsx`、`frontend/src/components/UserSettings/{UserInformation,ChangePassword,DeleteAccount,DeleteConfirmation}.tsx`、`frontend/tests/user-settings.spec.ts`

**规模**:M(6 文件,测试文件为伴随)

---

## Task 11:隐蔽英文源清扫

**描述**:useCustomToast.ts(toast 标题 Success!/Something went wrong! → 字典)、utils.ts(兜底 "Something went wrong.")、ui/sidebar.tsx 等 shadcn 内置英文(Toggle Sidebar 等 tooltip/aria)按「尽量本地化」处理;radix aria-label 处置清单记录到本文件(做了/遗留原因)。

**验收标准**:
- [ ] toast 标题与错误兜底文案来自字典
- [ ] shadcn 内置可见英文清扫或列入处置清单
- [ ] 字典新增 `toast` / `common` 组(双字典)

**验证**:
- [ ] 手动检查:成功/失败 toast 标题为中文
- [ ] lint + build 通过

**依赖**:Task 10

**文件**:`frontend/src/hooks/useCustomToast.ts`、`frontend/src/utils.ts`、`frontend/src/components/ui/sidebar.tsx`(及其他 grep 命中文件)

**规模**:S(3–5 文件)

---

## Task 12:zod 字面量审计

**描述**:grep 门禁:`frontend/src` 内 `message: "` / `message: '` 零字面量(全部来自字典);发现即修。产出 grep 结果记录。

**验收标准**:
- [ ] grep 零命中(字典定义处除外)
- [ ] `bun run build` 通过

**验证**:
- [ ] `grep -rn "message: \"" frontend/src --include="*.tsx" | grep -v locales` 为空
- [ ] E2E 全绿(回归)

**依赖**:Task 11

**文件**:按 grep 结果(预期 0–3)

**规模**:S

---

## ◆ Checkpoint C:S3 验收

- [ ] Admin/Settings 零英文;aria 处置清单已记录
- [ ] **双字典 key 集合 diff = 0**(脚本对比 zh-CN 与 en 的 key 集合;en 全量决策复核点)
- [ ] E2E 全绿

---

## Task 13:错误码契约 login 单点试点

**描述**:打通全链路样板。先字典后后端:双字典 `errors` 组新增 `AUTH_LOGIN_NAME_CONFLICT` / `AUTH_LOGIN_INVALID` / `AUTH_LOGIN_INACTIVE`(中文译文);login.py 3 处 `detail` 改 `{"code", "message"}`(message 固定英文,契约表);test_login.py 对应断言改 `detail["code"]`;utils.ts `extractErrorMessage` 增加 `detail?.code` 分支(`t("errors."+code, { defaultValue: detail.message })`);`sh scripts/generate-client.sh` 再生成。

**验收标准**:
- [ ] 登录接口错误返回 `{"code","message"}`,状态码不变;test_login.py 以 code 断言
- [ ] 前端错误登录 toast 显示中文;未知 code 场景回退英文 message(有验证记录)
- [ ] client 再生成零手改;pytest + E2E 全绿

**验证**:
- [ ] `cd backend && uv run pytest`
- [ ] `bunx playwright test tests/login.spec.ts`
- [ ] 手动检查:错误登录 → 中文 toast

**依赖**:Task 11(utils.ts 归属)、Task 2(登录页中文)

**文件**:`backend/app/api/routes/login.py`、`backend/tests/api/routes/test_login.py`、`frontend/src/utils.ts`、`frontend/openapi.json` + `frontend/src/client/`(再生成)

**规模**:M(3 源文件 + 生成物)

---

## Task 14:契约推广 users + deps

**描述**:先字典后后端:双字典 `errors` 组新增 USERS 组 8 个 code + `AUTH_CREDENTIALS_INVALID` / `AUTH_USER_NOT_FOUND` / `AUTH_USER_INACTIVE` / `AUTH_FORBIDDEN`(契约表);users.py 11 处、deps.py 4 处 detail 改造;grep 定位 deps 断言归属文件(可能跨 test_login.py)并逐条改 code 断言(不许删断言);再生成 client。

**验收标准**:
- [ ] users/deps 15 处全部契约化,状态码不变
- [ ] 相关测试以 code 断言,`uv run pytest` 全绿

**验证**:
- [ ] `cd backend && uv run pytest`
- [ ] E2E 全绿(admin/settings 涉及 403/404 流程)

**依赖**:Task 13

**文件**:`backend/app/api/routes/users.py`、`backend/app/api/deps.py`、`backend/tests/api/routes/test_users.py`(及 grep 命中的断言文件)、生成物

**规模**:M(4+ 文件)

---

## Task 15:契约推广 items + 契约表核对

**描述**:双字典新增 `ITEMS_NOT_FOUND` / `ITEMS_FORBIDDEN`;items.py 6 处 detail 改造;test_items.py 断言改 code;再生成 client。收尾:以 grep 脚本核对 24 处 raise 全部契约化、17 code 与 SPEC-i18n.md 契约表一一对应。

**验收标准**:
- [ ] items 6 处契约化;test_items.py code 断言
- [ ] **契约表逐项核对记录**:24 处 / 17 code / 状态码不变,写入本文件
- [ ] `sh scripts/generate-client.sh` 后 `git diff frontend/src/client` 无手改痕迹

**验证**:
- [ ] `cd backend && uv run pytest`(全量)
- [ ] `bun run test`(全量 E2E)

**依赖**:Task 14

**文件**:`backend/app/api/routes/items.py`、`backend/tests/api/routes/test_items.py`、生成物

**规模**:S(2 文件 + 生成物)

---

## ◆ Checkpoint D:S4 验收

- [ ] 契约表核对记录完整;`uv run pytest` + `bun run test` 双绿
- [ ] idea 假设 2 验证成立(契约不破坏唯一消费方)

---

## Task 16:E2E 收口审计(S5)

**描述**:全 spec 文件 grep 英文文案定位/断言(允许仅 login.spec.ts 中文冒烟);抽查演练:临时改一个非登录文案跑 items.spec 确认仍绿后还原(验证「改文案不碎测试」);S5 清单核对。

**验收标准**:
- [ ] login.spec.ts 之外零文案断言;关键路径均 testid 定位
- [ ] 抽查演练记录(改文案 → items.spec 仍绿 → 还原)

**验证**:
- [ ] `bun run test`(全量)

**依赖**:Task 15

**文件**:按审计结果(预期 0–3 个 spec 文件微调)

**规模**:S

---

## Task 17:文档中文化(S6)

**描述**:README.md、development.md、deployment.md、deployment-docker-compose.md 中文重写,与 SPEC.md 口径一致;根 README 增加「i18n 脚手架 + 错误码契约」模板继承说明(派生项目零成本继承的差异化价值)。

**验收标准**:
- [ ] 四份文档全中文,命令/路径与实际一致
- [ ] 继承说明章节就位;prek(typos)通过

**验证**:
- [ ] `uv run prek run --all-files`(或 typos 单项)
- [ ] 人工通读与 SPEC.md 口径比对

**依赖**:Task 16(可与 P4 并行,默认线性)

**文件**:`README.md`、`development.md`、`deployment.md`、`deployment-docker-compose.md`

**规模**:S(4 文件)

---

## Task 18:全量验证与 spec 核对

**描述**:按 SPEC-i18n.md「Success Criteria」总体四项 + S1–S6 清单逐条核对,证据记录到本文件;四条命令最终全绿。

**验收标准**:
- [ ] 总体验收四项逐条勾选并附证据
- [ ] `bun run lint` / `bun run build` / `bun run test` / `uv run pytest` 全绿

**验证**:
- [ ] 上述四命令最终运行记录

**依赖**:Task 17

**文件**:无(仅本文件记录)

**规模**:XS

---

## ◆ Checkpoint E:完成

- [ ] SPEC-i18n.md Success Criteria 全部达成,人工终审通过
