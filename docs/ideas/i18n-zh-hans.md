# 简体中文支持(i18n 中英双语)

> 2026-11-19 经 idea-refine 流程收敛定稿。决策记录:目标用户「以中文为主、偶有英文」;框架选型 i18next;后端采用错误码契约;文档中文重写;测试 testid + 中文冒烟;上游已脱离、自维护。

## Problem Statement

**如何让一个中文为主的内部系统(及它派生的所有未来项目),把用户可见文案全面中文化,同时保留为偶发英文用户服务的双语能力,并把「i18n 就绪 + 错误码契约」沉淀为模板的继承资产?**

背景:认证改造(`SPEC.md`)时「界面中文化」被刻意列为不在范围内,本方案即该延后项的落地。

## Recommended Direction

采用 **react-i18next + 错误码契约 + 文档中文重写 + testid 化测试** 的组合:

- **前端**:i18next 单 namespace、JSON 字典本地打包,zh-CN 为源语言、en 为第二语言;浏览器语言自动检测 + 侧边栏语言切换器 + localStorage 持久化;动态设置 `<html lang>` 与路由标题。配置从简(~40 行),不用多 namespace 拆分、HTTP 加载等重型配置。
- **后端**:~20 处 `HTTPException` 的 `detail` 改为结构化错误码(如 `{"code": "ITEM_NOT_FOUND"}`),后端保持语言中立;前端字典负责翻译,**回退链为 `code → 字典 → 原始 detail`**,未知 code 永远有兜底。
- **隐蔽英文源一并处理**:zod 校验消息(藏在表单 schema 里)、`document.title`、Radix/shadcn aria-label(低优先级)。
- **测试**:关键交互路径加 `data-testid`,文案断言仅保留中文冒烟级(登录流程),改文案不碎测试。
- **文档**:README / development.md / deployment*.md 重写为中文,与 SPEC.md 口径统一。

差异化价值:模板从此自带「i18n 脚手架 + 错误码规范」,每个派生项目零成本继承。

## Key Assumptions to Validate

- [ ] i18next 与 Vite + SWC + React 19 无集成摩擦 —— **验证:切片 1 一天内在登录页跑通双语渲染**
- [ ] 错误码契约改动不破坏唯一消费方(自研前端)—— **验证:先改 login 一处,pytest + Playwright 全绿再推广**
- [ ] 文案总量可控(估 ~150–250 keys)—— **验证:切片 2 结束时统计 key 数,若 >400 重估工作量**
- [ ] 偶发英文用户能接受回退链(未知 code 时看到英文原始 detail)

## MVP Scope(六个独立可验证的切片,按序交付)

1. **脚手架 + 登录页样板**:i18next 接入、切换器、`<html lang>`、登录页双语 —— 确立全项目模仿的模式
2. **主框架 + Items**:侧边栏、路由标题、Items 页全部文案
3. **Admin + Settings + zod 消息**:管理页、用户设置、表单校验消息
4. **后端错误码契约**:~20 处报错点 + @hey-api/openapi-ts 客户端再生成 + 前端错误 toast 走字典
5. **测试改造**:关键路径 testid + 中文冒烟断言,E2E 全绿
6. **文档中文化**:README / development.md / deployment.md / deployment-docker-compose.md 重写

## Not Doing (and Why)

- **Pydantic 422 自动校验错误中文化** —— FastAPI 自动生成的消息,本地化是另一个量级的坑;前端 zod 已拦截绝大多数,显式排除
- **集中式日期/数字格式化层(Intl)** —— 偶发英文用户用浏览器默认 Intl 足够,不做抽象层
- **语言偏好存到后端账号** —— localStorage + navigator.language 已覆盖场景,不建 per-user 服务端偏好
- **README 英文版维护** —— 中文为主的团队不需要双份文档
- **更多语言(繁体等)、伪本地化、RTL** —— 无用户,纯工程自嗨

## Open Questions

- 语言切换器放侧边栏底部还是用户菜单?(实现时定,不影响架构)
- en.json 全量覆盖还是先核心路径?(切片 3 结束时按剩余工作量决定)
- 错误码命名规范(`UPPER_SNAKE` + 模块前缀,如 `AUTH_LOGIN_INVALID`?实现时定)
