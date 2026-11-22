import { expect, type Page, test } from "@playwright/test"
import { firstSuperuserCode, firstSuperuserPassword } from "./config.ts"
import { createUser } from "./utils/privateApi.ts"
import { randomPassword, randomUserCode } from "./utils/random.ts"

test.use({ storageState: { cookies: [], origins: [] }, locale: "zh-CN" })

const fillForm = async (page: Page, identifier: string, password: string) => {
  await page.getByTestId("identifier-input").fill(identifier)
  await page.getByTestId("password-input").fill(password)
}

const submitLogin = async (page: Page) => {
  await page.getByTestId("login-submit").click()
}

const verifyInput = async (page: Page, testId: string) => {
  const input = page.getByTestId(testId)
  await expect(input).toBeVisible()
  await expect(input).toHaveText("")
  await expect(input).toBeEditable()
}

test("Inputs are visible, empty and editable", async ({ page }) => {
  await page.goto("/login")

  await verifyInput(page, "identifier-input")
  await verifyInput(page, "password-input")
})

test("Log In button is visible", async ({ page }) => {
  await page.goto("/login")

  await expect(page.getByTestId("login-submit")).toBeVisible()
})

test("Log in with valid user code and password", async ({ page }) => {
  await page.goto("/login")

  await fillForm(page, firstSuperuserCode, firstSuperuserPassword)
  await submitLogin(page)

  await page.waitForURL("/")
})

test("Log in with full name", async ({ page }) => {
  const userCode = randomUserCode()
  const password = randomPassword()
  const fullName = `Name ${randomUserCode()}`

  await createUser({ user_code: userCode, password, full_name: fullName })

  await page.goto("/login")
  await fillForm(page, fullName, password)
  await submitLogin(page)

  await page.waitForURL("/")
})

test("Log in with unknown user code shows the unified error", async ({
  page,
}) => {
  await page.goto("/login")

  await fillForm(page, "no_such_user_code", randomPassword())
  await submitLogin(page)

  await expect(page.getByText("用户编码或密码错误")).toBeVisible()
})

test("Log in with unknown name shows the unified error", async ({ page }) => {
  await page.goto("/login")

  await fillForm(page, "No Such Name", firstSuperuserPassword)
  await submitLogin(page)

  await expect(page.getByText("用户编码或密码错误")).toBeVisible()
})

test("Identifier is required", async ({ page }) => {
  await page.goto("/login")

  await page.getByTestId("identifier-input").fill("")
  await page.getByTestId("identifier-input").blur()

  await expect(page.getByText("请输入用户编码或姓名")).toBeVisible()
})

test("Password visibility controls use localized accessible names", async ({
  page,
}) => {
  await page.goto("/login")

  const showPassword = page.getByRole("button", { name: "显示密码" })
  await expect(showPassword).toBeVisible()
  await showPassword.click()
  await expect(
    page.getByRole("button", { name: "隐藏密码" }),
  ).toBeVisible()
  await expect(page.getByTestId("password-input")).toHaveAttribute(
    "type",
    "text",
  )
})

test("Unexpected login errors use a localized title and fallback", async ({
  page,
}) => {
  await page.goto("/login")
  await fillForm(page, "no_such_user_code", randomPassword())
  await submitLogin(page)

  await expect(page.getByText("出错了", { exact: true })).toBeVisible()
  await expect(page.getByText("出错了,请重试。")).toBeVisible()
})

test("Sidebar and user menu use localized labels", async ({ page }) => {
  await page.goto("/login")

  await fillForm(page, firstSuperuserCode, firstSuperuserPassword)
  await submitLogin(page)

  await page.waitForURL("/")

  const trigger = page.locator('[data-sidebar="trigger"]')
  await expect(trigger).toHaveAccessibleName("收起侧边栏")
  await expect(page.locator('[data-sidebar="rail"]')).toHaveAttribute(
    "aria-label",
    "切换侧边栏",
  )
  await expect(page.locator('[data-sidebar="rail"]')).toHaveAttribute(
    "title",
    "切换侧边栏",
  )
  await trigger.click()
  await expect(trigger).toHaveAccessibleName("展开侧边栏")

  const dashboardLink = page.getByRole("link", { name: "仪表盘", exact: true })
  await expect(dashboardLink).toBeVisible()
  await expect(
    page.getByRole("link", { name: "项目", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "管理", exact: true }),
  ).toBeVisible()

  await page.getByTestId("user-menu").click()
  await expect(page.getByRole("menuitem", { name: "用户设置" })).toBeVisible()
  await expect(page.getByTestId("logout")).toHaveText("退出登录")
  await page.keyboard.press("Escape")

  await page.locator('[data-sidebar="trigger"]').click()
  await dashboardLink.hover()
  await expect(page.getByRole("tooltip")).toHaveText("仪表盘")
})

test("Successful log out", async ({ page }) => {
  await page.goto("/login")

  await fillForm(page, firstSuperuserCode, firstSuperuserPassword)
  await submitLogin(page)

  await page.waitForURL("/")

  await page.getByTestId("user-menu").click()
  await page.getByTestId("logout").click()
  await page.waitForURL("/login")
})

test("Logged-out user cannot access protected routes", async ({ page }) => {
  await page.goto("/login")

  await fillForm(page, firstSuperuserCode, firstSuperuserPassword)
  await submitLogin(page)

  await page.waitForURL("/")

  await page.getByTestId("user-menu").click()
  await page.getByTestId("logout").click()
  await page.waitForURL("/login")

  await page.goto("/settings")
  await page.waitForURL("/login")
})

test("Redirects to /login when token is wrong", async ({ page }) => {
  await page.goto("/settings")
  await page.evaluate(() => {
    localStorage.setItem("access_token", "invalid_token")
  })
  await page.goto("/settings")
  await page.waitForURL("/login")
  await expect(page).toHaveURL("/login")
})
