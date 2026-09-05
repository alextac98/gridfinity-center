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
    // DOM ranges include invisible font ascender/descender space. Check the
    // visible glyph bounds at the browser's actual font size instead.
    const context = document.createElement("canvas").getContext("2d")!;
    const rects = lines.map((line) => {
      const rect = line.getBoundingClientRect();
      const style = getComputedStyle(line);
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const metrics = context.measureText(line.textContent || "");
      const baseline = rect.top + (parseFloat(style.lineHeight) - metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2 + metrics.fontBoundingBoxAscent;
      const startX = rect.left + (rect.width - metrics.width) / 2;
      return {
        left: startX - metrics.actualBoundingBoxLeft,
        right: startX + metrics.actualBoundingBoxRight,
        top: baseline - metrics.actualBoundingBoxAscent,
        bottom: baseline + metrics.actualBoundingBoxDescent,
      };
    });
    return rects.every((text) => text.left >= box.left - 1 && text.right <= box.right + 1 &&
      text.top >= box.top - 1 && text.bottom <= box.bottom + 1 &&
      Math.abs((text.left + text.right) / 2 - (box.left + box.right) / 2) < 1.5,
    ) && Math.abs(
      (Math.min(...rects.map((rect) => rect.top)) + Math.max(...rects.map((rect) => rect.bottom))) / 2 -
      (box.top + box.bottom) / 2,
    ) < 1.5;
  });

  await itemName.fill("M3");
  await expect.poll(fitsAndCenters).toBe(true);
  const shortSize = await fontSize();
  expect(shortSize).toBeGreaterThan((await textArea.boundingBox())!.height * 0.75);

  await itemName.fill("M3 x 20 stainless steel socket cap screws");
  await expect.poll(fontSize).toBeLessThan(shortSize / 2);
  await expect.poll(fitsAndCenters).toBe(true);

  for (const text of ["Égj Å", "M3 x 20", "Stainless steel / drawer 12"]) {
    await itemName.fill(text);
    await expect.poll(fitsAndCenters).toBe(true);
  }
  await itemName.fill("M3");
  await expect.poll(fontSize).toBeCloseTo(shortSize, 1);
  await page.getByLabel("Additional Text").fill("Stainless steel / drawer 12");
  await expect(textArea.locator("span")).toHaveText("Stainless steel / drawer 12");
  await expect.poll(fitsAndCenters).toBe(true);
  await expect.poll(fontSize).toBeLessThan(shortSize);

  await page.getByLabel("Additional Text").fill("");
  await expect.poll(fontSize).toBeCloseTo(shortSize, 1);
});

test("fills the available text space with visible lettering in the PNG", async ({ page }) => {
  await page.goto("/label-generator");
  await expect(page.getByTestId("label-printer-preview")).toBeVisible();
  const region = await page.getByTestId("label-text").evaluate((element) => {
    const box = element.getBoundingClientRect();
    const label = element.parentElement!.parentElement!.getBoundingClientRect();
    return { x: (box.x - label.x) / label.width, y: (box.y - label.y) / label.height,
      width: box.width / label.width, height: box.height / label.height };
  });
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG" }).click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const result = await page.evaluate(async ({ base64, region }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const width = Math.round(region.width * image.width);
    const height = Math.round(region.height * image.height);
    const pixels = context.getImageData(Math.round(region.x * image.width), Math.round(region.y * image.height), width, height).data;
    let minX = width, maxX = -1, minY = height, maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (pixels[(y * width + x) * 4] >= 128) continue;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
    return { widthFill: (maxX - minX + 1) / width, heightFill: (maxY - minY + 1) / height,
      centerY: (minY + maxY + 1) / 2 / height };
  }, { base64: Buffer.concat(chunks).toString("base64"), region });
  expect(result.widthFill).toBeGreaterThan(0.9);
  // The larger QR leaves a narrower text column; width can limit font size.
  expect(result.heightFill).toBeGreaterThan(0.7);
  expect(result.centerY).toBeCloseTo(0.5, 1);
});

test("redraws vectors and text at zoomed size without changing the PNG", async ({ page }, testInfo) => {
  await page.goto("/label-generator");
  await page.getByRole("button", { name: "Design", exact: true }).click();
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
          if (!svg.isConnected) return false;
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
      const whiteAt = (x: number, y: number) => {
        const index = (y * image.width + x) * 4;
        return allPixels[index] === 255 && allPixels[index + 1] === 255 && allPixels[index + 2] === 255;
      };
      let borderless = true;
      for (let x = 0; x < image.width; x++) {
        borderless &&= whiteAt(x, 0) && whiteAt(x, image.height - 1);
      }
      for (let y = 0; y < image.height; y++) {
        borderless &&= whiteAt(0, y) && whiteAt(image.width - 1, y);
      }
      return {
        width: image.width, height: image.height,
        ink: ink / (regionWidth * regionHeight),
        borderless,
      };
    }, { base64: png.toString("base64"), region: primaryRegion });

    expect(result.width).toBe(1654);
    expect(result.height).toBe(567);
    expect(result.ink).toBeGreaterThan(0.03);
    expect(result.ink).toBeLessThan(0.3);
    expect(result.borderless).toBe(true);
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
      const heightMm = size === "35 x 12" ? 12 : 25;
      const marginTopMm = Number(await page.getByRole("spinbutton", { name: /Vertical margin/ }).inputValue());
      const marginBottomMm = Number(await page.getByRole("spinbutton", { name: /Vertical margin/ }).inputValue());
      const usableHeight = heightMm - marginTopMm - marginBottomMm;
      await page.setViewportSize(viewport);
      await expect.poll(async () => {
        const topBox = await preview.locator('[data-artwork-profile="top"]').boundingBox();
        const sideBox = await side.boundingBox();
        const qrBox = await qr.boundingBox();
        const copyBox = await preview.locator("strong").boundingBox();
        const labelBox = await preview.boundingBox();
        if (!topBox || !sideBox || !qrBox || !copyBox || !labelBox) return false;
        return topBox.width < qrBox.width &&
          Math.abs(qrBox.width - qrBox.height) < 1 &&
          Math.abs(qrBox.height - labelBox.height * usableHeight / heightMm) < 1 &&
          Math.abs(qrBox.y - labelBox.y - labelBox.height * marginTopMm / heightMm) < 1 &&
          Math.abs(topBox.y + topBox.height / 2 - qrBox.y - qrBox.height / 2) < 1 &&
          topBox.x + topBox.width < sideBox.x &&
          sideBox.x + sideBox.width < qrBox.x &&
          sideBox.y > topBox.y &&
          copyBox.y + copyBox.height <= sideBox.y &&
          Math.abs(sideBox.height - labelBox.height * usableHeight / heightMm * 0.6) < 1 &&
          Math.abs(sideBox.y - labelBox.y - labelBox.height * (marginTopMm + usableHeight * 0.4) / heightMm) < 1 &&
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
