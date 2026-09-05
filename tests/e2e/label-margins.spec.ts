import { expect, test, type Page } from "@playwright/test";

const margin = (page: Page, side: string) => page.getByRole("spinbutton", { name: new RegExp(`${side} margin`, "i") });

async function setMargin(page: Page, side: string, value: string) {
  await margin(page, side).fill(value);
  await margin(page, side).blur();
}

test("applies paired margins to borderless previews and high resolution exports", async ({ page }) => {
  await page.goto("/label-generator");
  await expect(page.getByTestId("label-printer-preview")).toBeVisible();
  await expect(margin(page, "horizontal")).toHaveValue("2");
  await expect(margin(page, "vertical")).toHaveValue("1.06");
  for (const [side, value] of [["horizontal", "1"], ["vertical", "0.5"]]) {
    await setMargin(page, side, value);
    await expect(margin(page, side)).toHaveValue(value);
  }
  await expect(page.getByRole("checkbox", { name: "Use printer margins" })).not.toBeChecked();
  await expect(page.getByTestId("printable-area-size")).toContainText("33 × 11 mm");

  const layout = await page.getByTestId("label-preview-transform").evaluate((element) => {
    const label = element.firstElementChild!;
    const rect = label.getBoundingClientRect();
    const top = label.querySelector('[data-artwork-profile="top"]')!.getBoundingClientRect();
    const side = label.querySelector('[data-artwork-profile="side"]')!.getBoundingClientRect();
    const qr = label.querySelector('[data-testid="label-qr"]')!.getBoundingClientRect();
    const copy = label.querySelector('[data-testid="label-text"]')!.parentElement!.getBoundingClientRect();
    return {
      left: (top.left - rect.left) / rect.width * 35,
      right: (rect.right - qr.right) / rect.width * 35,
      top: (copy.top - rect.top) / rect.height * 12,
      bottom: (rect.bottom - side.bottom) / rect.height * 12,
      sideHeight: side.height / rect.height * 12,
      border: getComputedStyle(label, "::after").content,
    };
  });
  expect(layout.left).toBeCloseTo(1, 1);
  expect(layout.right).toBeCloseTo(1, 1);
  expect(layout.top).toBeCloseTo(0.5, 1);
  expect(layout.bottom).toBeCloseTo(0.5, 1);
  expect(layout.sideHeight).toBeCloseTo(6.6, 1);
  expect(layout.border).toBe("none");

  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG" }).click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const png = Buffer.concat(chunks);
  expect(png.readUInt32BE(16)).toBe(1654);
  expect(png.readUInt32BE(20)).toBe(567);

  // Check actual pixels outside the physical margins in both outputs, rather
  // than just comparing the two layout calculations.
  const sources = [
    `data:image/png;base64,${png.toString("base64")}`,
    (await page.getByTestId("label-printer-preview").getAttribute("src"))!,
  ];
  for (const source of sources) {
    const result = await page.evaluate(async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, image.width, image.height).data;
      let insideInk = 0;
      let outsideInk = 0;
      for (let y = 0; y < image.height; y++) {
        for (let x = 0; x < image.width; x++) {
          const index = (y * image.width + x) * 4;
          if (pixels[index] >= 250 && pixels[index + 1] >= 250 && pixels[index + 2] >= 250) continue;
          if (x < Math.floor(image.width / 35) || x >= Math.ceil(image.width * 34 / 35) ||
              y < Math.floor(image.height * 0.5 / 12) || y >= Math.ceil(image.height * 11.5 / 12)) outsideInk++;
          else insideInk++;
        }
      }
      return { insideInk, outsideInk };
    }, source);
    expect(result.insideInk).toBeGreaterThan(100);
    expect(result.outsideInk).toBe(0);
  }

  await page.reload();
  for (const [side, value] of [["horizontal", "1"], ["vertical", "0.5"]]) {
    await expect(margin(page, side)).toHaveValue(value);
  }
  await expect(page.getByRole("checkbox", { name: "Use printer margins" })).not.toBeChecked();
});

test("updates automatic margins for tape width while preserving manual calibration", async ({ page }) => {
  await page.goto("/label-generator");
  await expect(page.getByTestId("label-printer-preview")).toBeVisible();
  const height = page.getByLabel("Custom label height");
  await height.fill("24");
  await height.blur();
  await expect(margin(page, "vertical")).toHaveValue("2.97");
  await setMargin(page, "vertical", "1.5");
  await height.fill("12");
  await height.blur();
  await expect(margin(page, "vertical")).toHaveValue("1.5");
  await page.getByRole("checkbox", { name: "Use printer margins" }).check();
  await expect(margin(page, "vertical")).toHaveValue("1.06");
  await page.getByRole("button", { name: "Reset Label" }).click();
  await expect(margin(page, "horizontal")).toHaveValue("2");
  await expect(page.getByRole("checkbox", { name: "Use printer margins" })).toBeChecked();
});

test("bounds margins when labels shrink and allows zero margins", async ({ page }) => {
  await page.goto("/label-generator");
  await expect(page.getByTestId("label-printer-preview")).toBeVisible();
  await setMargin(page, "horizontal", "999");
  await setMargin(page, "vertical", "999");
  for (const [name, value] of [["Custom label width", "10"], ["Custom label height", "6"]]) {
    await page.getByLabel(name).fill(value);
    await page.getByLabel(name).blur();
  }
  const left = Number(await margin(page, "horizontal").inputValue());
  const right = Number(await margin(page, "horizontal").inputValue());
  const top = Number(await margin(page, "vertical").inputValue());
  const bottom = Number(await margin(page, "vertical").inputValue());
  expect(left + right).toBeLessThanOrEqual(9.01);
  expect(top + bottom).toBeLessThanOrEqual(5.01);
  await expect(page.getByTestId("label-printer-preview")).toBeVisible();
  for (const side of ["horizontal", "vertical"]) {
    await setMargin(page, side, "0");
    await expect(margin(page, side)).toHaveValue("0");
  }
  await expect(page.getByTestId("printable-area-size")).toContainText("10 × 6 mm");
  await setMargin(page, "horizontal", "-5");
  await expect(margin(page, "horizontal")).toHaveValue("0");
});
