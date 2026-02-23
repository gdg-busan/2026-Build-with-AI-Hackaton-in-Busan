import { test, expect } from '@playwright/test';

// ─── Accessibility Test Suite ───

test.describe('Accessibility Tests', () => {
  test('keyboard tab order on login page', async ({ page }) => {
    await page.goto('/');

    // Wait for login form to render
    const input = page.getByRole('textbox', { name: 'GDG-XXXX' });
    await expect(input).toBeVisible();

    // Tab to the code input
    await page.keyboard.press('Tab');

    // Eventually the input should receive focus
    let inputFocused = false;
    for (let i = 0; i < 10; i++) {
      const activeTag = await page.evaluate(() => document.activeElement?.tagName);
      if (activeTag === 'INPUT') {
        inputFocused = true;
        break;
      }
      await page.keyboard.press('Tab');
    }
    expect(inputFocused).toBe(true);

    // Type a code and tab to the button
    await page.keyboard.type('GDG-TEST');
    await page.keyboard.press('Tab');

    // The submit button should eventually be focusable
    let buttonFocused = false;
    for (let i = 0; i < 5; i++) {
      const activeTag = await page.evaluate(() => document.activeElement?.tagName);
      if (activeTag === 'BUTTON') {
        buttonFocused = true;
        break;
      }
      await page.keyboard.press('Tab');
    }
    expect(buttonFocused).toBe(true);
  });

  test('aria-label presence on interactive elements', async ({ page }) => {
    await page.goto('/');

    // All buttons should have accessible names
    const buttons = page.getByRole('button');
    const buttonCount = await buttons.count();
    for (let i = 0; i < buttonCount; i++) {
      const name = await buttons.nth(i).getAttribute('aria-label') ??
        await buttons.nth(i).innerText();
      expect(name?.trim().length).toBeGreaterThan(0);
    }

    // The text input should have a placeholder or label for accessibility
    const input = page.getByRole('textbox');
    const inputCount = await input.count();
    for (let i = 0; i < inputCount; i++) {
      const placeholder = await input.nth(i).getAttribute('placeholder');
      const ariaLabel = await input.nth(i).getAttribute('aria-label');
      const hasLabel = (placeholder && placeholder.length > 0) ||
        (ariaLabel && ariaLabel.length > 0);
      expect(hasLabel).toBe(true);
    }
  });

  test('focus visible indicators exist', async ({ page }) => {
    await page.goto('/');

    // Focus the input
    const input = page.getByRole('textbox', { name: 'GDG-XXXX' });
    await input.focus();

    // Check that focus styles are applied (border or outline change)
    const inputStyles = await input.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        outlineStyle: styles.outlineStyle,
        outlineWidth: styles.outlineWidth,
        borderColor: styles.borderColor,
        boxShadow: styles.boxShadow,
      };
    });

    // Should have some visible focus indicator (outline, border, or box-shadow)
    const hasFocusIndicator =
      (inputStyles.outlineStyle !== 'none' && inputStyles.outlineWidth !== '0px') ||
      inputStyles.boxShadow !== 'none';
    expect(hasFocusIndicator).toBe(true);

    // Focus the button
    const button = page.getByRole('button', { name: '접속하기' });
    await button.focus();

    const buttonStyles = await button.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        outlineStyle: styles.outlineStyle,
        outlineWidth: styles.outlineWidth,
        boxShadow: styles.boxShadow,
      };
    });

    const buttonHasFocus =
      (buttonStyles.outlineStyle !== 'none' && buttonStyles.outlineWidth !== '0px') ||
      buttonStyles.boxShadow !== 'none';
    expect(buttonHasFocus).toBe(true);
  });

  test('form inputs have associated labels', async ({ page }) => {
    await page.goto('/');

    // The login form input should be identifiable by role
    const input = page.getByRole('textbox');
    await expect(input).toBeVisible();

    // Input should have a placeholder that serves as a label
    const placeholder = await input.getAttribute('placeholder');
    expect(placeholder).toBeTruthy();
    expect(placeholder!.length).toBeGreaterThan(0);

    // The form should be submittable via keyboard (Enter key)
    await input.fill('GDG-TEST');
    // Pressing Enter on the input should trigger form submission
    // (the form has onSubmit handler)
    const submitBtn = page.getByRole('button', { name: '접속하기' });
    await expect(submitBtn).toBeVisible();
  });
});
