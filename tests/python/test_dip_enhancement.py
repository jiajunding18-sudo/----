"""Run the published checkpoints and independently verify enhancement contracts."""
from pathlib import Path
import re
import unittest
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import cv2


class Enhancement(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        body = (Path(__file__).resolve().parents[2] /
                "content/concepts/image-processing/dip-enhancement.mdx").read_text(encoding="utf-8")
        cls.s = {}
        for block in re.findall(r"```python\n(.*?)```", body, re.S):
            exec(compile(block, "dip-enhancement", "exec"), cls.s)
        plt.close("all")

    def test_deterministic_input(self):
        s = self.s
        expected = s["clean"] + np.random.default_rng(42).normal(0, .003, (96, 128))
        np.testing.assert_array_equal(s["raw"], expected)
        self.assertEqual(s["base"].shape, (96,128))

    def test_encoding_not_enhancement(self):
        s = self.s
        self.assertEqual(s["encoded"].dtype, np.uint8)
        self.assertLessEqual(np.max(np.abs(s["base"]-s["raw"])), .5/255+1e-12)
        self.assertFalse(np.array_equal(s["base"],s["raw"]))
        np.testing.assert_array_equal(s["base"],s["snapshot"])

    def test_display_only_does_not_mutate(self):
        a = self.s["base"].copy()
        original = a.copy()
        fig, axes = plt.subplots(1,2)
        for ax, lim in zip(axes,[(0,1),(.29,.34)]):
            ax.imshow(a,cmap="gray",vmin=lim[0],vmax=lim[1])
        self.assertNotEqual(axes[0].images[0].get_clim(), axes[1].images[0].get_clim())
        np.testing.assert_array_equal(a,original)
        plt.close(fig)

    def test_linear_scales_signal_and_variation(self):
        s = self.s
        original, stretched = s["checks"](s["base"]), s["checks"](s["linear"])
        self.assertAlmostEqual(stretched[0],original[0]/.30)
        self.assertAlmostEqual(stretched[1],original[1]/.30)

    def test_outliers_and_window_tradeoff(self):
        s = self.s
        np.testing.assert_array_equal(s["minmax"],s["outlier_input"])
        self.assertGreater(s["checks"](s["robust"])[0],s["checks"](s["minmax"])[0]*3)
        self.assertGreater(np.count_nonzero((s["outlier_input"]<s["p_lo"]) |
                                           (s["outlier_input"]>s["p_hi"])),0)
        with self.assertRaises(ValueError): s["window"](s["base"],.5,.5)

    def test_power_direction_and_local_difference(self):
        s=self.s
        np.testing.assert_allclose(s["values"]**.5,[.1,.2,.5,.9])
        self.assertTrue(np.all(s["power_half"]>=s["base"]))
        self.assertTrue(np.all(s["power_two"]<=s["base"]))
        self.assertLess(s["checks"](s["power_half"])[1],s["checks"](s["base"])[1])

    def test_equalization_not_perfect_uniformity(self):
        s=self.s
        # Two equally populated input levels remain two levels, not 256 bins.
        a=np.array([[10,10],[20,20]],dtype=np.uint8)
        np.testing.assert_array_equal(cv2.equalizeHist(a),[[0,0],[255,255]])
        self.assertEqual(np.count_nonzero(s["hist"]),17)
        np.testing.assert_array_equal(np.sort(s["encoded"].ravel()),
                                      np.sort(s["encoded"][::-1].ravel()))
        self.assertFalse(np.array_equal(s["encoded"],s["encoded"][::-1]))

    def test_api_dtype_and_channel_guards(self):
        for bad in [np.zeros((8,8),np.float32),np.zeros((8,8,3),np.uint8)]:
            for fn in [cv2.equalizeHist,cv2.createCLAHE().apply]:
                with self.assertRaises(cv2.error): fn(bad)

    def test_clahe_reproducible_and_grid_contract(self):
        s=self.s
        obj=cv2.createCLAHE(clipLimit=2.0,tileGridSize=(4,4))
        self.assertEqual(obj.getTilesGridSize(),(4,4))
        self.assertEqual(obj.getClipLimit(),2.0)
        np.testing.assert_array_equal(obj.apply(s["encoded"]),s["clahe2_u8"])
        self.assertEqual(s["clahe2_u8"].dtype,np.uint8)
        self.assertEqual(s["clahe2_u8"].shape,s["base"].shape)

    def test_overenhancement_failure(self):
        s=self.s
        get=s["checks"]
        self.assertGreater(get(s["results"]["CLAHE 40"])[1],get(s["results"]["CLAHE 2"])[1]*10)
        self.assertGreater(get(s["results"]["global HE"])[1],get(s["base"])[1]*20)

    def test_clipping_is_not_denoising(self):
        s=self.s
        self.assertEqual(s["clipped_count"],5592)
        self.assertLess(s["checks"](s["aggressive_window"])[1],s["checks"](s["base"])[1])
        np.testing.assert_array_equal(s["lost"],[0,0,0])
        # Endpoints can exist without clipping: do not equate the two counters.
        a=np.array([0.,.5,1.])
        self.assertEqual(np.count_nonzero((a<0)|(a>1)),0)
        self.assertEqual(np.count_nonzero((a==0)|(a==1)),2)

    def test_checks_and_source_contract(self):
        s=self.s
        for a in s["results"].values():
            expected=abs(float(np.mean(a[32:56,20:44]))-float(np.mean(a[60:84,20:44])))
            self.assertAlmostEqual(s["checks"](a)[0],expected)
            self.assertTrue(np.isfinite(a).all())
            self.assertGreaterEqual(a.min(),0)
            self.assertLessEqual(a.max(),1)
        np.testing.assert_array_equal(s["base"],s["snapshot"])


if __name__ == "__main__":
    unittest.main()
