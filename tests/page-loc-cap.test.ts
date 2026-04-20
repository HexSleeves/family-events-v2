import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const PAGES_DIR = path.resolve(process.cwd(), "src/pages")
const MAX_PAGE_LINES = 200

function collectPageFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry: string) => {
    const absolutePath = path.join(dir, entry)
    const stats = statSync(absolutePath)

    if (stats.isDirectory()) {
      return collectPageFiles(absolutePath)
    }

    return absolutePath.endsWith(".tsx") ? [absolutePath] : []
  })
}

describe("page size budget", () => {
  it(`keeps src/pages/** at or under ${MAX_PAGE_LINES} lines`, () => {
    const oversizedPages = collectPageFiles(PAGES_DIR)
      .map((filePath) => {
        const relativePath = path.relative(process.cwd(), filePath)
        const lineCount = readFileSync(filePath, "utf8").split("\n").length
        return { relativePath, lineCount }
      })
      .filter(({ lineCount }) => lineCount > MAX_PAGE_LINES)

    expect(oversizedPages).toEqual([])
  })
})
