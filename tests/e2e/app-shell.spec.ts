import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/label-generator");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("keeps a visited app mounted while navigating through the shell", async ({
  page,
}) => {
  await expect(
    page.getByRole("heading", { level: 1, name: "Label Generator" }),
  ).toBeVisible();

  await page.getByLabel("Additional Text").fill("Socket cap drawer");
  await page.getByRole("button", { name: /60 x 20/ }).click();

  await page.getByRole("tab", { name: /Bin Generator/ }).click();
  await expect(page).toHaveURL(/\/bin-generator$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Bin Generator" }),
  ).toBeVisible();

  await page.getByRole("tab", { name: /Label Generator/ }).click();
  await expect(page).toHaveURL(/\/label-generator$/);
  await expect(page.getByLabel("Additional Text")).toHaveValue(
    "Socket cap drawer",
  );
});

test("restores label settings after a reload", async ({ page }) => {
  await page.getByLabel("Additional Text").fill("Reload me");

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const storedSettings = window.localStorage.getItem(
          "gridfinity-label-generator-settings",
        );

        return storedSettings ? JSON.parse(storedSettings).note : "";
      }),
    )
    .toBe("Reload me");

  await page.reload();
  await expect(page.getByLabel("Additional Text")).toHaveValue("Reload me");
});

test("selects and restores a compatible fastener style", async ({
  page,
}) => {
  const preview = page.getByTestId("label-preview-transform");
  const style = page.getByRole("button", { name: "Fastener Style" });

  await expect
    .poll(() =>
      page.evaluate(() =>
        window.localStorage.getItem("gridfinity-label-generator-settings"),
      ),
    )
    .not.toBeNull();
  await style.click();
  await expect(
    page.getByRole("button", { name: "Head: Socket cap" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Drive: Hex socket" }),
  ).toHaveAttribute("aria-pressed", "true");

  await page
    .getByRole("button", { name: "Head: Countersunk" })
    .click();
  await page.getByRole("button", { name: "Drive: Phillips" }).click();

  await expect(
    preview.locator('[data-artwork-profile="top"]'),
  ).toHaveAttribute("data-artwork-id", "phillips");
  await expect(
    preview.locator('[data-artwork-profile="side"]'),
  ).toHaveAttribute("data-artwork-id", "countersunk");

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const storedSettings = window.localStorage.getItem(
          "gridfinity-label-generator-settings",
        );
        const parsed = storedSettings ? JSON.parse(storedSettings) : null;

        return parsed
          ? {
              driveId: parsed.driveId,
              headProfileId: parsed.headProfileId,
            }
          : null;
      }),
    )
    .toEqual({
      driveId: "phillips",
      headProfileId: "countersunk",
    });

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Fastener Style" }),
  ).toContainText("Countersunk");
  await expect(
    page.getByRole("button", { name: "Fastener Style" }),
  ).toContainText("Phillips");
});

test("repairs an incompatible saved fastener style", async ({ page }) => {
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.localStorage.getItem("gridfinity-label-generator-settings"),
      ),
    )
    .not.toBeNull();

  await page.evaluate(() => {
    const storageKey = "gridfinity-label-generator-settings";
    const storedSettings = window.localStorage.getItem(storageKey);
    const parsed = storedSettings ? JSON.parse(storedSettings) : {};

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        ...parsed,
        driveId: "external-hex",
        fastenerId: "flat-head",
        headProfileId: "countersunk",
      }),
    );
  });
  await page.reload();

  const style = page.getByRole("button", { name: "Fastener Style" });
  await expect(style).toContainText("Countersunk");
  await expect(style).toContainText("Phillips");
});

test("keeps fastener artwork inside its preview slots", async ({ page }) => {
  const preview = page.getByTestId("label-preview-transform");

  await page.getByRole("button", { name: /70 x 25/ }).click();
  await page.getByRole("button", { name: "Fastener Style" }).click();
  await page
    .getByRole("button", { name: "Head: Button / round" })
    .click();

  for (const profile of ["top", "side"]) {
    const artworkFits = await preview
      .locator(`[data-artwork-profile="${profile}"]`)
      .evaluate((artwork, artworkProfile) => {
        const artworkRect = artwork.getBoundingClientRect();
        const container =
          artworkProfile === "top"
            ? artwork.parentElement?.parentElement
            : artwork.parentElement;
        const containerRect = container?.getBoundingClientRect();

        return Boolean(
          containerRect &&
            artworkRect.top >= containerRect.top &&
            artworkRect.right <= containerRect.right &&
            artworkRect.bottom <= containerRect.bottom &&
            artworkRect.left >= containerRect.left,
        );
      }, profile);

    expect(artworkFits).toBe(true);

    const graphicFits = await preview
      .locator(`[data-artwork-profile="${profile}"] svg`)
      .evaluate((svg) => {
        const graphic = (svg as SVGSVGElement).getBBox();
        const viewBox = (svg as SVGSVGElement).viewBox.baseVal;

        return (
          graphic.x >= viewBox.x &&
          graphic.y >= viewBox.y &&
          graphic.x + graphic.width <= viewBox.x + viewBox.width &&
          graphic.y + graphic.height <= viewBox.y + viewBox.height
        );
      });

    expect(graphicFits).toBe(true);
  }
});

test("keeps fastener artwork legible in both color themes", async ({ page }) => {
  const itemType = page.getByRole("button", { name: "Item Type" });
  const style = page.getByRole("button", { name: "Fastener Style" });
  const previewArtwork = page
    .getByTestId("label-preview-transform")
    .locator('[data-artwork-profile="top"] svg');
  const itemTypeArtwork = itemType.locator("[data-artwork-id] svg").first();
  const styleArtwork = style.locator("[data-artwork-id] svg").first();

  const switchToLight = page.getByRole("button", {
    name: "Switch to light mode",
  });
  if (await switchToLight.isVisible()) {
    await switchToLight.click();
  }

  await expect(itemTypeArtwork).toHaveCSS("filter", "none");
  await expect(styleArtwork).toHaveCSS("filter", "none");
  await expect(previewArtwork).toHaveCSS("filter", "none");

  await page
    .getByRole("button", { name: "Switch to dark mode" })
    .click();

  await expect(itemTypeArtwork).toHaveCSS("filter", "invert(1)");
  await expect(styleArtwork).toHaveCSS("filter", "invert(1)");
  await expect(previewArtwork).toHaveCSS("filter", "none");
  await expect
    .poll(() =>
      style
        .locator('[data-artwork-profile="top"]')
        .evaluate((artwork) => {
          const artworkRect = artwork.getBoundingClientRect();
          const slotRect = artwork.parentElement?.getBoundingClientRect();

          return Boolean(
            slotRect &&
              artworkRect.left >= slotRect.left &&
              artworkRect.right <= slotRect.right,
          );
        }),
    )
    .toBe(true);

  await style.click();
  await expect(
    page
      .getByRole("button", { name: "Head: Socket cap" })
      .locator("[data-artwork-id] svg"),
  ).toHaveCSS("filter", "invert(1)");
  await expect(
    page
      .getByRole("button", { name: "Drive: Hex socket" })
      .locator("[data-artwork-id] svg"),
  ).toHaveCSS("filter", "invert(1)");

  const torxDrive = page.getByRole("button", { name: "Drive: Torx" });
  await expect(torxDrive).toBeVisible();
  await expect(page.getByText(/hexalobular/i)).toHaveCount(0);
  await torxDrive.click();
  await expect(
    page
      .getByTestId("label-preview-transform")
      .locator('[data-artwork-profile="top"]'),
  ).toHaveAttribute("data-artwork-id", "torx");

  await page.getByRole("button", { name: "Head: Hex head" }).click();
  await expect(
    page
      .getByText("Fixed by the hex head style")
      .locator("..")
      .locator("..")
      .locator("[data-artwork-id] svg"),
  ).toHaveCSS("filter", "invert(1)");
});

test("only offers drives compatible with the selected head", async ({
  page,
}) => {
  const preview = page.getByTestId("label-preview-transform");
  const standardToggle = page.getByLabel("Show ISO / DIN standard");

  await expect(standardToggle).toBeEnabled();
  await page.getByRole("button", { name: "Fastener Style" }).click();

  await expect(
    page
      .getByRole("group", { name: "Head style" })
      .getByRole("button"),
  ).toHaveText([
    "Socket cap",
    "Wafer / low profile",
    "Button / round",
    "Countersunk",
    "Pan",
    "Hex head",
  ]);

  await page
    .getByRole("button", { name: "Head: Button / round" })
    .click();
  await expect(
    page.getByRole("button", { name: "Drive: Slotted" }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Head: Wafer / low profile" })
    .click();
  await expect(
    page.getByRole("button", { name: "Drive: Hex socket" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Head: Hex head" }).click();

  await expect(page.getByText("Fixed by the hex head style")).toBeVisible();
  await expect(standardToggle).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Drive: Phillips" }),
  ).toHaveCount(0);
  await expect(
    preview.locator('[data-artwork-profile="top"]'),
  ).toHaveAttribute("data-artwork-id", "external-hex");

  await page
    .getByRole("button", { name: "Head: Countersunk" })
    .click();

  await expect(
    page.getByRole("button", { name: "Drive: Phillips" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(standardToggle).toBeDisabled();
  await expect(page.getByText("Fixed by the hex head style")).toHaveCount(0);
  await expect(
    preview.locator('[data-artwork-profile="top"]'),
  ).toHaveAttribute("data-artwork-id", "phillips");

  await page.getByRole("button", { name: "Fastener Style" }).click();
  await page.getByRole("button", { name: "Item Type" }).click();
  await page.getByRole("option", { name: /Hex nut/ }).click();

  await expect(
    page.getByRole("button", { name: "Fastener Style" }),
  ).toHaveCount(0);
  await expect(
    preview.locator('[data-artwork-profile="top"]'),
  ).toHaveAttribute("data-artwork-id", "nut");
});

test("allows partial bin height units", async ({ page }) => {
  await page.getByRole("tab", { name: /Bin Generator/ }).click();
  await expect(page).toHaveURL(/\/bin-generator$/);

  const heightInput = page.locator('input[aria-label="Height u"]');
  await expect(heightInput).toHaveAttribute("step", "0.1");

  await heightInput.fill("2.5");
  await heightInput.blur();
  await expect(heightInput).toHaveValue("2.5");

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const storedSettings = window.localStorage.getItem(
          "gridfinity-bin-generator-settings",
        );
        const parsed = storedSettings ? JSON.parse(storedSettings) : null;

        return parsed
          ? {
              heightUnit: parsed.params.heightUnit,
              heightUnits: parsed.params.heightUnits,
              wallThicknessUnit: parsed.params.wallThicknessUnit,
            }
          : null;
      }),
    )
    .toEqual({
      heightUnit: "u",
      heightUnits: 2.5,
      wallThicknessUnit: "auto",
    });
});

test("allows panning and zooming the label preview", async ({ page }) => {
  const viewport = page.getByLabel("Label preview viewport");
  const grid = page.getByTestId("label-preview-grid");
  const preview = page.getByTestId("label-preview-transform");
  const homeButton = viewport.getByRole("button", { name: "Home view" });

  await expect(viewport).toBeVisible();
  await expect(grid).toBeVisible();
  await expect(preview).toBeVisible();
  await expect(homeButton).toBeVisible();

  const initialTransform = await preview.evaluate(
    (element) => window.getComputedStyle(element).transform,
  );
  const initialGridSize = await viewport.evaluate(
    (element) => window.getComputedStyle(element).getPropertyValue("--preview-grid-size"),
  );
  expect(initialGridSize.trim()).toBe("55px");

  const viewportBox = await viewport.boundingBox();
  expect(viewportBox).not.toBeNull();

  if (!viewportBox) {
    return;
  }

  await page.mouse.move(
    viewportBox.x + viewportBox.width / 2,
    viewportBox.y + viewportBox.height / 2,
  );
  await page.mouse.wheel(0, -420);

  await expect
    .poll(() =>
      preview.evaluate((element) => window.getComputedStyle(element).transform),
    )
    .not.toBe(initialTransform);
  await expect
    .poll(() =>
      viewport.evaluate((element) =>
        window.getComputedStyle(element).getPropertyValue("--preview-grid-size"),
      ),
    )
    .not.toBe(initialGridSize);

  const zoomedTransform = await preview.evaluate(
    (element) => window.getComputedStyle(element).transform,
  );

  await page.mouse.down();
  await page.mouse.move(
    viewportBox.x + viewportBox.width / 2 + 90,
    viewportBox.y + viewportBox.height / 2 + 55,
  );
  await page.mouse.up();

  await expect
    .poll(() =>
      preview.evaluate((element) => window.getComputedStyle(element).transform),
    )
    .not.toBe(zoomedTransform);

  const expectPreviewOverlap = async () => {
    const nextViewportBox = await viewport.boundingBox();
    const previewBox = await preview.boundingBox();

    expect(nextViewportBox).not.toBeNull();
    expect(previewBox).not.toBeNull();

    if (!nextViewportBox || !previewBox) {
      return;
    }

    const overlapX =
      Math.min(previewBox.x + previewBox.width, nextViewportBox.x + nextViewportBox.width) -
      Math.max(previewBox.x, nextViewportBox.x);
    const overlapY =
      Math.min(previewBox.y + previewBox.height, nextViewportBox.y + nextViewportBox.height) -
      Math.max(previewBox.y, nextViewportBox.y);

    expect(overlapX).toBeGreaterThanOrEqual(20);
    expect(overlapY).toBeGreaterThanOrEqual(20);
  };

  await page.mouse.move(
    viewportBox.x + viewportBox.width / 2,
    viewportBox.y + viewportBox.height / 2,
  );
  await page.mouse.wheel(0, 1500);
  await expect
    .poll(() =>
      viewport.evaluate((element) =>
        window.getComputedStyle(element).getPropertyValue("--preview-scale"),
      ),
    )
    .toBe("0.2");
  await page.mouse.down();
  await page.mouse.move(
    viewportBox.x + viewportBox.width / 2 + 2000,
    viewportBox.y + viewportBox.height / 2 + 2000,
    { steps: 4 },
  );
  await page.mouse.up();
  await expectPreviewOverlap();

  await page.mouse.down();
  await page.mouse.move(
    viewportBox.x + viewportBox.width / 2 - 2000,
    viewportBox.y + viewportBox.height / 2 - 2000,
    { steps: 4 },
  );
  await page.mouse.up();
  await expectPreviewOverlap();

  await homeButton.click();
  await expect
    .poll(() =>
      viewport.evaluate((element) =>
        window.getComputedStyle(element).getPropertyValue("--preview-scale"),
      ),
    )
    .toBe("1.56");
  await expect
    .poll(() =>
      preview.evaluate((element) =>
        parseFloat((element.firstElementChild as HTMLElement).style.width),
      ),
    )
    .toBeCloseTo(600.6, 1);
});

test("renders the grid generator and persists grid settings", async ({ page }) => {
  await page.getByRole("tab", { name: /Grid Generator/ }).click();
  await expect(page).toHaveURL(/\/grid-generator$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Grid Generator" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Grid Parameters" }),
  ).toBeVisible();
  await expect(page.getByLabel("Grid Preview")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Model Output" }),
  ).toBeVisible();

  await page.getByRole("spinbutton", { name: "Grid Width u" }).fill("4");
  await page.getByRole("spinbutton", { name: "Grid Width u" }).blur();
  await page
    .getByRole("group", { name: "Size unit" })
    .getByRole("button", { name: "mm" })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "Grid Width mm" }),
  ).toHaveValue("168");
  await expect(
    page.getByRole("spinbutton", { name: "Grid Depth mm" }),
  ).toHaveValue("84");
  await page.getByLabel("Fill Mode").selectOption({ label: "Grid + Solid" });
  await expect(page.getByRole("spinbutton", { name: "Solid Width u" })).toHaveAttribute(
    "min",
    "4",
  );
  await expect(page.getByRole("spinbutton", { name: "Solid Depth u" })).toHaveAttribute(
    "min",
    "2",
  );
  await page.getByRole("spinbutton", { name: "Solid Width u" }).fill("5");
  await page.getByRole("spinbutton", { name: "Solid Width u" }).blur();
  await page.getByRole("spinbutton", { name: "Solid Depth u" }).fill("3");
  await page.getByRole("spinbutton", { name: "Solid Depth u" }).blur();
  await page
    .getByRole("group", { name: "Solid size unit" })
    .getByRole("button", { name: "mm" })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "Solid Width mm" }),
  ).toHaveValue("210");
  await expect(
    page.getByRole("spinbutton", { name: "Solid Depth mm" }),
  ).toHaveValue("126");

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const storedSettings = window.localStorage.getItem(
          "gridfinity-grid-generator-settings",
        );
        const parsed = storedSettings ? JSON.parse(storedSettings) : null;

        return parsed
          ? {
              depthUnit: parsed.params.depthUnit,
              depthUnits: parsed.params.depthUnits,
              fillMode: parsed.params.fillMode,
              solidUnit: parsed.params.solidUnit,
              solidWidth: parsed.params.outerWidthUnits,
              widthUnit: parsed.params.widthUnit,
              widthUnits: parsed.params.widthUnits,
            }
          : null;
      }),
    )
    .toEqual({
      depthUnit: "mm",
      depthUnits: 84,
      fillMode: "grid-solid",
      solidUnit: "mm",
      solidWidth: 210,
      widthUnit: "mm",
      widthUnits: 168,
    });

  await page
    .getByLabel("Grid Parameters")
    .getByRole("button", { name: "Generate" })
    .click();
  await expect(page.getByText("OpenSCAD Preview Ready")).toBeVisible({
    timeout: 60_000,
  });
});
