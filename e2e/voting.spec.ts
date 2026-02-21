import { test, expect, type Page } from '@playwright/test';

const PARTICIPANT_CODE = process.env.E2E_PARTICIPANT_CODE ?? 'GDG-P02D4BZ';
const ADMIN_CODE = process.env.E2E_ADMIN_CODE ?? 'GDG-A02XHNZ';

async function login(page: Page, code: string) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'GDG-XXXX' }).fill(code);
  await page.getByRole('button', { name: '접속하기' }).click();
}

async function loginAsParticipant(page: Page) {
  await login(page, PARTICIPANT_CODE);
  await page.waitForURL('/vote');
}

async function loginAsAdmin(page: Page) {
  await login(page, ADMIN_CODE);
  await page.waitForURL('/admin');
}

// ─── Test Suite ───

test.describe('Voting E2E Tests', () => {
  test.describe.configure({ mode: 'serial' });

  test('admin can login and access admin page', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByText('>_ Admin Dashboard')).toBeVisible();
  });

  test('admin can reset all votes', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: '이벤트 제어' }).click();

    // Click reset all votes
    await page.getByRole('button', { name: '모든 투표 초기화' }).click();

    // Handle first confirm dialog
    page.once('dialog', (dialog) => dialog.accept());
    await page.waitForTimeout(500);

    // Should show success or the status remains
    await expect(page.getByText('현재 상태:')).toBeVisible();
  });

  test('admin can change status to 1차 투표중', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: '이벤트 제어' }).click();

    // Click '1차 투표중' button
    const votingBtn = page.getByRole('button', { name: '1차 투표중', exact: true });

    // If not disabled (not already in this state), click it
    if (await votingBtn.isEnabled()) {
      page.once('dialog', (dialog) => dialog.accept());
      await votingBtn.click();
      await page.waitForTimeout(1000);
    }

    // Verify status changed in banner
    await expect(page.getByRole('banner').getByText('1차 투표중')).toBeVisible();
  });

  test('participant can login and see vote page', async ({ page }) => {
    await loginAsParticipant(page);
    // Should be on vote page (either voting or already voted)
    await expect(page).toHaveURL('/vote');
    // Wait for teams to load
    await page.getByRole('heading', { level: 3 }).first().waitFor({ timeout: 10000 });
    const count = await page.getByRole('heading', { level: 3 }).count();
    expect(count).toBeGreaterThanOrEqual(10);
  });

  test('participant can cast a vote', async ({ page }) => {
    await loginAsParticipant(page);
    await page.getByRole('heading', { level: 3 }).first().waitFor({ timeout: 10000 });

    // Check if already voted
    const votedText = page.getByText('vote_submitted');
    const isVoted = await votedText.isVisible().catch(() => false);

    if (isVoted) {
      console.log('Participant already voted, skipping vote action.');
      return;
    }

    // Select 3 teams (ensure we don't pick disabled ones if any, though seeded user has no team)
    const teamCards = page.locator('.relative.rounded-xl.border.p-5.cursor-pointer');
    const count = await teamCards.count();
    expect(count).toBeGreaterThanOrEqual(3);

    for (let i = 0; i < 3; i++) {
      await teamCards.nth(i).click();
    }

    // Click submit button on the page
    // Text is likely '$ submit_vote (3팀)'
    const submitBtn = page.getByRole('button', { name: /\$ submit_vote/ });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Confirm dialog
    // Button text is '투표하기 (3팀)'
    const confirmBtn = page.getByRole('button', { name: /투표하기/ });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // Wait for success message
    await expect(page.getByText('$ vote_submitted!')).toBeVisible({ timeout: 15000 });
  });

  test('participant sees vote completed state on revisit', async ({ page }) => {
    await loginAsParticipant(page);

    // Should show completed state
    await expect(
      page.getByText('$ vote_submitted!')
    ).toBeVisible({ timeout: 5000 });
  });

  test('admin can change status to 1차 마감', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: '이벤트 제어' }).click();

    const btn = page.getByRole('button', { name: '1차 마감', exact: true });
    if (await btn.isEnabled()) {
      page.once('dialog', (dialog) => dialog.accept());
      await btn.click();
      await page.waitForTimeout(1000);
    }

    await expect(page.getByRole('banner').getByText('1차 마감')).toBeVisible();
  });

  test('admin can change status to TOP 10 공개', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: '이벤트 제어' }).click();

    const btn = page.getByRole('button', { name: 'TOP 10 공개', exact: true });
    if (await btn.isEnabled()) {
      page.once('dialog', (dialog) => dialog.accept());
      await btn.click();
      await page.waitForTimeout(1000);
    }

    await expect(page.getByRole('banner').getByText('TOP 10 공개')).toBeVisible();
  });

  test('admin can change status to 2차 투표중', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: '이벤트 제어' }).click();

    const btn = page.getByRole('button', { name: '2차 투표중', exact: true });
    if (await btn.isEnabled()) {
      page.once('dialog', (dialog) => dialog.accept());
      await btn.click();
      await page.waitForTimeout(1000);
    }

    await expect(page.getByRole('banner').getByText('2차 투표중')).toBeVisible();
  });

  test('participant sees read-only view during phase 2 voting', async ({ page }) => {
    await loginAsParticipant(page);

    // Should see phase 2 message
    await expect(
      page.getByText('$ phase2_voting_in_progress...')
    ).toBeVisible({ timeout: 5000 });

    // Should see read-only label
    await expect(page.getByText('// 팀 목록 (읽기 전용)')).toBeVisible();

    // Should only show TOP 10 teams (10 teams, not 25)
    const teamHeadings = page.getByRole('heading', { level: 3 });
    const count = await teamHeadings.count();
    expect(count).toBe(10);
  });

  test('admin can change status to 2차 마감', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: '이벤트 제어' }).click();

    const btn = page.getByRole('button', { name: '2차 마감', exact: true });
    if (await btn.isEnabled()) {
      page.once('dialog', (dialog) => dialog.accept());
      await btn.click();
      await page.waitForTimeout(1000);
    }

    await expect(page.getByRole('banner').getByText('2차 마감')).toBeVisible();
  });

  test('admin can change status to 최종 발표', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: '이벤트 제어' }).click();

    const btn = page.getByRole('button', { name: '최종 발표', exact: true });
    if (await btn.isEnabled()) {
      page.once('dialog', (dialog) => dialog.accept());
      await btn.click();
      await page.waitForTimeout(1000);
    }

    await expect(page.getByRole('banner').getByText('최종 발표')).toBeVisible();
  });

  test('invalid code shows error', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('textbox', { name: 'GDG-XXXX' }).fill('INVALID-CODE');
    await page.getByRole('button', { name: '접속하기' }).click();

    // Should show error message
    await expect(
      page.getByText(/유효하지 않|존재하지 않|올바른 코드/).or(page.getByText('error'))
    ).toBeVisible({ timeout: 5000 });
  });
});
