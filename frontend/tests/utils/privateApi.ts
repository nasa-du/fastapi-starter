// Note: the `PrivateService` is only available when generating the client
// for local environments
import { PrivateService } from "../../src/client"
import { client } from "../../src/client/client.gen"

client.setConfig({
  baseURL: `${process.env.VITE_API_URL}`,
})

export const createUser = async ({
  user_code,
  password,
  full_name = "Test User",
}: {
  user_code: string
  password: string
  full_name?: string
}) => {
  const response = await PrivateService.createUser({
    body: {
      user_code,
      password,
      is_verified: true,
      full_name,
    },
  })
  return response.data
}
