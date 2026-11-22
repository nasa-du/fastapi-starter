import { AxiosError } from "axios"
import i18next from "i18next"

function extractErrorMessage(err: Error): string {
  if (err instanceof AxiosError) {
    const errDetail = (err.response?.data as any)?.detail
    if (Array.isArray(errDetail) && errDetail.length > 0) {
      return errDetail[0].msg
    }
    if (errDetail?.code) {
      return i18next.t(`errors.${errDetail.code}`, {
        defaultValue: errDetail.message ?? "",
      })
    }
    if (typeof errDetail === "string") {
      return errDetail
    }
    return err.message
  }
  return i18next.t("error.somethingWentWrong")
}

export const handleError = function (this: (msg: string) => void, err: Error) {
  const errorMessage = extractErrorMessage(err)
  this(errorMessage)
}

export const getInitials = (name: string): string => {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
}
