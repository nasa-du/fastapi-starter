import { expect, test } from "@playwright/test"
import { createUser } from "./utils/privateApi"
import {
  randomItemDescription,
  randomItemTitle,
  randomPassword,
  randomUserCode,
} from "./utils/random"

test.use({ locale: "zh-CN" })

test("Items page is accessible and shows correct title", async ({ page }) => {
  await page.goto("/items")
  await expect(page).toHaveTitle("项目 - FastAPI Template")
  await expect(page.getByRole("heading", { name: "项目" })).toBeVisible()
  await expect(page.getByText("创建和管理您的项目")).toBeVisible()
})

test("Add Item button is visible", async ({ page }) => {
  await page.goto("/items")
  await expect(page.getByTestId("add-item")).toBeVisible()
})

test("Items table localizes headings and missing descriptions", async ({
  page,
}) => {
  await page.route("**/api/v1/items/?**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: "missing-description-item",
            title: "Missing description smoke",
            description: null,
            owner_id: "test-owner",
          },
        ],
        count: 1,
      }),
    }),
  )
  await page.goto("/items")
  await expect(page.getByRole("columnheader", { name: "标题" })).toBeVisible()
  await expect(page.getByRole("columnheader", { name: "描述" })).toBeVisible()
  await expect(page.getByText("暂无描述")).toBeVisible()
  await expect(page.getByText("操作")).toBeAttached()
  await expect(page.getByTestId("copy-item-id")).toHaveText("复制 ID")

  await page.getByTestId("language-button").click()
  await page.getByTestId("language-en").click()

  await expect(page.getByRole("columnheader", { name: "Title" })).toBeVisible()
  await expect(
    page.getByRole("columnheader", { name: "Description" }),
  ).toBeVisible()
  await expect(page.getByText("No description")).toBeVisible()
  await expect(page.getByText("Actions")).toBeAttached()
  await expect(page.getByTestId("copy-item-id")).toHaveText("Copy ID")
})

test("Pending Items uses localized table headings", async ({ page }) => {
  await page.route("**/api/v1/items/?**", () => {})
  await page.goto("/items")
  await expect(page.getByRole("table")).toBeVisible()
  const pendingTable = page.locator("table").filter({
    has: page.locator("[data-slot='skeleton']"),
  })
  await expect(
    pendingTable.getByRole("columnheader", { name: "标题" }),
  ).toBeVisible()
  await expect(
    pendingTable.getByRole("columnheader", { name: "描述" }),
  ).toBeVisible()
  await expect(pendingTable.getByText("操作")).toBeAttached()
})

test.describe("Items management", () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  let userCode: string
  const password = randomPassword()

  test.beforeAll(async () => {
    userCode = randomUserCode()
    await createUser({ user_code: userCode, password })
  })

  test.beforeEach(async ({ page }) => {
    await page.goto("/login")
    await page.getByTestId("identifier-input").fill(userCode)
    await page.getByTestId("password-input").fill(password)
    await page.getByTestId("login-submit").click()
    await page.waitForURL("/")
    await page.goto("/items")
  })

  test("Create a new item successfully", async ({ page }) => {
    const title = randomItemTitle()
    const description = randomItemDescription()

    await page.getByTestId("add-item").click()
    const dialog = page.getByRole("dialog")
    await expect(
      dialog.getByRole("heading", { name: "添加项目" }),
    ).toBeVisible()
    await expect(dialog.getByText("填写信息以添加新项目。")).toBeVisible()
    await expect(dialog.getByText("标题")).toBeVisible()
    await expect(dialog.getByText("描述")).toBeVisible()
    await expect(page.getByTestId("item-title-input")).toHaveAttribute(
      "placeholder",
      "标题",
    )
    await expect(page.getByTestId("item-description-input")).toHaveAttribute(
      "placeholder",
      "描述",
    )
    await expect(page.getByTestId("cancel-create-item")).toHaveText("取消")
    await expect(page.getByTestId("save-item")).toHaveText("保存")

    await page.getByTestId("item-title-input").fill(title)
    await page.getByTestId("item-description-input").fill(description)
    await page.getByTestId("save-item").click()

    await expect(page.getByTestId("item-created-toast")).toContainText(
      "项目创建成功",
    )
    await expect(page.getByText(title, { exact: true })).toBeVisible()
  })

  test("Create item with only required fields", async ({ page }) => {
    const title = randomItemTitle()

    await page.getByTestId("add-item").click()
    await page.getByTestId("item-title-input").fill(title)
    await page.getByTestId("save-item").click()

    await expect(page.getByTestId("item-created-toast")).toBeVisible()
    await expect(page.getByText(title, { exact: true })).toBeVisible()
  })

  test("Cancel item creation", async ({ page }) => {
    await page.getByTestId("add-item").click()
    await page.getByTestId("item-title-input").fill("Test Item")
    await page.getByTestId("cancel-create-item").click()

    await expect(page.getByRole("dialog")).not.toBeVisible()
  })

  test("Title is required", async ({ page }) => {
    await page.getByTestId("add-item").click()
    await page.getByTestId("item-title-input").focus()
    await page.getByTestId("item-title-input").blur()

    await expect(page.getByTestId("item-title-input")).toHaveAttribute(
      "aria-invalid",
      "true",
    )
    await expect(page.getByText("请输入标题")).toBeVisible()
  })

  test.describe("Edit and Delete", () => {
    const itemTitle = randomItemTitle()

    test.beforeEach(async ({ page }) => {
      await page.getByTestId("add-item").click()
      await page.getByTestId("item-title-input").fill(itemTitle)
      await page.getByTestId("save-item").click()
      await expect(page.getByTestId("item-created-toast")).toBeVisible()
      await expect(page.getByRole("dialog")).not.toBeVisible()
    })

    test("Edit an item successfully", async ({ page }) => {
      await page.getByTestId("item-actions").last().click()
      await page.getByTestId("edit-item").click()

      const dialog = page.getByRole("dialog")
      await expect(
        dialog.getByRole("heading", { name: "编辑项目" }),
      ).toBeVisible()
      await expect(dialog.getByText("在下方更新项目信息。")).toBeVisible()

      const updatedTitle = randomItemTitle()
      await page.getByTestId("item-title-input").fill(updatedTitle)
      await page.getByTestId("save-item").click()

      await expect(page.getByTestId("item-updated-toast")).toContainText(
        "项目更新成功",
      )
      await expect(page.getByText(updatedTitle, { exact: true })).toBeVisible()
    })

    test("Delete an item successfully", async ({ page }) => {
      await page.getByTestId("item-actions").last().click()
      await page.getByTestId("delete-item").click()

      const dialog = page.getByRole("dialog")
      await expect(
        dialog.getByRole("heading", { name: "删除项目" }),
      ).toBeVisible()
      await expect(dialog.getByText("该项目将被永久删除")).toBeVisible()
      await expect(page.getByTestId("confirm-delete-item")).toHaveText("删除")

      await page.getByTestId("confirm-delete-item").click()

      await expect(page.getByTestId("item-deleted-toast")).toContainText(
        "项目删除成功",
      )
      await expect(page.getByText(itemTitle, { exact: true })).not.toBeVisible()
    })
  })
})

test.describe("Items empty state", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("Shows empty state message when no items exist", async ({ page }) => {
    const userCode = randomUserCode()
    const password = randomPassword()
    await createUser({ user_code: userCode, password })
    await page.goto("/login")
    await page.getByTestId("identifier-input").fill(userCode)
    await page.getByTestId("password-input").fill(password)
    await page.getByTestId("login-submit").click()
    await page.waitForURL("/")

    await page.goto("/items")

    await expect(page.getByText("您还没有任何项目")).toBeVisible()
    await expect(page.getByText("添加一个新项目开始使用")).toBeVisible()
  })
})
