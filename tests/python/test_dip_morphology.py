"""Run lesson checkpoints and verify geometry rather than API invocation alone."""
from pathlib import Path
import re
import unittest
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import cv2


class Morphology(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        body = (Path(__file__).resolve().parents[2] / "content/concepts/image-processing/dip-morphology.mdx").read_text(encoding="utf-8")
        cls.s = {}
        blocks = re.findall(r"```python\n(.*?)```", body, re.S)
        assert len(blocks) == 4
        for block in blocks:
            exec(compile(block, "dip-morphology", "exec"), cls.s)
        plt.close("all")

    def test_size_geometry(self):
        s = self.s
        for n, area_e, area_d in [(1,40,40),(3,18,70),(5,4,108)]:
            e = s["morph"](s["rect"], cv2.MORPH_ERODE, s["kernel"](n))
            d = s["morph"](s["rect"], cv2.MORPH_DILATE, s["kernel"](n))
            self.assertEqual(s["geometry"](e)["area"], area_e)
            self.assertEqual(s["geometry"](d)["area"], area_d)
            self.assertEqual(s["geometry"](e)["components"], 1)
        self.assertEqual(s["geometry"](s["morph"](s["rect"], cv2.MORPH_ERODE,s["kernel"](3)))["bbox"], (11,11,6,3))

    def test_shape(self):
        self.assertEqual(np.count_nonzero(self.s["square"]), 9)
        self.assertEqual(np.count_nonzero(self.s["cross"]), 5)

    def test_open_success(self):
        s = self.s
        self.assertEqual(s["errors"](s["success_source"], s["large"])["FP"],3)
        self.assertEqual(s["errors"](s["success_open"], s["large"]),dict(FP=0,FN=0,IoU=1))

    def test_open_failure(self):
        s = self.s
        self.assertEqual(s["errors"](s["opened"],s["truth_b"])["FN"],12)
        self.assertAlmostEqual(s["errors"](s["opened"],s["truth_b"])["IoU"],80/92)

    def test_direction_practice(self):
        for shape, expected in [((1,3),8),((3,1),0)]:
            out = self.s["morph"](self.s["source_b"],cv2.MORPH_OPEN,np.ones(shape,np.uint8))
            self.assertEqual(np.count_nonzero(out[20,6:14]),expected)

    def test_close_success(self):
        s = self.s
        self.assertEqual(s["errors"](s["hole"],s["truth_hole"])["FN"],1)
        self.assertEqual(s["errors"](s["filled"],s["truth_hole"])["IoU"],1)

    def test_close_merge(self):
        s = self.s
        self.assertEqual(s["geometry"](s["pair"])["components"],2)
        self.assertEqual(s["geometry"](s["joined"])["components"],1)
        self.assertEqual(s["geometry"](s["pair"])["bbox"],s["geometry"](s["joined"])["bbox"])
        self.assertAlmostEqual(s["errors"](s["joined"],s["truth_pair"])["IoU"],96/112)

    def test_gray(self):
        self.assertEqual(self.s["gray_eroded"][1,1],10)
        self.assertEqual(self.s["gray_dilated"][1,1],90)

    def test_invalid_and_empty(self):
        s = self.s
        with self.assertRaises(ValueError): s["kernel"](4)
        with self.assertRaises(ValueError): s["morph"](s["rect"].astype(float),cv2.MORPH_OPEN,s["kernel"](3))
        self.assertEqual(s["geometry"](np.zeros_like(s["rect"])),dict(area=0,components=0,bbox=None))

    def test_source_protection(self):
        s = self.s
        for a,b in [("rect","rect_snapshot"),("source_b","snapshot_b"),("pair","pair_snapshot"),("hole","hole_snapshot"),("truth_b","truth_b_snapshot"),("truth_pair","truth_pair_snapshot"),("gray","gray_snapshot")]:
            np.testing.assert_array_equal(s[a],s[b])

if __name__ == "__main__": unittest.main()
