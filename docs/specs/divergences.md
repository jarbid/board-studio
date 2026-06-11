# Intentional divergences from BoardCAD-LE

The ledger required by CLAUDE.md principle 2 (golden-data rule, ported phase).
Every place where OpenShaper _deliberately_ differs from legacy behavior gets an
entry here: what changed, why, the magnitude, and the replacement oracle that
proves the new behavior is right. Accidental drift is still a bug — if a golden
test fails and there's no entry here, the code is wrong, not the fixture.

Adding an entry requires:

1. **A better oracle** — analytic cases, convergence tests, or a published
   reference that the new behavior is verified against (legacy stops being the
   ground truth for that value).
2. **Regenerated or re-banded fixtures** — the golden test changes in the same
   commit, with the new tolerance derivation documented.
3. **A row below.**

| Date       | Subsystem                                | What differs                                                                                                                                                                                | Magnitude vs legacy                                                                                                                                                                                                                                                                                                 | Why                                                                                                                                                                                           | Oracle                                                                                                                                                                                                                                     | Commit                            |
| ---------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| 2026-06-11 | `getVolume` / `getCenterOfMass` (kernel) | Longitudinal integral defaults to `adaptiveSimpson` (relTol `1e-5`) instead of the legacy fixed `VOLUME_Y_SPLITS=30` / `MASS_Y_SPLITS=10` Simpson. Inner cross-section trapezoid unchanged. | Volume: ≤ 0.016% vs legacy fixed-split (control-point boards), ≤ 1.3e-4 rel (sLinear longboard). CoM: ≤ 0.072 cm. All well inside the 1% / 0.5 cm golden bands. (The `1e-5` relTol was chosen because `1e-4` still leaves the funboard ~0.18% short of converged; `1e-5` lands within ~1e-4 of the 1e-9 reference.) | Legacy hard-coded 30/10 panels (CLAUDE.md principle 3). Adaptive refines only where the area-vs-x curve needs it, so it is at least as accurate everywhere for ~13–260 integrand calls/board. | Convergence: adaptive default agrees with a 4×-finer fixed Simpson to < 0.5% (`board.integration.test.ts`) and to < 1e-3 over the sLinear area curve (`board.slinear.test.ts`). Legacy splits still reproducible via `IntegrationOptions`. | feat/adaptive-integration-default |
| 2026-06-11 | `getArea` (kernel)                       | Planshape-area integral defaults to `adaptiveSimpson` (relTol `1e-5`) instead of the legacy fixed `AREA_SPLITS=10` Simpson.                                                                 | ≤ 0.75% larger than legacy (longboard; shortboard 0.42%, funboard 0.52%) — AREA_SPLITS was the least-converged legacy resolution.                                                                                                                                                                                   | Same as above; `AREA_SPLITS=10` left the longboard's width integral ~0.63–0.75% short of converged.                                                                                           | Adaptive default equals a 1e-9 adaptive integral of the width to < 0.01% (`board.integration.test.ts`); still inside the 1% golden area band. `getArea(b, 10)` reproduces the legacy value bit-for-bit.                                    | feat/adaptive-integration-default |

The sLinear golden **volume** band was relaxed 1e-4 → 1e-2 in the same commit
(`board.slinear.test.ts`), with a convergence-oracle test; the per-station
**area** band stays 1e-4 because the inner cross-section trapezoid
(`SLINEAR_AREA_SPLITS`) is deliberately left legacy-pinned.

## Known candidates (not yet diverged)

- _(none — the adaptive-integration candidates above have been actioned.)_
