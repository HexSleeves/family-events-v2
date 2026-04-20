import { expect, test } from "@playwright/test"

test("dashboard renders for authenticated admin", async ({ page }) => {
  await page.goto("/home")

  await expect(page).toHaveURL(/\/home$/)
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await expect(page.getByRole("navigation").getByRole("link", { name: "Explore" })).toBeVisible()
})

test("explore renders search and filters", async ({ page }) => {
  await page.goto("/explore")

  await expect(page.getByRole("heading", { name: /today's adventures/i })).toBeVisible()
  await expect(page.getByPlaceholder("Find activities nearby...")).toBeVisible()
  await expect(page.getByRole("button", { name: "Filters", exact: true })).toBeVisible()
})

test("admin sources opens add-source controls", async ({ page }) => {
  await page.goto("/admin/sources")

  await expect(page.getByRole("heading", { name: "Event Sources" }).nth(1)).toBeVisible()
  await page.getByRole("button", { name: "Add Source" }).click()
  await expect(page.getByRole("heading", { name: "Add Event Source" })).toBeVisible()
  await expect(page.getByPlaceholder("e.g. NYC Parks Family Events")).toBeVisible()
  await expect(page.getByPlaceholder("https://...")).toBeVisible()
})
