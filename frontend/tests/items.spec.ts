import { expect, test } from "@playwright/test"
import { createUser } from "./utils/privateApi"
import {
  randomItemDescription,
  randomItemTitle,
  randomPassword,
  randomUserCode,
} from "./utils/random"

test.use({ locale: "zh-CN" })

test("Items page renders its main content", async ({ page }) => {
  await page.goto("/items")
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await expect(page.getByTestId("add-item")).toBeVisible()
  await expect(page.getByRole("table")).toBeVisible()
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
  const headings = page.getByRole("columnheader")
  await expect(headings).toHaveCount(4)
  const emptyDescription = page.getByTestId("item-description-empty")
  await expect(emptyDescription).toBeVisible()
  await expect(page.getByTestId("item-actions")).toBeVisible()
  const chineseHeadings = await headings.allTextContents()
  const chineseDescription = await emptyDescription.textContent()
  const copyButton = page.getByTestId("copy-item-id")
  const chineseCopyLabel = await copyButton.textContent()

  await page.getByTestId("language-button").click()
  await page.getByTestId("language-en").click()

  await expect(headings).toHaveCount(4)
  expect(await headings.allTextContents()).not.toEqual(chineseHeadings)
  await expect(emptyDescription).toBeVisible()
  expect(await emptyDescription.textContent()).not.toBe(chineseDescription)
  await expect(page.getByTestId("item-actions")).toBeVisible()
  expect(await copyButton.textContent()).not.toBe(chineseCopyLabel)
})

test("Pending Items uses localized table headings", async ({ page }) => {
  await page.route("**/api/v1/items/?**", () => {})
  await page.goto("/items")
  await expect(page.getByRole("table")).toBeVisible()
  const pendingTable = page.locator("table").filter({
    has: page.locator("[data-slot='skeleton']"),
  })
  await expect(pendingTable.getByRole("columnheader")).toHaveCount(4)
  await expect(
    pendingTable.locator("[data-slot='skeleton']").first(),
  ).toBeVisible()
})

test("Add Item button uses localized dialog controls", async ({ page }) => {
  await page.goto("/items")
  await page.getByTestId("add-item").click()

  const dialog = page.getByRole("dialog")
  await expect(
    dialog.locator("[data-slot='dialog-close']").last(),
  ).toBeVisible()
})

test("Data table localizes pagination and navigation controls", async ({
  page,
}) => {
  await page.route("**/api/v1/items/?**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: Array.from({ length: 11 }, (_, index) => ({
          id: `item-${index}`,
          title: `Item ${index}`,
          description: null,
          owner_id: "test-owner",
        })),
        count: 11,
      }),
    }),
  )
  await page.goto("/items")

  const entriesSummary = page.getByTestId("table-entries-summary")
  await expect(entriesSummary).toBeVisible()
  await expect(page.getByTestId("table-pagination")).toBeVisible()
  const chineseEntriesSummary = await entriesSummary.textContent()
  await expect(page.getByTestId("table-page-current")).toHaveText("1")
  await expect(page.getByTestId("table-page-current")).toHaveClass(
    /font-medium/,
  )
  await expect(page.getByTestId("table-page-count")).toHaveText("2")
  await expect(page.getByTestId("table-page-count")).toHaveClass(/font-medium/)
  await expect(page.getByTestId("table-total-count")).toHaveText("11")
  await expect(page.getByTestId("table-total-count")).toHaveClass(/font-medium/)
  await page.getByTestId("table-last-page").click()
  await expect(page.getByTestId("table-page-current")).toHaveText("2")
  await expect(page.getByText("Item 10", { exact: true })).toBeVisible()
  await page.getByTestId("table-previous-page").click()
  await expect(page.getByTestId("table-page-current")).toHaveText("1")
  await expect(page.getByText("Item 0", { exact: true })).toBeVisible()
  await page.getByTestId("table-next-page").click()
  await expect(page.getByTestId("table-page-current")).toHaveText("2")
  await expect(page.getByText("Item 10", { exact: true })).toBeVisible()
  await page.getByTestId("table-first-page").click()
  await expect(page.getByTestId("table-page-current")).toHaveText("1")
  await expect(page.getByText("Item 0", { exact: true })).toBeVisible()

  await page.getByTestId("language-button").click()
  await page.getByTestId("language-en").click()
  await expect(entriesSummary).toBeVisible()
  expect(await entriesSummary.textContent()).not.toBe(chineseEntriesSummary)
  await expect(page.getByTestId("table-page-current")).toHaveText("1")
  await expect(page.getByTestId("table-page-count")).toHaveText("2")
  await expect(page.getByTestId("table-first-page")).toBeDisabled()
  await expect(page.getByTestId("table-previous-page")).toBeDisabled()
  await expect(page.getByTestId("table-next-page")).toBeEnabled()
  await expect(page.getByTestId("table-last-page")).toBeEnabled()
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
    await expect(dialog.getByRole("heading")).toBeVisible()
    await expect(
      dialog.locator("[data-slot='dialog-description']"),
    ).toBeVisible()
    await expect(dialog.locator("label")).toHaveCount(2)
    await expect(page.getByTestId("item-title-input")).toHaveAttribute(
      "required",
      "",
    )
    await expect(page.getByTestId("item-description-input")).toBeEditable()
    await expect(page.getByTestId("cancel-create-item")).toBeEnabled()
    await expect(page.getByTestId("save-item")).toBeEnabled()

    await page.getByTestId("item-title-input").fill(title)
    await page.getByTestId("item-description-input").fill(description)
    await page.getByTestId("save-item").click()

    await expect(page.getByTestId("item-created-toast")).toBeVisible()
    await expect(page.getByTestId("item-created-toast")).toHaveAttribute(
      "data-type",
      "success",
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
    await expect(page.locator("[data-slot='form-message']")).toBeVisible()
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
      const itemRow = page.getByRole("row").filter({ hasText: itemTitle })
      await itemRow.getByTestId("item-actions").click()
      await page.getByTestId("edit-item").click()

      const dialog = page.getByRole("dialog")
      await expect(dialog.getByRole("heading")).toBeVisible()
      await expect(
        dialog.locator("[data-slot='dialog-description']"),
      ).toBeVisible()
      await expect(page.getByTestId("item-title-input")).toHaveValue(itemTitle)

      const updatedTitle = randomItemTitle()
      await page.getByTestId("item-title-input").fill(updatedTitle)
      await page.getByTestId("save-item").click()

      await expect(page.getByTestId("item-updated-toast")).toBeVisible()
      await expect(page.getByText(updatedTitle, { exact: true })).toBeVisible()
    })

    test("Delete an item successfully", async ({ page }) => {
      const itemRow = page.getByRole("row").filter({ hasText: itemTitle })
      await itemRow.getByTestId("item-actions").click()
      await page.getByTestId("delete-item").click()

      const dialog = page.getByRole("dialog")
      await expect(dialog.getByRole("heading")).toBeVisible()
      await expect(
        dialog.locator("[data-slot='dialog-description']"),
      ).toBeVisible()
      await expect(page.getByTestId("confirm-delete-item")).toBeEnabled()

      await page.getByTestId("confirm-delete-item").click()

      await expect(page.getByTestId("item-deleted-toast")).toBeVisible()
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

    const emptyState = page.getByTestId("items-empty-state")
    await expect(emptyState).toBeVisible()
    await expect(emptyState.getByRole("heading")).toBeVisible()
  })
})
