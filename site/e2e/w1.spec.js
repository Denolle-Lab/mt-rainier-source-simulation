import { expect, test } from "@playwright/test";

// Milestone W1: a reciprocity database, picking the source location on the map, moment tensors below the surface
// and forces on the surface (W3 database).
test("location picking and source kinds", async ({ page }) => {
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("./?lite=1");
  await page.waitForFunction(() => window.__sim && document.querySelector(".waves canvas"), null, { timeout: 170_000 });
  await page.waitForTimeout(1500);
  const dir = "test-results/screens";
  await page.screenshot({ path: `${dir}/w1_01_default.png` });

  // below the surface: click the map west of the summit
  const stage = await page.locator("main.stage canvas").boundingBox();
  await page.mouse.click(stage.x + stage.width * 0.32, stage.y + stage.height * 0.5);
  await expect(page.locator(".facts")).toContainText("from the click", { timeout: 60_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${dir}/w1_02_clicked_below.png` });

  // deeper level: moment tensors only
  await page.getByLabel("Elevation level").selectOption({ index: 6 });
  await page.waitForTimeout(1500);
  await expect(page.getByRole("radio", { name: "Force" })).toBeDisabled();
  await page.screenshot({ path: `${dir}/w1_03_deep.png` });

  // on the surface: moment tensor disabled, force pulse
  await page.getByRole("radio", { name: "On the surface" }).click({ force: true });
  await page.waitForTimeout(2000);
  await expect(page.getByRole("radio", { name: "Moment tensor" })).toBeDisabled();
  await page.mouse.click(stage.x + stage.width * 0.55, stage.y + stage.height * 0.42);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${dir}/w1_04_surface_force.png` });
  expect(errors, errors.join("\n")).toEqual([]);
});
