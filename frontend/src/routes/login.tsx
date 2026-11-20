import { zodResolver } from "@hookform/resolvers/zod"
import { createFileRoute, redirect } from "@tanstack/react-router"
import type { AxiosError } from "axios"
import i18next from "i18next"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import type { Body_login_login_access_token as AccessToken } from "@/client"
import { AuthLayout } from "@/components/Common/AuthLayout"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { PasswordInput } from "@/components/ui/password-input"
import useAuth, { isLoggedIn } from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

// 过渡方案:错误码契约(Task 13)落地前,按后端 detail 文案映射字典;
// Task 13 起统一走 utils.ts::extractErrorMessage 的 code 分支,届时移除本映射。
const LOGIN_ERROR_KEYS: Record<string, string> = {
  "Incorrect user code/name or password": "login.errors.invalid",
  "Multiple users share this name, please log in with your user code":
    "login.errors.nameConflict",
  "Inactive user": "login.errors.inactive",
}

export const Route = createFileRoute("/login")({
  component: Login,
  beforeLoad: async () => {
    if (isLoggedIn()) {
      throw redirect({
        to: "/",
      })
    }
  },
  head: () => ({
    meta: [
      {
        title: i18next.t("login.headTitle"),
      },
    ],
  }),
})

function Login() {
  const { t } = useTranslation()
  const { loginMutation } = useAuth()
  const { showErrorToast } = useCustomToast()

  const formSchema = z.object({
    username: z
      .string()
      .min(1, { message: t("login.errors.identifierRequired") }),
    password: z
      .string()
      .min(1, { message: t("login.errors.passwordRequired") })
      .min(8, { message: t("login.errors.passwordMinLength") }),
  }) satisfies z.ZodType<AccessToken>

  type FormData = z.infer<typeof formSchema>

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      username: "",
      password: "",
    },
  })

  const showLoginError = (error: Error) => {
    const detail = (error as AxiosError<{ detail?: unknown }>).response?.data
      ?.detail
    const key =
      typeof detail === "string" ? LOGIN_ERROR_KEYS[detail] : undefined
    if (key) {
      showErrorToast(t(key))
    } else {
      handleError.call(showErrorToast, error)
    }
  }

  const onSubmit = (data: FormData) => {
    if (loginMutation.isPending) return
    loginMutation.mutate(data, { onError: showLoginError })
  }

  return (
    <AuthLayout>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-6"
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-2xl font-bold">{t("login.title")}</h1>
          </div>

          <div className="grid gap-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("login.identifierLabel")}</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="identifier-input"
                      placeholder={t("login.identifierPlaceholder")}
                      type="text"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("login.passwordLabel")}</FormLabel>
                  <FormControl>
                    <PasswordInput
                      data-testid="password-input"
                      placeholder={t("login.passwordPlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <LoadingButton
              type="submit"
              loading={loginMutation.isPending}
              data-testid="login-submit"
            >
              {t("login.submit")}
            </LoadingButton>
          </div>
        </form>
      </Form>
    </AuthLayout>
  )
}
