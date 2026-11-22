import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { UsersService } from "@/client"
import { Button } from "@/components/ui/button"
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
import { LoadingButton } from "@/components/ui/loading-button"
import useAuth from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

const DeleteConfirmation = () => {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const { handleSubmit } = useForm()
  const { logout } = useAuth()
  const { t } = useTranslation()

  const mutation = useMutation({
    mutationFn: () => UsersService.deleteUserMe(),
    onSuccess: () => {
      showSuccessToast(t("settings.deleteAccount.toast"), {
        testId: "account-deleted-toast",
      })
      logout()
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] })
    },
  })

  const onSubmit = async () => {
    mutation.mutate()
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          data-testid="delete-account"
          variant="destructive"
          className="mt-3"
        >
          {t("settings.deleteAccount.title")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{t("settings.deleteConfirmation.title")}</DialogTitle>
            <DialogDescription>
              {t("settings.deleteConfirmation.descriptionStart")}{" "}
              <strong>
                {t("settings.deleteConfirmation.descriptionEmphasis")}
              </strong>{" "}
              {t("settings.deleteConfirmation.descriptionEnd")}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button
                data-testid="cancel-delete-account"
                variant="outline"
                disabled={mutation.isPending}
              >
                {t("settings.deleteConfirmation.cancel")}
              </Button>
            </DialogClose>
            <LoadingButton
              data-testid="confirm-delete-account"
              variant="destructive"
              type="submit"
              loading={mutation.isPending}
            >
              {t("settings.deleteConfirmation.confirm")}
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default DeleteConfirmation
