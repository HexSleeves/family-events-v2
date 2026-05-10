import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"

async function exploreHasFavoriteTargets(page: Page): Promise<boolean> {
  await page.goto("/explore")
  await expect(page.getByRole("heading", { name: /today's adventures/i })).toBeVisible()
  try {
    await page.waitForLoadState("networkidle", { timeout: 15_000 })
  } catch {
    // non-fatal; we still check DOM below
  }

  const noEvents = page.getByRole("heading", { name: "No events found" })
  if (await noEvents.isVisible()) {
    return false
  }

  const fav = page.getByRole("button", { name: /^(Add to favorites|Remove from favorites)$/ }).first()
  await expect(fav).toBeVisible({ timeout: 30_000 })
  return true
}

async function firstFavoriteButton(page: Page) {
  return page.getByRole("button", { name: /^(Add to favorites|Remove from favorites)$/ }).first()
}

async function titleOnCardForFavoriteButton(page: Page) {
  const btn = await firstFavoriteButton(page)
  const cardLink = btn.locator("xpath=ancestor::a[1]")
  const title = await cardLink.getByRole("heading", { level: 3 }).textContent()
  return title?.trim() ?? ""
}

/** Unfavorite first card until aria-label is Add (so add→remove round-trip is deterministic). */
async function ensureAddOnFirstFavorite(page: Page) {
  let b = await firstFavoriteButton(page)
  for (let i = 0; i < 5; i++) {
    const label = await b.getAttribute("aria-label")
    if (label === "Add to favorites") {
      return b
    }
    await b.click()
    await page.getByRole("button", { name: "Add to favorites" }).first().waitFor({
      state: "visible",
      timeout: 20_000,
    })
    b = page.getByRole("button", { name: "Add to favorites" }).first()
  }
  throw new Error("Could not reach Add to favorites on first card")
}

test.describe("favorite toggle (regression)", () => {
  test("explore: add then remove favorites heart", async ({ page }) => {
    const ok = await exploreHasFavoriteTargets(page)
    if (!ok) {
      test.skip()
      return
    }

    const add = await ensureAddOnFirstFavorite(page)
    await add.click()
    const remove = page.getByRole("button", { name: "Remove from favorites" }).first()
    await expect(remove).toBeVisible({ timeout: 20_000 })
    await remove.click()
    await expect(page.getByRole("button", { name: "Add to favorites" }).first()).toBeVisible({
      timeout: 20_000,
    })
  })

  test("explore: rapid double-tap does not duplicate saved item", async ({ page }) => {
    const ok = await exploreHasFavoriteTargets(page)
    if (!ok) {
      test.skip()
      return
    }

    const add = await ensureAddOnFirstFavorite(page)
    const title = await titleOnCardForFavoriteButton(page)
    expect(title.length).toBeGreaterThan(0)

    await add.dblclick()
    await expect(page.getByRole("button", { name: "Remove from favorites" }).first()).toBeVisible({
      timeout: 20_000,
    })

    await page.goto("/saved")
    await page.getByRole("tab", { name: /Saved Ideas/i }).click()
    await expect(page.getByRole("heading", { name: title, level: 3 })).toHaveCount(1, {
      timeout: 20_000,
    })

    await page.getByRole("button", { name: "Remove" }).first().click()
    await expect(page.getByText("No saved events yet")).toBeVisible({ timeout: 20_000 })
  })

  test("saved: Saved Ideas tab lists event after favoriting on explore", async ({ page }) => {
    const ok = await exploreHasFavoriteTargets(page)
    if (!ok) {
      test.skip()
      return
    }

    const add = await ensureAddOnFirstFavorite(page)
    const title = await titleOnCardForFavoriteButton(page)
    expect(title.length).toBeGreaterThan(0)

    await add.click()
    await expect(page.getByRole("button", { name: "Remove from favorites" }).first()).toBeVisible({
      timeout: 20_000,
    })

    await page.goto("/saved")
    await page.getByRole("tab", { name: /Saved Ideas/i }).click()
    await expect(page.getByRole("heading", { name: title, level: 3 })).toBeVisible({
      timeout: 20_000,
    })

    await page.getByRole("button", { name: "Remove" }).first().click()
    await expect(page.getByText("No saved events yet")).toBeVisible({ timeout: 20_000 })
  })

  test("home: hero favorite toggles when Saturday plan hero exists", async ({ page }) => {
    await page.goto("/home")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

    const topPick = page.getByText("Top plan pick")
    if ((await topPick.count()) === 0) {
      test.skip()
      return
    }

    const add = page.getByRole("button", { name: "Add to favorites" }).first()
    const remove = page.getByRole("button", { name: "Remove from favorites" }).first()

    if ((await add.count()) > 0) {
      await add.click()
      await expect(remove).toBeVisible({ timeout: 20_000 })
      await remove.click()
      await expect(add).toBeVisible({ timeout: 20_000 })
    } else {
      await remove.click()
      await expect(add).toBeVisible({ timeout: 20_000 })
      await add.click()
      await expect(remove).toBeVisible({ timeout: 20_000 })
    }
  })
})
