import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { type FieldPath, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import { UsersService, type UserUpdateMe } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/ui/loading-button"
import useAuth from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"
import { handleError } from "@/utils"

const UserInformation = () => {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const { t, i18n } = useTranslation()

  const formSchema = z.object({
    full_name: z
      .string()
      .max(30, { message: t("settings.profile.fullNameMaxLength") })
      .optional(),
  })

  type FormData = z.infer<typeof formSchema>

  const [editMode, setEditMode] = useState(false)
  const { user: currentUser } = useAuth()

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      full_name: currentUser?.full_name ?? undefined,
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

  const toggleEditMode = () => {
    setEditMode(!editMode)
  }

  const mutation = useMutation({
    mutationFn: (data: UserUpdateMe) =>
      UsersService.updateUserMe({ body: data }),
    onSuccess: () => {
      showSuccessToast(t("settings.profile.updatedToast"), {
        testId: "profile-updated-toast",
      })
      toggleEditMode()
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries()
    },
  })

  const onSubmit = (data: FormData) => {
    const updateData: UserUpdateMe = {}

    // only include fields that have changed
    if (data.full_name !== currentUser?.full_name) {
      updateData.full_name = data.full_name
    }

    mutation.mutate(updateData)
  }

  const onCancel = () => {
    form.reset()
    toggleEditMode()
  }

  return (
    <div className="max-w-md">
      <h3 className="text-lg font-semibold py-4">
        {t("settings.profile.title")}
      </h3>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) =>
              editMode ? (
                <FormItem>
                  <FormLabel>{t("settings.profile.fullNameLabel")}</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="profile-full-name-input"
                      type="text"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              ) : (
                <FormItem>
                  <FormLabel>{t("settings.profile.fullNameLabel")}</FormLabel>
                  <p
                    className={cn(
                      "py-2 truncate max-w-sm",
                      !field.value && "text-muted-foreground",
                    )}
                  >
                    {field.value || t("settings.profile.noFullName")}
                  </p>
                </FormItem>
              )
            }
          />

          <FormItem>
            <Label>{t("settings.profile.userCodeLabel")}</Label>
            <p className="py-2 truncate max-w-sm">{currentUser?.user_code}</p>
          </FormItem>

          <div className="flex gap-3">
            {editMode ? (
              <>
                <LoadingButton
                  data-testid="save-profile"
                  type="submit"
                  loading={mutation.isPending}
                  disabled={!form.formState.isDirty}
                >
                  {t("settings.profile.save")}
                </LoadingButton>
                <Button
                  data-testid="cancel-edit-profile"
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={mutation.isPending}
                >
                  {t("settings.profile.cancel")}
                </Button>
              </>
            ) : (
              <Button
                data-testid="edit-profile"
                type="button"
                onClick={toggleEditMode}
              >
                {t("settings.profile.edit")}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  )
}

export default UserInformation
