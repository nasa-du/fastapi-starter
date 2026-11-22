import type { ColumnDef } from "@tanstack/react-table"
import i18next from "i18next"
import { Check, Copy } from "lucide-react"
import { useTranslation } from "react-i18next"

import type { ItemPublic } from "@/client"
import type { DataTableFeatures } from "@/components/Common/DataTable"
import { Button } from "@/components/ui/button"
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard"
import { cn } from "@/lib/utils"
import { ItemActionsMenu } from "./ItemActionsMenu"

function CopyId({ id }: { id: string }) {
  const [copiedText, copy] = useCopyToClipboard()
  const isCopied = copiedText === id
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-1.5 group">
      <span className="font-mono text-xs text-muted-foreground">{id}</span>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 opacity-0 group-hover:opacity-100 transition-opacity"
        data-testid="copy-item-id"
        onClick={() => copy(id)}
      >
        {isCopied ? (
          <Check className="size-3 text-green-500" />
        ) : (
          <Copy className="size-3" />
        )}
        <span className="sr-only">{t("items.copyId")}</span>
      </Button>
    </div>
  )
}

export const columns: ColumnDef<DataTableFeatures, ItemPublic>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => <CopyId id={row.original.id} />,
  },
  {
    accessorKey: "title",
    header: () => i18next.t("items.columnTitle"),
    cell: ({ row }) => (
      <span className="font-medium">{row.original.title}</span>
    ),
  },
  {
    accessorKey: "description",
    header: () => i18next.t("items.columnDescription"),
    cell: ({ row }) => {
      const description = row.original.description
      return (
        <span
          className={cn(
            "max-w-xs truncate block text-muted-foreground",
            !description && "italic",
          )}
          data-testid={description ? undefined : "item-description-empty"}
        >
          {description || i18next.t("items.noDescription")}
        </span>
      )
    },
  },
  {
    id: "actions",
    header: () => <span className="sr-only">{i18next.t("items.actions")}</span>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <ItemActionsMenu item={row.original} />
      </div>
    ),
  },
]
