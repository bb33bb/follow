import {
  useUISettingKey,
  useUISettingSelector,
} from "@renderer/atoms/settings/ui"
import { isElectronBuild } from "@renderer/constants"
import { tipcClient } from "@renderer/lib/client"
import { cn } from "@renderer/lib/utils"
import type { FC } from "react"
import {
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type {
  BundledLanguage,
  BundledTheme,
  DynamicImportLanguageRegistration,
  DynamicImportThemeRegistration,
} from "shiki"
import { createHighlighterCore } from "shiki/core"
import { default as getWasm } from "shiki/wasm"

import { CopyButton } from "../copy-button"
import { shikiTransformers } from "./shared"
import styles from "./shiki.module.css"

const shiki = await createHighlighterCore({
  themes: [import("shiki/themes/github-dark.mjs")],
  langs: [],
  loadWasm: getWasm,
})

export interface ShikiProps {
  language: string | undefined
  code: string

  attrs?: string
  className?: string

  transparent?: boolean

  theme?: string
}

let langModule: Record<
  BundledLanguage,
  DynamicImportLanguageRegistration
> | null = null
let themeModule: Record<BundledTheme, DynamicImportThemeRegistration> | null =
  null
let bundledLanguagesKeysSet: Set<string> | null = null
export const ShikiHighLighter: FC<ShikiProps> = (props) => {
  const { code, language, className, theme: overrideTheme } = props
  const [currentLanguage, setCurrentLanguage] = useState(
    language || "plaintext",
  )

  const guessCodeLanguage = useUISettingKey("guessCodeLanguage")
  useInsertionEffect(() => {
    if (!guessCodeLanguage) return
    if (language || !isElectronBuild) return

    if (!bundledLanguagesKeysSet) {
      import("shiki/langs")
        .then(({ bundledLanguages }) => {
          langModule = bundledLanguages
          bundledLanguagesKeysSet = new Set(Object.keys(bundledLanguages))
        })
        .then(guessLanguage)
    } else {
      guessLanguage()
    }

    function guessLanguage() {
      tipcClient
        ?.detectCodeStringLanguage({ codeString: code })
        .then((result) => {
          for (const item of result) {
            if (bundledLanguagesKeysSet?.has(item.languageId)) {
              setCurrentLanguage(item.languageId)
              break
            }
          }
        })
    }
  }, [guessCodeLanguage])

  const loadThemesRef = useRef([] as string[])
  const loadLanguagesRef = useRef([] as string[])

  const [loaded, setLoaded] = useState(false)

  const codeTheme = useUISettingSelector(
    (s) => overrideTheme || s.codeHighlightTheme,
  )
  useLayoutEffect(() => {
    let isMounted = true
    setLoaded(false)

    async function loadShikiLanguage(language: string, languageModule: any) {
      if (!shiki) return
      if (!shiki.getLoadedLanguages().includes(language)) {
        await shiki.loadLanguage(await languageModule())
      }
    }
    async function loadShikiTheme(theme: string, themeModule: any) {
      if (!shiki) return
      if (!shiki.getLoadedThemes().includes(theme)) {
        await shiki.loadTheme(await themeModule())
      }
    }

    async function register() {
      if (!currentLanguage || !codeTheme) return

      const [{ bundledLanguages }, { bundledThemes }] =
        langModule && themeModule ?
            [
              {
                bundledLanguages: langModule,
              },
              { bundledThemes: themeModule },
            ] :
          await Promise.all([import("shiki/langs"), import("shiki/themes")])

      langModule = bundledLanguages
      themeModule = bundledThemes

      if (
        currentLanguage &&
        loadLanguagesRef.current.includes(currentLanguage) &&
        codeTheme &&
        loadThemesRef.current.includes(codeTheme)
      ) {
        return
      }
      return Promise.all([
        (async () => {
          if (currentLanguage) {
            const importFn = (bundledLanguages as any)[currentLanguage]
            if (!importFn) return
            await loadShikiLanguage(currentLanguage || "", importFn)
            loadLanguagesRef.current.push(currentLanguage)
          }
        })(),
        (async () => {
          if (codeTheme) {
            const importFn = (bundledThemes as any)[codeTheme]
            if (!importFn) return
            await loadShikiTheme(codeTheme || "", importFn)
            loadThemesRef.current.push(codeTheme)
          }
        })(),
      ])
    }
    register().then(() => {
      if (isMounted) {
        setLoaded(true)
      }
    })
    return () => {
      isMounted = false
    }
  }, [codeTheme, currentLanguage])

  if (!loaded) {
    return (
      <pre className={className}>
        <code>{code}</code>
      </pre>
    )
  }
  return (
    <ShikiCode {...props} language={currentLanguage} codeTheme={codeTheme} />
  )
}

const ShikiCode: FC<
  ShikiProps & {
    codeTheme: string
  }
> = ({ code, language, codeTheme, className, transparent }) => {
  const rendered = useMemo(() => {
    try {
      return shiki.codeToHtml(code, {
        lang: language!,
        themes: {
          dark: codeTheme,
          light: codeTheme,
        },
        transformers: shikiTransformers,
      })
    } catch {
      // console.error(err)
      return null
    }
  }, [code, language, codeTheme])

  if (!rendered) {
    return (
      <pre className={className}>
        <code>{code}</code>
      </pre>
    )
  }
  return (
    <div
      className={cn(
        "group relative my-4",
        styles["shiki-wrapper"],
        transparent ? styles["transparent"] : null,
        className,
      )}
    >
      <div dangerouslySetInnerHTML={{ __html: rendered }} />
      <CopyButton
        value={code}
        className="absolute right-1 top-1 opacity-0 duration-200 group-hover:opacity-100"
      />
    </div>
  )
}
