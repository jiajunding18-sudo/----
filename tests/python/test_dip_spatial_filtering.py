"""Execute the lesson, then test numeric contracts independently."""
from pathlib import Path
import re
import unittest
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import cv2
import numpy as np


class SpatialFiltering(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        body = (Path(__file__).resolve().parents[2] / "content/concepts/image-processing/dip-spatial-filtering.mdx").read_text(encoding="utf-8")
        cls.s = {}
        for block in re.findall(r"```python\n(.*?)```", body, re.S):
            exec(compile(block, "dip-spatial-filtering", "exec"), cls.s)
        plt.close("all")

    def test_seed_and_corruption(self):
        s = self.s
        z = np.random.default_rng(83).normal(0, .06, s["clean"].shape).astype(np.float32)
        np.testing.assert_array_equal(s["gaussian_input"], s["clean"] + z)
        selected = s["draws"] < .05
        self.assertTrue(.04 < selected.mean() < .06)
        np.testing.assert_array_equal(s["impulse_input"][~selected], s["clean"][~selected])

    def test_all_outputs_and_source(self):
        s = self.s
        np.testing.assert_array_equal(s["clean"], s["original"])
        for outputs in s["results"].values():
            for y in outputs.values():
                self.assertEqual(y.shape, (96, 128))
                self.assertEqual(y.dtype, np.float32)
                self.assertTrue(np.isfinite(y).all())
        self.assertGreater(s["gaussian_input"].max(), 0.9)

    def test_box_normalization_border(self):
        x = np.arange(1, 10, dtype=np.float32).reshape(3, 3)
        y = cv2.blur(x, (3, 3), borderType=cv2.BORDER_REPLICATE)
        np.testing.assert_allclose(y, cv2.boxFilter(x, -1, (3, 3), normalize=True, borderType=cv2.BORDER_REPLICATE))
        self.assertAlmostEqual(float(y[0, 0]), 21 / 9, places=6)
        padded = np.pad(x, 1, mode="edge")
        expected = np.array([[np.median(padded[r:r+3, c:c+3]) for c in range(3)] for r in range(3)], dtype=np.float32)
        np.testing.assert_array_equal(cv2.medianBlur(x, 3), expected)

    def test_gaussian_noise_tradeoff(self):
        check = self.s["checks"]
        y = self.s["results"]["Gaussian"]
        self.assertLess(check(y["mean5"])[1], check(y["raw"])[1])
        self.assertLess(check(y["mean5"])[2], check(y["raw"])[2] / 2)
        self.assertGreater(check(y["mean5"])[0], check(y["raw"])[0])
        np.testing.assert_allclose(check(y["gauss5"]), [.001821, .017034, .238570, .534129], atol=2e-6)

    def test_impulse_not_universal_winner(self):
        check = self.s["checks"]
        y = self.s["results"]["Impulse"]
        self.assertLess(check(y["median3"])[0], check(y["mean5"])[0])
        self.assertGreater(check(y["bilateral"])[0], check(y["median3"])[0] * 10)

    def test_gaussian_parameter_scale(self):
        x, check = self.s["gaussian_input"], self.s["checks"]
        values = [check(cv2.GaussianBlur(x, (k, k), sigma, sigmaY=sigma, borderType=cv2.BORDER_REPLICATE)) for k, sigma in [(3, .6), (5, 1.), (9, 2.)]]
        self.assertTrue(values[0][1] > values[1][1] > values[2][1])
        self.assertTrue(values[0][2] > values[1][2] > values[2][2])

    def test_bilateral_parameter_failure(self):
        x, check = self.s["gaussian_input"], self.s["checks"]
        small, middle, large = [check(cv2.bilateralFilter(x, 9, v, 2., borderType=cv2.BORDER_REPLICATE)) for v in [.005, .12, 2.]]
        self.assertGreater(small[1], middle[1] * 2)
        self.assertLess(large[2], middle[2] / 2)

    def test_thin_structure_loss(self):
        np.testing.assert_array_equal(self.s["thin"], self.s["thin_snapshot"])
        self.assertAlmostEqual(float(self.s["lost"][10, 10]), .2, places=6)
        thick = self.s["thin"].copy()
        thick[:, 9:12] = .9
        self.assertAlmostEqual(float(cv2.medianBlur(thick, 5)[10, 10]), .9, places=6)

    def test_float_median_kernel_boundary(self):
        with self.assertRaises(cv2.error):
            cv2.medianBlur(self.s["clean"], 7)
        with self.assertRaises(cv2.error):
            cv2.medianBlur(self.s["clean"], 4)
        with self.assertRaises(cv2.error):
            cv2.bilateralFilter(self.s["clean"].astype(np.float64), 9, .12, 2.)

    def test_new_seed_and_no_hidden_mutation(self):
        clean = self.s["clean"]
        x = clean + np.random.default_rng(101).normal(0, .04, clean.shape).astype(np.float32)
        before = x.copy()
        outputs = self.s["candidates"](x)
        np.testing.assert_array_equal(x, before)
        self.assertLess(self.s["checks"](outputs["gauss5"])[1], self.s["checks"](x)[1])


if __name__ == "__main__":
    unittest.main()
