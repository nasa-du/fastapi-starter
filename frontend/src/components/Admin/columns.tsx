import type { ColumnDef } from "@tanstack/react-table"
import i18next from "i18next"

import type { UserPublic } from "@/client"
import type { DataTableFeatures } from "@/components/Common/DataTable"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { UserActionsMenu } from "./UserActionsMenu"

export type UserTableData = UserPublic & {
  isCurrentUser: boolean
}

export const columns: ColumnDef<DataTableFeatures, UserTableData>[] = [
  {
    accessorKey: "full_name",
    header: () => i18next.t("admin.columnFullName"),
    cell: ({ row }) => {
      const fullName = row.original.full_name
      return (
        <div className="flex items-center gap-2">
          <span
            className={cn("font-medium", !fullName && "text-muted-foreground")}
            data-testid="user-full-name-cell"
          >
            {fullName || i18next.t("admin.noFullName")}
          </span>
          {row.original.isCurrentUser && (
            <Badge
              variant="outline"
              className="text-xs"
              data-testid="current-user-badge"
            >
              {i18next.t("admin.you")}
            </Badge>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "user_code",
    header: () => i18next.t("admin.columnUserCode"),
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.user_code}</span>
    ),
  },
  {
    accessorKey: "is_superuser",
    header: () => i18next.t("admin.columnRole"),
    cell: ({ row }) => (
      <Badge
        variant={row.original.is_superuser ? "default" : "secondary"}
        data-testid="user-role-cell"
        data-superuser={row.original.is_superuser}
      >
        {row.original.is_superuser
          ? i18next.t("admin.superuser")
          : i18next.t("admin.user")}
      </Badge>
    ),
  },
  {
    accessorKey: "is_active",
    header: () => i18next.t("admin.columnStatus"),
    cell: ({ row }) => (
      <div className="flex items-center gap-2" data-testid="user-status-cell">
        <span
          className={cn(
            "size-2 rounded-full",
            row.original.is_active ? "bg-green-500" : "bg-gray-400",
          )}
        />
        <span className={row.original.is_active ? "" : "text-muted-foreground"}>
          {row.original.is_active
            ? i18next.t("admin.active")
            : i18next.t("admin.inactive")}
        </span>
      </div>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">{i18next.t("admin.actions")}</span>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <UserActionsMenu user={row.original} />
      </div>
    ),
  },
]
