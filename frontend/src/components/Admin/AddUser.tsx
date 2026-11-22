import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { type FieldPath, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import { type UserCreate, UsersService } from "@/client"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

const AddUser = () => {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const { t, i18n } = useTranslation()

  const formSchema = z
    .object({
      user_code: z
        .string()
        .min(1, { message: t("admin.form.userCodeRequired") })
        .max(50, { message: t("admin.form.userCodeMaxLength") }),
      full_name: z.string().optional(),
      password: z
        .string()
        .min(1, { message: t("admin.form.passwordRequired") })
        .min(8, { message: t("admin.form.passwordMinLength") }),
      confirm_password: z
        .string()
        .min(1, { message: t("admin.form.confirmPasswordRequired") }),
      is_superuser: z.boolean(),
      is_active: z.boolean(),
    })
    .refine((data) => data.password === data.confirm_password, {
      message: t("admin.form.passwordsDoNotMatch"),
      path: ["confirm_password"],
    })

  type FormData = z.infer<typeof formSchema>

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      user_code: "",
      full_name: "",
      password: "",
      confirm_password: "",
      is_superuser: false,
      is_active: false,
    },
  })

  const language = i18n.language
  const previousLanguage = useRef(i18n.language)
  const errorFields = Object.keys(
    form.formState.errors,
  ) as FieldPath<FormData>[]

  useEffect(() => {
    if (previousLanguage.current === language) {
      return
    }
    previousLanguage.current = language
    if (errorFields.length) {
      void form.trigger(errorFields)
    }
  }, [form.trigger, language, errorFields])
  const mutation = useMutation({
    mutationFn: (data: UserCreate) => UsersService.createUser({ body: data }),
    onSuccess: () => {
      showSuccessToast(t("admin.add.toast"), {
        testId: "user-created-toast",
      })
      form.reset()
      setIsOpen(false)
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
  })

  const onSubmit = (data: FormData) => {
    mutation.mutate(data)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="my-4" data-testid="add-user">
          <Plus className="mr-2" />
          {t("admin.add.title")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("admin.add.title")}</DialogTitle>
          <DialogDescription>{t("admin.add.description")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="user_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("admin.form.userCodeLabel")}{" "}
                      <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        data-testid="user-code-input"
                        aria-label={t("admin.form.userCodeLabel")}
                        placeholder={t("admin.form.userCodePlaceholder")}
                        type="text"
                        {...field}
                        required
                      />
                    </FormControl>
                    <FormDescription>
                      {t("admin.form.userCodeDescription")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.form.fullNameLabel")}</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="user-full-name-input"
                        aria-label={t("admin.form.fullNameLabel")}
                        placeholder={t("admin.form.fullNamePlaceholder")}
                        type="text"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("admin.form.passwordLabel")}{" "}
                      <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        data-testid="user-password-input"
                        aria-label={t("admin.form.passwordLabel")}
                        placeholder={t("admin.form.passwordPlaceholder")}
                        type="password"
                        {...field}
                        required
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirm_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("admin.form.confirmPasswordLabel")}{" "}
                      <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        data-testid="user-confirm-password-input"
                        aria-label={t("admin.form.confirmPasswordLabel")}
                        placeholder={t("admin.form.passwordPlaceholder")}
                        type="password"
                        {...field}
                        required
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_superuser"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        data-testid="user-superuser-input"
                        aria-label={t("admin.form.isSuperuser")}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">
                      {t("admin.form.isSuperuser")}
                    </FormLabel>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        data-testid="user-active-input"
                        aria-label={t("admin.form.isActive")}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">
                      {t("admin.form.isActive")}
                    </FormLabel>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button
                  data-testid="cancel-create-user"
                  variant="outline"
                  disabled={mutation.isPending}
                >
                  {t("admin.form.cancel")}
                </Button>
              </DialogClose>
              <LoadingButton
                data-testid="save-user"
                type="submit"
                loading={mutation.isPending}
              >
                {t("admin.form.save")}
              </LoadingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default AddUser
