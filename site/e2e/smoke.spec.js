import { expect, test } from "@playwright/test";

// Loads the site with its data bundle, checks the synthesis drew waveforms without errors, and saves screenshots
// (test-results/screens/) for the milestone review.
test("loads, synthesizes and plays", async ({ page }, info) => {
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("./?lite=1");   // software WebGL: a quarter of the terrain vertices
  await page.waitForFunction(() => window.__sim && document.querySelector(".waves canvas"), null, { timeout: 90_000 });
  await expect(page.locator(".panel")).toContainText("Location");
  await page.waitForTimeout(1500);
  const dir = `test-results/screens`;
  await page.screenshot({ path: `${dir}/01_initial.png` });

  // play to ~4 s after the origin, pause
  await page.getByRole("button", { name: "Play" }).click();
  await page.waitForTimeout(4200);
  await page.getByRole("button", { name: "Pause" }).click();
  await page.screenshot({ path: `${dir}/02_playing.png` });

  // select a receiver in the record section, switch to a force-free MT tensor view in Z R T and velocity band
  const waves = page.locator(".waves");
  const box = await waves.boundingBox();
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.5);
  await page.getByRole("radio", { name: "Z R T" }).click({ force: true });
  await page.getByRole("radio", { name: "0.5–2.5 Hz" }).click({ force: true });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${dir}/03_zrt_band_selected.png` });

  // help panel
  await page.getByRole("button", { name: "?" }).click();
  await page.screenshot({ path: `${dir}/04_help.png` });
  expect(errors, errors.join("\n")).toEqual([]);
  info.annotations.push({ type: "screens", description: dir });
});

test("phone layout", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto("./?lite=1");   // software WebGL: a quarter of the terrain vertices
  await page.waitForFunction(() => window.__sim && document.querySelector(".waves canvas"), null, { timeout: 90_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "test-results/screens/05_phone.png", fullPage: true });
});
