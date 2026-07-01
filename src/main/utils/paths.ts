import { app } from 'electron'
import { join } from 'node:path'

/**
 * Returns the `resources/` directory used for bundled binaries and models.
 *
 * - **Development** (`npm run dev`): resolves to `<project-root>/resources/`,
 *   so binaries placed there work without being on the system PATH.
 * - **Packaged app**: resolves to `process.resourcesPath`, which is where
 *   electron-builder copies the `extraResources` entries.
 *
 * Use this as the base for all binary/model path resolution instead of
 * branching on `app.isPackaged` in each module.
 */
export function resolveResourcesDir (): string {
  if (app.isPackaged) {
    return process.resourcesPath
  }
  // In dev mode, electron-vite sets app.getAppPath() to the project root
  return join(app.getAppPath(), 'resources')
}
