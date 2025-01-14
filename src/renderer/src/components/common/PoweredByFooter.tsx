import pkg from "@pkg"
import { cn } from "@renderer/lib/utils"

import { Logo } from "../icons/logo"

export const PoweredByFooter: Component = ({ className }) => (
  <footer className={cn("center mt-12 flex gap-2", className)}>
    Powered by
    {" "}
    <Logo className="size-5" />
    {" "}
    <a
      href={pkg.homepage}
      className="cursor-pointer font-bold text-theme-accent"
      target="_blank"
      rel="noreferrer"
    >
      {APP_NAME}
    </a>
  </footer>
)
