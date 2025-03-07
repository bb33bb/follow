import { useNavigateEntry } from "@renderer/hooks/biz/useNavigateEntry"
import { useAuthQuery } from "@renderer/hooks/common"
import { FeedViewType } from "@renderer/lib/enum"
import { isBizId } from "@renderer/lib/utils"
import { useEntryContentContext } from "@renderer/modules/entry-content/hooks"
import { Queries } from "@renderer/queries"
import { useEntry } from "@renderer/store/entry"
import { useFeedByIdSelector } from "@renderer/store/feed"
import { useCallback, useMemo } from "react"

import type { LinkProps } from "../../link"
import {
  Tooltip,
  TooltipContent,
  TooltipPortal,
  TooltipTrigger,
} from "../../tooltip"
import { ensureAndRenderTimeStamp } from "../utils"

const safeUrl = (url: string, baseUrl: string) => {
  try {
    return new URL(url, baseUrl).href
  } catch {
    return url
  }
}
export const MarkdownLink = (props: LinkProps) => {
  const { view, feedId } = useEntryContentContext()

  const feedSiteUrl = useFeedByIdSelector(feedId, (feed) => feed?.siteUrl)

  const populatedFullHref = useMemo(() => {
    const { href } = props
    if (!href) return "#"

    if (href.startsWith("http")) return href
    if (href.startsWith("/") && feedSiteUrl) return safeUrl(href, feedSiteUrl)
    return href
  }, [feedSiteUrl, props])
  const entryId = isBizId(props.href) ? props.href : null
  const entry = useEntry(entryId)
  useAuthQuery(Queries.entries.byId(entryId!), {
    enabled: !!entryId && !entry,
    staleTime: 1000 * 60 * 5,
  })

  const navigate = useNavigateEntry()
  const onClick = useCallback(
    (e: React.MouseEvent) => {
      if (entryId) {
        e.preventDefault()
        navigate({
          entryId,
        })
      }
    },
    [entryId, navigate],
  )

  const parseTimeStamp = view === FeedViewType.Audios
  if (parseTimeStamp) {
    const childrenText = props.children

    if (typeof childrenText === "string") {
      const renderer = ensureAndRenderTimeStamp(childrenText)
      if (renderer) return renderer
    }
  }

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <a
          className="follow-link--underline font-semibold text-foreground no-underline"
          href={populatedFullHref}
          title={props.title}
          target="_blank"
          onClick={onClick}
        >
          {props.children}

          {typeof props.children === "string" && (
            <i className="i-mgc-arrow-right-up-cute-re size-[0.9em] translate-y-[2px] opacity-70" />
          )}
        </a>
      </TooltipTrigger>
      {!!props.href && (
        <TooltipPortal>
          <TooltipContent align="start" className="break-all" side="bottom">
            {entry?.entries.title || populatedFullHref}
          </TooltipContent>
        </TooltipPortal>
      )}
    </Tooltip>
  )
}
