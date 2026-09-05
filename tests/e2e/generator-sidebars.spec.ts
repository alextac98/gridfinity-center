import { expect, test } from "@playwright/test";

test("collapses label output sections without changing settings or blocking export", async ({ page }) => {
  await page.goto("/label-generator");
  const output = page.getByRole("region", { name: "Output Settings", exact: true });
  await page.getByLabel("Custom label width").fill("42");
  await page.getByLabel("Custom label width").blur();
  await page.getByLabel("Print resolution", { exact: true }).selectOption("180x180");
  await page.getByRole("spinbutton", { name: /Horizontal margin/ }).fill("1");
  await page.getByRole("spinbutton", { name: /Horizontal margin/ }).blur();
  await page.getByRole("button", { name: "Design", exact: true }).click();
  for (const name of ["Label size", "Printer", "Margins"]) {
    const toggle = output.getByRole("button", { name, exact: true });
    await toggle.focus();
    await toggle.press("Space");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    const id = await toggle.getAttribute("aria-controls");
    await expect(page.locator(`[id="${id}"]`)).toBeHidden();
  }
  const pending = page.waitForEvent("download");
  await output.getByRole("button", { name: "Download PNG" }).click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const png = Buffer.concat(chunks);
  expect(png.readUInt32BE(16)).toBe(1984);
  expect(png.readUInt32BE(20)).toBe(567);
  await page.getByRole("tab", { name: /Bin Generator/ }).click();
  await expect(page).toHaveURL(/\/bin-generator$/);
  await page.getByRole("tab", { name: /Label Generator/ }).click();
  await expect(page).toHaveURL(/\/label-generator$/);
  for (const name of ["Label size", "Printer", "Margins"]) {
    const toggle = output.getByRole("button", { name, exact: true });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
  }
  await expect(page.getByLabel("Custom label width")).toHaveValue("42");
  await expect(page.getByLabel("Print resolution", { exact: true })).toHaveValue("180x180");
  await expect(page.getByRole("spinbutton", { name: /Horizontal margin/ })).toHaveValue("1");
  await expect(page.getByRole("button", { name: "Print Preview", exact: true })).toHaveAttribute("aria-pressed", "false");
});

for (const width of [1440, 390]) {
  test(`shares sidebar dividers and usable collapsible output at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const [route, panelName, sectionName, outputName, outputSection] of [
      ["label-generator", "Label Parameters", "Details", "Output Settings", "Printer"],
      ["bin-generator", "Bin Parameters", "Compartments", "Model Output", "Preview floor"],
      ["grid-generator", "Grid Parameters", "Magnets & Screws", "Model Output", "Preview floor"],
    ]) {
      await page.goto(`/${route}`);
      const parameters = page.getByRole("region", { name: panelName, exact: true });
      const output = page.getByRole("region", { name: outputName, exact: true });
      const section = parameters.getByRole("button", { name: sectionName, exact: true });
      await expect(section).toBeVisible();
      // Bin's searchable sections have an extra wrapper; the divider must
      // still be visible between sections in every generator.
      expect(await section.evaluate((button) => {
        const section = button.parentElement!;
        return [section, section.parentElement!].some((element) => {
          const style = getComputedStyle(element);
          return style.borderTopWidth === "1px" && style.borderTopStyle === "solid";
        });
      })).toBe(true);
      const toggle = output.getByRole("button", { name: outputSection, exact: true });
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      const contentId = await toggle.getAttribute("aria-controls");
      await expect(page.locator(`[id="${contentId}"]`)).toBeHidden();
      await expect(output.getByRole("button", { name: route === "label-generator" ? "Download PNG" : "Download STL", exact: true })).toBeVisible();
      await toggle.click();
      await expect(page.locator(`[id="${contentId}"]`)).toBeVisible();
      if (route !== "label-generator") {
        await output.getByLabel("Ground plane width").fill("275");
        await toggle.click();
        await toggle.click();
        await expect(output.getByLabel("Ground plane width")).toHaveValue("275");
        await output.getByRole("button", { name: "Choose build plate preset" }).click();
        await output.getByRole("menuitemradio", { name: /Prusa XL/ }).click();
        await expect(output.getByLabel("Ground plane width")).toHaveValue("360");
      }
    }
  });
}
