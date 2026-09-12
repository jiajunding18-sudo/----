"""Execute the lesson and verify changed-parameter numerical behavior."""
from pathlib import Path
import re
import unittest
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parents[2]


class NoiseModelsBehavior(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        body = (ROOT / "content/concepts/image-processing/dip-noise-models.mdx").read_text(encoding="utf-8")
        cls.scope = {}
        for block in re.findall(r"```python\n(.*?)```", body, re.S):
            exec(compile(block, "dip-noise-models", "exec"), cls.scope)
        plt.close("all")

    def test_seed_reproduces_but_generator_advances(self):
        rng = np.random.default_rng(72)
        first = rng.normal(0, 1, (128, 192))
        np.testing.assert_array_equal(first, self.scope["z"])
        self.assertFalse(np.array_equal(first, rng.normal(0, 1, first.shape)))
        self.assertFalse(np.array_equal(first, np.random.default_rng(73).normal(0, 1, first.shape)))

    def test_gaussian_new_sigma_and_regional_statistics(self):
        z = self.scope["z"]
        self.assertAlmostEqual((.08*z).std() / (.02*z).std(), 4)
        for start in (0, 64, 128):
            self.assertLess(abs((.08*z[:, start:start+64]).std() - .08), .005)

    def test_poisson_new_scale(self):
        clean = self.scope["clean"]
        residual = np.random.default_rng(73).poisson(clean*200) / 200 - clean
        for start in (0, 64, 128):
            part = residual[:, start:start+64]
            self.assertLess(abs(part.mean()), .005)
            self.assertLess(abs(part.std()/np.sqrt(clean[0, start]/200)-1), .1)

    def test_impulse_selection_and_source(self):
        s = self.scope
        np.testing.assert_array_equal(s["clean"], s["original"])
        np.testing.assert_array_equal(s["impulse"][~s["selected"]], s["clean"][~s["selected"]])
        self.assertAlmostEqual(s["replacement_fraction"], .04, delta=.01)

    def test_existing_extremes_do_not_measure_replacements(self):
        clean = self.scope["clean"].copy()
        clean[:, :64] = 0
        result = clean.copy()
        result[self.scope["pepper"]] = 0
        result[self.scope["salt"]] = 1
        self.assertGreater(np.count_nonzero((result == 0) | (result == 1)), self.scope["selected"].sum())
        np.testing.assert_array_equal(result[~self.scope["selected"]], clean[~self.scope["selected"]])

    def test_clipping_changes_statistics(self):
        s = self.scope
        self.assertLess(s["after"].mean(), s["before"].mean())
        self.assertLess(s["after"].std(), s["before"].std())
        brighter = .98 + s["noise_large"][:, 128:]
        self.assertGreater(np.mean(brighter > 1), s["clipped_fraction"])
        self.assertLess((np.clip(brighter, 0, 1)-.98).mean(), (brighter-.98).mean())

    def test_dtype_and_roundtrip(self):
        s = self.scope
        self.assertEqual(s["wrong"][0], 14)
        self.assertEqual(s["safe_raw"][0], 270)
        self.assertEqual(s["encoded"].dtype, np.uint8)
        self.assertLessEqual(np.abs(s["decoded"]-s["clipped"]).max(), .5/255+1e-12)
        self.assertLess(s["gaussian"].min(), 0)
        self.assertGreater(s["gaussian"].max(), 1)

    def test_new_seeds_support_trends_not_exact_sequence(self):
        clean = self.scope["clean"]
        for seed in (7, 123, 2026):
            noise = np.random.default_rng(seed).normal(0, .08, clean.shape)
            self.assertLess(abs(noise.mean()), .003)
            self.assertLess(abs(noise.std()-.08), .005)
            residual = np.random.default_rng(seed).poisson(clean*100)/100-clean
            self.assertGreater(residual[:,128:].std(), 2*residual[:,:64].std())


if __name__ == "__main__":
    unittest.main()
