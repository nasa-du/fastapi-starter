import { expect, test } from "@playwright/test"
import { firstSuperuserCode, firstSuperuserPassword } from "./config.ts"
import { createUser } from "./utils/privateApi"
import { randomPassword, randomUserCode } from "./utils/random"
import { logInUser, logOutUser } from "./utils/user"

test.describe("Admin page and table", () => {
  test.use({ locale: "zh-CN" })

  test("Admin page is accessible and shows the localized title", async ({
    page,
  }) => {
    await page.goto("/admin")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.getByTestId("add-user")).toBeVisible()
    await expect(page.getByRole("table")).toBeVisible()
    const chineseTitle = await page.title()

    await page.getByTestId("language-button").click()
    await page.getByTestId("language-en").click()

    await expect(page.locator("html")).toHaveAttribute("lang", "en")
    expect(await page.title()).not.toBe(chineseTitle)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.getByTestId("add-user")).toBeVisible()
    await expect(page.getByRole("table")).toBeVisible()
  })

  test("Add User button is visible", async ({ page }) => {
    await page.goto("/admin")
    await expect(page.getByTestId("add-user")).toBeVisible()
  })

  test("Users table localizes headings, roles, status, and identity", async ({
    page,
  }) => {
    await page.route("**/api/v1/users/me", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          id: "active-admin",
          user_code: "active_admin",
          full_name: null,
          is_active: true,
          is_superuser: true,
        }),
      }),
    )
    await page.route("**/api/v1/users/?**", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: "active-admin",
              user_code: "active_admin",
              full_name: null,
              is_active: true,
              is_superuser: true,
            },
            {
              id: "inactive-user",
              user_code: "inactive_user",
              full_name: "Inactive Test User",
              is_active: false,
              is_superuser: false,
            },
          ],
          count: 2,
        }),
      }),
    )
    await page.goto("/admin")

    const headings = page.getByRole("columnheader")
    await expect(headings).toHaveCount(5)
    const chineseHeadings = await headings.allTextContents()
    await expect(page.getByTestId("user-actions")).toHaveCount(1)
    const adminRow = page.getByRole("row").filter({ hasText: "active_admin" })
    const adminName = adminRow.getByTestId("user-full-name-cell")
    const adminRole = adminRow.getByTestId("user-role-cell")
    const adminStatus = adminRow.getByTestId("user-status-cell")
    await expect(adminName).toBeVisible()
    await expect(adminName).toHaveClass(/text-muted-foreground/)
    await expect(adminRow.getByTestId("current-user-badge")).toBeVisible()
    await expect(adminRow.getByTestId("user-actions")).toHaveCount(0)
    await expect(adminRole).toHaveAttribute("data-superuser", "true")
    await expect(adminStatus.locator(".bg-green-500")).toBeVisible()
    const chineseAdmin = await adminRow.textContent()
    const userRow = page.getByRole("row").filter({ hasText: "inactive_user" })
    const userRole = userRow.getByTestId("user-role-cell")
    const userStatus = userRow.getByTestId("user-status-cell")
    await expect(userRole).toHaveAttribute("data-superuser", "false")
    await expect(userStatus.locator(".bg-gray-400")).toBeVisible()
    const chineseUser = await userRow.textContent()
    await expect(userRow.getByTestId("user-actions")).toBeVisible()

    await page.getByTestId("language-button").click()
    await page.getByTestId("language-en").click()

    expect(await headings.allTextContents()).not.toEqual(chineseHeadings)
    await expect(page.getByTestId("user-actions")).toHaveCount(1)
    await expect(adminRow.getByTestId("user-actions")).toHaveCount(0)
    await expect(userRow.getByTestId("user-actions")).toBeVisible()
    expect(await adminName.textContent()).not.toBe("active_admin")
    await expect(adminRow.getByTestId("current-user-badge")).toBeVisible()
    await expect(adminRole).toHaveAttribute("data-superuser", "true")
    await expect(adminStatus.locator(".bg-green-500")).toBeVisible()
    await expect(userRole).toHaveAttribute("data-superuser", "false")
    await expect(userStatus.locator(".bg-gray-400")).toBeVisible()
    expect(await adminRow.textContent()).not.toBe(chineseAdmin)
    expect(await userRow.textContent()).not.toBe(chineseUser)
  })

  test("Add user dialog switches to English without reload", async ({
    page,
  }) => {
    await page.goto("/admin")
    await page.getByTestId("add-user").click()
    const dialog = page.getByRole("dialog")
    await page.getByTestId("user-code-input").focus()
    await page.getByTestId("user-code-input").blur()
    const userCodeError = dialog.locator("[data-slot='form-message']")
    await expect(userCodeError).toBeVisible()
    const chineseError = await userCodeError.textContent()
    await page.keyboard.press("Escape")
    await expect(dialog).not.toBeVisible()

    await page.getByTestId("language-button").click()
    await page.getByTestId("language-en").click()
    await page.getByTestId("add-user").click()

    await expect(dialog.getByRole("heading")).toBeVisible()
    await expect(
      dialog.locator("[data-slot='dialog-description']"),
    ).toBeVisible()
    await expect(page.getByTestId("user-superuser-input")).toBeVisible()
    await expect(page.getByTestId("user-active-input")).toBeVisible()
    await expect(page.getByTestId("user-code-input")).toBeEditable()
    await expect(page.getByTestId("user-full-name-input")).toBeEditable()
    await expect(page.getByTestId("cancel-create-user")).toBeEnabled()
    await expect(page.getByTestId("save-user")).toBeEnabled()
    await expect(page).toHaveURL("/admin")

    await expect(userCodeError).toBeVisible()
    expect(await userCodeError.textContent()).not.toBe(chineseError)

    await page.getByTestId("user-code-input").fill("persisted-user-code")
    await page.keyboard.press("Escape")
    await expect(dialog).not.toBeVisible()
    await page.getByTestId("add-user").click()

    await expect(page.getByTestId("user-code-input")).toHaveValue(
      "persisted-user-code",
    )
    await page.getByTestId("user-password-input").focus()
    await page.getByTestId("user-password-input").blur()
    await expect(page.getByTestId("user-password-input")).toHaveAttribute(
      "aria-invalid",
      "true",
    )
  })

  test("Pending Users uses localized table headings", async ({ page }) => {
    await page.route("**/api/v1/users/?**", () => {})
    await page.goto("/admin")
    await expect(page.getByRole("table")).toBeVisible()
    const pendingTable = page.locator("table").filter({
      has: page.locator("[data-slot='skeleton']"),
    })
    await expect(pendingTable.getByRole("columnheader")).toHaveCount(5)
    await expect(
      pendingTable.locator("[data-slot='skeleton']").first(),
    ).toBeVisible()
  })
})

test.describe("Admin user management", () => {
  test.use({ locale: "zh-CN" })
  test("Create a new user successfully", async ({ page }) => {
    await page.goto("/admin")

    const userCode = randomUserCode()
    const password = randomPassword()
    const fullName = "Test User Admin"

    await page.getByTestId("add-user").click()

    const dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("heading")).toBeVisible()
    await expect(
      dialog.locator("[data-slot='dialog-description']"),
    ).toBeVisible()
    await expect(page.getByTestId("user-code-input")).toHaveAttribute(
      "required",
      "",
    )
    await expect(dialog.locator("[data-slot='form-description']")).toBeVisible()
    await expect(page.getByTestId("user-full-name-input")).toBeEditable()
    await expect(page.getByTestId("user-password-input")).toHaveAttribute(
      "required",
      "",
    )
    await expect(
      page.getByTestId("user-confirm-password-input"),
    ).toHaveAttribute("required", "")
    await expect(page.getByTestId("user-superuser-input")).toBeVisible()
    await expect(page.getByTestId("user-active-input")).toBeVisible()
    await expect(page.getByTestId("cancel-create-user")).toBeEnabled()
    await expect(page.getByTestId("save-user")).toBeEnabled()

    await page.getByTestId("user-code-input").fill(userCode)
    await page.getByTestId("user-full-name-input").fill(fullName)
    await page.getByTestId("user-password-input").fill(password)
    await page.getByTestId("user-confirm-password-input").fill(password)

    await page.getByTestId("save-user").click()

    await expect(page.getByTestId("user-created-toast")).toBeVisible()

    await expect(page.getByRole("dialog")).not.toBeVisible()

    const userRow = page.getByRole("row").filter({ hasText: userCode })
    await expect(userRow).toBeVisible()
  })

  test("Create a superuser", async ({ page }) => {
    await page.goto("/admin")

    const userCode = randomUserCode()
    const password = randomPassword()

    await page.getByTestId("add-user").click()

    await page.getByTestId("user-code-input").fill(userCode)
    await page.getByTestId("user-password-input").fill(password)
    await page.getByTestId("user-confirm-password-input").fill(password)
    await page.getByTestId("user-superuser-input").check()
    await page.getByTestId("user-active-input").check()

    await page.getByTestId("save-user").click()

    await expect(page.getByTestId("user-created-toast")).toBeVisible()

    await expect(page.getByRole("dialog")).not.toBeVisible()

    const userRow = page.getByRole("row").filter({ hasText: userCode })
    await expect(userRow.getByTestId("user-role-cell")).toHaveAttribute(
      "data-superuser",
      "true",
    )
  })

  test("Edit a user successfully", async ({ page }) => {
    await page.goto("/admin")

    const userCode = randomUserCode()
    const password = randomPassword()
    const originalName = "Original Name"
    const updatedName = `Updated ${randomUserCode()}`

    await page.getByTestId("add-user").click()
    await page.getByTestId("user-code-input").fill(userCode)
    await page.getByTestId("user-full-name-input").fill(originalName)
    await page.getByTestId("user-password-input").fill(password)
    await page.getByTestId("user-confirm-password-input").fill(password)
    await page.getByTestId("save-user").click()

    await expect(page.getByTestId("user-created-toast")).toBeVisible()
    await expect(page.getByRole("dialog")).not.toBeVisible()

    const userRow = page.getByRole("row").filter({ hasText: userCode })
    await userRow.getByTestId("user-actions").click()

    await page.getByTestId("edit-user").click()

    const dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("heading")).toBeVisible()
    await expect(
      dialog.locator("[data-slot='dialog-description']"),
    ).toBeVisible()
    await expect(page.getByTestId("user-code-input")).toHaveValue(userCode)
    await expect(page.getByTestId("cancel-edit-user")).toBeEnabled()
    await expect(page.getByTestId("user-full-name-input")).toHaveValue(
      originalName,
    )

    await page.getByTestId("user-full-name-input").fill(updatedName)
    await page.getByTestId("save-user").click()

    await expect(page.getByTestId("user-updated-toast")).toBeVisible()
    await expect(userRow.getByText(updatedName)).toBeVisible()
  })

  test("Edit user dialog uses English validation after language switch", async ({
    page,
  }) => {
    const userCode = "edit_language_fixture"
    const user = {
      id: "edit-language-fixture",
      user_code: userCode,
      full_name: "Original Name",
      is_active: true,
      is_superuser: false,
    }
    await page.route("**/api/v1/users/?**", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data: [user], count: 1 }),
      }),
    )
    await page.goto("/admin")
    await page.getByTestId("user-actions").click()
    await page.getByTestId("edit-user").click()

    const dialog = page.getByRole("dialog")
    await page.getByTestId("user-full-name-input").fill("Unsaved Name")
    await page.getByTestId("user-code-input").fill("")
    await page.getByTestId("user-code-input").blur()
    const editUserCodeError = dialog.locator("[data-slot='form-message']")
    await expect(editUserCodeError).toBeVisible()
    const chineseEditError = await editUserCodeError.textContent()
    await page.keyboard.press("Escape")
    await expect(dialog).not.toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByTestId("edit-user")).toHaveCount(0)

    await page.getByTestId("language-button").click()
    await page.getByTestId("language-en").click()
    await page.getByTestId("user-actions").click()
    await page.getByTestId("edit-user").click()

    await expect(page.getByTestId("user-code-input")).toHaveValue(userCode)
    await expect(page.getByTestId("user-full-name-input")).toHaveValue(
      "Original Name",
    )
    await page.getByTestId("user-code-input").fill("")
    await page.getByTestId("user-code-input").blur()
    await expect(editUserCodeError).toBeVisible()
    expect(await editUserCodeError.textContent()).not.toBe(chineseEditError)
    await page.getByTestId("user-password-input").fill("password123")
    await page.getByTestId("user-confirm-password-input").fill("different12345")
    await page.getByTestId("user-confirm-password-input").blur()

    await expect(
      page.getByTestId("user-confirm-password-input"),
    ).toHaveAttribute("aria-invalid", "true")
    await expect(
      dialog.locator("[data-slot='form-message']").last(),
    ).toBeVisible()
  })

  test("Delete a user successfully", async ({ page }) => {
    await page.goto("/admin")

    const userCode = randomUserCode()
    const password = randomPassword()

    await page.getByTestId("add-user").click()
    await page.getByTestId("user-code-input").fill(userCode)
    await page.getByTestId("user-password-input").fill(password)
    await page.getByTestId("user-confirm-password-input").fill(password)
    await page.getByTestId("save-user").click()

    await expect(page.getByTestId("user-created-toast")).toBeVisible()

    await expect(page.getByRole("dialog")).not.toBeVisible()

    const userRow = page.getByRole("row").filter({ hasText: userCode })
    await userRow.getByTestId("user-actions").click()

    await page.getByTestId("delete-user").click()

    const dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("heading")).toBeVisible()
    const description = dialog.locator("[data-slot='dialog-description']")
    await expect(description).toBeVisible()
    await expect(description.locator("strong")).toBeVisible()
    await expect(page.getByTestId("cancel-delete-user")).toBeEnabled()
    await expect(page.getByTestId("confirm-delete-user")).toBeEnabled()
    await page.getByTestId("confirm-delete-user").click()

    await expect(page.getByTestId("user-deleted-toast")).toBeVisible()

    await expect(
      page.getByRole("row").filter({ hasText: userCode }),
    ).not.toBeVisible()
  })

  test("Cancel user deletion keeps the row", async ({ page }) => {
    await page.goto("/admin")

    const userCode = randomUserCode()
    const password = randomPassword()

    await page.getByTestId("add-user").click()
    await page.getByTestId("user-code-input").fill(userCode)
    await page.getByTestId("user-password-input").fill(password)
    await page.getByTestId("user-confirm-password-input").fill(password)
    await page.getByTestId("save-user").click()

    await expect(page.getByTestId("user-created-toast")).toBeVisible()
    await expect(page.getByRole("dialog")).not.toBeVisible()

    const userRow = page.getByRole("row").filter({ hasText: userCode })
    await userRow.getByTestId("user-actions").click()
    await page.getByTestId("delete-user").click()

    const dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("heading")).toBeVisible()
    await page.getByTestId("cancel-delete-user").click()

    // The actions menu stays open beneath the closed dialog (same as the
    // edit-dialog flow); dismiss it before checking the table again.
    await expect(page.getByRole("dialog")).not.toBeVisible()
    await page.keyboard.press("Escape")
    await expect(userRow).toBeVisible()
  })

  test("Cancel user creation", async ({ page }) => {
    await page.goto("/admin")

    await page.getByTestId("add-user").click()
    await page.getByTestId("user-code-input").fill("test_user_code")

    await page.getByTestId("cancel-create-user").click()

    await expect(page.getByRole("dialog")).not.toBeVisible()
  })

  test("User code is required", async ({ page }) => {
    await page.goto("/admin")

    await page.getByTestId("add-user").click()

    await page.getByTestId("user-code-input").fill("")
    await page.getByTestId("user-code-input").blur()

    await expect(page.getByTestId("user-code-input")).toHaveAttribute(
      "aria-invalid",
      "true",
    )
    await expect(
      page.locator("[data-slot='form-message']").first(),
    ).toBeVisible()
  })

  test("User code must be at most 50 characters", async ({ page }) => {
    await page.goto("/admin")

    await page.getByTestId("add-user").click()

    await page.getByTestId("user-code-input").fill("x".repeat(51))
    await page.getByTestId("user-code-input").blur()

    await expect(page.getByTestId("user-code-input")).toHaveAttribute(
      "aria-invalid",
      "true",
    )
    await expect(
      page.locator("[data-slot='form-message']").first(),
    ).toBeVisible()
  })

  test("Password is required", async ({ page }) => {
    await page.goto("/admin")

    await page.getByTestId("add-user").click()
    await page.getByTestId("user-password-input").focus()
    await page.getByTestId("user-password-input").blur()

    await expect(page.getByTestId("user-password-input")).toHaveAttribute(
      "aria-invalid",
      "true",
    )
    await expect(
      page.locator("[data-slot='form-message']").first(),
    ).toBeVisible()
  })

  test("Password confirmation is required", async ({ page }) => {
    await page.goto("/admin")

    await page.getByTestId("add-user").click()
    await page.getByTestId("user-password-input").fill(randomPassword())
    await page.getByTestId("user-confirm-password-input").focus()
    await page.getByTestId("user-confirm-password-input").blur()

    await expect(
      page.getByTestId("user-confirm-password-input"),
    ).toHaveAttribute("aria-invalid", "true")
    await expect(
      page.locator("[data-slot='form-message']").first(),
    ).toBeVisible()
  })

  test("Password must be at least 8 characters", async ({ page }) => {
    await page.goto("/admin")

    await page.getByTestId("add-user").click()
    await page.getByTestId("user-code-input").fill(randomUserCode())
    await page.getByTestId("user-password-input").fill("short")
    await page.getByTestId("user-confirm-password-input").fill("short")
    await page.getByTestId("save-user").click()

    await expect(page.getByTestId("user-password-input")).toHaveAttribute(
      "aria-invalid",
      "true",
    )
    await expect(
      page.locator("[data-slot='form-message']").first(),
    ).toBeVisible()
  })

  test("Passwords must match", async ({ page }) => {
    await page.goto("/admin")

    await page.getByTestId("add-user").click()
    await page.getByTestId("user-code-input").fill(randomUserCode())
    await page.getByTestId("user-password-input").fill(randomPassword())
    await page.getByTestId("user-confirm-password-input").fill("different12345")
    await page.getByTestId("user-confirm-password-input").blur()

    await expect(
      page.getByTestId("user-confirm-password-input"),
    ).toHaveAttribute("aria-invalid", "true")
    await expect(
      page.locator("[data-slot='form-message']").first(),
    ).toBeVisible()
  })
})

test.describe("Admin reset password", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("Admin resets a password, then the user logs in with it", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"])

    const userCode = randomUserCode()
    const password = randomPassword()
    await createUser({ user_code: userCode, password })

    await logInUser(page, firstSuperuserCode, firstSuperuserPassword)
    await page.goto("/admin")
    await page.getByTestId("language-button").click()
    await page.getByTestId("language-zh").click()
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN")

    const userRow = page.getByRole("row").filter({ hasText: userCode })
    await userRow.getByTestId("user-actions").click()
    await expect(page.getByTestId("edit-user")).toBeVisible()
    await expect(page.getByTestId("reset-password")).toBeVisible()
    await expect(page.getByTestId("delete-user")).toBeVisible()
    await page.getByTestId("reset-password").click()

    const dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("heading")).toBeVisible()
    await expect(
      dialog.locator("[data-slot='dialog-description']"),
    ).toBeVisible()
    await expect(dialog.getByTestId("cancel-reset-password")).toBeEnabled()
    await expect(dialog.getByTestId("confirm-reset-password")).toBeEnabled()
    await dialog.getByTestId("confirm-reset-password").click()

    await expect(dialog.getByRole("heading")).toBeVisible()
    await expect(
      dialog.locator("[data-slot='dialog-description']"),
    ).toBeVisible()
    const tempPasswordInput = dialog.getByTestId("temporary-password-input")
    await expect(tempPasswordInput).toHaveAttribute("readonly", "")
    await expect(tempPasswordInput).toBeVisible()
    const tempPassword = await tempPasswordInput.inputValue()
    expect(tempPassword.length).toBeGreaterThanOrEqual(16)

    await expect(dialog.getByTestId("copy-temporary-password")).toBeEnabled()
    await expect(dialog.getByTestId("close-reset-password")).toBeEnabled()
    await dialog.getByTestId("copy-temporary-password").click()
    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboard).toBe(tempPassword)

    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).not.toBeVisible()

    await page.getByTestId("language-button").click()
    await page.getByTestId("language-en").click()
    await logOutUser(page)
    await logInUser(page, userCode, tempPassword)
  })
})

test.describe("Admin page access control", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("Non-superuser cannot access admin page", async ({ page }) => {
    const userCode = randomUserCode()
    const password = randomPassword()

    await createUser({ user_code: userCode, password })
    await logInUser(page, userCode, password)

    await page.goto("/admin")

    await expect(page.getByRole("heading", { level: 1 })).not.toBeVisible()
    await expect(page).not.toHaveURL(/\/admin/)
    await expect(page.getByTestId("user-menu")).toBeVisible()
  })

  test("Superuser can access admin page", async ({ page }) => {
    await logInUser(page, firstSuperuserCode, firstSuperuserPassword)

    await page.goto("/admin")

    await expect(page).toHaveURL("/admin")
    await expect(page.getByTestId("add-user")).toBeVisible()
    await expect(page.getByRole("table")).toBeVisible()
  })
})
