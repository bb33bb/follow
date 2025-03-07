import { electronApp, optimizer } from "@electron-toolkit/utils"
import { APP_PROTOCOL, DEEPLINK_SCHEME } from "@shared/constants"
import { extractElectronWindowOptions } from "@shared/electron"
import { app, BrowserWindow, session } from "electron"
import squirrelStartup from "electron-squirrel-startup"

import { env } from "../env"
import { isDev, isMacOS } from "./env"
import { initializationApp } from "./init"
import { setAuthSessionToken } from "./lib/user"
import { registerUpdater } from "./updater"
import { createMainWindow, createWindow } from "./window"

if (isDev) console.info("[main] env loaded:", env)

if (squirrelStartup) {
  app.quit()
}

function bootsharp() {
  const gotTheLock = app.requestSingleInstanceLock()

  if (!gotTheLock) {
    app.quit()

    return
  }

  let mainWindow: BrowserWindow

  initializationApp()

  app.on("second-instance", (_, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }

    const url = commandLine.pop()
    if (url) {
      handleOpen(url)
    }
  })

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId(`re.${APP_PROTOCOL}`)

    mainWindow = createMainWindow()

    registerUpdater()

    app.on("activate", () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow()
      }

      if (mainWindow) mainWindow.show()
    })

    app.on("open-url", (_, url) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
      } else {
        mainWindow = createMainWindow()
      }
      url && handleOpen(url)
    })

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on("browser-window-created", (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    // for dev debug

    if (process.env.NODE_ENV === "development") {
      import("electron-devtools-installer").then(
        ({
          default: installExtension,
          REDUX_DEVTOOLS,
          REACT_DEVELOPER_TOOLS,
        }) => {
          [REDUX_DEVTOOLS, REACT_DEVELOPER_TOOLS].forEach((extension) => {
            installExtension(extension, {
              loadExtensionOptions: { allowFileAccess: true },
            })
              .then((name) => console.info(`Added Extension:  ${name}`))
              .catch((err) => console.info("An error occurred:", err))
          })

          session.defaultSession.getAllExtensions().forEach((e) => {
            session.defaultSession.loadExtension(e.path)
          })
        },
      )
    }
  })

  const handleOpen = (url: string) => {
    const urlObj = new URL(url)

    if (urlObj.hostname === "auth" || urlObj.pathname === "//auth") {
      const token = urlObj.searchParams.get("token")

      const apiURL =
        process.env["VITE_API_URL"] || import.meta.env.VITE_API_URL
      if (token && apiURL) {
        setAuthSessionToken(token)
        mainWindow.webContents.session.cookies.set({
          url: apiURL,
          name: "authjs.session-token",
          value: token,
          secure: true,
          httpOnly: true,
          domain: new URL(apiURL).hostname,
          sameSite: "no_restriction",
        })
        mainWindow.reload()
      }
    } else {
      const options = extractElectronWindowOptions(url)

      const { height, resizable, width } = options || {}
      createWindow({
        extraPath: `#${url.replace(DEEPLINK_SCHEME, "/")}`,
        width: width ?? 800,
        height: height ?? 600,
        resizable,
      })
    }
  }

  // Quit when all windows are closed, except on  macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
  app.on("window-all-closed", () => {
    if (!isMacOS) {
      app.quit()
    }
  })

  app.on("before-quit", () => {
    const windows = BrowserWindow.getAllWindows()
    windows.forEach((window) => window.destroy())
  })
}

bootsharp()
