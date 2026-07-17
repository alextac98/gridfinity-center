import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/bin-generator");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByLabel("Compartment layout")).toBeVisible();
});

test("the vertical Y rail adds a vertical divider", async ({ page }) => {
  await page.getByRole("button", { name: "Add Y divider" }).click();

  await expect(page.getByText("2 total", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Select Y divider at 21 mm" }),
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
  await position.fill("21");
  await position.blur();

  await expect(
    page.getByRole("button", { name: "Select X divider at 21 mm" }),
  ).toHaveAttribute("style", /top: 75%/);
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
  await page.getByRole("button", { name: "Add Y divider" }).click();
  await page
    .getByRole("button", { name: "Select Y divider at 21 mm" })
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

test("snaps a dragged divider to a major fraction", async ({ page }) => {
  await page.getByRole("button", { name: "Add Y divider" }).click();
  const divider = page.getByRole("button", {
    name: "Select Y divider at 21 mm",
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
    surfaceBox.x + surfaceBox.width * (15 / 42),
    surfaceBox.y + surfaceBox.height - 3,
    { steps: 8 },
  );
  await page.mouse.up();

  await expect(
    page.getByRole("button", { name: "Select Y divider at 14 mm" }),
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
  await page.getByRole("button", { name: "Add Y divider" }).click();

  const size = page.getByRole("textbox", {
    name: "X compartment 1 size mm",
    exact: true,
  });
  await expect(size).toHaveValue("19.3");
  await size.fill("30");
  await size.blur();

  await expect(
    page.getByRole("button", { name: "Select Y divider at 31.7 mm" }),
  ).toBeVisible();
  await expect(size).toHaveValue("30");
});

test("clicking away deselects the active divider", async ({ page }) => {
  await page.getByRole("button", { name: "Add Y divider" }).click();
  await page
    .getByRole("button", { name: "Select Y divider at 21 mm" })
    .click();

  await expect(
    page.getByRole("button", {
      name: "Remove Y divider at 21 mm",
      exact: true,
    }),
  ).toBeVisible();

  await page.getByText("Compartment Layout", { exact: true }).click();

  await expect(
    page.getByRole("button", {
      name: "Remove Y divider at 21 mm",
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

test("edits diagram measurements in inches while storing millimeters", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Add Y divider" }).click();
  await page.getByRole("button", { name: "Inches" }).click();

  const size = page.getByRole("textbox", {
    name: "X compartment 1 size in",
    exact: true,
  });
  await expect(size).toHaveValue("0.76");
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
  await page.getByRole("button", { name: "Add Y divider" }).click();
  await page
    .getByRole("button", { name: "Select Y divider at 21 mm" })
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
    .toBe("19.8");
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
