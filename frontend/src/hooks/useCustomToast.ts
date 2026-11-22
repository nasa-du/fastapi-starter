import { useTranslation } from "react-i18next"
import { toast } from "sonner"

const useCustomToast = () => {
  const { t } = useTranslation()

  const showSuccessToast = (
    description: string,
    options: { testId?: string } = {},
  ) => {
    toast.success(t("toast.success"), {
      description,
      testId: options.testId,
    })
  }

  const showErrorToast = (description: string) => {
    toast.error(t("toast.error"), {
      description,
    })
  }

  return { showSuccessToast, showErrorToast }
}

export default useCustomToast
