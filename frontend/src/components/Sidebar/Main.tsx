import { Link as RouterLink, useRouterState } from "@tanstack/react-router"
import type { LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export type NavItemKey = "dashboard" | "items" | "admin"

export type Item = {
  icon: LucideIcon
  titleKey: NavItemKey
  path: string
}

interface MainProps {
  items: Item[]
}

export function Main({ items }: MainProps) {
  const { t } = useTranslation()
  const { isMobile, setOpenMobile } = useSidebar()
  const router = useRouterState()
  const currentPath = router.location.pathname

  const handleMenuClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = currentPath === item.path
            const title = t(`nav.${item.titleKey}`)

            return (
              <SidebarMenuItem key={item.titleKey}>
                <SidebarMenuButton tooltip={title} isActive={isActive} asChild>
                  <RouterLink to={item.path} onClick={handleMenuClick}>
                    <item.icon />
                    <span>{title}</span>
                  </RouterLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
