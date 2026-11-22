import { useMutation } from "@tanstack/react-query"
import { Check, Copy, KeyRound } from "lucide-react"
import { useState } from "react"
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
} from "@/components/ui/dialog"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

interface ResetPasswordDialogProps {
  id: string
  onSuccess: () => void
}

const ResetPasswordDialog = ({ id, onSuccess }: ResetPasswordDialogProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [copiedText, copy] = useCopyToClipboard()
  const { showErrorToast } = useCustomToast()
  const { t } = useTranslation()

  const resetPassword = useMutation({
    mutationFn: async () =>
      (await UsersService.resetUserPassword({ path: { user_id: id } })).data,
    onError: handleError.bind(showErrorToast),
  })

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      // The temporary password is one-time viewable: never show it again
      // after the dialog closes.
      if (resetPassword.isSuccess) {
        onSuccess()
      }
      resetPassword.reset()
    }
  }

  const newPassword = resetPassword.data?.new_password
  const isCopied = copiedText === newPassword

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuItem
        data-testid="reset-password"
        onSelect={(e) => e.preventDefault()}
        onClick={() => setIsOpen(true)}
      >
        <KeyRound />
        {t("admin.resetPassword.title")}
      </DropdownMenuItem>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {newPassword
              ? t("admin.resetPassword.successTitle")
              : t("admin.resetPassword.resetTitle")}
          </DialogTitle>
          <DialogDescription>
            {newPassword
              ? t("admin.resetPassword.successDescription")
              : t("admin.resetPassword.resetDescription")}
          </DialogDescription>
        </DialogHeader>

        {newPassword && (
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={newPassword}
              className="font-mono"
              data-testid="temporary-password-input"
              aria-label={t("admin.resetPassword.temporaryPasswordLabel")}
            />
            <Button
              data-testid="copy-temporary-password"
              variant="outline"
              size="icon"
              onClick={() => copy(newPassword)}
            >
              {isCopied ? <Check className="text-green-500" /> : <Copy />}
              <span className="sr-only">
                {t("admin.resetPassword.copyTemporaryPassword")}
              </span>
            </Button>
          </div>
        )}

        <DialogFooter className="mt-4">
          {newPassword ? (
            <DialogClose asChild>
              <Button data-testid="close-reset-password" variant="outline">
                {t("admin.resetPassword.close")}
              </Button>
            </DialogClose>
          ) : (
            <>
              <DialogClose asChild>
                <Button
                  data-testid="cancel-reset-password"
                  variant="outline"
                  disabled={resetPassword.isPending}
                >
                  {t("admin.form.cancel")}
                </Button>
              </DialogClose>
              <LoadingButton
                data-testid="confirm-reset-password"
                onClick={() => resetPassword.mutate()}
                loading={resetPassword.isPending}
              >
                {t("admin.resetPassword.confirm")}
              </LoadingButton>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ResetPasswordDialog
