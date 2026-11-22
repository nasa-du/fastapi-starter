import { expect, test } from "@playwright/test"

test.use({ locale: "zh-CN" })

test.describe("login page language switcher", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("Switching to English updates the page without reload", async ({
    page,
  }) => {
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
