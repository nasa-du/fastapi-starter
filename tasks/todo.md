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
- [x] 登录页(含主题下拉)中英文可切换、zod 校验消息来自字典;head 标题来自字典
- [x] login.spec.ts 无英文文案断言(中文冒烟 + testid);auth.setup.ts 不再依赖按钮文案
- [x] 字典新增 `login` 组与主题组(双字典同步)

**验证**:
- [x] E2E:`bunx playwright test tests/login.spec.ts`(需后端+db)— 11/11 绿
- [x] 构建通过:`bun run build`
- [x] 手动检查:错误登录 → 中文提示 toast(单 toast,描述「用户编码或密码错误」;toast 标题 "Something went wrong!" 属 Task 11 useCustomToast 清扫);切 en 后登录页变英文(head 标题/h1/按钮/`<html lang>` 冒烟证据齐)

**执行备注**(超出原文件预算部分):
- `useAuth.ts` 移除 loginMutation 的 mutation 级 onError(唯一调用方为登录页):`mutate()` 的 per-call 回调与 mutation 级回调**叠加触发**,原方案会双 toast(一英一中);现错误展示归调用方,Task 13 恢复 handleError 漏斗
- 错误登录中文为 login.tsx 本地映射过渡(按后端 detail 字符串 → 字典),Task 13 迁入 extractErrorMessage 后移除
- login.spec.ts 的 `Log out` menuitem 定位器按计划归 Task 4 改造

**依赖**:Task 1

**文件**:`frontend/src/routes/login.tsx`、`frontend/src/components/Common/Appearance.tsx`、`frontend/tests/login.spec.ts`、`frontend/tests/auth.setup.ts`

**规模**:M(4 文件)

---

## Task 3:语言切换器与语言响应

**描述**:新建 `LanguageSwitcher.tsx`(仿 SidebarAppearance 的 dropdown:中文 / English + tooltip),放入 AppSidebar 的 SidebarFooter(Appearance 旁)。`setAppLanguage` 完成持久化 + `<html lang>` 同步;切换后 `router.invalidate()` 触发 `head()` 重求值(接线方式实现时定)。新增 tests/language.spec.ts 冒烟:切 en → 登录页英文 → 刷新保持 → `<html lang>` 断言。

**验收标准**:
- [x] 侧边栏底部出现语言切换器,与主题切换并列;切换即时生效且免硬刷新(路由标题、`<html lang>`)
- [x] 刷新后语言保持(localStorage)
- [x] language.spec.ts 通过

**验证**:
- [x] E2E:`bunx playwright test tests/language.spec.ts` — 4 passed(3 冒烟 + setup)
- [x] 手动检查:登录页切 en → 标题「登录 - …」→「Log In - …」、`<html lang>`、按钮文案即时更新,URL 不变(免硬刷新,E2E 断言覆盖);Dashboard 侧边栏切换即时生效;Dashboard **页面标题**即时更新待 Task 5(`dashboard.headTitle` 入字典后生效,当前为静态英文字面量)

**执行备注**(超出原文件预算部分):
- 新增 `AuthLayout.tsx` 接线(第 5 文件):S1 验收要求「登录路由标题随语言切换即时更新」,而当前唯一 i18n 化的 head 是登录路由标题;切换器必须登录页可达才能免导航观察到标题即时更新。仿 Appearance 先例(登录页已有主题按钮),语言按钮并列其右
- `i18n.ts` 零改动:Task 1 的 `setAppLanguage` 已含持久化 + `<html lang>` 同步;接线定为组件内共享 `useChangeAppLanguage`(`setAppLanguage().then(router.invalidate())`),`invalidate()` 末尾 `load()` 重投影 lane → `head()` 重求值(已对 router-core 源码核实,并经 E2E 标题断言实证)
- 菜单项「中文 / English」为语言自助名,不随当前语言翻译(故意字面量);按钮 label/sr-only 走 `language.{label,toggleLanguage}` 字典组(双字典同步)

**依赖**:Task 2

**文件**:`frontend/src/components/Common/LanguageSwitcher.tsx`(新)、`frontend/src/components/Sidebar/AppSidebar.tsx`、`frontend/src/i18n.ts`、`frontend/tests/language.spec.ts`(新)

**规模**:M(4 文件)

---

## ◆ Checkpoint A:S1 验收(人工评审后再进入 Phase 2)

- [x] SPEC-i18n.md S1 清单逐项核对(双语渲染/切换器/持久化/html lang/标题即时更新);2026-11-20 人工检查通过
- [x] `bun run lint` + `bun run build` + `bun run test` 全绿:lint 75 files、build tsc + vite 通过、E2E **48 passed**(2026-11-20;build 在 `frontend/` 执行)
- [x] i18next × Vite+SWC+React 19 集成摩擦已排除(idea 假设 1;构建、E2E 与人工验收均通过)

---

## Task 4:侧边栏与用户菜单

**描述**:Sidebar/Main.tsx(导航项 title → 字典)、Sidebar/User.tsx(用户菜单各项)、AppSidebar.tsx(baseItems 的 title 改为 key 映射)。User 菜单登出项加 `data-testid="logout"`,login.spec.ts 的 `"Log out"` 定位器同步改 testid。

**验收标准**:
- [x] 侧边栏与用户菜单(含 collapse tooltip)文案来自字典
- [x] login.spec.ts 无 `"Log out"` 文本依赖
- [x] 字典新增 `nav` / `menu` 组(双字典)

**验证**:
- [x] E2E:`bunx playwright test tests/login.spec.ts` — 12/12 绿(新增冒烟先行 RED:改前 3 处失败 → 实现后全绿)
- [x] lint + build 通过(biome 75 files;tsc + vite 绿);回归 `bun run test` 全量 **49 passed**(48 + 新增冒烟)

**执行备注**(超出原文件预算部分):
- 新增测试用例「Sidebar and user menu use localized labels」(login.spec.ts 伴随,RED→GREEN):断言侧边栏三链接(仪表盘/项目/管理)、用户菜单两项、collapse tooltip(收起侧边栏后 hover 断言)及 `data-testid="logout"`;原两处 `"Log out"` 文案定位同步改 testid
- `Item.title` → `Item.titleKey`(`NavItemKey` 联合类型):key 映射在 `Main.tsx` 渲染层解析,可见文案与 tooltip 同源单次 `t()`;`AppSidebar.tsx` baseItems 只存 key
- zh 译名口径:Dashboard→仪表盘、Items→项目、Admin→管理;en 侧文案与原字面量一致("Dashboard"/"Items"/"Admin"/"User Settings"/"Log Out"),E2E 默认 en locale 不受影响
- **发现未动**(记录给 Task 16):`tests/utils/user.ts` 的 `logInUser`("Log In" 按钮文案)与 `logOutUser`("Log out" menuitem 文案)仍依赖默认 en locale 文案;当前 en 文案未变 + role name 匹配大小写不敏感,套件仍绿,建议 T16 收口时一并 testid 化
- `ui/sidebar.tsx` 内置 "Collapse/Open Sidebar" sr-only 与 "Toggle Sidebar" aria/title 属 Task 11 shadcn 清扫范围(不在本任务文件列表,未动)

**依赖**:Task 3

**文件**:`frontend/src/components/Sidebar/Main.tsx`、`frontend/src/components/Sidebar/User.tsx`、`frontend/src/components/Sidebar/AppSidebar.tsx`、`frontend/tests/login.spec.ts`

**规模**:M(4 文件)

---

## Task 5:Dashboard 与全局组件

**描述**:routes/_layout/index.tsx(Dashboard 标题 + 页内文案)、Common/ErrorComponent.tsx、Common/NotFound.tsx 全部 t() 化。

**验收标准**:
- [x] Dashboard 页、错误组件、404 页零英文残留(品牌词除外)
- [x] 字典新增 `dashboard` / `error` 组(双字典)

**验证**:
- [x] 手动检查:访问不存在路由看 404 文案(headless chromium 脚本 16/16:zh 浏览器 404 三文案 + `<html lang>` + console 零报错;存储偏好 en → 404 英文文案;zh 登录 Dashboard 文案/head 标题/问候插值、切 en 后标题**即时更新**、刷新保持)
- [x] build + lint 通过(biome 75 files;tsc + vite 绿;双字典 key 集合 diff = 0,34/34)

**执行备注**(超出原文件预算部分):
- `head()` 接线沿用 login.tsx 先例(`i18next.t`):Task 3 遗留「Dashboard 页面标题即时更新待 Task 5」已生效(`router.invalidate()` 重求值 `head()`),切 en 冒烟实证
- 问候语改插值 `dashboard.greeting`(`{{name}}`),替代原 JSX 字符串拼接;en 字面量与原文逐字一致
- `error` 组双组件共享(`error.oops`);404 数字大字保留字面量(语言中性)
- 404 页为根级 `notFoundComponent`,无侧边栏/语言切换器,切语言验证经 localStorage 预置实现
- en 侧文案未变 → `tests/utils/user.ts` 的 `logInUser` "Welcome back" 断言不受影响(回归 49 passed 实证;文案 testid 化归 Task 16)
- ErrorComponent 与 NotFound 同构(useTranslation 在根级组件树可用性已经 404 页实证),本任务无 E2E 断言依赖其文案

**依赖**:Task 4

**文件**:`frontend/src/routes/_layout/index.tsx`、`frontend/src/components/Common/ErrorComponent.tsx`、`frontend/src/components/Common/NotFound.tsx`

**规模**:S(3 文件)

---

## Task 6:Items 页与表格

**描述**:routes/_layout/items.tsx(head 标题 + 页面文案)、Items/columns.tsx(表头/单元格)、Pending/PendingItems.tsx t() 化。关键交互(如新增按钮)加 testid;tests/items.spec.ts 定位器改造(testid 优先)与断言中文化。

**验收标准**:
- [x] Items 列表页零英文残留;关键交互以 testid 定位
- [x] items.spec.ts 无英文文案定位/断言依赖
- [x] 字典新增 `items` 组(双字典)

**验证**:
- [x] E2E:`bunx playwright test tests/items.spec.ts` — 12/12 绿(页面/表头/加载态/空态中文冒烟 + testid CRUD;RED 先行:改前中文断言 4 处失败)
- [x] build 通过(`frontend/` 内 `bun run build`,tsc + vite 绿);lint 75 files 绿
- [x] 回归:`bun run test` 全量 **51 passed**(2026-11-20)
- [x] 双字典 key 集合 diff = 0(44/44)

**执行备注**(超出原文件预算部分):
- testid 落点(超出 4 文件清单的伴随改动,均为测试钩子不改行为):`AddItem.tsx`(add-item / item-title-input / item-description-input / save-item / cancel-create-item)、`EditItem.tsx`(edit-item / 同款输入 testid / save-item)、`DeleteItem.tsx`(delete-item 菜单项 / confirm-delete-item 确认钮)、`ItemActionsMenu.tsx`(item-actions)、`columns.tsx`(copy-item-id)
- `useCustomToast.ts` showSuccessToast 增加可选 `{ testId }`(sonner 原生 testId 透传,标题/文案不动):CRUD 成功 toast 改以 item-{created,updated,deleted}-toast 定位,替代英文文案断言,提前兑现「改文案不碎测试」;toast 标题/文案中文化仍归 Task 7/11
- 弹窗可见文案(Add/Edit/Delete 对话框)与 zod message 保留英文,属 Task 7;「Title is required」文案断言改为输入框 `aria-invalid` 属性断言;CRUD 行为断言(成功 toast、列表行出现/消失)全部保留
- 新增 2 条非 CRUD 冒烟:表头/暂无描述/复制 ID 中→英即时切换断言(经侧边栏语言切换器),Pending 加载态表头断言(拦截 items 接口,不依赖真实延迟)
- `DataTable.tsx` 的分页/「No results found.」文案属共享组件,不在本任务文件清单,未动(记录给全局清扫)
- items.spec.ts 不再经 `logInUser`(其「Log In」/「Welcome back」文案依赖见 Task 4 备注,T16 收口)

**依赖**:Task 5

**文件**:`frontend/src/routes/_layout/items.tsx`、`frontend/src/components/Items/columns.tsx`、`frontend/src/components/Pending/PendingItems.tsx`、`frontend/tests/items.spec.ts`

**规模**:M(4 文件)

---

## Task 7:Items 弹窗与操作

**描述**:Items/AddItem.tsx、EditItem.tsx、DeleteItem.tsx(弹窗文案 + zod message 内联字典化)、ItemActionsMenu.tsx(菜单项 + 成功 toast 文案如 "The item was deleted successfully")。items.spec.ts 弹窗断言同步。

**验收标准**:
- [x] Items CRUD 全链路(弹窗、菜单、成功/失败 toast)零英文残留
- [x] 该 4 文件内 zod message 零字面量
- [x] items.spec.ts 全绿

**验证**:
- [x] E2E:`bunx playwright test tests/items.spec.ts` — **12/12 绿**(RED 先行:改前中文断言 4 处失败 → 实现后全绿;2026-11-21)
- [x] 手动检查:新增/编辑/删除流程中文提示(E2E zh-CN locale 全链路断言即证据:弹窗标题/描述、表单标签/placeholder、取消/保存/确认删除、成功 toast 均中文)

**执行备注**(超出原文件预算部分):
- 字典新增 `items.form.*`(7,双弹窗共享:标签/placeholder/必填校验/取消/保存)+ `items.add.*`(3)+ `items.edit.*`(3)+ `items.delete.*`(4)+ `items.menuLabel`;双字典 key 集合 diff = 0(62/62)
- zod schema 移入组件内(沿 login.tsx Task 2 先例)使 message 走 `t("items.form.titleRequired")`;grep 门禁:4 文件 `message: "` 零命中
- 同字面量合并 key:AddItem 触发钮与弹窗标题共用 `items.add.title`,EditItem 菜单项与标题共用 `items.edit.title`(en/zh 两侧字面量一致)
- items.spec.ts 断言微调:弹窗 label 去 `exact: true`(标签含必填标记「标题 *」);删除弹窗补中文冒烟(标题/警告描述/确认钮「删除」/toast「项目删除成功」),RED 提交 82b5a49 先行
- **发现未动**(记录给 Task 11):`ui/dialog.tsx:73` 内置 `sr-only Close`(弹窗右上关闭钮)为共享组件英文,不在本任务文件清单
- E2E 执行方式注记:在 `frontend/` 内前台运行并显式传 `PLAYWRIGHT_BASE_URL`/`VITE_API_URL`(后台任务 shell 从仓库根起跑会丢失 workdir 与 dotenv 上下文,导致 baseURL 为空——已踩坑记录);lint 75 files 绿、`bun run build` 绿、回归 `bun run test` 全量 **51 passed**(2026-11-21)

**依赖**:Task 6

**文件**:`frontend/src/components/Items/{AddItem,EditItem,DeleteItem,ItemActionsMenu}.tsx`、`frontend/tests/items.spec.ts`

**规模**:M(4+1 文件)

---

## ◆ Checkpoint B:S2 验收

- [x] Dashboard/Items 域零英文残留(品牌词除外);E2E 全绿(2026-11-21 人工检查通过;E2E 51 passed 见 Task 7 验证记录,HEAD 未变)
- [x] **keys 统计 ≤400**:zh-CN.json key 总数 **62/400**(2026-11-21 统计;idea 假设 3 成立,无需重估)

---

## Task 8:Admin 页与表格

**描述**:routes/_layout/admin.tsx(head 标题 + 页面文案)、Admin/columns.tsx、Pending/PendingUsers.tsx t() 化;admin.spec.ts 定位器/断言随域改造(本任务先改页面级,弹窗级留给 T9)。

**验收标准**:
- [x] Admin 列表页零英文残留(弹窗、操作菜单与共享 DataTable 分页不在 T8 范围,分别归 T9/T11)
- [x] admin.spec.ts 页面级断言中文化/testid 化,测试绿
- [x] 字典新增 `admin` 组(双字典)

**验证**:
- [x] E2E:`bunx playwright test tests/admin.spec.ts` — **17 passed**(16 spec tests + setup;RED 先行 4 处预期失败,实现后全绿;2026-11-21)
- [x] lint + build:`bun run lint`(biome 75 files)+ `frontend/` 内 `bun run build`(tsc + vite)绿
- [x] 手动检查:E2E 中英切换覆盖页面标题/head、四个表头、姓名缺失/当前用户徽标、角色/状态单元格;Pending 拦截态表头独立断言
- [x] 双字典 key 集合 diff = 0(76/76,新增 admin 14 keys)

**执行备注**:
- `admin.headTitle` 沿用既有 `i18next.t()` 接线,验证中→英切换免硬刷新;columns 沿用 Items 表格的 `i18next.t` 运行时取值,支持表头/单元格即时切换;PendingUsers 用 `useTranslation`
- en 标题用 "Users - FastAPI Template"(区别于侧边栏 "Admin"),其余 en 文案与原字面量一致;zh 用户角色译作「超级管理员 / 普通用户」、状态「启用 / 停用」、缺失姓名「暂无姓名」
- 表格 fixture 额外拦截 `/users/me` 使当前用户徽标成为可达断言;用精确文本匹配区分用户编码 `active_admin` 与状态 `Active`。页面级 `describe` 限定 zh-CN,避免覆盖依赖 `logInUser` 英文环境的后续 dialogs(T16 收口)
- `AddUser` 按钮与创建/编辑/删除/重置密码弹窗均保持英文原行为,留 Task 9;共享 DataTable 分页留 Task 11
- **发现未动**:全量回归 `bun run test` **52 passed / 1 failed**(2026-11-21);既有 `user-settings.spec.ts`「Selected mode is preserved across sessions」在打开深色主题菜单时超时(非 T8 文件/行为)。等待菜单退出/主题类名的两次测试性修正均未消除孤立复现,已还原,需独立调试;不计入 T8 验收结果

**依赖**:Task 7

**文件**:`frontend/src/routes/_layout/admin.tsx`、`frontend/src/components/Admin/columns.tsx`、`frontend/src/components/Pending/PendingUsers.tsx`、`frontend/tests/admin.spec.ts`

**规模**:M(4 文件)

---

## Task 9:Admin 弹窗与操作

**描述**:Admin/AddUser.tsx、EditUser.tsx、DeleteUser.tsx(zod 内联)、UserActionsMenu.tsx、ResetPasswordDialog.tsx(临时密码弹窗文案)t() 化;admin.spec.ts 弹窗断言同步。

**验收标准**:
- [x] Admin 全操作链路(增删改、重置密码、菜单)零英文残留;zod 零字面量
- [x] admin.spec.ts 全绿

**验证**:
- [x] E2E:`bunx playwright test tests/admin.spec.ts` — **21 passed**(20 spec tests + setup;RED 先行 14 项失败,独立审查后再补旧错误语言 RED,修复后全绿;2026-11-22)
- [x] 手动检查:创建用户/重置密码流程中文(E2E zh-CN 全链路断言 + headless chromium 表单冒烟;临时密码复制、新密码登录、操作菜单与校验消息均实测)
- [x] lint + build 通过(biome 75 files;`frontend/` 内 `bun run build`,tsc + vite 绿)
- [x] 回归:`bun run test` 全量 **57 passed**(2026-11-22;包含本次新增 4 条与独立审查补回归,既有主题持久化用例通过)
- [x] 双字典 key 集合 diff = 0(116/116,新增 admin 40 keys)

**执行备注**:
- testid 落点:add-user、user-actions、edit-user / delete-user / reset-password、四类用户表单输入与复选框、保存/取消/确认钮、user-{created,updated,deleted}-toast、temporary-password-input / copy-temporary-password 等;所有交互路径保留行为断言,中文冒烟补充弹窗描述、菜单、占位符及校验消息
- AddUser / EditUser 表单 schema 沿用 Items Task 7 先例移入组件;共享 `admin.form.*` 17 keys(含 6 条校验、按钮和标签),en 字面量与原文逐项一致
- 独立审查发现既有错误在切语言后保留旧文(2026-11-22):AddUser 用 ref 记录上次语言,只在实际变化时对现有错误字段 `trigger()` 重求值,不 reset 输入;ref 守卫避免 effect 依赖错误对象形成循环,TypeScript 以 `FieldPath<FormData>[]` 明确错误字段类型。Add 回归保留「中文错误→关闭→切 en→重开→英文错误」RED→GREEN 证据与后续字段持久化/新错误断言
- EditUser 使用同一防御性重验;Radix 菜单卸载重建表单的真实行为保留,语言切换测试断言重开原始行数据及新 schema 英文密码不一致消息,不把未保存编辑输入的既有取消语义扩大为保留
- 删除警告以 `descriptionStart` / `descriptionEmphasis` / `descriptionEnd` 保留 `<strong>` 结构与各语序;临时密码 `aria-label` 和复制按钮 sr-only 均入字典,关闭后 `resetPassword.reset()` 原逻辑未动
- 重开英文创建弹窗实测 schema 重建后英文校验生效、已填字段保留;模态弹窗内不可操作背景切换器,语言回归在关闭弹窗后切英文并重开,原有错误及新触发错误均断言
- 重置密码用例仍以先在 en 环境 `logInUser`、`logOutUser` 为前提,操作域内显式切 zh 验证后切回 en;辅助函数英文文案依赖仍归 T16,未扩范围修改
- **发现未动**:共享 toast 标题 `Success!` / `Something went wrong!` 归 Task 11;共享 DataTable 分页与 radix 内置 `Close` 归 Task 11;后端错误消息契约归 Task 14,本任务仅覆盖 Task 9 组件文案与成功提示
- 浏览器截图证据:`/tmp/task9-add-user-zh.png`;自动化 headless chromium 检查中文标题、复选框可访问名称与 `<html lang="zh-CN">`,console 错误/警告均 0(2026-11-22)

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

**描述**:打通全链路样板。先字典后后端:双字典 `errors` 组新增 `AUTH_LOGIN_NAME_CONFLICT` / `AUTH_LOGIN_INVALID` / `AUTH_LOGIN_INACTIVE`(中文译文,与 Task 2 的 `login.errors.{invalid,nameConflict,inactive}` 译文一致);login.py 3 处 `detail` 改 `{"code", "message"}`(message 固定英文,契约表);test_login.py 对应断言改 `detail["code"]`;utils.ts `extractErrorMessage` 增加 `detail?.code` 分支(`t("errors."+code, { defaultValue: detail.message })`);`sh scripts/generate-client.sh` 再生成。**收尾迁移**:移除 Task 2 在 login.tsx 的本地错误映射(`LOGIN_ERROR_KEYS` + per-call onError),恢复 useAuth loginMutation 的 `onError: handleError.bind(showErrorToast)`。

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
