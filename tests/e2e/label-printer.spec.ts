import { expect, test, type Page } from "@playwright/test";

async function downloadPng(page: Page) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG" }).click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function expectRasterSize(page: Page, width: number, height: number) {
  await expect.poll(() => page.getByTestId("label-printer-preview").evaluate((element) => {
    const image = element as HTMLImageElement;
    return [image.naturalWidth, image.naturalHeight];
  })).toEqual([width, height]);
}

test("simulates monochrome printer dots but exports original artwork at 1200 DPI", async ({ page }) => {
  await page.goto("/label-generator");
  await expectRasterSize(page, 496, 85);
  const raster = page.getByTestId("label-printer-preview");
  const previewPanel = page.getByRole("region", { name: "Label Preview", exact: true });
  await expect(previewPanel.getByRole("group", { name: "Label preview mode" })).toBeVisible();
  await expect(previewPanel.getByTestId("preview-dpi")).toHaveText("360 × 180 DPI");
  await expect(page.getByRole("region", { name: "Output Settings", exact: true }).getByRole("button", { name: "Preview", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Label printer", { exact: true })).toHaveValue("brother-p750w");
  const preview = await raster.evaluate(async (element) => {
    const image = element as HTMLImageElement;
    const buffer = await (await fetch(image.src)).arrayBuffer();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let black = 0;
    let white = 0;
    let other = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] === 0 && pixels[i + 1] === 0 && pixels[i + 2] === 0 && pixels[i + 3] === 255) black++;
      else if (pixels[i] === 255 && pixels[i + 1] === 255 && pixels[i + 2] === 255 && pixels[i + 3] === 255) white++;
      else other++;
    }
    return { bytes: Array.from(new Uint8Array(buffer)), black, white, other, rendering: getComputedStyle(image).imageRendering };
  });
  expect(preview.black).toBeGreaterThan(500);
  expect(preview.white).toBeGreaterThan(preview.black);
  expect(preview.other).toBe(0);
  expect(preview.rendering).toBe("pixelated");
  const png = await downloadPng(page);
  expect(png.equals(Buffer.from(preview.bytes))).toBe(false);
  expect(png.readUInt32BE(16)).toBe(1654);
  expect(png.readUInt32BE(20)).toBe(567);
  const hasSmoothEdges = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] > 0 && pixels[i] < 255) return true;
    }
    return false;
  }, png.toString("base64"));
  expect(hasSmoothEdges).toBe(true);
  const densityOffset = png.indexOf(Buffer.from("pHYs"));
  expect(densityOffset).toBeGreaterThan(0);
  expect(png.readUInt32BE(densityOffset + 4)).toBe(47244);
  expect(png.readUInt32BE(densityOffset + 8)).toBe(47244);
  expect(png[densityOffset + 12]).toBe(1);

  const beforeSrc = await raster.getAttribute("src");
  const beforeWidth = (await raster.boundingBox())!.width;
  const surface = await page.getByLabel("Label preview viewport").boundingBox();
  await page.mouse.move(surface!.x + surface!.width / 2, surface!.y + surface!.height / 2);
  await page.mouse.wheel(0, -2000);
  await expect.poll(async () => (await raster.boundingBox())!.width).toBeGreaterThan(beforeWidth * 3);
  await expectRasterSize(page, 496, 85);
  await expect(raster).toHaveAttribute("src", beforeSrc!);
  expect((await downloadPng(page)).equals(png)).toBe(true);
});

test("verifies all printer modes and preserves high resolution exports", async ({ page }) => {
  await page.goto("/label-generator");
  await expectRasterSize(page, 496, 85);
  const printer = page.getByLabel("Label printer", { exact: true });
  const mode = page.getByLabel("Print resolution", { exact: true });
  const originalExport = await downloadPng(page);
  for (const [id, resolution, width, height] of [
    ["brother-p750w", "360x180", 496, 85],
    ["brother-p750w", "180x180", 248, 85],
    ["brother-p710bt", "180x180", 248, 85],
    ["brother-p710bt", "360x180", 496, 85],
    ["brother-p300bt", null, 248, 85],
    ["brother-p910bt", null, 496, 170],
    ["niimbot-d110", null, 280, 96],
  ] as const) {
    await printer.selectOption(id);
    if (resolution) await mode.selectOption(resolution);
    else await expect(mode).toHaveCount(0);
    await expectRasterSize(page, width, height);
    expect((await downloadPng(page)).equals(originalExport)).toBe(true);
  }
  await printer.selectOption("brother-p750w");
  await mode.selectOption("180x180");
  await expectRasterSize(page, 248, 85);
  await page.reload();
  await expect(mode).toHaveValue("180x180");
  await expectRasterSize(page, 248, 85);
  await mode.selectOption("360x180");
  await expectRasterSize(page, 496, 85);
  await page.reload();
  await expect(mode).toHaveValue("360x180");
  await expectRasterSize(page, 496, 85);
});

test("updates independent custom DPI, persists settings, and resets them", async ({ page }) => {
  await page.goto("/label-generator");
  await expectRasterSize(page, 496, 85);
  const printer = page.getByLabel("Label printer", { exact: true });
  const dpi = page.getByLabel("Horizontal DPI");
  const dpiY = page.getByLabel("Vertical DPI");
  const simulate = page.getByRole("button", { name: "Print Preview", exact: true });
  const originalExport = await downloadPng(page);
  await printer.selectOption("custom");
  await expect(dpi).toHaveValue("360");
  await expect(dpiY).toHaveValue("180");
  for (const [resolution, width, height] of [[72, 99, 34], [1200, 1654, 567], [300, 413, 142]]) {
    await dpi.fill(String(resolution));
    await dpi.blur();
    await dpiY.fill(String(resolution));
    await dpiY.blur();
    await expectRasterSize(page, width, height);
    expect((await downloadPng(page)).equals(originalExport)).toBe(true);
  }
  for (const input of [dpi, dpiY]) {
    for (const invalid of ["", "0", "-1", "1201", "203.5"]) {
      await input.fill(invalid);
      await input.blur();
      await expect(input).toHaveValue("300");
    }
  }
  await dpiY.fill("180");
  await dpiY.blur();
  await expectRasterSize(page, 413, 85);
  expect((await downloadPng(page)).equals(originalExport)).toBe(true);
  await page.getByLabel("Custom label width").fill("42");
  await page.getByLabel("Custom label width").blur();
  await expectRasterSize(page, 496, 85);
  const png = await downloadPng(page);
  await page.getByRole("button", { name: "Design", exact: true }).click();
  await expect(page.getByTestId("label-printer-preview")).toHaveCount(0);
  expect((await downloadPng(page)).equals(png)).toBe(true);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("gridfinity-label-generator-settings")!).showPrinterPreview)).toBe(false);
  await page.reload();
  await expect(printer).toHaveValue("custom");
  await expect(dpi).toHaveValue("300");
  await expect(dpiY).toHaveValue("180");
  await expect(simulate).toHaveAttribute("aria-pressed", "false");
  await simulate.click();
  await expectRasterSize(page, 496, 85);
  await page.getByRole("button", { name: "Reset Label" }).click();
  await expect(printer).toHaveValue("brother-p750w");
  await expect(page.getByLabel("Print resolution", { exact: true })).toHaveValue("360x180");
  await expect(simulate).toHaveAttribute("aria-pressed", "true");
  await expectRasterSize(page, 496, 85);
});

test("refreshes the printer raster after label edits and artwork visibility changes", async ({ page }) => {
  await page.goto("/label-generator");
  await expectRasterSize(page, 496, 85);
  const original = await downloadPng(page);
  const originalPreview = await page.getByTestId("label-printer-preview").getAttribute("src");
  await page.getByLabel("Additional Text").fill("Stainless steel");
  await page.getByRole("checkbox", { name: "Show QR code" }).uncheck();
  await page.getByRole("checkbox", { name: "Show secondary image" }).uncheck();
  const edited = await downloadPng(page);
  expect(edited.equals(original)).toBe(false);
  await expectRasterSize(page, 496, 85);
  const preview = await page.getByTestId("label-printer-preview").evaluate(async (element) => {
    const blob = await fetch((element as HTMLImageElement).src);
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  expect(edited.equals(Buffer.from(preview))).toBe(false);
  await expect(page.getByTestId("label-printer-preview")).not.toHaveAttribute("src", originalPreview!);
  expect(edited.readUInt32BE(16)).toBe(1654);
  expect(edited.readUInt32BE(20)).toBe(567);
  await page.getByRole("button", { name: "Design", exact: true }).click();
  expect((await downloadPng(page)).equals(edited)).toBe(true);
});

test("keeps printer controls clickable on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/label-generator");
  await expectRasterSize(page, 496, 85);
  await page.getByLabel("Print resolution", { exact: true }).selectOption("180x180");
  await expectRasterSize(page, 248, 85);
  await page.getByLabel("Label printer", { exact: true }).selectOption("custom");
  const dpi = page.getByLabel("Horizontal DPI");
  await dpi.click();
  await dpi.fill("300");
  await dpi.blur();
  const simulate = page.getByRole("button", { name: "Print Preview", exact: true });
  const design = page.getByRole("button", { name: "Design", exact: true });
  const toolbarHeight = () => page.getByRole("group", { name: "Label preview mode" }).evaluate((group) => group.parentElement!.parentElement!.getBoundingClientRect().height);
  const printToolbarHeight = await toolbarHeight();
  await design.focus();
  await design.press("Space");
  await expect(design).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("label-printer-preview")).toHaveCount(0);
  await expect(page.getByTestId("preview-dpi")).toHaveCount(0);
  expect(await toolbarHeight()).toBeCloseTo(printToolbarHeight, 1);
  await simulate.focus();
  await simulate.press("Enter");
  await expectRasterSize(page, 413, 85);
  await expect(page.getByTestId("preview-dpi")).toHaveText("300 × 180 DPI");
  const panel = await page.getByRole("region", { name: "Label Preview", exact: true }).boundingBox();
  const group = await page.getByRole("group", { name: "Label preview mode" }).boundingBox();
  expect(group!.x).toBeGreaterThanOrEqual(panel!.x);
  expect(group!.x + group!.width).toBeLessThanOrEqual(panel!.x + panel!.width);
  expect(group!.y + group!.height).toBeLessThanOrEqual((await page.getByLabel("Label preview viewport").boundingBox())!.y);
  const png = await downloadPng(page);
  expect(png.readUInt32BE(16)).toBe(1654);
  expect(png.readUInt32BE(20)).toBe(567);
});

test("keeps artwork proportions on the rectangular printer dot grid", async ({ page }) => {
  await page.goto("/label-generator");
  await expectRasterSize(page, 496, 85);
  const inspect = () => page.getByTestId("label-printer-preview").evaluate(async (element) => {
    const image = element as HTMLImageElement;
    const bytes = new Uint8Array(await (await fetch(image.src)).arrayBuffer());
    const view = new DataView(bytes.buffer);
    let density: number[] = [];
    for (let offset = 8; offset < bytes.length; offset += view.getUint32(offset) + 12) {
      if (String.fromCharCode(...bytes.slice(offset + 4, offset + 8)) === "pHYs") {
        density = [view.getUint32(offset + 8), view.getUint32(offset + 12)];
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const label = image.parentElement!;
    const rect = label.getBoundingClientRect();
    const bounds = [
      '[data-artwork-profile="top"]', '[data-artwork-profile="side"]',
      '[data-testid="label-text"]', '[data-testid="label-qr"]',
    ].map((selector) => {
      const slot = label.querySelector(selector)!.getBoundingClientRect();
      const left = Math.floor((slot.left - rect.left) / rect.width * canvas.width);
      const right = Math.ceil((slot.right - rect.left) / rect.width * canvas.width);
      const top = Math.floor((slot.top - rect.top) / rect.height * canvas.height);
      const bottom = Math.ceil((slot.bottom - rect.top) / rect.height * canvas.height);
      let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
      for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
        if (pixels[(y * canvas.width + x) * 4] === 0) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
      return [minX / canvas.width, minY / canvas.height, (maxX - minX + 1) / canvas.width, (maxY - minY + 1) / canvas.height];
    });
    return { density, bounds, ratio: rect.width / rect.height };
  });
  const high = await inspect();
  expect(high.density).toEqual([14173, 7087]);
  expect(high.ratio).toBeCloseTo(35 / 12, 2);
  // Face and QR should stay square in physical space, despite rectangular pixels.
  for (const index of [0, 3]) {
    const box = high.bounds[index];
    expect(box[2] * 35 / (box[3] * 12)).toBeCloseTo(1, 1);
  }
  await page.getByLabel("Print resolution", { exact: true }).selectOption("180x180");
  await expectRasterSize(page, 248, 85);
  const standard = await inspect();
  expect(standard.density).toEqual([7087, 7087]);
  for (let region = 0; region < high.bounds.length; region++) {
    for (let coordinate = 0; coordinate < 4; coordinate++) {
      expect(Math.abs(high.bounds[region][coordinate] - standard.bounds[region][coordinate])).toBeLessThan(0.025);
    }
  }
});

test("migrates legacy printer settings without changing custom DPI", async ({ page }) => {
  await page.goto("/label-generator");
  await expectRasterSize(page, 496, 85);
  for (const [printerId, printerDpi, width, height] of [
    ["brother-p750w", 180, 496, 85],
    ["custom", 300, 413, 142],
    ["brother-p910bt", 360, 496, 170],
  ] as const) {
    await page.evaluate(({ printerId, printerDpi }) => {
      localStorage.setItem("gridfinity-label-generator-settings", JSON.stringify({ printerId, printerDpi }));
    }, { printerId, printerDpi });
    await page.reload();
    await expectRasterSize(page, width, height);
    await expect(page.getByLabel("Label printer", { exact: true })).toHaveValue(printerId);
  }
});
