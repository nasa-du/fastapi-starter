import { expect, test } from "@playwright/test"
import { createUser } from "./utils/privateApi.ts"
import { randomPassword, randomUserCode } from "./utils/random.ts"
import { logInUser } from "./utils/user.ts"

test.describe("Admin sidebar and /items after Items removal", () => {
  test.use({ locale: "zh-CN" })

  test("Admin sidebar has no Items link and /items shows Not Found", async ({
    page,
  }) => {
    await page.goto("/")

    await expect(
      page.getByRole("link", { name: "项目", exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("link", { name: "仪表盘", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "管理", exact: true }),
    ).toBeVisible()

    await page.goto("/items")

    await expect(page.getByTestId("not-found")).toBeVisible()
    await expect(page).toHaveURL("/items")
  })
})

test.describe("Regular user sidebar and /items after Items removal", () => {
  test.use({ locale: "zh-CN", storageState: { cookies: [], origins: [] } })

  test("Regular user sidebar has no Items link and /items shows Not Found", async ({
    page,
  }) => {
    const userCode = randomUserCode()
    const password = randomPassword()

    await createUser({ user_code: userCode, password })
    await logInUser(page, userCode, password)

    await expect(
      page.getByRole("link", { name: "项目", exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("link", { name: "仪表盘", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "管理", exact: true }),
    ).toHaveCount(0)

    await page.goto("/items")

    await expect(page.getByTestId("not-found")).toBeVisible()
    await expect(page).toHaveURL("/items")
  })
})
