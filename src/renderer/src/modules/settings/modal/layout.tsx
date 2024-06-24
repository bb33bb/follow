import { Logo } from "@renderer/components/icons/logo"
import { APP_NAME } from "@renderer/lib/constants"
import { preventDefault } from "@renderer/lib/dom"
import { m } from "framer-motion"
import type { PropsWithChildren } from "react"
import { useEffect } from "react"

import { settings } from "../constants"
import { SettingsSidebarTitle } from "../title"
import { useSetSettingTab, useSettingTab } from "./context"

export function SettingModalLayout(props: PropsWithChildren) {
  const { children } = props
  const setTab = useSetSettingTab()
  const tab = useSettingTab()

  useEffect(() => {
    if (!tab) setTab(settings[0].path)
  }, [])
  return (
    <m.div
      exit={{
        opacity: 0,
        scale: 0.96,
      }}
      className="flex h-[500px] max-h-[80vh] w-[660px] max-w-full flex-col overflow-hidden rounded-xl border border-border"
      onContextMenu={preventDefault}
    >
      <div className="flex h-0 flex-1 bg-theme-tooltip-background">
        <div className="w-44 border-r px-2 py-5">
          <div className="mb-4 flex h-8 items-center gap-2 px-4 font-bold">
            <Logo className="size-6" />
            {APP_NAME}
          </div>
          {settings.map((t) => (
            <button
              key={t.path}
              className={`my-1 flex w-full items-center rounded-lg px-2.5 py-0.5 leading-loose text-theme-foreground/70 transition-colors ${
                tab === t.path ?
                  "bg-theme-item-active text-theme-foreground/90" :
                  ""
              }`}
              type="button"
              onClick={() => setTab(t.path)}
            >
              <SettingsSidebarTitle
                path={t.path}
                className="text-[0.94rem] font-medium"
              />
            </button>
          ))}
        </div>
        <div className="relative h-full flex-1 bg-theme-background p-8 pt-0">
          {children}
        </div>
      </div>
    </m.div>
  )
}