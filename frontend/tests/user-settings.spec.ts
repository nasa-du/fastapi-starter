import { expect, test } from "@playwright/test"
import { firstSuperuserCode, firstSuperuserPassword } from "./config.ts"
import { createUser } from "./utils/privateApi.ts"
import { randomPassword, randomUserCode } from "./utils/random"
import { logInUser, logOutUser } from "./utils/user"

test.use({ locale: "zh-CN" })

const tabs = ["my-profile", "password"]

async function switchToChinese(page: Parameters<typeof logInUser>[0]) {
  await page.getByTestId("language-button").click()
  await page.getByTestId("language-zh").click()
}

test("Settings switches language without a reload", async ({ page }) => {
  await page.goto("/settings")
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await expect(page.getByRole("tablist")).toBeVisible()
  const chineseTitle = await page.title()

  await page.getByTestId("language-button").click()
  await page.getByTestId("language-en").click()

  await expect(page.locator("html")).toHaveAttribute("lang", "en")
  expect(await page.title()).not.toBe(chineseTitle)
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  for (const tab of tabs) {
    await expect(page.getByTestId(`settings-tab-${tab}`)).toBeVisible()
  }
  await expect(page).toHaveURL("/settings")
})

test.describe("Shared authentication helpers", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("work independently of UI text", async ({ page }) => {
    await logInUser(page, firstSuperuserCode, firstSuperuserPassword)
    await logOutUser(page)
    await expect(page).toHaveURL("/login")
  })
})

test("My profile tab is active by default", async ({ page }) => {
  await page.goto("/settings")
  await expect(page.getByTestId("settings-tab-my-profile")).toHaveAttribute(
    "aria-selected",
    "true",
  )
})

test("All tabs are visible", async ({ page }) => {
  await page.goto("/settings")
  for (const tab of tabs) {
    await expect(page.getByTestId(`settings-tab-${tab}`)).toBeVisible()
  }
})

test.describe("Self-service account deletion is removed", () => {
  async function expectNoSelfDeletionEntry(
    page: Parameters<typeof logInUser>[0],
  ) {
    await expect(page.getByRole("tablist").getByRole("tab")).toHaveCount(2)
    for (const tab of tabs) {
      await expect(page.getByTestId(`settings-tab-${tab}`)).toBeVisible()
    }
    await expect(page.getByTestId("settings-tab-danger-zone")).toHaveCount(0)
    await expect(page.getByTestId("delete-account")).toHaveCount(0)
    await expect(page.getByTestId("confirm-delete-account")).toHaveCount(0)
    await expect(page.getByTestId("account-deleted-toast")).toHaveCount(0)
  }

  test("Admin settings page has no delete-account entry", async ({ page }) => {
    await page.goto("/settings")
    await expectNoSelfDeletionEntry(page)
  })

  test.describe("as regular user", () => {
    test.use({ storageState: { cookies: [], origins: [] } })

    test("Regular user settings page has no delete-account entry", async ({
      page,
    }) => {
      const userCode = randomUserCode()
      const password = randomPassword()
      await createUser({ user_code: userCode, password })
      await logInUser(page, userCode, password)
      await page.goto("/settings")
      await expectNoSelfDeletionEntry(page)
    })
  })
})

test.describe("Edit user profile", () => {
  test.use({ locale: "en-US", storageState: { cookies: [], origins: [] } })
  let userCode: string
  let password: string

  test.beforeAll(async () => {
    userCode = randomUserCode()
    password = randomPassword()
    await createUser({ user_code: userCode, password })
  })

  test.beforeEach(async ({ page }) => {
    await logInUser(page, userCode, password)
    await switchToChinese(page)
    await page.goto("/settings")
    await page.getByTestId("settings-tab-my-profile").click()
  })

  test("Profile length validation follows the selected language", async ({
    page,
  }) => {
    await expect(page.getByTestId("edit-profile")).toBeVisible()
    await expect(
      page.getByRole("tabpanel").getByText(userCode, { exact: true }),
    ).toBeVisible()
    await page.getByTestId("edit-profile").click()
    await page.getByTestId("profile-full-name-input").fill("x".repeat(31))
    await page.getByTestId("profile-full-name-input").blur()
    const nameError = page.locator("[data-slot='form-message']")
    await expect(nameError).toBeVisible()
    const chineseError = await nameError.textContent()

    await page.getByTestId("language-button").click()
    await page.getByTestId("language-en").click()

    await expect(page.locator("html")).toHaveAttribute("lang", "en")
    await expect(nameError).toBeVisible()
    expect(await nameError.textContent()).not.toBe(chineseError)
    await expect(page.getByTestId("profile-full-name-input")).toHaveValue(
      "x".repeat(31),
    )
    await expect(page.getByTestId("save-profile")).toBeEnabled()
    await expect(page.getByTestId("cancel-edit-profile")).toBeEnabled()
  })

  test("Edit user name with a valid name", async ({ page }) => {
    const updatedName = "Test User 2"

    await expect(page.getByRole("heading", { level: 3 })).toBeVisible()

    await page.getByTestId("edit-profile").click()
    await page.getByTestId("profile-full-name-input").fill(updatedName)
    await page.getByTestId("save-profile").click()

    await expect(page.getByTestId("profile-updated-toast")).toBeVisible()
    await expect(
      page.locator("form").getByText(updatedName, { exact: true }),
    ).toBeVisible()
  })
})

test.describe("Cancel edit actions", () => {
  test.use({ locale: "en-US", storageState: { cookies: [], origins: [] } })

  test("Cancel edit action restores original name", async ({ page }) => {
    const userCode = randomUserCode()
    const password = randomPassword()
    const user = await createUser({ user_code: userCode, password })

    await logInUser(page, userCode, password)
    await switchToChinese(page)
    await page.goto("/settings")
    await page.getByTestId("settings-tab-my-profile").click()
    await page.getByTestId("edit-profile").click()
    await page.getByTestId("profile-full-name-input").fill("Test User")
    await page.getByTestId("cancel-edit-profile").click()

    await expect(
      page.locator("form").getByText(user.full_name as string, { exact: true }),
    ).toBeVisible()
  })
})

test.describe("Change password", () => {
  test.use({ locale: "en-US", storageState: { cookies: [], origins: [] } })

  test("Update password successfully", async ({ page }) => {
    const userCode = randomUserCode()
    const password = randomPassword()
    const newPassword = randomPassword()

    await createUser({ user_code: userCode, password })
    await logInUser(page, userCode, password)
    await switchToChinese(page)
    await page.goto("/settings")
    await page.getByTestId("settings-tab-password").click()

    await expect(page.getByRole("heading", { level: 3 })).toBeVisible()
    await expect(page.getByTestId("current-password-input")).toBeEditable()
    await expect(page.getByTestId("new-password-input")).toBeEditable()
    await expect(page.getByTestId("confirm-password-input")).toBeEditable()
    await expect(page.getByTestId("update-password")).toBeEnabled()

    await page.getByTestId("current-password-input").fill(password)
    await page.getByTestId("new-password-input").fill(newPassword)
    await page.getByTestId("confirm-password-input").fill(newPassword)
    await page.getByTestId("update-password").click()

    await expect(page.getByTestId("password-updated-toast")).toBeVisible()

    await page.getByTestId("language-button").click()
    await page.getByTestId("language-en").click()
    await logOutUser(page)
    await logInUser(page, userCode, newPassword)
  })
})

test.describe("Change password validation", () => {
  test.use({ locale: "en-US", storageState: { cookies: [], origins: [] } })
  let userCode: string
  let password: string

  test.beforeAll(async () => {
    userCode = randomUserCode()
    password = randomPassword()
    await createUser({ user_code: userCode, password })
  })

  test.beforeEach(async ({ page }) => {
    await logInUser(page, userCode, password)
    await switchToChinese(page)
    await page.goto("/settings")
    await page.getByTestId("settings-tab-password").click()
  })

  test("Passwords are required", async ({ page }) => {
    await page.getByTestId("update-password").click()

    for (const input of [
      "current-password-input",
      "new-password-input",
      "confirm-password-input",
    ]) {
      await expect(page.getByTestId(input)).toHaveAttribute(
        "aria-invalid",
        "true",
      )
    }
    await expect(page.locator("[data-slot='form-message']")).toHaveCount(3)
  })

  test("Validation messages follow the selected language", async ({ page }) => {
    await page.getByTestId("update-password").click()
    const errors = page.locator("[data-slot='form-message']")
    await expect(errors).toHaveCount(3)
    const chineseErrors = await errors.allTextContents()

    await page.getByTestId("language-button").click()
    await page.getByTestId("language-en").click()
    await expect(page.locator("html")).toHaveAttribute("lang", "en")

    await expect(errors).toHaveCount(3)
    expect(await errors.allTextContents()).not.toEqual(chineseErrors)
  })

  test("Update password with weak passwords", async ({ page }) => {
    const weakPassword = "weak"

    await page.getByTestId("current-password-input").fill(password)
    await page.getByTestId("new-password-input").fill(weakPassword)
    await page.getByTestId("confirm-password-input").fill(weakPassword)
    await page.getByTestId("update-password").click()

    await expect(page.getByTestId("new-password-input")).toHaveAttribute(
      "aria-invalid",
      "true",
    )
    await expect(page.locator("[data-slot='form-message']")).toBeVisible()
  })

  test("New password and confirmation password do not match", async ({
    page,
  }) => {
    await page.getByTestId("current-password-input").fill(password)
    await page.getByTestId("new-password-input").fill(randomPassword())
    await page.getByTestId("confirm-password-input").fill(randomPassword())
    await page.getByTestId("update-password").click()

    await expect(page.getByTestId("confirm-password-input")).toHaveAttribute(
      "aria-invalid",
      "true",
    )
    await expect(page.locator("[data-slot='form-message']")).toBeVisible()
  })

  test("Current password and new password are the same", async ({ page }) => {
    await page.getByTestId("current-password-input").fill(password)
    await page.getByTestId("new-password-input").fill(password)
    await page.getByTestId("confirm-password-input").fill(password)
    const responsePromise = page.waitForResponse("**/api/v1/users/me/password")
    await page.getByTestId("update-password").click()

    const response = await responsePromise
    expect(response.status()).toBe(400)
    expect((await response.json()).detail.code).toBe("USERS_PASSWORD_UNCHANGED")
    await expect(page.getByTestId("error-toast")).toBeVisible()
  })

  test("Current password is incorrect", async ({ page }) => {
    const newPassword = randomPassword()
    await page.getByTestId("current-password-input").fill(randomPassword())
    await page.getByTestId("new-password-input").fill(newPassword)
    await page.getByTestId("confirm-password-input").fill(newPassword)
    const responsePromise = page.waitForResponse("**/api/v1/users/me/password")
    await page.getByTestId("update-password").click()

    const response = await responsePromise
    expect(response.status()).toBe(400)
    expect((await response.json()).detail.code).toBe("USERS_PASSWORD_INCORRECT")
    await expect(page.getByTestId("error-toast")).toBeVisible()
  })
})

test("Appearance button is visible in sidebar", async ({ page }) => {
  await page.goto("/settings")
  await expect(page.getByTestId("theme-button")).toBeVisible()
})

test("User can switch between theme modes", async ({ page }) => {
  await page.goto("/settings")

  await page.getByTestId("theme-button").click()
  await page.getByTestId("dark-mode").click()
  await expect(page.locator("html")).toHaveClass(/dark/)

  await expect(page.getByTestId("dark-mode")).not.toBeVisible()

  await page.getByTestId("theme-button").click()
  await page.getByTestId("light-mode").click()
  await expect(page.locator("html")).toHaveClass(/light/)
})

test("Selected mode is preserved across sessions", async ({ page }) => {
  await page.goto("/settings")

  await page.getByTestId("theme-button").click()
  if (
    await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    )
  ) {
    await page.getByTestId("light-mode").click()
    await page.getByTestId("theme-button").click()
  }

  const isLightMode = await page.evaluate(() =>
    document.documentElement.classList.contains("light"),
  )
  expect(isLightMode).toBe(true)

  await page.getByTestId("theme-button").click()
  await page.getByTestId("dark-mode").click()
  let isDarkMode = await page.evaluate(() =>
    document.documentElement.classList.contains("dark"),
  )
  expect(isDarkMode).toBe(true)

  await page.getByTestId("language-button").click()
  await page.getByTestId("language-en").click()
  await logOutUser(page)
  await logInUser(page, firstSuperuserCode, firstSuperuserPassword)

  isDarkMode = await page.evaluate(() =>
    document.documentElement.classList.contains("dark"),
  )
  expect(isDarkMode).toBe(true)
})
