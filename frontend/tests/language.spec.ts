import { expect, test } from "@playwright/test"
import { firstSuperuserCode, firstSuperuserPassword } from "./config.ts"

test.use({ locale: "zh-CN" })

test.describe("Document title and route language behavior", () => {
  test("Document template defaults to Chinese", async ({ request }) => {
    const html = await (await request.get("/")).text()

    expect(html).toContain('<html lang="zh-CN">')
    expect(html).toContain("<title>全栈 FastAPI 模板</title>")
  })

  test("Document title fallback follows the selected language", async ({
    browser,
  }) => {
    for (const [browserLanguage, expectedTitle] of [
      ["zh-CN", "全栈 FastAPI 模板"],
      ["en-US", "Full Stack FastAPI Template"],
    ]) {
      const context = await browser.newContext({
        locale: browserLanguage,
        storageState: { cookies: [], origins: [] },
      })
      const page = await context.newPage()
      await page.goto("/__not-found-title-probe")
      await expect(page.locator("html")).toHaveAttribute(
        "lang",
        browserLanguage === "zh-CN" ? "zh-CN" : "en",
      )
      await expect(page).toHaveTitle(expectedTitle)
      await context.close()
    }
  })

  test("All route titles follow language changes without reload", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      locale: "zh-CN",
      storageState: { cookies: [], origins: [] },
    })
    const page = await context.newPage()
    await page.goto("/login")
    await expect(page).toHaveTitle("登录 - FastAPI Template")
    await page.getByTestId("language-button").click()
    await page.getByTestId("language-en").click()
    await expect(page).toHaveTitle("Log In - FastAPI Template")
    await page.reload()
    await expect(page).toHaveTitle("Log In - FastAPI Template")
    await page.getByTestId("language-button").click()
    await page.getByTestId("language-zh").click()
    await expect(page).toHaveTitle("登录 - FastAPI Template")

    await page.getByTestId("identifier-input").fill(firstSuperuserCode)
    await page.getByTestId("password-input").fill(firstSuperuserPassword)
    await page.getByTestId("login-submit").click()
    await page.waitForURL("/")

    const routeTitles = [
      ["/", "仪表盘 - FastAPI Template", "Dashboard - FastAPI Template"],
      ["/items", "项目 - FastAPI Template", "Items - FastAPI Template"],
      ["/admin", "用户管理 - FastAPI Template", "Users - FastAPI Template"],
      [
        "/settings",
        "用户设置 - FastAPI Template",
        "Settings - FastAPI Template",
      ],
    ]

    for (const [path, chineseTitle, englishTitle] of routeTitles) {
      await page.goto(path)
      await expect(page.getByTestId("language-button")).toBeVisible()
      await expect(page).toHaveTitle(chineseTitle)
      await page.getByTestId("language-button").click()
      await page.getByTestId("language-en").click()
      await expect(page).toHaveTitle(englishTitle)
      await page.reload()
      await expect(page).toHaveTitle(englishTitle)
      await page.getByTestId("language-button").click()
      await page.getByTestId("language-zh").click()
      await expect(page).toHaveTitle(chineseTitle)
    }
    await context.close()
  })
})

test.describe("login page language switcher", () => {
  test("Switching to English updates the page without reload", async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.removeItem("access_token"))
    await page.goto("/login")

    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN")
    const chineseTitle = await page.title()
    const chineseSubmit = await page.getByTestId("login-submit").textContent()

    await page.getByTestId("language-button").click()
    await page.getByTestId("language-en").click()

    // 切换即时生效:标题、<html lang>、可见文案,免硬刷新
    await expect(page.locator("html")).toHaveAttribute("lang", "en")
    expect(await page.title()).not.toBe(chineseTitle)
    expect(await page.getByTestId("login-submit").textContent()).not.toBe(
      chineseSubmit,
    )
    await expect(page).toHaveURL("/login")
  })

  test("Language choice persists across reloads and can be switched back", async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.removeItem("access_token"))
    await page.goto("/login")
    const submit = page.getByTestId("login-submit")
    await expect(submit).toBeVisible()
    const chineseTitle = await page.title()

    await page.getByTestId("language-button").click()
    await page.getByTestId("language-en").click()
    await expect(page.locator("html")).toHaveAttribute("lang", "en")
    const englishTitle = await page.title()
    const englishSubmit = await page.getByTestId("login-submit").textContent()
    expect(englishTitle).not.toBe(chineseTitle)

    await page.reload()

    await expect(page.locator("html")).toHaveAttribute("lang", "en")
    await expect(submit).toBeVisible()
    expect(await page.title()).not.toBe(chineseTitle)
    expect(await submit.textContent()).toBe(englishSubmit)

    await page.getByTestId("language-button").click()
    await page.getByTestId("language-zh").click()

    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN")
    expect(await page.title()).toBe(chineseTitle)
  })
})

test.describe("sidebar language switcher", () => {
  test("Switching language updates the sidebar immediately", async ({
    page,
  }) => {
    await page.goto("/")

    const chineseTheme = await page.getByTestId("theme-button").textContent()
    const chineseLanguage = await page
      .getByTestId("language-button")
      .textContent()

    await page.getByTestId("language-button").click()
    await page.getByTestId("language-en").click()

    await expect(page.locator("html")).toHaveAttribute("lang", "en")
    expect(await page.getByTestId("theme-button").textContent()).not.toBe(
      chineseTheme,
    )
    expect(await page.getByTestId("language-button").textContent()).not.toBe(
      chineseLanguage,
    )
    await expect(page).toHaveURL("/")
  })
})
