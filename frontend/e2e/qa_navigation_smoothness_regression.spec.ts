import { test, expect, Page } from "@playwright/test";

// Helpers
async function clearSession(page: Page) {
    await page.addInitScript(() => {
        localStorage.clear();
        sessionStorage.clear();
    });
}

async function stubAuthFailures(page: Page) {
    await page.route("**/auth/me", route =>
        route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({ detail: "Not authenticated" }),
        })
    );
    await page.route("**/auth/refresh", route =>
        route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({ detail: "Token expired" }),
        })
    );
}

test.describe("Navigation & Interaction Smoothness QA Suite", () => {
    test.beforeEach(async ({ page }) => {
        await clearSession(page);
        await stubAuthFailures(page);
    });

    // 1. Desktop Navigation Smoothness
    test("Desktop navigation links and brand logo navigate cleanly without dead clicks", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("domcontentloaded");

        // Verify Logo Link
        const logo = page.locator("header a[href=\"/\"]").first();
        await expect(logo).toBeVisible();

        // Search link navigation
        const searchLink = page.locator("header a[href*=\"search\"], header a[href*=\"properties\"]").first();
        if (await searchLink.isVisible()) {
            await searchLink.click();
            await expect(page).toHaveURL(/.*(search|properties)/);
        }

        // Return Home via Logo
        await logo.click();
        await expect(page).toHaveURL(/.*\/$/);
    });

    // 2. Language Switch & LocalStorage Persistence
    test("Language switch updates html lang attribute and persists across page reload", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("domcontentloaded");

        const menuBtn = page.locator("button:has(svg.lucide-menu)").first();
        if (await menuBtn.isVisible()) {
            await menuBtn.click();
            await expect(page.locator("[data-testid=\"mobile-nav\"]")).toBeVisible();
        }

        const btnEn = page.locator("[data-testid=\"lang-switch-en\"]:visible").first();
        const btnFr = page.locator("[data-testid=\"lang-switch-fr\"]:visible").first();

        await expect(btnEn).toBeVisible();
        await expect(btnFr).toBeVisible();

        // Switch to French
        await btnFr.click({ force: true });
        await expect(page.locator("html")).toHaveAttribute("lang", "fr", { timeout: 5000 });

        // Reload page and check persistence
        await page.reload();
        await expect(page.locator("html")).toHaveAttribute("lang", "fr", { timeout: 5000 });
    });

    // 3. Auth Controls: Password Visibility Toggle & Validation
    test("Auth forms allow password visibility toggling and validate inputs", async ({ page }) => {
        await page.goto("/auth/login");
        await page.waitForLoadState("domcontentloaded");

        const emailInput = page.locator("input[type=\"email\"]").first();
        const passwordInput = page.locator("input[type=\"password\"]").first();

        await expect(emailInput).toBeVisible();
        await expect(passwordInput).toBeVisible();

        await emailInput.fill("qa@roomivo.eu");
        await passwordInput.fill("Secret123!");

        // Password visibility toggle
        const toggleBtn = page.locator("button[aria-label*=\"password\"], button[aria-label*=\"Password\"]").first();
        if (await toggleBtn.isVisible()) {
            await toggleBtn.click();
            const textInput = page.locator("input[type=\"text\"]").first();
            await expect(textInput).toBeVisible();
            await expect(textInput).toHaveValue("Secret123!");

            await toggleBtn.click();
            await expect(passwordInput).toBeVisible();
        }
    });

    // 4. Forgot & Reset Password Flow
    test("Forgot password form accepts email and presents user feedback", async ({ page }) => {
        await page.route("**/auth/forgot-password", route => {
            if (route.request().method() === "POST") {
                route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({ message: "Password reset link sent successfully." })
                });
            } else {
                route.continue();
            }
        });

        await page.goto("/auth/forgot-password");
        await page.waitForLoadState("domcontentloaded");

        const emailInput = page.locator("input[type=\"email\"]");
        await expect(emailInput).toBeVisible();
        await emailInput.fill("tenant-qa@roomivo.com");

        const submitBtn = page.locator("button[type=\"submit\"]").first();
        await expect(submitBtn).toBeEnabled();
        await submitBtn.click();

        const feedbackMsg = page.locator("text=/sent|instructions|email|reset|réinitialisation/i").or(page.locator("[role=\"alert\"]")).first();
        await expect(feedbackMsg).toBeVisible({ timeout: 8000 });
    });

    // 5. Protected Route Auth Modal & Role Switch
    test("Protected route redirects or renders secure auth modal smoothly", async ({ page }) => {
        await page.goto("/dashboard");

        // Auth modal or login redirect should be present
        const modalOrLogin = page.locator("text=Roomivo Secure").or(page.locator("text=Login")).or(page.locator("form")).first();
        await expect(modalOrLogin).toBeVisible({ timeout: 10000 });

        // If auth modal tab switch is present, switch to signup
        const signupTab = page.getByTestId("switch-to-signup");
        if (await signupTab.isVisible()) {
            await signupTab.click();
            const roleOption = page.locator("button:has-text(\"Tenant\"), button:has-text(\"Locataire\")").first();
            await expect(roleOption).toBeVisible({ timeout: 5000 });
        }
    });

    // 6. Mobile Viewport Drawer & Navigation
    test("Mobile viewport drawer menu toggles smoothly and redirects", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });

        await page.goto("/");
        await page.waitForLoadState("domcontentloaded");

        const menuBtn = page.locator("button:has(svg.lucide-menu)").first();
        await expect(menuBtn).toBeVisible();
        await menuBtn.click();

        const drawer = page.locator("[data-testid=\"mobile-nav\"]");
        await expect(drawer).toBeVisible({ timeout: 5000 });

        const loginLink = drawer.locator("a[href=\"/auth/login\"]").first();
        if (await loginLink.isVisible()) {
            await loginLink.click();
            await expect(page).toHaveURL(/.*\/auth\/login/);
        }
    });

    // 7. Console Health Check
    test("Standard page navigation produces no unhandled runtime console errors", async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on("console", msg => {
            if (msg.type() === "error") {
                const txt = msg.text();
                if (!txt.includes("ERR_CONNECTION_REFUSED") && !txt.includes("401 (Unauthorized)")) {
                    consoleErrors.push(txt);
                }
            }
        });
        page.on("pageerror", err => consoleErrors.push(err.message));

        await page.goto("/");
        await page.waitForLoadState("domcontentloaded");

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(300);
        await page.evaluate(() => window.scrollTo(0, 0));

        expect(consoleErrors).toEqual([]);
    });
});
