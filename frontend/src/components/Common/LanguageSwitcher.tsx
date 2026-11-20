import { useRouter } from "@tanstack/react-router"
import { Languages } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { type AppLanguage, setAppLanguage } from "@/i18n"

// 语言自助名:不随当前语言翻译(中文界面下英文项仍显示 "English")
const LANGUAGES: { value: AppLanguage; label: string; testId: string }[] = [
  { value: "zh-CN", label: "中文", testId: "language-zh" },
  { value: "en", label: "English", testId: "language-en" },
]

// setAppLanguage 完成持久化 + <html lang> 同步 + changeLanguage(组件经
// react-i18next 订阅自动重渲染);router.invalidate() 触发 head() 重求值,
// 路由标题免硬刷新更新。
function useChangeAppLanguage() {
  const router = useRouter()
  return (language: AppLanguage) =>
    setAppLanguage(language).then(() => router.invalidate())
}

const languageItems = (onChange: (language: AppLanguage) => void) =>
  LANGUAGES.map(({ value, label, testId }) => (
    <DropdownMenuItem
      key={value}
      data-testid={testId}
      onClick={() => onChange(value)}
    >
      {label}
    </DropdownMenuItem>
  ))

export const SidebarLanguageSwitcher = () => {
  const { t } = useTranslation()
  const { isMobile } = useSidebar()
  const changeAppLanguage = useChangeAppLanguage()

  return (
    <SidebarMenuItem>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            tooltip={t("language.label")}
            data-testid="language-button"
          >
            <Languages className="size-4 text-muted-foreground" />
            <span>{t("language.label")}</span>
            <span className="sr-only">{t("language.toggleLanguage")}</span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={isMobile ? "top" : "right"}
          align="end"
          className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
        >
          {languageItems(changeAppLanguage)}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}

export const LanguageSwitcher = () => {
  const { t } = useTranslation()
  const changeAppLanguage = useChangeAppLanguage()

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button data-testid="language-button" variant="outline" size="icon">
          <Languages className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">{t("language.toggleLanguage")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languageItems(changeAppLanguage)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
