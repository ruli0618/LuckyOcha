const { test, expect } = require('@playwright/test');

const html2canvasStub = `
  window.html2canvas = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1240;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fffdf8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  };
`;

async function stubCanvas(page) {
  await page.route('**/html2canvas@1.4.1/dist/html2canvas.min.js', route => {
    route.fulfill({ contentType: 'application/javascript', body: html2canvasStub });
  });
  await page.addInitScript(html2canvasStub);
}

async function addPrize(page, prizeLabel, member = '斉藤円香') {
  await page.locator('#addPrizeItem').selectOption({ label: prizeLabel });
  const memberSelect = page.locator('#addMember');
  if (await memberSelect.isEnabled()) {
    await memberSelect.selectOption(member);
  }
  await page.locator('#addOne').click();
}

test.beforeEach(async ({ page }) => {
  await stubCanvas(page);
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('initial state keeps collage title blank and sort waits for apply', async ({ page }) => {
  await expect(page.locator('#collageTitle')).toHaveText('');
  await expect(page.locator('#sort')).toHaveValue('prizeItemNo');
  await expect(page.locator('#applySort')).toBeVisible();

  await addPrize(page, "『また、あなたに恋焦がれているんだ』衣装着用オリジナルチェキ");
  await addPrize(page, "『ダントツで愛して』衣装着用A5アクリルプレート");

  await expect(page.locator('tbody tr').first().locator('[data-label="賞"]')).toContainText('C賞');
  await page.locator('#sort').selectOption('prizeItemNo');
  await expect(page.locator('tbody tr').first().locator('[data-label="賞"]')).toContainText('C賞');
  await page.locator('#applySort').click();
  await expect(page.locator('tbody tr').first().locator('[data-label="賞"]')).toContainText('A賞');
});

test('sharing text, title input, reset, and image preview work', async ({ page }) => {
  await addPrize(page, "『ダントツで愛して』衣装着用A5アクリルプレート");
  await page.locator('#titleInput').fill('交換まとめ');
  await expect(page.locator('#collageTitle')).toHaveText('交換まとめ');

  await expect(page.locator('#uncheckedText')).toContainText('【楽天ブックス オンラインラッキードロー】OCHA NORMA');
  await expect(page.locator('#uncheckedText')).toContainText('A賞 A5アクリルプレート 斉藤円香');

  const previewPromise = page.waitForEvent('popup');
  await page.locator('#savePng').click();
  const preview = await previewPromise;
  await expect(preview.locator('#previewImage')).toHaveAttribute('src', /^data:image\/png/);

  page.on('dialog', dialog => dialog.accept());
  await page.locator('#resetAll').click();
  await expect(page.locator('#collageTitle')).toHaveText('');
  await expect(page.locator('tbody tr')).toHaveCount(0);
});
