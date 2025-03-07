import { callGlobalContextMethod } from "@shared/bridge"
import type { MenuItemConstructorOptions, MessageBoxOptions } from "electron"
import { dialog, Menu, ShareMenu } from "electron"

import { downloadFile } from "../lib/download"
import { getMainWindow } from "../window"
import { t } from "./_instance"

type MenuItem = ActionMenuItem | { type: "separator" }
export interface ActionMenuItem {
  type: "text"
  label: string
  enabled?: boolean

  shortcut?: string
  icon?: string
  submenu?: MenuItem[]
}
export const menuRoute = {
  showContextMenu: t.procedure
    .input<{
      items: Array<MenuItem>
    }>()
    .action(async ({ input, context }) => {
      const menu = Menu.buildFromTemplate(transformMenuItems(input.items))

      function transformMenuItems(items: MenuItem[], parentIndex?: number) {
        return items.map((item, index) => {
          if (item.type === "separator") {
            return {
              type: "separator" as const,
            }
          }
          return {
            label: item.label,
            enabled: item.enabled ?? true,
            accelerator: item.shortcut?.replace("Meta", "CmdOrCtrl"),
            click() {
              context.sender.send(
                "menu-click",
                parentIndex !== undefined ?
                  `${parentIndex}-${index}` :
                  `${index}`,
              )
            },
            submenu: item.submenu ?
              transformMenuItems(item.submenu, index) :
              undefined,
          } as MenuItemConstructorOptions
        })
      }

      menu.popup({
        callback: () => {
          context.sender.send("menu-closed")
        },
      })
    }),

  /** @deprecated */
  showConfirmDialog: t.procedure
    .input<{
      title: string
      message: string
      options?: Partial<MessageBoxOptions>
    }>()
    .action(async ({ input }) => {
      const result = await dialog.showMessageBox({
        message: input.title,
        detail: input.message,
        buttons: ["Confirm", "Cancel"],
        ...input.options,
      })
      return result.response === 0
    }),

  showShareMenu: t.procedure
    .input<string>()
    .action(async ({ input, context }) => {
      const menu = new ShareMenu({
        urls: [input],
      })

      menu.popup({
        callback: () => {
          context.sender.send("menu-closed")
        },
      })
    }),

  saveImage: t.procedure.input<string>().action(async ({ input }) => {
    const result = await dialog.showSaveDialog({
      defaultPath: input.split("/").pop(),
    })
    if (result.canceled) return

    // return result.filePath;
    await downloadFile(input, result.filePath).catch((err) => {
      const mainWindow = getMainWindow()
      if (!mainWindow) return
      callGlobalContextMethod(mainWindow, "toast.error", ["Download failed!"])
      throw err
    })

    const mainWindow = getMainWindow()
    if (!mainWindow) return
    callGlobalContextMethod(mainWindow, "toast.success", ["Download success!"])
  }),
}
