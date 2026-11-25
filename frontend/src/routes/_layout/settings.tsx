import { createFileRoute } from "@tanstack/react-router"
import i18next from "i18next"
import { useTranslation } from "react-i18next"

import ChangePassword from "@/components/UserSettings/ChangePassword"
import UserInformation from "@/components/UserSettings/UserInformation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import useAuth from "@/hooks/useAuth"

const tabsConfig = [
  {
    value: "my-profile",
    titleKey: "settings.tabs.profile",
    component: UserInformation,
  },
  {
    value: "password",
    titleKey: "settings.tabs.password",
    component: ChangePassword,
  },
]

export const Route = createFileRoute("/_layout/settings")({
  component: UserSettings,
  head: () => ({
    meta: [
      {
        title: i18next.t("settings.headTitle"),
      },
    ],
  }),
})

function UserSettings() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()

  if (!currentUser) {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("settings.title")}
        </h1>
        <p className="text-muted-foreground">{t("settings.description")}</p>
      </div>

      <Tabs defaultValue="my-profile">
        <TabsList>
          {tabsConfig.map((tab) => (
            <TabsTrigger
              data-testid={`settings-tab-${tab.value}`}
              key={tab.value}
              value={tab.value}
            >
              {t(tab.titleKey)}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabsConfig.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <tab.component />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
