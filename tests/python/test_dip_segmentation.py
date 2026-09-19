"""Execute the four lesson checkpoints and test segmentation decisions, not text."""
from pathlib import Path
import re
import unittest
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import cv2
import numpy as np


class Segmentation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        body = (Path(__file__).resolve().parents[2] /
                "content/concepts/image-processing/dip-segmentation.mdx").read_text(encoding="utf-8")
        cls.s = {}
        blocks = re.findall(r"```python\n(.*?)```", body, re.S)
        assert len(blocks) == 4
        for block in blocks:
            exec(compile(block, "dip-segmentation", "exec"), cls.s)
        plt.close("all")

    def test_deterministic_truth_and_input(self):
        s = self.s
        g = np.zeros((96,128), bool)
        g[28:60,20:36] = True
        g[28:60,88:104] = True
        g[72:75,24:27] = True
        np.testing.assert_array_equal(g, s["truth"])
        np.testing.assert_array_equal(s["a"], s["make_input"](100, s["z"]))
        self.assertEqual(g.sum(), 1033)

    def test_polarity_and_equality(self):
        s = self.s
        np.testing.assert_array_equal(s["bright"], [[0,0,255]])
        np.testing.assert_array_equal(s["dark"], [[255,0,0]])
        a = np.array([[49,50,51]], np.uint8)
        np.testing.assert_array_equal(s["fixed"](a,50), [[0,0,255]])
        np.testing.assert_array_equal(cv2.threshold(a,50,255,cv2.THRESH_BINARY_INV)[1],[[255,255,0]])

    def test_mask_and_boolean_conversion(self):
        for mask in self.s["predictions"].values():
            self.assertEqual(mask.shape, (96,128))
            self.assertEqual(mask.dtype, np.uint8)
            self.assertTrue(np.isin(mask,[0,255]).all())
            np.testing.assert_array_equal((mask>0).astype(np.uint8)*255, mask)

    def test_counts_and_iou_known_sets(self):
        g = np.array([[True,True],[False,False]])
        p = np.array([[255,0],[255,0]], np.uint8)
        self.assertEqual(self.s["score"](p,g), dict(TP=1,FP=1,FN=1,TN=1,IoU=1/3))
        for p in self.s["predictions"].values():
            r = self.s["score"](p,self.s["truth"])
            self.assertEqual(sum(r[k] for k in ("TP","FP","FN","TN")),p.size)

    def test_empty_union_and_invalid_contract(self):
        score = self.s["score"]
        g = np.zeros((2,2),bool)
        self.assertIsNone(score(np.zeros((2,2),np.uint8),g)["IoU"])
        for p in [np.zeros((3,2),np.uint8),np.ones((2,2),np.uint8),np.zeros((2,2),bool)]:
            with self.assertRaises(ValueError): score(p,g)
        with self.assertRaises(ValueError): score(np.zeros((2,2),np.uint8),g.astype(np.uint8))

    def test_sweep_and_illumination_failure(self):
        s = self.s
        for t, expected in [(100,(6798,0)),(130,(3225,400)),(160,(199,521))]:
            r=s["sweep"][t]
            self.assertEqual((r["FP"],r["FN"]),expected)
        # A left target is dimmer than a right background, even without noise.
        self.assertLess(60+100*28/127+45,60+100*115/127)
        self.assertGreater(s["score"](s["predictions"]["fixed 130"],s["truth"])["FP"],0)

    def test_otsu_returns_threshold_not_score(self):
        s = self.s
        self.assertEqual(s["otsu_t"],113)
        np.testing.assert_array_equal(s["otsu_mask"],s["fixed"](s["a"],s["otsu_t"]))
        two = np.array([[30,30],[200,200]],np.uint8)
        t,p = cv2.threshold(two,0,255,cv2.THRESH_BINARY|cv2.THRESH_OTSU)
        np.testing.assert_array_equal(p,[[0,0],[255,255]])
        self.assertGreaterEqual(t,30)
        self.assertLess(t,200)

    def test_adaptive_scale_and_offset(self):
        s = self.s
        r31=s["score"](s["local"](s["a"],31),s["truth"])
        r3=s["score"](s["local"](s["a"],3),s["truth"])
        self.assertEqual((r31["FP"],r31["FN"]),(136,1))
        self.assertGreater(r3["FN"],r31["FN"])
        p8=s["local"](s["a"],31,-8)>0
        p0=s["local"](s["a"],31,0)>0
        self.assertTrue(np.all(~p8|p0))
        for block in [1,4,0]:
            with self.assertRaises(ValueError): s["local"](s["a"],block)
        with self.assertRaises(ValueError): s["local"](s["a"].astype(float))
        with self.assertRaises(cv2.error):
            cv2.adaptiveThreshold(s["a"],255,cv2.ADAPTIVE_THRESH_MEAN_C,cv2.THRESH_BINARY,4,-8)

    def test_filtering_small_target_tradeoff(self):
        s=self.s
        light=s["variants"]["light local31"]
        strong=s["variants"]["strong local31"]
        self.assertEqual(np.count_nonzero(light[72:75,24:27]),9)
        self.assertEqual(np.count_nonzero(strong[72:75,24:27]),0)
        self.assertEqual(s["score"](light,s["truth"])["FN"],4)
        self.assertEqual(s["score"](strong,s["truth"])["FN"],91)

    def test_enhancement_can_increase_fp(self):
        s=self.s
        r=s["score"](s["variants"]["CLAHE40 local31"],s["truth"])
        self.assertEqual(r["FP"],3847)
        self.assertLess(r["IoU"],s["score"](s["predictions"]["local31"],s["truth"])["IoU"])

    def test_accuracy_trap(self):
        r=self.s["r"]
        self.assertEqual((r["TP"]+r["TN"])/10000,.99)
        self.assertEqual((r["TP"],r["FN"],r["IoU"]),(0,100,0))

    def test_frozen_input_and_source_protection(self):
        s=self.s
        self.assertEqual(s["frozen"],s["config_snapshot"])
        for key, snapshot in [("a","source_snapshot"),("b","b_snapshot"),("truth","truth_snapshot")]:
            np.testing.assert_array_equal(s[key],s[snapshot])
        self.assertFalse(np.array_equal(s["a"],s["b"]))
        r=s["score"](s["b_mask"],s["truth"])
        self.assertEqual((r["FP"],r["FN"]),(158,0))
        np.testing.assert_array_equal(s["run_frozen"](s["b"],s["frozen"]),s["b_mask"])


if __name__ == "__main__":
    unittest.main()
