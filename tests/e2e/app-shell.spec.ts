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
      preview.evaluate((element) => window.getComputedStyle(element).transform),
    )
    .toContain("matrix(1.56, 0, 0, 1.56, 0, 0)");
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
