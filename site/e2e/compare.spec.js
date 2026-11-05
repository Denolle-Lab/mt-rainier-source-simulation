import { expect, test } from "@playwright/test";

// GF comparison: two velocity models at one source point, waveforms overlaid, velocity sections below ground.
test("GF comparison", async ({ page }) => {
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("./?lite=1");
  await page.waitForFunction(() => window.__sim && document.querySelector(".waves canvas"), null, { timeout: 170_000 });
  await page.getByLabel("Database").selectOption("compare_62134192_v1");
  await expect(page.locator(".legend")).toContainText("B:", { timeout: 60_000 });
  await expect(page.getByLabel("Velocity model A")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Force" })).toBeDisabled();
  await page.waitForFunction(() => window.__vol, null, { timeout: 60_000 });
  const dir = "test-results/screens";
  await page.screenshot({ path: `${dir}/comp_01_waveforms.png` });

  // velocity of model A on the section where the terrain is cut
  const shown = page.getByRole("radiogroup", { name: "Velocity model shown" });
  await shown.getByRole("radio", { name: "A", exact: true }).click();
  await page.waitForFunction(() => window.__vol.section.visible && window.__sim.U.clipOn.value === 1, null, { timeout: 60_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${dir}/comp_02_section_A.png` });

  // difference A / B - 1 and a depth slice
  await shown.getByRole("radio", { name: "A / B − 1" }).click();
  await page.getByLabel("Depth slice").check();
  await page.waitForFunction(() => window.__vol.U.uDiff.value === 1 && window.__vol.slice.visible, null, { timeout: 60_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${dir}/comp_03_diff_slice.png` });

  // a receiver: both models in the detail panel
  const box = await page.locator(".waves").boundingBox();
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.5);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/comp_04_selected.png` });

  // off: no section, terrain whole again
  await shown.getByRole("radio", { name: "Off" }).click();
  await page.waitForFunction(() => !window.__vol.section.visible && window.__sim.U.clipOn.value === 0);
  expect(errors, errors.join("\n")).toEqual([]);
});
