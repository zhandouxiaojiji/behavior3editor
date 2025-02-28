import react from "@vitejs/plugin-react";
import { rmSync } from "node:fs";
import { defineConfig } from "vite";
import electron from "vite-electron-plugin";
import { customStart, loadViteEnv } from "vite-electron-plugin/plugin";
import renderer from "vite-plugin-electron-renderer";
import pkg from "./package.json";

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  rmSync("dist-electron", { recursive: true, force: true });

  const sourcemap = true; //command === "serve" || !!process.env.VSCODE_DEBUG;

  return {
    build: {
      sourcemap: true,
    },
    plugins: [
      react(),
      electron({
        include: [
          "electron",
          "src/misc/b3type.ts",
          "src/misc/b3util.ts",
          "src/misc/path.ts",
          "src/misc/util.ts",
        ],
        transformOptions: {
          sourcemap,
        },
        plugins: [
          ...(!!process.env.VSCODE_DEBUG
            ? [
                // Will start Electron via VSCode Debug
                customStart(() =>
                  console.log(/* For `.vscode/.debug.script.mjs` */ "[startup] Electron App")
                ),
              ]
            : []),
          // Allow use `import.meta.env.VITE_SOME_KEY` in Electron-Main
          loadViteEnv(),
        ],
      }),
      // Use Node.js API in the Renderer-process
      renderer(),
    ],
    server: !!process.env.VSCODE_DEBUG
      ? (() => {
          const url = new URL(pkg.debug.env.VITE_DEV_SERVER_URL);
          return {
            host: url.hostname,
            port: +url.port,
          };
        })()
      : undefined,
    clearScreen: false,
  };
});
