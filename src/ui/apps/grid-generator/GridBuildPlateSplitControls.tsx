"use client";

import type { Dispatch, SetStateAction } from "react";
import type { GridfinityBaseplateParameters } from "@/shared/gridfinityBaseplate";
import { SelectField } from "@/ui/apps/openscad/parameterControls";
import styles from "@/ui/apps/openscad/generator.module.css";
import { buildPlateModeOptions, splitDistributionOptions } from "./gridOptions";

type GridBuildPlateSplitControlsProps = {
  params: GridfinityBaseplateParameters;
  setParams: Dispatch<SetStateAction<GridfinityBaseplateParameters>>;
  clearRenderError: () => void;
};

export function GridBuildPlateSplitControls({
  params,
  setParams,
  clearRenderError,
}: GridBuildPlateSplitControlsProps) {
  const buildPlateDisabled = params.buildPlateMode === "disabled";

  const updateParams = (
    updater: SetStateAction<GridfinityBaseplateParameters>,
  ) => {
    clearRenderError();
    setParams(updater);
  };

  return (
    <div className={styles.buildPlateSplitControls}>
      <SelectField
        fullWidth
        label="Split for Build Plate"
        onChange={(buildPlateMode) =>
          updateParams((current) => ({ ...current, buildPlateMode }))
        }
        options={buildPlateModeOptions}
        value={params.buildPlateMode}
      />
      <SelectField
        disabled={buildPlateDisabled}
        fullWidth
        label="Split Distribution"
        onChange={(splitDistribution) =>
          updateParams((current) => ({
            ...current,
            averagePlateSizes: splitDistribution === "balanced",
          }))
        }
        options={splitDistributionOptions}
        value={params.averagePlateSizes ? "balanced" : "full-first"}
      />
    </div>
  );
}
