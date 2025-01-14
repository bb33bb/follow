import { Checkbox } from "@renderer/components/ui/checkbox"
import { ShikiHighLighter } from "@renderer/components/ui/code-highlighter"
import {
  MarkdownBlockImage,
  MarkdownLink,
  MarkdownP,
} from "@renderer/components/ui/markdown/renderers"
import { Media } from "@renderer/components/ui/media"
import type { Components } from "hast-util-to-jsx-runtime"
import { toJsxRuntime } from "hast-util-to-jsx-runtime"
import { createElement } from "react"
import { Fragment, jsx, jsxs } from "react/jsx-runtime"
import { renderToString } from "react-dom/server"
import rehypeInferDescriptionMeta from "rehype-infer-description-meta"
import rehypeParse from "rehype-parse"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import rehypeStringify from "rehype-stringify"
import { unified } from "unified"
import { VFile } from "vfile"

export const parseHtml = async (
  content: string,
  options?: {
    renderInlineStyle: boolean
  },
) => {
  const file = new VFile(content)
  const { renderInlineStyle = false } = options || {}

  const pipeline = unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeSanitize, {
      ...defaultSchema,
      tagNames: renderInlineStyle ?
        defaultSchema.tagNames :
          [...defaultSchema.tagNames!, "video"],
      attributes: {
        ...defaultSchema.attributes,

        "*": renderInlineStyle ?
            [...defaultSchema.attributes!["*"], "style"] :
          defaultSchema.attributes!["*"],

        "video": ["src", "poster"],
      },
    })

    .use(rehypeInferDescriptionMeta)
    .use(rehypeStringify)

  const tree = pipeline.parse(content)

  const hastTree = pipeline.runSync(tree, file)

  return {
    content: toJsxRuntime(hastTree, {
      Fragment,
      ignoreInvalidStyle: true,
      jsx: (type, props, key) => jsx(type as any, props, key),
      jsxs: (type, props, key) => jsxs(type as any, props, key),
      passNode: true,
      components: {
        a: ({ node, ...props }) =>
          createElement(MarkdownLink, { ...props } as any),
        img: Img,
        video: ({ node, ...props }) =>
          createElement(Media, { ...props, popper: true, type: "video" }),
        p: ({ node, ...props }) => {
          if (node?.children && node.children.length !== 1) {
            for (const item of node.children) {
              item.type === "element" &&
              item.tagName === "img" &&
              ((item.properties as any).inline = true)
            }
          }
          return createElement(MarkdownP, props, props.children)
        },
        hr: ({ node, ...props }) =>
          createElement("hr", {
            ...props,
            className: tw`scale-x-50`,
          }),
        input: ({ node, ...props }) => {
          if (props.type === "checkbox") {
            return createElement(Checkbox, {
              ...props,
              disabled: false,
              className: tw`pointer-events-none mr-2`,
            })
          }
          return createElement("input", props)
        },
        pre: ({ node, ...props }) => {
          if (!props.children) return null

          let language = ""
          let codeString = null as string | null
          if (props.className?.includes("language-")) {
            language = props.className.replace("language-", "")
          }

          if (typeof props.children !== "object") {
            codeString = props.children.toString()
          } else {
            if (
              "type" in props.children &&
              props.children.type === "code" &&
              props.children.props.className?.includes("language-")
            ) {
              language = props.children.props.className.replace(
                "language-",
                "",
              )
            }
            const code =
              "props" in props.children && props.children.props.children
            if (!code) return null

            codeString = extractCodeFromHtml(renderToString(code))
          }

          if (!codeString) return null

          return createElement(ShikiHighLighter, {
            code: codeString.trimEnd(),
            language: language.toLowerCase(),
          })
        },
        table: ({ node, ...props }) =>
          createElement(
            "div",
            {
              className: "w-full overflow-x-auto",
            },

            createElement("table", {
              ...props,
              className: tw`w-full my-0`,
            }),
          ),
      },
    }),
  }
}

const Img: Components["img"] = ({ node, ...props }) => {
  const nextProps = {
    ...props,
    proxy: { height: 0, width: 700 },
  }
  if (node?.properties.inline) {
    return createElement(Media, {
      type: "photo",
      ...nextProps,

      mediaContainerClassName: tw`max-w-full inline size-auto`,
      popper: true,
      className: tw`inline`,
      showFallback: true,
    })
  }

  return createElement(MarkdownBlockImage, nextProps)
}

function extractCodeFromHtml(htmlString: string) {
  const tempDiv = document.createElement("div")
  tempDiv.innerHTML = htmlString

  // 1. line break via <div />
  const divElements = tempDiv.querySelectorAll("div")

  let code = ""

  if (divElements.length > 0) {
    divElements.forEach((div) => {
      code += `${div.textContent}\n`
    })
    return code
  }

  // 2. line wrapper like <span><span>...</span></span>
  const spanElements = tempDiv.querySelectorAll("span > span")

  // 2.1 outside <span /> as a line break?

  let spanAsLineBreak = false

  if (tempDiv.children.length > 2) {
    for (const node of tempDiv.children) {
      const span = node as HTMLSpanElement
      // 2.2 If the span has only one child and it's a line break, then span can be as a line break
      spanAsLineBreak =
        span.children.length === 1 &&
        span.childNodes.item(0).textContent === "\n"
      if (spanAsLineBreak) break
    }
  }
  if (spanElements.length > 0) {
    for (const node of tempDiv.children) {
      if (spanAsLineBreak) {
        code += `${node.textContent}`
      } else {
        code += `${node.textContent}\n`
      }
    }

    return code
  }

  return tempDiv.textContent
}
