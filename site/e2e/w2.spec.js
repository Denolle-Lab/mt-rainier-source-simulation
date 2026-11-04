import { expect, test } from "@playwright/test";

// Milestone W2: the surface color field (motion during playback, peak map) and its cost per frame.
test("surface color field", async ({ page }) => {
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("./?lite=1");
  await page.waitForFunction(() => window.__sim && window.__field && document.querySelector(".waves canvas"), null, { timeout: 170_000 });
  await page.waitForTimeout(1500);
  const dir = "test-results/screens";

  // off by default; motion: at a time in the S waves the field is drawn
  expect(await page.evaluate(() => window.__sim.U.overA.value)).toBe(0);
  await page.getByLabel("Surface color").selectOption("motion");
  await page.getByLabel("Time", { exact: true }).fill("3.5");
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__sim.U.overA.value)).toBeGreaterThan(0);
  await page.screenshot({ path: `${dir}/w2_01_motion.png` });

  // cost of one update (interpolation + texture fill), receivers of this database
  const ms = await page.evaluate(() => {
    const { idx, k } = window.__field.W, n = idx.length / k; let nrec = 0; for (const r of idx) nrec = Math.max(nrec, r + 1);
    const v = new Float32Array(nrec).map(() => Math.random() * 2 - 1), t = performance.now();
    for (let i = 0; i < 100; i++) window.__field.motion(v);
    return { perCall: (performance.now() - t) / 100, cells: n };
  });
  console.log(`field update: ${ms.perCall.toFixed(2)} ms per call (${ms.cells} cells)`);
  expect(ms.perCall).toBeLessThan(16);

  // peak map
  await page.getByLabel("Surface color").selectOption("peak");
  await expect(page.locator(".legend")).toContainText("peak velocity");
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__sim.U.overA.value)).toBeGreaterThan(0);
  await page.screenshot({ path: `${dir}/w2_02_peak.png` });

  // off
  await page.getByLabel("Surface color").selectOption("off");
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__sim.U.overA.value)).toBe(0);
  expect(errors, errors.join("\n")).toEqual([]);
});
