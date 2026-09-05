import { expect, test } from "@playwright/test";

for (const drive of ["Hex socket", "Phillips"]) {
  test(`keeps the ${drive} face consistent between button and countersunk heads`, async ({ page }) => {
    await page.goto("/label-generator");
    await expect(page.getByTestId("label-qr")).toBeVisible();
    const preview = page.getByTestId("label-preview-transform");
    const face = preview.locator('[data-artwork-profile="top"]');
    const side = preview.locator('[data-artwork-profile="side"]');
    await page.getByRole("button", { name: "Fastener Style" }).click();
    await page.getByRole("button", { name: "Head: Button / round" }).click();
    await page.getByRole("button", { name: `Drive: ${drive}` }).click();
    await expect(side).toHaveAttribute("data-artwork-id", "button");
    const buttonFace = await face.screenshot();
    const buttonSide = await side.locator("svg").innerHTML();

    await page.getByRole("button", { name: "Head: Countersunk" }).click();
    await expect(side).toHaveAttribute("data-artwork-id", "countersunk");
    expect((await face.screenshot()).equals(buttonFace)).toBe(true);
    expect(await side.locator("svg").innerHTML()).not.toBe(buttonSide);
  });
}

test("centers text and grows or shrinks it to fit the available space", async ({ page }) => {
  await page.goto("/label-generator");
  await expect(page.getByTestId("label-qr")).toBeVisible();
  await page.getByRole("button", { name: "Item Type" }).click();
  await page.getByRole("option", { name: /Custom/ }).click();
  const itemName = page.getByLabel("Item Name");
  const textArea = page.getByTestId("label-text");
  const primary = textArea.locator("strong");
  const fontSize = () => primary.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  const fitsAndCenters = () => textArea.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const lines = [...element.querySelectorAll("strong, span")];
    const rects = lines.map((line) => line.getBoundingClientRect());
    return lines.every((line) => {
      const range = document.createRange();
      range.selectNodeContents(line);
      const text = range.getBoundingClientRect();
      return text.left >= box.left - 1 && text.right <= box.right + 1 &&
        text.top >= box.top - 1 && text.bottom <= box.bottom + 1 &&
        Math.abs((text.left + text.right) / 2 - (box.left + box.right) / 2) < 1;
    }) && Math.abs(
      (Math.min(...rects.map((rect) => rect.top)) + Math.max(...rects.map((rect) => rect.bottom))) / 2 -
      (box.top + box.bottom) / 2,
    ) < 1;
  });

  await itemName.fill("M3");
  await expect.poll(fitsAndCenters).toBe(true);
  const shortSize = await fontSize();
  expect(shortSize).toBeGreaterThan((await textArea.boundingBox())!.height * 0.75);

  await itemName.fill("M3 x 20 stainless steel socket cap screws");
  await expect.poll(fontSize).toBeLessThan(shortSize / 2);
  await expect.poll(fitsAndCenters).toBe(true);

  await itemName.fill("M3");
  await expect.poll(fontSize).toBeCloseTo(shortSize, 1);
  await page.getByLabel("Additional Text").fill("Stainless steel / drawer 12");
  await expect(textArea.locator("span")).toHaveText("Stainless steel / drawer 12");
  await expect.poll(fitsAndCenters).toBe(true);
  await expect.poll(fontSize).toBeLessThan(shortSize);

  await page.getByLabel("Additional Text").fill("");
  await expect.poll(fontSize).toBeCloseTo(shortSize, 1);
});

test("redraws vectors and text at zoomed size without changing the PNG", async ({ page }, testInfo) => {
  await page.goto("/label-generator");
  const viewport = page.getByLabel("Label preview viewport");
  const preview = page.getByTestId("label-preview-transform");
  const qr = page.getByTestId("label-qr");
  await expect(qr).toHaveAttribute("src", /^data:image\/svg\+xml/);

  const downloadPng = async () => {
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PNG" }).click();
    const stream = await (await pending).createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  };
  const beforePng = await downloadPng();
  const initialFontSize = await preview.locator("strong")
    .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  const viewportBox = (await viewport.boundingBox())!;
  await page.mouse.move(viewportBox.x + viewportBox.width / 2, viewportBox.y + viewportBox.height / 2);
  await page.mouse.wheel(0, -2000);

  await expect.poll(() => preview.evaluate((element) => {
    const label = element.firstElementChild as HTMLElement;
    const svg = label.querySelector("svg")!;
    const transform = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return {
      layoutWidth: label.clientWidth,
      displayWidth: Math.round(label.getBoundingClientRect().width),
      svgDrawnAtDisplaySize: Math.abs(svg.clientWidth - svg.getBoundingClientRect().width) < 1,
      scaleX: transform.a,
      scaleY: transform.d,
    };
  })).toEqual({
    layoutWidth: 1540, displayWidth: 1540,
    svgDrawnAtDisplaySize: true, scaleX: 1, scaleY: 1,
  });
  const zoomedFontSize = await preview.locator("strong")
    .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  expect(zoomedFontSize / initialFontSize).toBeCloseTo(4, 2);
  await testInfo.attach("preview-at-4x.png", {
    body: await viewport.screenshot(), contentType: "image/png",
  });
  expect((await downloadPng()).equals(beforePng)).toBe(true);
});

for (const item of ["Socket cap", "Countersunk", "Hex bolt", "Hex nut", "Flat washer"]) {
  test(`exports legible line artwork for ${item}`, async ({ page }, testInfo) => {
    await page.goto("/label-generator");
    if (item === "Countersunk" || item === "Hex bolt") {
      await page.getByRole("button", { name: "Fastener Style" }).click();
      await page.getByRole("button", {
        name: item === "Hex bolt" ? "Head: Hex head" : "Head: Countersunk",
      }).click();
      await page.getByRole("button", { name: "Fastener Style" }).click();
    } else if (item === "Hex nut" || item === "Flat washer") {
      await page.getByRole("button", { name: "Item Type" }).click();
      await page.getByRole("option", { name: new RegExp(item) }).click();
    }

    const preview = page.getByTestId("label-preview-transform");
    await expect(page.getByTestId("label-qr")).toBeVisible();
    for (const profile of ["top", "side"]) {
      await expect.poll(() => preview.locator(`[data-artwork-profile="${profile}"] svg`)
        .evaluate((element) => {
          const svg = element as SVGSVGElement;
          const box = svg.getBBox();
          const frame = svg.viewBox.baseVal;
          const rendered = svg.getBoundingClientRect();
          const slot = svg.parentElement!.parentElement!.getBoundingClientRect();
          return box.width > 0 && box.height > 0 &&
            rendered.left >= slot.left - 0.5 && rendered.right <= slot.right + 0.5 &&
            rendered.top >= slot.top - 0.5 && rendered.bottom <= slot.bottom + 0.5 &&
            box.x >= frame.x && box.y >= frame.y &&
            box.x + box.width <= frame.x + frame.width &&
            box.y + box.height <= frame.y + frame.height;
        })).toBe(true);
    }

    const primaryRegion = await preview.locator('[data-artwork-profile="top"]')
      .evaluate((element) => {
        const slot = element.parentElement!.getBoundingClientRect();
        const label = element.parentElement!.parentElement!.getBoundingClientRect();
        return {
          x: (slot.x - label.x) / label.width,
          y: (slot.y - label.y) / label.height,
          width: slot.width / label.width,
          height: slot.height / label.height,
        };
      });

    const pendingDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PNG" }).click();
    const download = await pendingDownload;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    const png = Buffer.concat(chunks);
    await testInfo.attach(`${item}.png`, { body: png, contentType: "image/png" });

    const result = await page.evaluate(async ({ base64, region }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      // Inspect the preview's primary slot in the actual export. This catches
      // preview/export placement drift, missing artwork, and solid silhouettes.
      const regionWidth = Math.round(image.width * region.width);
      const regionHeight = Math.round(image.height * region.height);
      const pixels = context.getImageData(
        Math.round(image.width * region.x), Math.round(image.height * region.y),
        regionWidth, regionHeight,
      ).data;
      let ink = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] < 128 && pixels[i + 1] < 128 && pixels[i + 2] < 128) ink++;
      }
      const allPixels = context.getImageData(0, 0, image.width, image.height).data;
      const blackAt = (x: number, y: number) => {
        const index = (y * image.width + x) * 4;
        return allPixels[index] < 32 && allPixels[index + 1] < 32 && allPixels[index + 2] < 32;
      };
      const inset = Math.floor(image.height * 0.006);
      const corner = Math.ceil(image.height * 0.1);
      let continuousBorder = true;
      for (let x = corner; x < image.width - corner; x++) {
        continuousBorder &&= blackAt(x, inset) && blackAt(x, image.height - inset - 1);
      }
      for (let y = corner; y < image.height - corner; y++) {
        continuousBorder &&= blackAt(inset, y) && blackAt(image.width - inset - 1, y);
      }
      return {
        width: image.width, height: image.height,
        ink: ink / (regionWidth * regionHeight),
        continuousBorder,
      };
    }, { base64: png.toString("base64"), region: primaryRegion });

    expect(result.width).toBe(980);
    expect(result.height).toBe(336);
    expect(result.ink).toBeGreaterThan(0.03);
    expect(result.ink).toBeLessThan(0.3);
    expect(result.continuousBorder).toBe(true);
  });
}

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`keeps three label columns at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/label-generator");
    const preview = page.getByTestId("label-preview-transform");
    const side = preview.locator('[data-artwork-profile="side"]');
    const qr = page.getByTestId("label-qr");
    await expect(qr).toBeVisible();

    for (const size of ["35 x 12", "70 x 25"]) {
      // Configure on desktop, then independently verify the label geometry at
      // the target viewport (the mobile settings panel has its own scrolling).
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.getByRole("button", { name: new RegExp(size) }).click();
      await page.setViewportSize(viewport);
      await expect.poll(async () => {
        const topBox = await preview.locator('[data-artwork-profile="top"]').boundingBox();
        const sideBox = await side.boundingBox();
        const qrBox = await qr.boundingBox();
        const copyBox = await preview.locator("strong").boundingBox();
        const labelBox = await preview.boundingBox();
        if (!topBox || !sideBox || !qrBox || !copyBox || !labelBox) return false;
        return Math.abs(topBox.width - qrBox.width) < 1 &&
          Math.abs(topBox.height - qrBox.height) < 1 &&
          Math.abs(topBox.y - qrBox.y) < 1 &&
          topBox.x + topBox.width < sideBox.x &&
          sideBox.x + sideBox.width < qrBox.x &&
          sideBox.y > topBox.y &&
          copyBox.y + copyBox.height <= sideBox.y &&
          Math.abs(sideBox.height - labelBox.height * 0.301) < 1 &&
          Math.abs(sideBox.y - labelBox.y - labelBox.height * 0.629) < 1 &&
          sideBox.y + sideBox.height <= labelBox.y + labelBox.height;
      }).toBe(true);
      await expect.poll(() => side.locator("svg").evaluate((svg) => {
        const element = svg as SVGSVGElement;
        const frame = element.getBoundingClientRect();
        const viewBox = element.viewBox.baseVal;
        const matrix = element.getScreenCTM()!;
        const drawnWidth = viewBox.width * matrix.a;
        const drawnHeight = viewBox.height * matrix.d;
        return Math.abs(viewBox.x * matrix.a + matrix.e + drawnWidth / 2 - (frame.left + frame.width / 2)) < 1 &&
          Math.abs(matrix.a - matrix.d) < 0.001 &&
          drawnWidth <= frame.width + 1 && drawnHeight <= frame.height + 1 &&
          (Math.abs(drawnWidth - frame.width) < 1 || Math.abs(drawnHeight - frame.height) < 1);
      })).toBe(true);
    }

    await page.setViewportSize({ width: 1440, height: 1000 });
    const originalWidth = (await side.boundingBox())!.width;
    await page.getByRole("checkbox", { name: "Show QR code" }).uncheck();
    await expect(qr).toHaveCount(0);
    await expect.poll(async () => (await side.boundingBox())!.width).toBeGreaterThan(originalWidth);
    const withoutQrWidth = (await side.boundingBox())!.width;
    await page.getByRole("checkbox", { name: "Show primary image" }).uncheck();
    await expect.poll(async () => (await side.boundingBox())!.width).toBeGreaterThan(withoutQrWidth);
    await page.getByRole("checkbox", { name: "Show secondary image" }).uncheck();
    await expect(side).toHaveCount(0);
    await expect(preview.locator("strong")).toBeVisible();
  });
}
