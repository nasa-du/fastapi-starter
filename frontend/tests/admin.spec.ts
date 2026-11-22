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
    await expect(page.getByTestId("add-user")).toHaveText("添加用户")
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
    await expect(adminRow.getByText("Active", { exact: true })).toBeVisible()
    await expect(userRow.getByText("User", { exact: true })).toBeVisible()
    await expect(userRow.getByText("Inactive", { exact: true })).toBeVisible()
  })

  test("Add user dialog switches to English without reload", async ({
    page,
  }) => {
    await page.goto("/admin")
    await page.getByTestId("add-user").click()

    await page.getByTestId("language-button").click()
    await page.getByTestId("language-en").click()

    const dialog = page.getByRole("dialog")
    await expect(
      dialog.getByRole("heading", { name: "Add User" }),
    ).toBeVisible()
    await expect(
      dialog.getByText(
        "Fill in the form below to add a new user to the system.",
      ),
    ).toBeVisible()
    await expect(dialog.getByLabel("Is superuser?")).toBeVisible()
    await expect(dialog.getByLabel("Is active?")).toBeVisible()
    await expect(page.getByTestId("user-code-input")).toHaveAttribute(
      "placeholder",
      "User code",
    )
    await expect(page.getByTestId("user-full-name-input")).toHaveAttribute(
      "placeholder",
      "Full name",
    )
    await expect(page.getByTestId("cancel-create-user")).toHaveText("Cancel")
    await expect(page.getByTestId("save-user")).toHaveText("Save")
    await expect(page).toHaveURL("/admin")
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
  test.use({ locale: "zh-CN" })
  test("Create a new user successfully", async ({ page }) => {
    await page.goto("/admin")

    const userCode = randomUserCode()
    const password = randomPassword()
    const fullName = "Test User Admin"

    await page.getByTestId("add-user").click()

    const dialog = page.getByRole("dialog")
    await expect(
      dialog.getByRole("heading", { name: "添加用户" }),
    ).toBeVisible()
    await expect(dialog.getByText("填写以下表单以添加新用户。")).toBeVisible()
    await expect(dialog.getByText("用户编码")).toBeVisible()
    await expect(
      dialog.getByText("用户编码必须唯一,用户将使用此编码登录。"),
    ).toBeVisible()
    await expect(dialog.getByText("姓名")).toBeVisible()
    await expect(dialog.getByText("设置密码")).toBeVisible()
    await expect(dialog.getByText("确认密码")).toBeVisible()
    await expect(dialog.getByLabel("超级管理员")).toBeVisible()
    await expect(dialog.getByLabel("启用用户")).toBeVisible()
    await expect(page.getByTestId("user-code-input")).toHaveAttribute(
      "placeholder",
      "用户编码",
    )
    await expect(page.getByTestId("user-full-name-input")).toHaveAttribute(
      "placeholder",
      "姓名",
    )
    await expect(page.getByTestId("user-password-input")).toHaveAttribute(
      "placeholder",
      "密码",
    )
    await expect(
      page.getByTestId("user-confirm-password-input"),
    ).toHaveAttribute("placeholder", "密码")
    await expect(page.getByTestId("cancel-create-user")).toHaveText("取消")
    await expect(page.getByTestId("save-user")).toHaveText("保存")

    await page.getByTestId("user-code-input").fill(userCode)
    await page.getByTestId("user-full-name-input").fill(fullName)
    await page.getByTestId("user-password-input").fill(password)
    await page.getByTestId("user-confirm-password-input").fill(password)

    await page.getByTestId("save-user").click()

    await expect(page.getByTestId("user-created-toast")).toContainText(
      "用户创建成功",
    )

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
    await expect(userRow.getByText("超级管理员")).toBeVisible()
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
    await expect(
      dialog.getByRole("heading", { name: "编辑用户" }),
    ).toBeVisible()
    await expect(dialog.getByText("在下方更新用户信息。")).toBeVisible()
    await expect(page.getByTestId("user-code-input")).toHaveValue(userCode)
    await expect(page.getByTestId("cancel-edit-user")).toHaveText("取消")
    await expect(page.getByTestId("user-full-name-input")).toHaveAttribute(
      "placeholder",
      "姓名",
    )

    await page.getByTestId("user-full-name-input").fill(updatedName)
    await page.getByTestId("save-user").click()

    await expect(page.getByTestId("user-updated-toast")).toContainText(
      "用户更新成功",
    )
    await expect(userRow.getByText(updatedName)).toBeVisible()
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
    await expect(
      dialog.getByRole("heading", { name: "删除用户" }),
    ).toBeVisible()
    await expect(dialog.getByText("与该用户关联的所有项目也将")).toBeVisible()
    await expect(dialog.getByText("永久删除。", { exact: true })).toBeVisible()
    await expect(
      dialog.getByText("确定要删除吗?此操作无法撤销。"),
    ).toBeVisible()
    await expect(page.getByTestId("cancel-delete-user")).toHaveText("取消")
    await expect(page.getByTestId("confirm-delete-user")).toHaveText("删除")
    await page.getByTestId("confirm-delete-user").click()

    await expect(page.getByTestId("user-deleted-toast")).toContainText(
      "用户删除成功",
    )

    await expect(
      page.getByRole("row").filter({ hasText: userCode }),
    ).not.toBeVisible()
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

    await expect(page.getByText("请输入用户编码")).toBeVisible()
  })

  test("User code must be at most 50 characters", async ({ page }) => {
    await page.goto("/admin")

    await page.getByTestId("add-user").click()

    await page.getByTestId("user-code-input").fill("x".repeat(51))
    await page.getByTestId("user-code-input").blur()

    await expect(page.getByText("用户编码最多 50 个字符")).toBeVisible()
  })

  test("Password is required", async ({ page }) => {
    await page.goto("/admin")

    await page.getByTestId("add-user").click()
    await page.getByTestId("user-password-input").focus()
    await page.getByTestId("user-password-input").blur()

    await expect(page.getByText("请输入密码")).toBeVisible()
  })

  test("Password confirmation is required", async ({ page }) => {
    await page.goto("/admin")

    await page.getByTestId("add-user").click()
    await page.getByTestId("user-password-input").fill(randomPassword())
    await page.getByTestId("user-confirm-password-input").focus()
    await page.getByTestId("user-confirm-password-input").blur()

    await expect(page.getByText("请确认密码")).toBeVisible()
  })

  test("Password must be at least 8 characters", async ({ page }) => {
    await page.goto("/admin")

    await page.getByTestId("add-user").click()
    await page.getByTestId("user-code-input").fill(randomUserCode())
    await page.getByTestId("user-password-input").fill("short")
    await page.getByTestId("user-confirm-password-input").fill("short")
    await page.getByTestId("save-user").click()

    await expect(page.getByText("密码长度至少 8 个字符")).toBeVisible()
  })

  test("Passwords must match", async ({ page }) => {
    await page.goto("/admin")

    await page.getByTestId("add-user").click()
    await page.getByTestId("user-code-input").fill(randomUserCode())
    await page.getByTestId("user-password-input").fill(randomPassword())
    await page.getByTestId("user-confirm-password-input").fill("different12345")
    await page.getByTestId("user-confirm-password-input").blur()

    await expect(page.getByText("两次输入的密码不一致")).toBeVisible()
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
    await expect(page.getByTestId("edit-user")).toHaveText("编辑用户")
    await expect(page.getByTestId("reset-password")).toHaveText("重置密码")
    await expect(page.getByTestId("delete-user")).toHaveText("删除用户")
    await page.getByTestId("reset-password").click()

    const dialog = page.getByRole("dialog")
    await expect(
      dialog.getByRole("heading", { name: "重置用户密码" }),
    ).toBeVisible()
    await expect(
      dialog.getByText(
        "将生成新的临时密码,用户的当前密码将失效。临时密码仅显示一次。",
      ),
    ).toBeVisible()
    await expect(dialog.getByTestId("cancel-reset-password")).toHaveText("取消")
    await expect(dialog.getByTestId("confirm-reset-password")).toHaveText(
      "重置密码",
    )
    await dialog.getByTestId("confirm-reset-password").click()

    await expect(
      dialog.getByRole("heading", { name: "密码已重置" }),
    ).toBeVisible()
    await expect(
      dialog.getByText("请立即复制临时密码。关闭此弹窗后将不再显示。"),
    ).toBeVisible()
    const tempPasswordInput = dialog.getByTestId("temporary-password-input")
    await expect(tempPasswordInput).toHaveAttribute("aria-label", "临时密码")
    await expect(tempPasswordInput).toBeVisible()
    const tempPassword = await tempPasswordInput.inputValue()
    expect(tempPassword.length).toBeGreaterThanOrEqual(16)

    await expect(dialog.getByTestId("copy-temporary-password")).toHaveText(
      "复制临时密码",
    )
    await expect(dialog.getByTestId("close-reset-password")).toHaveText("关闭")
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

    await expect(page.getByRole("heading", { name: "Users" })).not.toBeVisible()
    await expect(page).not.toHaveURL(/\/admin/)
  })

  test("Superuser can access admin page", async ({ page }) => {
    await logInUser(page, firstSuperuserCode, firstSuperuserPassword)

    await page.goto("/admin")

    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible()
  })
})
