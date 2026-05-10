import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"
import { expect, test as setup } from "@playwright/test"

const authFile = "e2e/.auth/admin.json"
const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL ?? "admin@familyevents.local"
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? "Admin123!"

setup.setTimeout(120_000)

setup("authenticate local admin", async ({ page }) => {
  await mkdir(dirname(authFile), { recursive: true })

  await page.goto("/sign-in", { waitUntil: "domcontentloaded" })

  const emailField = page.getByLabel(/email/i)
  const passwordField = page.getByLabel(/password/i)
  const isLoginFormVisible = await emailField
    .waitFor({ state: "visible", timeout: 90_000 })
    .then(() => true)
    .catch(() => false)

  if (isLoginFormVisible) {
    await emailField.fill(adminEmail)
    await passwordField.fill(adminPassword)
    await page.getByRole("button", { name: "Sign In" }).click()
  } else {
    const currentUrl = page.url()
    if (!currentUrl.match(/\/home$/)) {
      throw new Error("Sign-in form not visible and not redirected to /home")
    }
  }

  await expect(page).toHaveURL(/\/home$/, { timeout: 30_000 })
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

  await page.context().storageState({ path: authFile })
})
