import { expect, test } from "@playwright/test";

// Time window slider (legend) and the station table (panel): sorting, drag to turn a run of rows off and on.
test("time window and station table", async ({ page }) => {
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("./?lite=1");
  await page.waitForFunction(() => window.__sim && document.querySelector(".waves canvas"), null, { timeout: 170_000 });
  await page.waitForTimeout(1500);
  const dir = "test-results/screens";

  // time window: the playback follows it
  await page.getByLabel("Window start").fill("1");
  await page.getByLabel("Window end").fill("6");
  await expect(page.locator(".twin .tval")).toHaveText("1.0 to 6.0 s");
  await expect(page.getByLabel("Time", { exact: true })).toHaveAttribute("max", "6");
  await page.getByLabel("Window start").fill("5.8");   // kept at least 1 s before the end
  await expect(page.locator(".twin .tval")).toHaveText("5.0 to 6.0 s");
  await page.getByLabel("Window start").fill("0");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${dir}/ctl_01_window.png` });

  // station table: open, sorted by distance; drag over the first four checkboxes turns them off
  await page.locator(".stations summary").click();
  const count = page.locator(".stations .count"), n = await page.locator(".stable tbody tr").count();
  await expect(count).toHaveText(`${n} of ${n} shown`);
  const cell = k => page.locator(".stable tbody tr").nth(k).locator("td.chk");
  const drag = async (a, b) => {
    const p = await cell(a).boundingBox(), q = await cell(b).boundingBox();
    await page.mouse.move(p.x + p.width / 2, p.y + p.height / 2); await page.mouse.down();
    await page.mouse.move(q.x + q.width / 2, q.y + q.height / 2, { steps: 6 }); await page.mouse.up();
  };
  await drag(0, 3);
  await expect(count).toHaveText(`${n - 4} of ${n} shown`);
  await expect(page.locator(".stable tbody tr.off")).toHaveCount(4);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${dir}/ctl_02_four_off.png` });

  // sort by network (the off rows follow their stations), turn the first network's rows back on with one click each
  await page.getByRole("button", { name: /^Network/ }).click();
  const nets = await page.locator(".stable tbody tr td:nth-child(3)").allTextContents();
  expect(nets).toEqual([...nets].sort());
  await expect(page.locator(".stable tbody tr.off")).toHaveCount(4);
  await page.getByRole("button", { name: /^Network/ }).click();   // descending
  expect(await page.locator(".stable tbody tr td:nth-child(3)").allTextContents()).toEqual([...nets].sort().reverse());

  // header checkbox: all on, then all off (empty record section), then all on
  await page.getByLabel("All stations").click();
  await expect(count).toHaveText(`${n} of ${n} shown`);
  await page.getByLabel("All stations").click();
  await expect(count).toHaveText(`0 of ${n} shown`);
  await page.waitForTimeout(500);
  await page.getByLabel("All stations").click();
  await expect(count).toHaveText(`${n} of ${n} shown`);

  // a single click toggles one row; the drag back over it restores it
  await cell(2).click();
  await expect(count).toHaveText(`${n - 1} of ${n} shown`);
  await drag(2, 2);
  await expect(count).toHaveText(`${n} of ${n} shown`);
  await page.screenshot({ path: `${dir}/ctl_03_sorted_network.png` });
  expect(errors, errors.join("\n")).toEqual([]);
});
