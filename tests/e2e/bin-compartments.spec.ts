import { expect, test, type Page } from "@playwright/test";

async function setBinDimension(
  page: Page,
  dimension: "Width" | "Depth",
  value: string,
) {
  const field = page.getByRole("spinbutton", {
    name: `${dimension} u`,
    exact: true,
  });
  await field.fill(value);
  await field.blur();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/bin-generator");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByLabel("Compartment layout")).toBeVisible();
});

test("the Y fallback control adds a vertical divider", async ({ page }) => {
  await setBinDimension(page, "Width", "2");
  await page.getByRole("button", { name: "Add Y divider" }).click();

  await expect(page.getByText("2 total", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Select Y divider at 42 mm" }),
  ).toBeVisible();

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const stored = window.localStorage.getItem(
          "gridfinity-bin-generator-settings",
        );
        const settings = stored ? JSON.parse(stored) : null;

        return {
          chambers: settings?.params?.verticalChambers,
          irregular:
            settings?.params?.extraDefines?.vertical_irregular_subdivisions,
        };
      }),
    )
    .toEqual({ chambers: 2, irregular: false });
});

test("positions the add controls on the true exterior axes", async ({ page }) => {
  const surface = page.getByTestId("compartment-surface");
  const addX = page.getByRole("button", { name: "Add X divider" });
  const addY = page.getByRole("button", { name: "Add Y divider" });
  await surface.scrollIntoViewIfNeeded();

  const [surfaceBox, addXBox, addYBox] = await Promise.all([
    surface.boundingBox(),
    addX.boundingBox(),
    addY.boundingBox(),
  ]);

  if (!surfaceBox || !addXBox || !addYBox) {
    throw new Error("Compartment axis controls are not visible");
  }

  expect(addXBox.y).toBeGreaterThanOrEqual(
    surfaceBox.y + surfaceBox.height,
  );
  expect(addYBox.x + addYBox.width).toBeLessThanOrEqual(surfaceBox.x);
});

test("limits dividers by a 19 mm minimum instead of a fixed count", async ({
  page,
}) => {
  await setBinDimension(page, "Width", "0.5");
  const addY = page.getByRole("button", { name: "Add Y divider" });
  await expect(addY).toBeDisabled();
  await expect(addY).toHaveAttribute(
    "title",
    "Compartments must remain at least 19 mm wide",
  );

  await setBinDimension(page, "Depth", "5");
  const addX = page.getByRole("button", { name: "Add X divider" });

  for (let count = 1; count < 8; count += 1) {
    await addX.click();
  }

  await expect(page.getByText("8 total", { exact: true })).toBeVisible();
  await expect(addX).toBeEnabled();
  await addX.click();
  await expect(page.getByText("9 total", { exact: true })).toBeVisible();
  await expect(addX).toBeEnabled();
  await addX.click();
  await expect(page.getByText("10 total", { exact: true })).toBeVisible();
  await expect(addX).toBeDisabled();
});

test("uses pointer direction to place dividers in the canvas", async ({ page }) => {
  await setBinDimension(page, "Width", "2");
  const surface = page.getByTestId("compartment-surface");
  await surface.scrollIntoViewIfNeeded();
  const box = await surface.boundingBox();

  if (!box) {
    throw new Error("Compartment layout is not visible");
  }

  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.5);
  await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.5, {
    steps: 3,
  });
  await page.mouse.click(box.x + box.width * 0.72, box.y + box.height * 0.5);

  await expect(
    page.getByRole("button", { name: "Select Y divider at 60.5 mm" }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const stored = window.localStorage.getItem(
          "gridfinity-bin-generator-settings",
        );
        const settings = stored ? JSON.parse(stored) : null;

        return settings?.params?.extraDefines?.vertical_separator_config;
      }),
    )
    .toBe("59.3");

  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.28, {
    steps: 3,
  });
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.28);

  await expect(
    page.getByRole("button", { name: "Select X divider at 60.5 mm" }),
  ).toBeVisible();
});

test("locks new dividers to ruler ticks before using pointer direction", async ({
  page,
}) => {
  await setBinDimension(page, "Width", "2");
  const surface = page.getByTestId("compartment-surface");
  await surface.scrollIntoViewIfNeeded();
  const box = await surface.boundingBox();

  if (!box) {
    throw new Error("Compartment layout is not visible");
  }

  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.move(
    box.x + box.width * 0.5,
    box.y + box.height - 4,
    { steps: 4 },
  );
  await page.mouse.click(
    box.x + box.width * 0.5,
    box.y + box.height - 4,
  );

  await expect(
    page.getByRole("button", { name: "Select Y divider at 42 mm" }),
  ).toBeVisible();
});

test("quarter ticks create equal internal compartment sizes", async ({ page }) => {
  await setBinDimension(page, "Width", "3");
  const surface = page.getByTestId("compartment-surface");
  await surface.scrollIntoViewIfNeeded();
  const box = await surface.boundingBox();

  if (!box) {
    throw new Error("Compartment layout is not visible");
  }

  for (const positionMm of [31.85, 63, 94.15]) {
    await page.mouse.click(
      box.x + box.width * (positionMm / 126),
      box.y + box.height - 4,
    );
  }

  for (let index = 1; index <= 4; index += 1) {
    await expect(
      page.getByRole("textbox", {
        name: `X compartment ${index} size mm`,
        exact: true,
      }),
    ).toHaveValue("30.15");
  }
});

test("sizes measurement fields to fit their formatted values", async ({
  page,
}) => {
  await setBinDimension(page, "Depth", "3");
  const addX = page.getByRole("button", { name: "Add X divider" });
  await addX.click();
  await addX.click();
  await addX.click();

  const measurement = page.getByRole("textbox", {
    name: "Y compartment 1 size mm",
    exact: true,
  });
  await expect(measurement).toHaveValue("30.15");
  await expect
    .poll(() => measurement.evaluate((element) => element.style.width))
    .toBe("5ch");
});

test("matches the bin aspect ratio and front-left coordinate origin", async ({
  page,
}) => {
  const layoutBox = await page.getByLabel("Compartment layout").boundingBox();

  if (!layoutBox) {
    throw new Error("Compartment layout is not visible");
  }

  expect(layoutBox.width / layoutBox.height).toBeCloseTo(1 / 2, 1);

  await page.getByRole("button", { name: "Add X divider" }).click();
  await page
    .getByRole("button", { name: "Select X divider at 42 mm" })
    .click();
  const position = page.getByRole("spinbutton", {
    name: "X divider position mm",
    exact: true,
  });
  await position.fill("21.7");
  await position.blur();

  await expect(
    page.getByRole("button", { name: "Select X divider at 21.7 mm" }),
  ).toHaveAttribute("style", /top: 74.166/);
});

test("successive add actions create thirds and quarters", async ({ page }) => {
  const addX = page.getByRole("button", { name: "Add X divider" });
  await addX.click();
  await addX.click();

  await expect(page.getByText("3 total", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Select X divider at 28.233 mm" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Select X divider at 55.767 mm" }),
  ).toBeVisible();

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const stored = window.localStorage.getItem(
          "gridfinity-bin-generator-settings",
        );
        const settings = stored ? JSON.parse(stored) : null;

        return {
          chambers: settings?.params?.horizontalChambers,
          irregular:
            settings?.params?.extraDefines?.horizontal_irregular_subdivisions,
        };
      }),
    )
    .toEqual({ chambers: 3, irregular: false });
});

test("edits and removes a selected divider without exposing the delimiter", async ({
  page,
}) => {
  await setBinDimension(page, "Width", "2");
  await page.getByRole("button", { name: "Add Y divider" }).click();
  await page
    .getByRole("button", { name: "Select Y divider at 42 mm" })
    .click();

  const position = page.getByRole("spinbutton", {
    name: "Y divider position mm",
    exact: true,
  });
  await position.fill("31.5");
  await position.blur();

  await expect(
    page.getByRole("button", { name: "Select Y divider at 31.5 mm" }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const stored = window.localStorage.getItem(
          "gridfinity-bin-generator-settings",
        );
        const settings = stored ? JSON.parse(stored) : null;

        return settings?.params?.extraDefines?.vertical_separator_config;
      }),
    )
    .toBe("30.3");

  await page
    .getByRole("button", { name: "Select Y divider at 31.5 mm" })
    .hover();
  await page
    .getByRole("button", {
      name: "Remove Y divider at 31.5 mm",
      exact: true,
    })
    .click();
  await expect(page.getByText("1 total", { exact: true })).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const stored = window.localStorage.getItem(
          "gridfinity-bin-generator-settings",
        );
        const settings = stored ? JSON.parse(stored) : null;

        return {
          chambers: settings?.params?.verticalChambers,
          irregular:
            settings?.params?.extraDefines?.vertical_irregular_subdivisions,
        };
      }),
    )
    .toEqual({ chambers: 1, irregular: false });
});

test("reveals divider deletion on hover without selecting the line", async ({
  page,
}) => {
  await setBinDimension(page, "Width", "2");
  await page.getByRole("button", { name: "Add Y divider" }).click();
  await page.getByText("Compartment Layout", { exact: true }).click();

  const divider = page.getByRole("button", {
    name: "Select Y divider at 42 mm",
  });
  const removeDivider = page.getByRole("button", {
    name: "Remove Y divider at 42 mm",
    exact: true,
  });

  await expect(removeDivider).toHaveCount(0);
  await divider.hover();
  await expect(removeDivider).toBeVisible();
  await expect(
    page.getByRole("spinbutton", {
      name: "Y divider position mm",
      exact: true,
    }),
  ).toHaveCount(0);
});

test("snaps a dragged divider to a major fraction", async ({ page }) => {
  await setBinDimension(page, "Width", "2");
  await page.getByRole("button", { name: "Add Y divider" }).click();
  const divider = page.getByRole("button", {
    name: "Select Y divider at 42 mm",
  });
  const dividerBox = await divider.boundingBox();
  const surfaceBox = await page.getByTestId("compartment-surface").boundingBox();

  if (!dividerBox || !surfaceBox) {
    throw new Error("Divider editor is not visible");
  }

  await page.mouse.move(
    dividerBox.x + dividerBox.width / 2,
    dividerBox.y + dividerBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    surfaceBox.x + surfaceBox.width * (28.233 / 84),
    surfaceBox.y + surfaceBox.height - 3,
    { steps: 8 },
  );
  await page.mouse.up();

  await expect(
    page.getByRole("button", { name: "Select Y divider at 28.233 mm" }),
  ).toBeVisible();
});

test("interior dragging preserves an arbitrary 60 mm compartment", async ({ page }) => {
  await page.getByRole("button", { name: "Add X divider" }).click();

  const divider = page.getByRole("button", {
    name: "Select X divider at 42 mm",
  });
  await divider.click();
  const dividerBox = await divider.boundingBox();
  const surfaceBox = await page.getByTestId("compartment-surface").boundingBox();

  if (!dividerBox || !surfaceBox) {
    throw new Error("Divider editor is not visible");
  }

  await page.mouse.move(
    dividerBox.x + dividerBox.width / 2,
    dividerBox.y + dividerBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    dividerBox.x + dividerBox.width / 2,
    surfaceBox.y + surfaceBox.height * (1 - 60 / 84),
    { steps: 8 },
  );
  await page.mouse.up();

  await expect(
    page.getByRole("button", { name: "Select X divider at 60 mm" }),
  ).toBeVisible();
  await expect(
    page.getByRole("spinbutton", {
      name: "X divider position mm",
      exact: true,
    }),
  ).toHaveValue("60");
});

test("edits a compartment measurement directly in the diagram", async ({
  page,
}) => {
  await setBinDimension(page, "Width", "2");
  await page.getByRole("button", { name: "Add Y divider" }).click();

  const size = page.getByRole("textbox", {
    name: "X compartment 1 size mm",
    exact: true,
  });
  await expect(size).toHaveValue("40.3");
  await size.fill("30");
  await size.blur();

  await expect(
    page.getByRole("button", { name: "Select Y divider at 31.7 mm" }),
  ).toBeVisible();
  await expect(size).toHaveValue("30");
});

test("clicking away deselects the active divider", async ({ page }) => {
  await setBinDimension(page, "Width", "2");
  await page.getByRole("button", { name: "Add Y divider" }).click();
  await page
    .getByRole("button", { name: "Select Y divider at 42 mm" })
    .click();

  await expect(
    page.getByRole("button", {
      name: "Remove Y divider at 42 mm",
      exact: true,
    }),
  ).toBeVisible();

  await page.getByText("Compartment Layout", { exact: true }).click();

  await expect(
    page.getByRole("button", {
      name: "Remove Y divider at 42 mm",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("spinbutton", {
      name: "Y divider position mm",
      exact: true,
    }),
  ).toHaveCount(0);
});

test("Escape deselects the active divider and clears focus", async ({ page }) => {
  await setBinDimension(page, "Width", "2");
  await page.getByRole("button", { name: "Add Y divider" }).click();
  const divider = page.getByRole("button", {
    name: "Select Y divider at 42 mm",
  });
  await divider.click();

  const position = page.getByRole("spinbutton", {
    name: "Y divider position mm",
    exact: true,
  });
  await position.focus();
  await page.keyboard.press("Escape");

  await expect(position).toHaveCount(0);
  await expect(divider).toHaveAttribute("aria-pressed", "false");
  await expect
    .poll(() => divider.evaluate((element) => document.activeElement === element))
    .toBe(false);
});

test("edits diagram measurements in inches while storing millimeters", async ({
  page,
}) => {
  await setBinDimension(page, "Width", "2");
  await page.getByRole("button", { name: "Add Y divider" }).click();
  await page.getByRole("button", { name: "Inches" }).click();

  const size = page.getByRole("textbox", {
    name: "X compartment 1 size in",
    exact: true,
  });
  await expect(size).toHaveValue("1.587");
  await size.fill("1");
  await size.blur();

  await expect(
    page.getByRole("button", { name: "Select Y divider at 1.067 in" }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const stored = window.localStorage.getItem(
          "gridfinity-bin-generator-settings",
        );
        const settings = stored ? JSON.parse(stored) : null;

        return settings?.params?.extraDefines?.vertical_separator_config;
      }),
    )
    .toBe("25.9");
});

test("converts dimensional compartment parameters with the unit picker", async ({
  page,
}) => {
  await setBinDimension(page, "Width", "2");
  await page.getByRole("button", { name: "Add Y divider" }).click();

  await expect(
    page.getByLabel("Divider Wall Thickness Bottom mm", { exact: true }),
  ).toHaveValue("1");
  await expect(
    page.getByLabel("Divider Wall Thickness Top mm", { exact: true }),
  ).toHaveValue("1");

  await page.getByRole("button", { name: "Inches" }).click();

  const bottomThickness = page.getByLabel(
    "Divider Wall Thickness Bottom in",
    { exact: true },
  );
  await bottomThickness.fill("0.04");

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const stored = window.localStorage.getItem(
          "gridfinity-bin-generator-settings",
        );
        const settings = stored ? JSON.parse(stored) : null;

        return settings?.params?.extraDefines?.chamber_wall_thickness;
      }),
    )
    .toEqual([1.016, 1]);

  const headroom = page.getByLabel(/Divider Headroom/);
  await headroom.fill("0.1");

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const stored = window.localStorage.getItem(
          "gridfinity-bin-generator-settings",
        );
        const settings = stored ? JSON.parse(stored) : null;

        return settings?.params?.extraDefines?.chamber_wall_headroom;
      }),
    )
    .toBe(2.54);

  await page.getByText("Advanced X Divider Geometry", { exact: true }).click();
  await expect(page.getByLabel(/X Divider Bend Angle/)).toHaveAttribute(
    "step",
    "1",
  );
});

test("serializes edited divider positions relative to the cavity", async ({
  page,
}) => {
  await setBinDimension(page, "Width", "2");
  await page.getByRole("button", { name: "Add Y divider" }).click();
  await page
    .getByRole("button", { name: "Select Y divider at 42 mm" })
    .click();

  const position = page.getByRole("spinbutton", {
    name: "Y divider position mm",
    exact: true,
  });
  await position.focus();
  await position.blur();

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const stored = window.localStorage.getItem(
          "gridfinity-bin-generator-settings",
        );
        const settings = stored ? JSON.parse(stored) : null;

        return settings?.params?.extraDefines?.vertical_separator_config;
      }),
    )
    .toBe("40.8");
});

test("derives custom compartment totals from the separator config", async ({
  page,
}) => {
  await page.evaluate(() => {
    const key = "gridfinity-bin-generator-settings";
    const stored = window.localStorage.getItem(key);
    const settings = stored ? JSON.parse(stored) : null;

    settings.params.verticalChambers = 1;
    settings.params.extraDefines.vertical_irregular_subdivisions = true;
    settings.params.extraDefines.vertical_separator_config = "10|20";
    window.localStorage.setItem(key, JSON.stringify(settings));
  });
  await page.reload();

  await expect(page.getByText("3 total", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Divider Wall Thickness Bottom mm", { exact: true }),
  ).toBeEnabled();
});
