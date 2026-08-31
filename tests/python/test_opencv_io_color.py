import os
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

import cv2
import numpy as np


WORKSPACE_ROOT = Path(__file__).resolve().parents[2]
FIXTURE_PATH = Path("public") / "media" / "opencv-io-color-fixture.ppm"


class OpenCvIoColorFixtureTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.original_working_directory = Path.cwd()
        os.chdir(WORKSPACE_ROOT)

    @classmethod
    def tearDownClass(cls) -> None:
        os.chdir(cls.original_working_directory)

    def test_known_pixels_prove_bgr_to_rgb_contract(self) -> None:
        image_bgr = cv2.imread(str(FIXTURE_PATH), cv2.IMREAD_COLOR)

        self.assertIsNotNone(image_bgr)
        assert image_bgr is not None
        self.assertEqual(image_bgr.shape, (2, 3, 3))
        self.assertEqual(image_bgr.dtype, np.uint8)
        self.assertEqual(image_bgr[0, 0].tolist(), [0, 0, 255])

        image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        self.assertEqual(image_rgb[0, 0].tolist(), [255, 0, 0])
        self.assertEqual(image_rgb[0, 2].tolist(), [0, 0, 255])

    def test_float_actual_range_preserves_fractional_values(self) -> None:
        float_image = np.array([[0.1, 0.4], [0.7, 0.9]], dtype=np.float32)

        actual_min = float_image.min().item()
        actual_max = float_image.max().item()

        self.assertIsInstance(actual_min, float)
        self.assertIsInstance(actual_max, float)
        self.assertAlmostEqual(actual_min, 0.1, places=6)
        self.assertAlmostEqual(actual_max, 0.9, places=6)
        self.assertNotEqual((actual_min, actual_max), (0, 0))

    def test_grayscale_is_two_dimensional(self) -> None:
        grayscale = cv2.imread(str(FIXTURE_PATH), cv2.IMREAD_GRAYSCALE)

        self.assertIsNotNone(grayscale)
        assert grayscale is not None
        self.assertEqual(grayscale.shape, (2, 3))
        self.assertEqual(grayscale.ndim, 2)

    def test_lossless_roundtrip_and_bgra_contract(self) -> None:
        image_bgr = cv2.imread(str(FIXTURE_PATH), cv2.IMREAD_COLOR)
        self.assertIsNotNone(image_bgr)
        assert image_bgr is not None

        with TemporaryDirectory() as temporary_directory:
            output_directory = Path(temporary_directory)
            roundtrip_path = output_directory / "fixture-roundtrip.png"

            write_succeeded = cv2.imwrite(str(roundtrip_path), image_bgr)
            self.assertTrue(write_succeeded)
            self.assertTrue(roundtrip_path.is_file())

            reloaded = cv2.imread(str(roundtrip_path), cv2.IMREAD_COLOR)
            self.assertIsNotNone(reloaded)
            assert reloaded is not None
            self.assertEqual(reloaded.shape, image_bgr.shape)
            self.assertEqual(reloaded.dtype, image_bgr.dtype)
            self.assertEqual(reloaded[0, 0].tolist(), [0, 0, 255])
            self.assertTrue(np.array_equal(reloaded, image_bgr))

            bgra = np.array(
                [
                    [[0, 0, 255, 255], [255, 0, 0, 64]],
                    [[0, 255, 0, 128], [255, 255, 255, 0]],
                ],
                dtype=np.uint8,
            )
            bgra_path = output_directory / "known-bgra.png"
            bgra_write_succeeded = cv2.imwrite(str(bgra_path), bgra)
            self.assertTrue(bgra_write_succeeded)

            bgra_reloaded = cv2.imread(str(bgra_path), cv2.IMREAD_UNCHANGED)
            self.assertIsNotNone(bgra_reloaded)
            assert bgra_reloaded is not None
            self.assertEqual(bgra_reloaded.shape, (2, 2, 4))
            self.assertEqual(bgra_reloaded[0, 1].tolist(), [255, 0, 0, 64])

    def test_missing_file_returns_none_before_shape_access(self) -> None:
        missing_path = FIXTURE_PATH.with_name("this-file-does-not-exist.png")

        self.assertFalse(missing_path.is_file())
        image = cv2.imread(str(missing_path), cv2.IMREAD_COLOR)
        self.assertIsNone(image)


if __name__ == "__main__":
    unittest.main()
