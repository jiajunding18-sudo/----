"""Execute the published MDX examples, then probe their assumptions independently."""
from pathlib import Path
import re
import unittest

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import cv2

ROOT = Path(__file__).resolve().parents[2]


def run_lesson(slug):
    body = (ROOT / "content/concepts/image-processing" / f"{slug}.mdx").read_text(encoding="utf-8")
    scope = {}
    for block in re.findall(r"```python\n(.*?)```", body, re.S):
        exec(compile(block, slug, "exec"), scope)
    plt.close("all")
    return scope


class WaveOneBehavior(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.s = run_lesson("dip-sampling-quantization")
        cls.c = run_lesson("dip-convolution-lsi")

    def test_sampling_phase_and_prefilter(self):
        self.assertEqual(self.s["direct"].mean(), 0)
        self.assertEqual(self.s["other_phase"].mean(), 1)
        self.assertEqual(self.s["filtered_down"].mean(), .5)
        self.assertTrue(np.array_equal(self.s["source"], self.s["original"]))

    def test_wider_stripes(self):
        row = np.array([0, 0, 1, 1, 0, 0, 1, 1])
        np.testing.assert_array_equal(row[::2], [0, 1, 0, 1])
        np.testing.assert_array_equal(row[::2], row[1::2])

    def test_quantization_practice(self):
        q = self.s["quantize_unit"]
        ramp = self.s["ramp"]
        self.assertLessEqual(np.max(np.abs(q(ramp, 8) - ramp)), 1 / 14 + 1e-6)
        np.testing.assert_allclose(q(np.array([.4]), 8), [3 / 7])
        for bad in (np.array([255.]), np.array([np.nan])):
            with self.assertRaises(ValueError):
                q(bad, 4)

    def test_asymmetric_manual_and_library(self):
        f = self.c["manual_convolution"]
        k = np.array([[0, 0, 0], [1, 2, 0], [0, 0, 0]], dtype=np.float32)
        p = self.c["patch"]
        self.assertEqual(f(p, k)[1, 1], 16)
        self.assertEqual(cv2.filter2D(p, -1, k)[1, 1], 14)
        for border, cv_border in (("constant", cv2.BORDER_CONSTANT), ("edge", cv2.BORDER_REPLICATE)):
            np.testing.assert_allclose(f(p, k, border), cv2.filter2D(p, cv2.CV_32F, k[::-1, ::-1], borderType=cv_border), atol=1e-5)

    def test_linearity_new_coefficients(self):
        T = self.c["T"]
        a, b = self.c["impulse"], self.c["edge"]
        np.testing.assert_allclose(T(.5*a + 3*b), .5*T(a) + 3*T(b), atol=1e-6)

    def test_shift_internal_and_boundary_limit(self):
        T = self.c["T"]
        a = self.c["impulse"]
        shifted = np.zeros_like(a)
        shifted[1:] = a[:-1]
        expected = np.zeros_like(a)
        expected[1:] = T(a)[:-1]
        np.testing.assert_array_equal(T(shifted), expected)
        # Cropping an edge response before shifting loses information.
        border_point = np.zeros_like(a)
        border_point[3, 0] = 1
        moved = np.zeros_like(a)
        moved[:, 1:] = border_point[:, :-1]
        cropped_shift = np.zeros_like(a)
        cropped_shift[:, 1:] = T(border_point)[:, :-1]
        self.assertFalse(np.array_equal(T(moved), cropped_shift))

    def test_saturation_and_source(self):
        self.assertEqual(self.c["edge_response"][3, 3], -20)
        self.assertEqual(self.c["saturated"][3, 3], 0)
        np.testing.assert_array_equal(self.c["edge"], self.c["original"])

    def test_invalid_kernel(self):
        with self.assertRaises(ValueError):
            self.c["manual_convolution"](np.ones((3, 3)), np.ones((2, 2)))


if __name__ == "__main__":
    unittest.main()
