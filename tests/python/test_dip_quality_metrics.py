"""Execute the four published quality-metrics checkpoints and test metric boundaries."""
from pathlib import Path
import re
import unittest

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np


class QualityMetrics(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        body = (Path(__file__).resolve().parents[2] / "content/concepts/image-processing/dip-quality-metrics.mdx").read_text(encoding="utf-8")
        blocks = re.findall(r"```python\n(.*?)```", body, re.S)
        assert len(blocks) == 4
        cls.s = {}
        for block in blocks:
            exec(compile(block, "dip-quality-metrics", "exec"), cls.s)
        plt.close("all")

    def test_reference_and_source_protection(self):
        s = self.s
        self.assertEqual(s["reference"].shape, (16, 16))
        self.assertEqual(s["reference"].dtype, np.float64)
        np.testing.assert_array_equal(s["reference"], s["reference_snapshot"])
        self.assertEqual(np.count_nonzero(s["target_roi"]), 4)
        for name in ("background_error", "target_error", "widespread", "target_lost", "blurred"):
            self.assertFalse(np.shares_memory(s[name], s["reference"]))

    def test_mse_mae_and_large_error_weighting(self):
        s = self.s
        self.assertAlmostEqual(s["mse"](s["reference"], s["background_error"]), .0025)
        self.assertAlmostEqual(s["mae"](s["reference"], s["background_error"]), .00625)
        self.assertAlmostEqual(np.mean(np.array([.4, 0, 0, 0])**2), .04)
        self.assertAlmostEqual(np.mean(abs(np.array([.4, 0, 0, 0]))), .1)
        self.assertAlmostEqual(np.mean(np.array([.15]*4)**2), .0225)
        self.assertAlmostEqual(np.mean(abs(np.array([.15]*4))), .15)

    def test_psnr_explicit_range_and_identical_boundary(self):
        s = self.s
        r, c = s["reference"], s["background_error"]
        self.assertAlmostEqual(s["psnr"](r, c, 1), 26.02059991327962)
        self.assertEqual(s["psnr"](r, r.copy(), 1), float("inf"))
        for invalid in (0, -1, float("nan"), float("inf")):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                s["psnr"](r, c, invalid)

    def test_uint8_vs_normalized_scale_and_safe_subtraction(self):
        s = self.s
        r = np.array([[10, 250]], dtype=np.uint8)
        c = np.array([[250, 10]], dtype=np.uint8)
        self.assertEqual(s["mse"](r, c), 57600)
        self.assertAlmostEqual(s["mse"](r/255, c/255), 57600/255**2)
        self.assertAlmostEqual(s["psnr"](r, c, 255), s["psnr"](r/255, c/255, 1))

    def test_same_score_different_spatial_failure(self):
        s = self.s
        r, roi = s["reference"], s["target_roi"]
        a, b = s["background_error"], s["target_error"]
        self.assertAlmostEqual(s["mse"](r, a), s["mse"](r, b))
        self.assertAlmostEqual(s["mae"](r, a), s["mae"](r, b))
        self.assertAlmostEqual(s["psnr"](r, a, 1), s["psnr"](r, b, 1))
        self.assertEqual(s["masked_mse"](r, a, roi), 0)
        self.assertAlmostEqual(s["masked_mse"](r, b, roi), .16)
        self.assertEqual(np.count_nonzero(a-r), 4)
        self.assertEqual(np.count_nonzero(b-r), 4)
        self.assertAlmostEqual(np.mean(a-r), .00625)
        self.assertAlmostEqual(np.mean(b-r), -.00625)
        self.assertAlmostEqual(np.std(a-r), np.std(b-r))

    def test_lower_global_mse_can_lose_target(self):
        s = self.s
        r, roi = s["reference"], s["target_roi"]
        a, b = s["widespread"], s["target_lost"]
        self.assertAlmostEqual(s["mse"](r, a), .0221484375)
        self.assertAlmostEqual(s["mse"](r, b), .01)
        self.assertEqual(s["masked_mse"](r, a, roi), 0)
        self.assertAlmostEqual(s["masked_mse"](r, b, roi), .64)
        self.assertAlmostEqual(b[roi].mean(), .2)

    def test_mask_shape_type_and_empty_rejected(self):
        s = self.s
        r = s["reference"]
        for mask in (np.zeros((15, 16), bool), np.zeros((16, 16), np.uint8), np.zeros((16, 16), bool)):
            with self.subTest(shape=mask.shape, dtype=mask.dtype), self.assertRaises(ValueError):
                s["masked_mse"](r, r, mask)

    def test_shape_finite_and_numeric_contract(self):
        s = self.s
        r = s["reference"]
        invalid = [r[:1], np.empty((0, 0)), np.full((16, 16), np.nan),
                   np.full((16, 16), np.inf), r.astype(str), r.astype(bool)]
        for candidate in invalid:
            with self.subTest(dtype=candidate.dtype, shape=candidate.shape), self.assertRaises(ValueError):
                s["mse"](r, candidate)

    def test_blur_and_clipping_local_counterexamples(self):
        s = self.s
        roi = s["target_roi"]
        self.assertLess(s["blurred"][roi].mean(), s["reference"][roi].mean())
        self.assertGreater(np.mean(s["saturated"] == 1), np.mean(s["reference"] == 1))
        for name in ("blurred", "brightness_shift", "saturated"):
            self.assertTrue(np.isfinite(s[name]).all())


if __name__ == "__main__":
    unittest.main()
