"""Execute the published four checkpoints and verify numerical teaching claims."""
from pathlib import Path
import re
import unittest
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np


class Restoration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        body = (Path(__file__).resolve().parents[2] / "content/concepts/image-processing/dip-restoration.mdx").read_text(encoding="utf-8")
        blocks = re.findall(r"```python\n(.*?)```", body, re.S)
        assert len(blocks) == 4
        cls.s = {}
        for block in blocks:
            exec(compile(block, "dip-restoration", "exec"), cls.s)
        plt.close("all")

    def test_truth_and_observation_contract(self):
        s = self.s
        self.assertEqual(s["clean"].shape, (32, 41))
        self.assertEqual(s["observed"].shape, (34, 43))
        self.assertEqual(s["observed"].dtype, np.float64)
        self.assertGreater(s["observed"].max(), 1)
        np.testing.assert_allclose(s["observed"] - s["blur_full"], s["noise"], atol=1e-15)

    def test_normalized_known_kernel(self):
        self.assertAlmostEqual(self.s["kernel"].sum(), 1)
        self.assertAlmostEqual(abs(self.s["H"][0, 0]), 1)
        self.assertAlmostEqual(abs(self.s["H"]).min(), .0010311563736291095, places=12)

    def test_full_spatial_frequency_alignment(self):
        s = self.s
        np.testing.assert_allclose(s["blur_full"], s["full_convolution"](s["clean"], s["kernel"]), atol=1e-12)
        # Asymmetric impulse rules out accidentally using correlation or a shifted origin.
        a = np.zeros((3, 4)); a[1, 2] = 1
        k = np.array([[1, 2], [3, 4]], dtype=float)
        full = s["full_convolution"](a, k)
        np.testing.assert_array_equal(full[1:3, 2:4], k)
        np.testing.assert_allclose(full, np.fft.ifft2(np.fft.fft2(a, s=(4, 5))*np.fft.fft2(k, s=(4, 5))).real, atol=1e-12)

    def test_ideal_inverse(self):
        self.assertEqual(self.s["blocked_ideal"], 0)
        np.testing.assert_allclose(self.s["ideal"], self.s["clean"], atol=1e-10)

    def test_noise_amplification_finite_not_reliable(self):
        s = self.s
        self.assertTrue(np.isfinite(s["naive"]).all())
        self.assertLess(s["naive"].min(), -.4)
        self.assertGreater(s["naive"].max(), 1.4)
        self.assertAlmostEqual(s["checks"](s["naive"])[0], .041771394266746587, places=10)
        self.assertGreater(s["checks"](s["naive"])[1], 50*s["sigma"])

    def test_noise_change_practice(self):
        s = self.s
        doubled, _ = s["naive_inverse"](np.fft.fft2(s["blur_full"] + 2*s["noise"]), s["H"])
        np.testing.assert_allclose(doubled-s["ideal"], 2*(s["naive"]-s["ideal"]), atol=1e-11)

    def test_zero_response_protection_not_information_recovery(self):
        s = self.s
        zero = np.zeros_like(s["H"])
        result, blocked = s["naive_inverse"](s["G"], zero)
        self.assertEqual(blocked, zero.size)
        np.testing.assert_array_equal(result, np.zeros_like(s["clean"]))
        self.assertFalse(np.array_equal(result, s["clean"]))

    def test_stabilization_tradeoff(self):
        s = self.s; checks = s["checks"]
        low, middle, high = (s["stable"][v] for v in s["lambdas"])
        self.assertLess(checks(middle)[0], checks(s["naive"])[0])
        self.assertGreater(checks(high)[0], checks(middle)[0])
        self.assertLess(checks(high)[1], checks(low)[1])
        self.assertLess(checks(high)[2], checks(low)[2])

    def test_lambda_guard(self):
        for lam in (0, -1, np.inf, np.nan):
            with self.assertRaises(ValueError):
                self.s["stabilized"](self.s["G"], self.s["H"], lam)

    def test_model_mismatch_same_observation(self):
        s = self.s
        np.testing.assert_array_equal(s["observed"], s["observed_snapshot"])
        expected = s["inverse_crop"](np.conj(s["wrong_H"])*s["G"]/(abs(s["wrong_H"])**2+.01))
        np.testing.assert_array_equal(expected, s["wrong"])
        self.assertAlmostEqual(s["checks"](s["wrong"])[0], .013559220812977092, places=10)
        self.assertGreater(s["checks"](s["wrong"])[0], s["checks"](s["stable"][.01])[0])

    def test_sharpening_is_not_inverse(self):
        s = self.s
        np.testing.assert_array_equal(s["sharpened"], 2*s["same_observed"]-s["local_mean"])
        self.assertLess(s["checks"](s["sharpened"])[2], .25)
        self.assertGreater(s["checks"](s["stable"][.01])[2], .5)

    def test_clipping_changes_error_and_is_not_analysis(self):
        s = self.s
        self.assertNotEqual(s["checks"](np.clip(s["naive"], 0, 1))[0], s["checks"](s["naive"])[0])
        self.assertLess(s["naive"].min(), 0)

    def test_complex_residue_guard(self):
        with self.assertRaises(AssertionError):
            self.s["real_checked"](np.ones((2, 2), dtype=complex)*1j)

    def test_source_protection(self):
        np.testing.assert_array_equal(self.s["clean"], self.s["clean_snapshot"])
        np.testing.assert_array_equal(self.s["observed"], self.s["observed_snapshot"])


if __name__ == "__main__":
    unittest.main()
