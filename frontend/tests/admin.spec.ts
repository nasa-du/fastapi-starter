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
    await expect(page).toHaveTitle("用户管理 - FastAPI Template")
    await expect(page.getByRole("heading", { name: "用户" })).toBeVisible()
    await expect(page.getByText("管理用户账户和权限")).toBeVisible()

    await page.getByTestId("language-button").click()
    await page.getByTestId("language-en").click()

    await expect(page).toHaveTitle("Users - FastAPI Template")
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible()
    await expect(
      page.getByText("Manage user accounts and permissions"),
    ).toBeVisible()
  })

  test("Add User button is visible", async ({ page }) => {
    await page.goto("/admin")
    await expect(page.getByRole("button", { name: "Add User" })).toBeVisible()
  })

  test("Users table localizes headings, roles, status, and identity", async ({
    page,
  }) => {
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

    for (const heading of ["姓名", "用户编码", "角色", "状态"]) {
      await expect(
        page.getByRole("columnheader", { name: heading }),
      ).toBeVisible()
    }
    await expect(page.getByText("操作")).toBeAttached()
    const adminRow = page.getByRole("row").filter({ hasText: "active_admin" })
    await expect(adminRow.getByText("暂无姓名")).toBeVisible()
    await expect(adminRow.getByText("你", { exact: true })).toBeVisible()
    await expect(adminRow.getByText("超级管理员")).toBeVisible()
    await expect(adminRow.getByText("启用")).toBeVisible()
    const userRow = page.getByRole("row").filter({ hasText: "inactive_user" })
    await expect(userRow.getByText("普通用户")).toBeVisible()
    await expect(userRow.getByText("停用")).toBeVisible()

    await page.getByTestId("language-button").click()
    await page.getByTestId("language-en").click()

    for (const heading of ["Full Name", "User Code", "Role", "Status"]) {
      await expect(
        page.getByRole("columnheader", { name: heading }),
      ).toBeVisible()
    }
    await expect(page.getByText("Actions")).toBeAttached()
    await expect(adminRow.getByText("N/A")).toBeVisible()
    await expect(adminRow.getByText("You", { exact: true })).toBeVisible()
    await expect(adminRow.getByText("Superuser")).toBeVisible()
    await expect(adminRow.getByText("Active")).toBeVisible()
    await expect(userRow.getByText("User")).toBeVisible()
    await expect(userRow.getByText("Inactive")).toBeVisible()
  })

  test("Pending Users uses localized table headings", async ({ page }) => {
    await page.route("**/api/v1/users/?**", () => {})
    await page.goto("/admin")
    await expect(page.getByRole("table")).toBeVisible()
    const pendingTable = page.locator("table").filter({
      has: page.locator("[data-slot='skeleton']"),
    })
    for (const heading of ["姓名", "用户编码", "角色", "状态"]) {
      await expect(
        pendingTable.getByRole("columnheader", { name: heading }),
      ).toBeVisible()
    }
    await expect(pendingTable.getByText("操作")).toBeAttached()
  })
})

test.describe("Admin user management", () => {
  test("Create a new user successfully", async ({ page }) => {
    await page.goto("/admin")

    const userCode = randomUserCode()
    const password = randomPassword()
    const fullName = "Test User Admin"

    await page.getByRole("button", { name: "Add User" }).click()

    await page.getByPlaceholder("User code").fill(userCode)
    await page.getByPlaceholder("Full name").fill(fullName)
    await page.getByPlaceholder("Password").first().fill(password)
    await page.getByPlaceholder("Password").last().fill(password)

    await page.getByRole("button", { name: "Save" }).click()

    await expect(page.getByText("User created successfully")).toBeVisible()

    await expect(page.getByRole("dialog")).not.toBeVisible()

    const userRow = page.getByRole("row").filter({ hasText: userCode })
    await expect(userRow).toBeVisible()
  })

  test("Create a superuser", async ({ page }) => {
    await page.goto("/admin")

    const userCode = randomUserCode()
    const password = randomPassword()

    await page.getByRole("button", { name: "Add User" }).click()

    await page.getByPlaceholder("User code").fill(userCode)
    await page.getByPlaceholder("Password").first().fill(password)
    await page.getByPlaceholder("Password").last().fill(password)
    await page.getByLabel("Is superuser?").check()
    await page.getByLabel("Is active?").check()

    await page.getByRole("button", { name: "Save" }).click()

    await expect(page.getByText("User created successfully")).toBeVisible()

    await expect(page.getByRole("dialog")).not.toBeVisible()

    const userRow = page.getByRole("row").filter({ hasText: userCode })
    await expect(userRow.getByText("Superuser")).toBeVisible()
  })

  test("Edit a user successfully", async ({ page }) => {
    await page.goto("/admin")

    const userCode = randomUserCode()
    const password = randomPassword()
    const originalName = "Original Name"
    const updatedName = `Updated ${randomUserCode()}`

    await page.getByRole("button", { name: "Add User" }).click()
    await page.getByPlaceholder("User code").fill(userCode)
    await page.getByPlaceholder("Full name").fill(originalName)
    await page.getByPlaceholder("Password").first().fill(password)
    await page.getByPlaceholder("Password").last().fill(password)
    await page.getByRole("button", { name: "Save" }).click()

    await expect(page.getByText("User created successfully")).toBeVisible()
    await expect(page.getByRole("dialog")).not.toBeVisible()

    const userRow = page.getByRole("row").filter({ hasText: userCode })
    await userRow.getByRole("button").click()

    await page.getByRole("menuitem", { name: "Edit User" }).click()

    await page.getByPlaceholder("Full name").fill(updatedName)
    await page.getByRole("button", { name: "Save" }).click()

    await expect(page.getByText("User updated successfully")).toBeVisible()
    await expect(userRow.getByText(updatedName)).toBeVisible()
  })

  test("Delete a user successfully", async ({ page }) => {
    await page.goto("/admin")

    const userCode = randomUserCode()
    const password = randomPassword()

    await page.getByRole("button", { name: "Add User" }).click()
    await page.getByPlaceholder("User code").fill(userCode)
    await page.getByPlaceholder("Password").first().fill(password)
    await page.getByPlaceholder("Password").last().fill(password)
    await page.getByRole("button", { name: "Save" }).click()

    await expect(page.getByText("User created successfully")).toBeVisible()

    await expect(page.getByRole("dialog")).not.toBeVisible()

    const userRow = page.getByRole("row").filter({ hasText: userCode })
    await userRow.getByRole("button").click()

    await page.getByRole("menuitem", { name: "Delete User" }).click()

    await page.getByRole("button", { name: "Delete" }).click()

    await expect(
      page.getByText("The user was deleted successfully"),
    ).toBeVisible()

    await expect(
      page.getByRole("row").filter({ hasText: userCode }),
    ).not.toBeVisible()
  })

  test("Cancel user creation", async ({ page }) => {
    await page.goto("/admin")

    await page.getByRole("button", { name: "Add User" }).click()
    await page.getByPlaceholder("User code").fill("test_user_code")

    await page.getByRole("button", { name: "Cancel" }).click()

    await expect(page.getByRole("dialog")).not.toBeVisible()
  })

  test("User code is required", async ({ page }) => {
    await page.goto("/admin")

    await page.getByRole("button", { name: "Add User" }).click()

    await page.getByPlaceholder("User code").fill("")
    await page.getByPlaceholder("User code").blur()

    await expect(page.getByText("User code is required")).toBeVisible()
  })

  test("User code must be at most 50 characters", async ({ page }) => {
    await page.goto("/admin")

    await page.getByRole("button", { name: "Add User" }).click()

    await page.getByPlaceholder("User code").fill("x".repeat(51))
    await page.getByPlaceholder("User code").blur()

    await expect(
      page.getByText("User code must be at most 50 characters"),
    ).toBeVisible()
  })

  test("Password must be at least 8 characters", async ({ page }) => {
    await page.goto("/admin")

    await page.getByRole("button", { name: "Add User" }).click()

    await page.getByPlaceholder("User code").fill(randomUserCode())
    await page.getByPlaceholder("Password").first().fill("short")
    await page.getByPlaceholder("Password").last().fill("short")
    await page.getByRole("button", { name: "Save" }).click()

    await expect(
      page.getByText("Password must be at least 8 characters"),
    ).toBeVisible()
  })

  test("Passwords must match", async ({ page }) => {
    await page.goto("/admin")

    await page.getByRole("button", { name: "Add User" }).click()

    await page.getByPlaceholder("User code").fill(randomUserCode())
    await page.getByPlaceholder("Password").first().fill(randomPassword())
    await page.getByPlaceholder("Password").last().fill("different12345")
    await page.getByPlaceholder("Password").last().blur()

    await expect(page.getByText("The passwords don't match")).toBeVisible()
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

    const userRow = page.getByRole("row").filter({ hasText: userCode })
    await userRow.getByRole("button").click()
    await page.getByRole("menuitem", { name: "Reset Password" }).click()

    const dialog = page.getByRole("dialog")
    await expect(
      dialog.getByRole("heading", { name: "Reset User Password" }),
    ).toBeVisible()
    await dialog.getByRole("button", { name: "Reset Password" }).click()

    const tempPasswordInput = dialog.getByLabel("Temporary password")
    await expect(tempPasswordInput).toBeVisible()
    const tempPassword = await tempPasswordInput.inputValue()
    expect(tempPassword.length).toBeGreaterThanOrEqual(16)

    await dialog
      .getByRole("button", { name: "Copy temporary password" })
      .click()
    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboard).toBe(tempPassword)

    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).not.toBeVisible()

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

    await expect(page.getByRole("heading", { name: "用户" })).not.toBeVisible()
    await expect(page).not.toHaveURL(/\/admin/)
  })

  test("Superuser can access admin page", async ({ page }) => {
    await logInUser(page, firstSuperuserCode, firstSuperuserPassword)

    await page.goto("/admin")

    await expect(page.getByRole("heading", { name: "用户" })).toBeVisible()
  })
})
