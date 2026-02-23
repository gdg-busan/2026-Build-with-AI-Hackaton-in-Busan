import { test, expect, type Page } from '@playwright/test';

const PARTICIPANT_CODE = process.env.E2E_PARTICIPANT_CODE ?? 'GDG-P02D4BZ';

async function login(page: Page, code: string) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'GDG-XXXX' }).fill(code);
  await page.getByRole('button', { name: '접속하기' }).click();
}

async function loginAsParticipant(page: Page) {
  await login(page, PARTICIPANT_CODE);
  await page.waitForURL('/vote');
}

// ─── Mobile Test Suite ───

test.describe('Mobile E2E Tests', () => {
  test('login page renders correctly on mobile viewport', async ({ page }) => {
    await page.goto('/');

    // Title should be visible
    await expect(page.getByText('GDG Busan')).toBeVisible();

    // Code input should be visible and usable
    const input = page.getByRole('textbox', { name: 'GDG-XXXX' });
    await expect(input).toBeVisible();

    // Submit button should be visible
    const submitBtn = page.getByRole('button', { name: '접속하기' });
    await expect(submitBtn).toBeVisible();

    // Login card should not overflow the viewport
    const card = page.locator('.border.border-\\[\\#00FF88\\]\\/20');
    if (await card.count() > 0) {
      const cardBox = await card.first().boundingBox();
      const viewport = page.viewportSize();
      if (cardBox && viewport) {
        expect(cardBox.x).toBeGreaterThanOrEqual(0);
        expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(viewport.width + 1);
      }
    }
  });

  test('team cards display properly on mobile without overflow', async ({ page }) => {
    await loginAsParticipant(page);
    await page.getByRole('heading', { level: 3 }).first().waitFor({ timeout: 10000 });

    const viewport = page.viewportSize();
    if (!viewport) return;

    // Check that team cards don't overflow the viewport horizontally
    const teamCards = page.locator('.grid > div');
    const count = await teamCards.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(count, 5); i++) {
      const box = await teamCards.nth(i).boundingBox();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      }
    }
  });

  test('buttons have adequate touch targets (min 44x44px)', async ({ page }) => {
    await page.goto('/');

    // Check the submit button has at least 44x44 touch target
    const submitBtn = page.getByRole('button', { name: '접속하기' });
    await expect(submitBtn).toBeVisible();
    const btnBox = await submitBtn.boundingBox();
    if (btnBox) {
      expect(btnBox.height).toBeGreaterThanOrEqual(44);
      expect(btnBox.width).toBeGreaterThanOrEqual(44);
    }
  });

  test('vote flow works on mobile viewport', async ({ page }) => {
    await loginAsParticipant(page);
    await page.getByRole('heading', { level: 3 }).first().waitFor({ timeout: 10000 });

    // Should be on the vote page
    await expect(page).toHaveURL('/vote');

    // Check if already voted
    const votedText = page.getByText('vote_submitted');
    const isVoted = await votedText.isVisible().catch(() => false);

    if (isVoted) {
      // If already voted, just verify the success state is visible
      await expect(page.getByText('$ vote_submitted!')).toBeVisible();
      return;
    }

    // Team cards should be visible and tappable
    const teamCards = page.locator('.relative.rounded-xl.border.p-5.cursor-pointer');
    const count = await teamCards.count();
    if (count >= 3) {
      // Select 3 teams
      for (let i = 0; i < 3; i++) {
        await teamCards.nth(i).click();
      }

      // Submit button should be visible
      const submitBtn = page.getByRole('button', { name: /\$ submit_vote/ });
      await expect(submitBtn).toBeEnabled();
    }
  });

  test('results page renders on mobile', async ({ page }) => {
    await loginAsParticipant(page);

    // Navigate to results page
    await page.goto('/results');

    // Page should load without errors - check for any visible content
    await page.waitForLoadState('networkidle');

    // Should have some content visible (the page may show different states)
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Page should not have horizontal overflow
    const viewport = page.viewportSize();
    if (viewport) {
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(viewport.width + 1);
    }
  });
});
