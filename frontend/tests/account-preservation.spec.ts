import { expect, test } from "@playwright/test"
import { createUser } from "./utils/privateApi.ts"
import { randomPassword, randomUserCode } from "./utils/random"
import { logInUser, logOutUser } from "./utils/user"

test.use({ locale: "zh-CN" })
test.use({ storageState: { cookies: [], origins: [] } })

test("Ordinary user logout preserves the account", async ({ page }) => {
  const deleteMeRequests: string[] = []
  page.on("request", (request) => {
    if (
      request.method() === "DELETE" &&
      /\/api\/v1\/users\/me$/.test(request.url())
    ) {
      deleteMeRequests.push(request.url())
    }
  })

  const userCode = randomUserCode()
  const password = randomPassword()
  await createUser({ user_code: userCode, password })

  await logInUser(page, userCode, password)

  await page.goto("/settings")
  await expect(page.getByTestId("settings-tab-my-profile")).toBeVisible()
  await expect(page.getByTestId("settings-tab-password")).toBeVisible()

  await logOutUser(page)
  await expect(page).toHaveURL("/login")

  expect(deleteMeRequests).toEqual([])

  await logInUser(page, userCode, password)
})
