"""Execute the published checkpoints; verify numerical meaning, not API presence."""
from pathlib import Path
import re
import unittest
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import cv2


class EdgeDetection(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        body = (Path(__file__).resolve().parents[2] / "content/concepts/image-processing/dip-edge-detection.mdx").read_text(encoding="utf-8")
        blocks = re.findall(r"```python\n(.*?)```", body, re.S)
        assert len(blocks) == 5
        cls.s = {}
        for block in blocks:
            exec(compile(block, "dip-edge-detection", "exec"), cls.s)
        plt.close("all")

    def test_constant_step_ramp(self):
        p = self.s["profiles"]
        np.testing.assert_array_equal(p["constant"], np.zeros(9))
        np.testing.assert_array_equal(p["step"], [0,0,0,80,80,0,0,0,0])
        np.testing.assert_array_equal(p["ramp"], [20,40,40,40,40,40,40,40,20])

    def test_vertical_horizontal(self):
        s = self.s
        self.assertEqual(s["gx"][3,3],80)
        self.assertEqual(s["gy"][3,3],0)
        self.assertEqual(s["hx"][3,3],0)
        self.assertEqual(s["hy"][3,3],80)

    def test_magnitude_orientation_polarity(self):
        s = self.s
        self.assertEqual(s["theta"][3,3],0)
        self.assertAlmostEqual(float(s["horizontal_theta"][3,3]),90)
        np.testing.assert_array_equal(s["rm"],s["mag"])
        _, gy, m = s["gradients"](s["reverse"].T)
        self.assertEqual(gy[3,3],-80)
        self.assertEqual(m[3,3],80)

    def test_contrast(self):
        s = self.s
        smaller = 30 + 0.5*(s["vertical"]-30)
        np.testing.assert_allclose(s["gradients"](smaller)[2],0.5*s["mag"])
        np.testing.assert_allclose(s["gradients"](s["double_contrast"])[2],2*s["mag"])

    def test_correlation_alignment(self):
        s = self.s
        np.testing.assert_allclose(s["gx"],cv2.filter2D(s["vertical"],cv2.CV_32F,s["kx"],borderType=cv2.BORDER_REPLICATE))
        np.testing.assert_allclose(-s["gx"],cv2.filter2D(s["vertical"],cv2.CV_32F,s["kx"][::-1,::-1],borderType=cv2.BORDER_REPLICATE))

    def test_signed_and_display(self):
        s = self.s
        self.assertEqual(s["rx"].dtype,np.float32)
        self.assertEqual(s["rx"][3,3],-80)
        self.assertEqual(s["bad_unsigned"][3,3],0)
        self.assertEqual(s["display_abs"][3,3],80)

    def test_noise_off_edge(self):
        s = self.s
        self.assertEqual(s["gradients"](s["clean"])[2][s["off"]].max(),0)
        self.assertGreater(s["magnitudes"]["raw"][s["off"]].mean(),20)
        self.assertGreater(s["records"]["raw",10,25]["off_count"],1000)

    def test_smoothing_and_thin_loss(self):
        s = self.s
        means = [s["magnitudes"][name][s["off"]].mean() for name in ("raw","light","strong")]
        self.assertGreater(means[0],means[1])
        self.assertGreater(means[1],means[2])
        a,b,c = s["thin_peaks"]
        self.assertEqual(a,160)
        self.assertGreater(a,b)
        self.assertGreater(b,c)
        self.assertLess(c,5)

    def test_canny_threshold_tradeoff(self):
        r = self.s["records"]
        self.assertGreater(r["raw",10,25]["off_count"],r["raw",40,100]["off_count"])
        self.assertEqual(r["raw",40,100]["thin_hit"],1)
        self.assertEqual(r["raw",150,300]["thin_hit"],0)
        self.assertEqual(r["strong",40,100]["main_hit"],0)

    def test_band_contract_and_simple_threshold(self):
        s = self.s
        self.assertEqual(np.count_nonzero(s["band"]),48*9)
        self.assertFalse(np.any(s["band"] & s["off"]))
        m=s["magnitudes"]["raw"]
        self.assertGreaterEqual(s["edge_checks"](m>25)["off_count"],s["edge_checks"](m>100)["off_count"])
        with self.assertRaises(ValueError): s["edge_checks"](np.zeros((1,1),bool))

    def test_source_and_representation(self):
        s=self.s
        np.testing.assert_array_equal(s["source"],s["snapshot"])
        np.testing.assert_array_equal(s["clean"],s["clean_snapshot"])
        self.assertEqual(s["source"].dtype,np.uint8)
        for edge in s["edges"].values():
            self.assertEqual(edge.shape,(64,96))
            self.assertEqual(edge.dtype,np.uint8)
            self.assertTrue(np.isin(edge,[0,255]).all())

    def test_invalid_contract(self):
        s=self.s
        for a,low,high in [(s["clean"],10,25),(s["source"],100,40),(np.zeros((0,2),np.uint8),10,25)]:
            with self.assertRaises(ValueError): s["canny_checked"](a,low,high)
        with self.assertRaises(ValueError): s["gradients"](np.array([[np.nan]]))

if __name__ == "__main__": unittest.main()
