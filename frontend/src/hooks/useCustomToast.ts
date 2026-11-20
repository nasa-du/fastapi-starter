import { toast } from "sonner"

const useCustomToast = () => {
  const showSuccessToast = (
    description: string,
    options: { testId?: string } = {},
  ) => {
    toast.success("Success!", {
      description,
      testId: options.testId,
    })
  }

  const showErrorToast = (description: string) => {
    toast.error("Something went wrong!", {
      description,
    })
  }

  return { showSuccessToast, showErrorToast }
}

export default useCustomToast
