import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Pencil } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { type FieldPath, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import { type UserPublic, UsersService } from "@/client"
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
} from "@/components/ui/dialog"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
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

interface EditUserProps {
  user: UserPublic
  onSuccess: () => void
}

const EditUser = ({ user, onSuccess }: EditUserProps) => {
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
        .min(8, { message: t("admin.form.passwordMinLength") })
        .optional()
        .or(z.literal("")),
      confirm_password: z.string().optional(),
      is_superuser: z.boolean().optional(),
      is_active: z.boolean().optional(),
    })
    .refine(
      (data) => !data.password || data.password === data.confirm_password,
      {
        message: t("admin.form.passwordsDoNotMatch"),
        path: ["confirm_password"],
      },
    )

  type FormData = z.infer<typeof formSchema>

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      user_code: user.user_code,
      full_name: user.full_name ?? undefined,
      is_superuser: user.is_superuser,
      is_active: user.is_active,
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
    mutationFn: (data: FormData) =>
      UsersService.updateUser({ path: { user_id: user.id }, body: data }),
    onSuccess: () => {
      showSuccessToast(t("admin.edit.toast"), {
        testId: "user-updated-toast",
      })
      setIsOpen(false)
      onSuccess()
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
  })

  const onSubmit = (data: FormData) => {
    // exclude confirm_password from submission data and remove password if empty
    const { confirm_password: _, ...submitData } = data
    if (!submitData.password) {
      delete submitData.password
    }
    mutation.mutate(submitData)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuItem
        data-testid="edit-user"
        onSelect={(e) => e.preventDefault()}
        onClick={() => setIsOpen(true)}
      >
        <Pencil />
        {t("admin.edit.title")}
      </DropdownMenuItem>
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>{t("admin.edit.title")}</DialogTitle>
              <DialogDescription>
                {t("admin.edit.description")}
              </DialogDescription>
            </DialogHeader>
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
                    <FormLabel>{t("admin.form.passwordLabel")}</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="user-password-input"
                        aria-label={t("admin.form.passwordLabel")}
                        placeholder={t("admin.form.passwordPlaceholder")}
                        type="password"
                        {...field}
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
                      {t("admin.form.confirmPasswordLabel")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        data-testid="user-confirm-password-input"
                        aria-label={t("admin.form.confirmPasswordLabel")}
                        placeholder={t("admin.form.passwordPlaceholder")}
                        type="password"
                        {...field}
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
                  data-testid="cancel-edit-user"
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

export default EditUser
