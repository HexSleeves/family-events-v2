import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"
import { expect, test as setup } from "@playwright/test"

const authFile = "e2e/.auth/admin.json"
const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL ?? "admin@familyevents.local"
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? "Admin123!"

setup("authenticate local admin", async ({ page }) => {
  await mkdir(dirname(authFile), { recursive: true })

  await page.goto("/sign-in")
  await page.getByLabel("Email").fill(adminEmail)
  await page.getByLabel("Password").fill(adminPassword)
  await page.getByRole("button", { name: "Sign In" }).click()

  await expect(page).toHaveURL(/\/home$/)
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

  await page.context().storageState({ path: authFile })
})
