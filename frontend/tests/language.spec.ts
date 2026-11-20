import { expect, test } from "@playwright/test"

test.use({ locale: "zh-CN" })

test.describe("login page language switcher", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("Switching to English updates the page without reload", async ({
    page,
  }) => {
    await page.goto("/login")

    await expect(page).toHaveTitle("登录 - FastAPI Template")
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN")

    await page.getByTestId("language-button").click()
    await page.getByTestId("language-en").click()

    // 切换即时生效:标题、<html lang>、可见文案,免硬刷新
    await expect(page).toHaveTitle("Log In - FastAPI Template")
    await expect(page.locator("html")).toHaveAttribute("lang", "en")
    await expect(page.getByTestId("login-submit")).toHaveText("Log In")
    await expect(page).toHaveURL("/login")
  })

  test("Language choice persists across reloads and can be switched back", async ({
    page,
  }) => {
    await page.goto("/login")

    await page.getByTestId("language-button").click()
    await page.getByTestId("language-en").click()
    await expect(page.locator("html")).toHaveAttribute("lang", "en")

    await page.reload()

    await expect(page).toHaveTitle("Log In - FastAPI Template")
    await expect(page.locator("html")).toHaveAttribute("lang", "en")
    await expect(page.getByTestId("login-submit")).toHaveText("Log In")

    await page.getByTestId("language-button").click()
    await page.getByTestId("language-zh").click()

    await expect(page).toHaveTitle("登录 - FastAPI Template")
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN")
  })
})

test.describe("sidebar language switcher", () => {
  test("Switching language updates the sidebar immediately", async ({
    page,
  }) => {
    await page.goto("/")

    await expect(page.getByTestId("theme-button")).toContainText("外观")
    await expect(page.getByTestId("language-button")).toContainText("语言")

    await page.getByTestId("language-button").click()
    await page.getByTestId("language-en").click()

    await expect(page.locator("html")).toHaveAttribute("lang", "en")
    await expect(page.getByTestId("theme-button")).toContainText("Appearance")
    await expect(page.getByTestId("language-button")).toContainText("Language")
    await expect(page).toHaveURL("/")
  })
})
