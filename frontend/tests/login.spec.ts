import { expect, type Page, test } from "@playwright/test"
import { firstSuperuserCode, firstSuperuserPassword } from "./config.ts"
import { createUser } from "./utils/privateApi.ts"
import { randomPassword, randomUserCode } from "./utils/random.ts"

test.use({ storageState: { cookies: [], origins: [] } })

const fillForm = async (page: Page, identifier: string, password: string) => {
  await page.getByTestId("identifier-input").fill(identifier)
  await page.getByTestId("password-input").fill(password)
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

  await expect(page.getByRole("button", { name: "Log In" })).toBeVisible()
})

test("Log in with valid user code and password", async ({ page }) => {
  await page.goto("/login")

  await fillForm(page, firstSuperuserCode, firstSuperuserPassword)
  await page.getByRole("button", { name: "Log In" }).click()

  await page.waitForURL("/")

  await expect(
    page.getByText("Welcome back, nice to see you again!"),
  ).toBeVisible()
})

test("Log in with full name", async ({ page }) => {
  const userCode = randomUserCode()
  const password = randomPassword()
  const fullName = `Name ${randomUserCode()}`

  await createUser({ user_code: userCode, password, full_name: fullName })

  await page.goto("/login")
  await fillForm(page, fullName, password)
  await page.getByRole("button", { name: "Log In" }).click()

  await page.waitForURL("/")

  await expect(
    page.getByText("Welcome back, nice to see you again!"),
  ).toBeVisible()
})

test("Log in with unknown user code shows the unified error", async ({
  page,
}) => {
  await page.goto("/login")

  await fillForm(page, "no_such_user_code", randomPassword())
  await page.getByRole("button", { name: "Log In" }).click()

  await expect(
    page.getByText("Incorrect user code/name or password"),
  ).toBeVisible()
})

test("Log in with unknown name shows the unified error", async ({ page }) => {
  await page.goto("/login")

  await fillForm(page, "No Such Name", firstSuperuserPassword)
  await page.getByRole("button", { name: "Log In" }).click()

  await expect(
    page.getByText("Incorrect user code/name or password"),
  ).toBeVisible()
})

test("Identifier is required", async ({ page }) => {
  await page.goto("/login")

  await page.getByTestId("identifier-input").fill("")
  await page.getByTestId("identifier-input").blur()

  await expect(page.getByText("User code or name is required")).toBeVisible()
})

test("Successful log out", async ({ page }) => {
  await page.goto("/login")

  await fillForm(page, firstSuperuserCode, firstSuperuserPassword)
  await page.getByRole("button", { name: "Log In" }).click()

  await page.waitForURL("/")

  await expect(
    page.getByText("Welcome back, nice to see you again!"),
  ).toBeVisible()

  await page.getByTestId("user-menu").click()
  await page.getByRole("menuitem", { name: "Log out" }).click()
  await page.waitForURL("/login")
})

test("Logged-out user cannot access protected routes", async ({ page }) => {
  await page.goto("/login")

  await fillForm(page, firstSuperuserCode, firstSuperuserPassword)
  await page.getByRole("button", { name: "Log In" }).click()

  await page.waitForURL("/")

  await expect(
    page.getByText("Welcome back, nice to see you again!"),
  ).toBeVisible()

  await page.getByTestId("user-menu").click()
  await page.getByRole("menuitem", { name: "Log out" }).click()
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
