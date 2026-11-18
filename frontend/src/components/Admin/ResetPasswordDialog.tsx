import { useMutation } from "@tanstack/react-query"
import { Check, Copy, KeyRound } from "lucide-react"
import { useState } from "react"

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
        onSelect={(e) => e.preventDefault()}
        onClick={() => setIsOpen(true)}
      >
        <KeyRound />
        Reset Password
      </DropdownMenuItem>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {newPassword ? "Password Reset" : "Reset User Password"}
          </DialogTitle>
          <DialogDescription>
            {newPassword
              ? "Copy the temporary password now. It will not be shown again after this dialog is closed."
              : "A new temporary password will be generated and the user's current password will stop working. The temporary password is shown only once."}
          </DialogDescription>
        </DialogHeader>

        {newPassword && (
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={newPassword}
              className="font-mono"
              aria-label="Temporary password"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => copy(newPassword)}
            >
              {isCopied ? <Check className="text-green-500" /> : <Copy />}
              <span className="sr-only">Copy temporary password</span>
            </Button>
          </div>
        )}

        <DialogFooter className="mt-4">
          {newPassword ? (
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          ) : (
            <>
              <DialogClose asChild>
                <Button variant="outline" disabled={resetPassword.isPending}>
                  Cancel
                </Button>
              </DialogClose>
              <LoadingButton
                onClick={() => resetPassword.mutate()}
                loading={resetPassword.isPending}
              >
                Reset Password
              </LoadingButton>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ResetPasswordDialog
