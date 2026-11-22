import { expect, test } from "@playwright/test"
import { firstSuperuserCode, firstSuperuserPassword } from "./config.ts"
import { createUser } from "./utils/privateApi.ts"
import { randomPassword, randomUserCode } from "./utils/random"
import { logInUser, logOutUser } from "./utils/user"

test.use({ locale: "zh-CN" })

const tabs = ["个人资料", "密码", "危险操作"]

async function switchToChinese(page: Parameters<typeof logInUser>[0]) {
  await page.getByTestId("language-button").click()
  await page.getByTestId("language-zh").click()
}

test("Settings switches language without a reload", async ({ page }) => {
  await page.goto("/settings")
  await expect(page).toHaveTitle("用户设置 - FastAPI Template")
  await expect(
    page.getByRole("heading", { name: "用户设置", exact: true }),
  ).toBeVisible()
  await expect(page.getByText("管理您的账户设置和偏好")).toBeVisible()

  await page.getByTestId("language-button").click()
  await page.getByTestId("language-en").click()

  await expect(page).toHaveTitle("Settings - FastAPI Template")
  await expect(
    page.getByRole("heading", { name: "User Settings", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText("Manage your account settings and preferences"),
  ).toBeVisible()
  for (const tab of ["My profile", "Password", "Danger zone"]) {
    await expect(page.getByRole("tab", { name: tab })).toBeVisible()
  }
  await expect(page).toHaveURL("/settings")
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
    await expect(page.getByRole("tab", { name: tab })).toBeVisible()
  }
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
    await expect(page.getByText("姓名", { exact: true })).toBeVisible()
    await expect(page.getByText("用户编码", { exact: true })).toBeVisible()
    await page.getByTestId("edit-profile").click()
    await page.getByTestId("profile-full-name-input").fill("x".repeat(31))
    await page.getByTestId("profile-full-name-input").blur()
    await expect(page.getByText("姓名最多 30 个字符")).toBeVisible()

    await page.getByTestId("language-button").click()
    await page.getByTestId("language-en").click()

    await expect(
      page.getByText("Full name must be at most 30 characters"),
    ).toBeVisible()
    await expect(page.getByTestId("save-profile")).toHaveText("Save")
    await expect(page.getByTestId("cancel-edit-profile")).toHaveText("Cancel")
  })

  test("Edit user name with a valid name", async ({ page }) => {
    const updatedName = "Test User 2"

    await expect(page.getByRole("heading", { name: "用户信息" })).toBeVisible()

    await page.getByTestId("edit-profile").click()
    await page.getByTestId("profile-full-name-input").fill(updatedName)
    await page.getByTestId("save-profile").click()

    await expect(page.getByTestId("profile-updated-toast")).toContainText(
      "用户信息更新成功",
    )
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

    await expect(page.getByRole("heading", { name: "修改密码" })).toBeVisible()
    await expect(page.getByText("当前密码", { exact: true })).toBeVisible()
    await expect(page.getByText("新密码", { exact: true })).toBeVisible()
    await expect(page.getByText("确认密码", { exact: true })).toBeVisible()
    await expect(page.getByTestId("update-password")).toHaveText("更新密码")

    await page.getByTestId("current-password-input").fill(password)
    await page.getByTestId("new-password-input").fill(newPassword)
    await page.getByTestId("confirm-password-input").fill(newPassword)
    await page.getByTestId("update-password").click()

    await expect(page.getByTestId("password-updated-toast")).toContainText(
      "密码更新成功",
    )

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

    await expect(page.getByText("请输入密码").first()).toBeVisible()
    await expect(page.getByText("请确认密码")).toBeVisible()
  })

  test("Validation messages follow the selected language", async ({ page }) => {
    await page.getByTestId("update-password").click()
    await expect(page.getByText("请输入密码").first()).toBeVisible()

    await page.getByTestId("language-button").click()
    await page.getByTestId("language-en").click()
    await expect(
      page.getByRole("heading", { name: "Change Password" }),
    ).toBeVisible()

    await expect(page.getByText("Password is required").first()).toBeVisible()
    await expect(
      page.getByText("Password confirmation is required"),
    ).toBeVisible()
  })

  test("Update password with weak passwords", async ({ page }) => {
    const weakPassword = "weak"

    await page.getByTestId("current-password-input").fill(password)
    await page.getByTestId("new-password-input").fill(weakPassword)
    await page.getByTestId("confirm-password-input").fill(weakPassword)
    await page.getByTestId("update-password").click()

    await expect(page.getByText("密码长度至少 8 个字符")).toBeVisible()
  })

  test("New password and confirmation password do not match", async ({
    page,
  }) => {
    await page.getByTestId("current-password-input").fill(password)
    await page.getByTestId("new-password-input").fill(randomPassword())
    await page.getByTestId("confirm-password-input").fill(randomPassword())
    await page.getByTestId("update-password").click()

    await expect(page.getByText("两次输入的密码不一致")).toBeVisible()
  })

  test("Current password and new password are the same", async ({ page }) => {
    await page.getByTestId("current-password-input").fill(password)
    await page.getByTestId("new-password-input").fill(password)
    await page.getByTestId("confirm-password-input").fill(password)
    await page.getByTestId("update-password").click()

    await expect(page.getByText("新密码不能与当前密码相同")).toBeVisible()
  })

  test("Current password is incorrect", async ({ page }) => {
    const newPassword = randomPassword()
    await page.getByTestId("current-password-input").fill(randomPassword())
    await page.getByTestId("new-password-input").fill(newPassword)
    await page.getByTestId("confirm-password-input").fill(newPassword)
    await page.getByTestId("update-password").click()

    await expect(page.getByText("当前密码不正确")).toBeVisible()
  })
})

test.describe("Delete account", () => {
  test.use({ locale: "en-US", storageState: { cookies: [], origins: [] } })

  test("Delete confirmation is localized and can be cancelled", async ({
    page,
  }) => {
    await logInUser(page, firstSuperuserCode, firstSuperuserPassword)
    await switchToChinese(page)
    await page.goto("/settings")
    await page.getByTestId("settings-tab-danger-zone").click()

    await expect(page.getByRole("heading", { name: "删除账户" })).toBeVisible()
    await expect(
      page.getByText("永久删除您的账户及所有关联数据。"),
    ).toBeVisible()
    await page.getByTestId("delete-account").click()

    const dialog = page.getByRole("dialog")
    await expect(
      dialog.getByRole("heading", { name: "需要确认" }),
    ).toBeVisible()
    await expect(
      dialog.getByText("您的所有账户数据将被", { exact: false }),
    ).toBeVisible()
    await expect(dialog.getByText("永久删除。")).toBeVisible()
    await expect(
      dialog.getByText("确定要继续吗?此操作无法撤销。", { exact: false }),
    ).toBeVisible()
    await expect(dialog.getByTestId("confirm-delete-account")).toHaveText(
      "删除",
    )
    await dialog.getByTestId("cancel-delete-account").click()
    await expect(dialog).not.toBeVisible()

    await page.getByTestId("language-button").click()
    await page.getByTestId("language-en").click()
    await page.getByTestId("delete-account").click()
    await expect(
      dialog.getByRole("heading", { name: "Confirmation Required" }),
    ).toBeVisible()
  })

  test("Delete account successfully logs the user out", async ({ page }) => {
    const userCode = randomUserCode()
    const password = randomPassword()
    await createUser({ user_code: userCode, password })
    await logInUser(page, userCode, password)
    await switchToChinese(page)
    await page.goto("/settings")
    await page.getByTestId("settings-tab-danger-zone").click()

    await page.getByTestId("delete-account").click()
    await page.getByTestId("confirm-delete-account").click()

    await expect(page.getByTestId("account-deleted-toast")).toContainText(
      "您的账户已成功删除",
    )
    await expect(page).toHaveURL("/login")
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
