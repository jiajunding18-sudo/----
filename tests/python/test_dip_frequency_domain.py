"""Execute published examples, then independently check DFT contracts."""
from pathlib import Path
import re
import unittest
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np


class FrequencyDomain(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        body = (Path(__file__).resolve().parents[2] / "content/concepts/image-processing/dip-frequency-domain.mdx").read_text(encoding="utf-8")
        cls.s = {}
        for block in re.findall(r"```python\n(.*?)```", body, re.S):
            exec(compile(block, "dip-frequency-domain", "exec"), cls.s)
        plt.close("all")

    def test_constant_dc(self):
        f = self.s["dc"]
        self.assertAlmostEqual(f[0, 0].real, 512)
        self.assertEqual(np.count_nonzero(np.abs(f) > 1e-10), 1)

    def test_stripe_peaks(self):
        for name, expected in [("vertical4", [[16,12],[16,20]]),
                               ("vertical8", [[16,8],[16,24]]),
                               ("horizontal4", [[12,16],[20,16]])]:
            m = np.abs(np.fft.fftshift(np.fft.fft2(self.s[name])))
            m[16,16] = 0
            np.testing.assert_array_equal(np.argwhere(m > 1e-8), expected)

    def test_changed_frequency_orientation(self):
        for kx, ky, expected in [(6,0,[[16,10],[16,22]]), (0,6,[[10,16],[22,16]])]:
            a = self.s["stripes"](kx,ky)
            f = np.fft.fftshift(np.fft.fft2(a)); f[16,16] = 0
            np.testing.assert_array_equal(np.argwhere(np.abs(f)>1e-8), expected)
        self.assertEqual(self.s["freq"][22], 0.1875)

    def test_roundtrip_and_dtype(self):
        for a in self.s["patterns"] + [self.s["square"]]:
            f = np.fft.fft2(a)
            self.assertEqual(f.shape,a.shape)
            self.assertTrue(np.iscomplexobj(f))
            np.testing.assert_allclose(self.s["real_checked"](np.fft.ifft2(f)),a,atol=1e-10,rtol=0)

    def test_shift_display_not_analysis(self):
        f = self.s["F"]
        np.testing.assert_array_equal(np.fft.ifftshift(np.fft.fftshift(f)), f)
        odd = np.arange(35).reshape(5,7)
        np.testing.assert_array_equal(np.fft.ifftshift(np.fft.fftshift(odd)),odd)
        self.assertFalse(np.array_equal(np.fft.fftshift(np.fft.fftshift(odd)),odd))
        np.testing.assert_array_equal(np.sort(np.abs(f).ravel()),np.sort(np.abs(np.fft.fftshift(f)).ravel()))
        display = np.log1p(np.abs(f))
        self.assertFalse(np.allclose(np.fft.ifft2(display),self.s["square"]))

    def test_phase_and_circular_shift(self):
        f,g=self.s["F"],self.s["G"]
        np.testing.assert_allclose(np.abs(f),np.abs(g),atol=1e-10,rtol=0)
        self.assertGreater(np.max(np.abs(self.s["phase_delta"])),1)
        self.assertFalse(np.allclose(self.s["zero_phase"], self.s["square"]))
        fy,fx=np.meshgrid(np.fft.fftfreq(32),np.fft.fftfreq(32),indexing="ij")
        np.testing.assert_allclose(g,f*np.exp(-2j*np.pi*(fy*3+fx*5)),atol=1e-10,rtol=0)

    def test_imaginary_guard(self):
        for z in [np.array([[1+0.01j]]), np.array([[np.nan+0j]])]:
            with self.assertRaises(ValueError): self.s["real_checked"](z)

    def test_circular_artifact(self):
        expected=np.zeros((4,5)); expected[:2,:2]=[[1,2],[3,4]]
        np.testing.assert_allclose(self.s["naive"],expected,atol=1e-10,rtol=0)
        self.assertFalse(np.allclose(self.s["naive"],self.s["spatial_full"][:4,:5]))

    def test_padded_full_and_crop(self):
        expected=np.zeros((6,7)); expected[4:6,5:7]=[[1,2],[3,4]]
        np.testing.assert_array_equal(self.s["spatial_full"],expected)
        np.testing.assert_allclose(self.s["padded"],expected,atol=1e-10,rtol=0)
        self.assertEqual(self.s["same"].shape,(4,5))
        np.testing.assert_allclose(self.s["same"],self.s["spatial_same"],atol=1e-10,rtol=0)

    def test_new_input_orientation_and_boundary(self):
        a=np.arange(1,21,dtype=float).reshape(4,5)
        k=self.s["kernel"]
        full=self.s["full_convolution"](a,k)
        f=np.fft.ifft2(np.fft.fft2(a,s=(6,7))*np.fft.fft2(k,s=(6,7)))
        np.testing.assert_allclose(f,full,atol=1e-10,rtol=0)
        correlation=np.zeros_like(a)
        pad=np.pad(a,1)
        for r in range(4):
            for c in range(5): correlation[r,c]=np.sum(pad[r:r+3,c:c+3]*k)
        self.assertFalse(np.allclose(correlation,full[1:5,1:6]))
        replicate=np.pad(a,1,mode="edge")
        self.assertEqual(full[1,1],1)
        self.assertEqual(np.sum(replicate[:3,:3]*k[::-1,::-1]),10)
        self.assertNotEqual(np.sum(replicate[:3,:3]*k[::-1,::-1]),full[1,1])

    def test_mask_is_not_noise_removal(self):
        s=self.s
        np.testing.assert_allclose(s["low"]+s["high"],s["square"],atol=1e-10,rtol=0)
        self.assertLess(s["low"].min(),0)
        self.assertGreater(s["low"].max(),1)
        self.assertGreater(np.max(np.abs(s["low"]-s["square"])),.5)
        self.assertLess(np.max(np.abs(np.diff(s["low"],axis=1))),.3)

    def test_source_protection(self):
        np.testing.assert_array_equal(self.s["square"],self.s["snapshot"])
        np.testing.assert_array_equal(self.s["small"],self.s["small_snapshot"])


if __name__ == "__main__":
    unittest.main()
