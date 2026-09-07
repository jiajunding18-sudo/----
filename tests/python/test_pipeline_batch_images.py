import json
import re
import tempfile
import unittest
from pathlib import Path
from typing import Callable
from unittest import mock

import cv2
import numpy as np


ALLOWED_SUFFIXES = (".png", ".jpg", ".jpeg", ".bmp")


class BatchPreflightError(RuntimeError):
    pass


class ItemFailure(RuntimeError):
    def __init__(
        self,
        expected: str,
        actual: str,
        reason: str,
        correction: str,
    ) -> None:
        super().__init__(reason)
        self.expected = expected
        self.actual = actual
        self.reason = reason
        self.correction = correction


def default_config() -> dict[str, object]:
    return {
        "allowed_suffixes": list(ALLOWED_SUFFIXES),
        "threshold": 127,
        "output_extension": ".png",
        "continue_on_error": True,
        "output_policy": "error-on-existing",
    }


def validate_config(config: dict[str, object]) -> None:
    threshold = config.get("threshold")
    if not isinstance(threshold, int) or not 0 <= threshold <= 255:
        raise BatchPreflightError("threshold 必须是 0–255 的整数")
    if config.get("output_extension") != ".png":
        raise BatchPreflightError("本实验正式输出必须使用 .png")
    if config.get("output_policy") != "error-on-existing":
        raise BatchPreflightError("本实验只实现 error-on-existing")
    if not isinstance(config.get("continue_on_error"), bool):
        raise BatchPreflightError("continue_on_error 必须是 bool")
    suffixes = config.get("allowed_suffixes")
    if not isinstance(suffixes, list) or not suffixes:
        raise BatchPreflightError("allowed_suffixes 必须是非空 list")


def stable_regular_files(input_dir: Path) -> list[Path]:
    return sorted(
        [path for path in input_dir.iterdir() if path.is_file()],
        key=lambda path: (path.name.casefold(), path.name),
    )


def output_name_for(input_path: Path) -> str:
    suffix_token = input_path.suffix.removeprefix(".").lower()
    return f"{input_path.stem}__{suffix_token}.png"


def build_output_plan(
    eligible: list[Path], output_dir: Path
) -> dict[Path, Path]:
    output_plan: dict[Path, Path] = {}
    names_by_casefold: dict[str, Path] = {}
    for input_path in eligible:
        output_path = output_dir / output_name_for(input_path)
        collision_key = output_path.name.casefold()
        previous = names_by_casefold.get(collision_key)
        if previous is not None:
            raise BatchPreflightError(
                f"output-name collision: {previous.name} 与 {input_path.name}"
            )
        names_by_casefold[collision_key] = input_path
        output_plan[input_path] = output_path
    return output_plan


def preflight(
    input_dir: Path,
    output_dir: Path,
    config: dict[str, object],
) -> dict[str, object]:
    validate_config(config)
    input_root = input_dir.resolve()
    output_root = output_dir.resolve()

    if not input_root.exists():
        raise BatchPreflightError(f"input directory 不存在：{input_root}")
    if not input_root.is_dir():
        raise BatchPreflightError(f"input path 不是 directory：{input_root}")
    if output_root == input_root:
        raise BatchPreflightError("input/output 不得指向同一目录")
    if output_root.is_relative_to(input_root):
        raise BatchPreflightError("output 不得位于 input discovery 范围内")

    try:
        output_root.mkdir(parents=True, exist_ok=True)
    except OSError as error:
        raise BatchPreflightError(f"output directory 无法创建：{output_root}") from error

    files = stable_regular_files(input_root)
    allowed = {str(item).lower() for item in config["allowed_suffixes"]}
    eligible = [path for path in files if path.suffix.lower() in allowed]
    skipped = [path for path in files if path.suffix.lower() not in allowed]
    if not eligible:
        raise BatchPreflightError(
            f"没有 eligible input：discovered={len(files)}, allowed={sorted(allowed)}"
        )

    output_plan = build_output_plan(eligible, output_root)
    manifest_path = output_root / "batch-manifest.json"
    existing = [path for path in output_plan.values() if path.exists()]
    if manifest_path.exists():
        existing.append(manifest_path)
    if existing:
        names = ", ".join(sorted(path.name for path in existing))
        raise BatchPreflightError(f"error-on-existing preflight：{names}")

    return {
        "input_root": input_root,
        "output_root": output_root,
        "files": files,
        "eligible": eligible,
        "skipped": skipped,
        "output_plan": output_plan,
        "manifest_path": manifest_path,
    }


def inspect_array(image: np.ndarray) -> dict[str, object]:
    return {
        "shape": list(image.shape),
        "dtype": str(image.dtype),
        "range": [image.min().item(), image.max().item()],
        "channels": int(image.shape[2]) if image.ndim == 3 else 1,
    }


def process_one(
    input_path: Path,
    output_path: Path,
    config: dict[str, object],
    writer: Callable[[str, np.ndarray], bool] = cv2.imwrite,
) -> dict[str, object]:
    source_bytes = input_path.read_bytes()
    image = cv2.imread(str(input_path), cv2.IMREAD_UNCHANGED)
    if image is None:
        raise ItemFailure(
            "decodable image",
            "imread returned None",
            "decode failure",
            "verify file contents and codec support",
        )

    input_contract = inspect_array(image)
    if image.ndim != 3 or image.shape[2] != 3 or image.dtype != np.uint8:
        raise ItemFailure(
            "H×W×3 uint8 BGR",
            f"shape={image.shape}, dtype={image.dtype}",
            "unexpected input contract",
            "route this input to a compatible process or convert it explicitly",
        )

    source_snapshot = image.copy()
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(
        gray,
        int(config["threshold"]),
        255,
        cv2.THRESH_BINARY,
    )
    contours, _ = cv2.findContours(
        binary,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE,
    )
    areas = [float(cv2.contourArea(contour)) for contour in contours]

    write_ok = writer(str(output_path), binary)
    if not write_ok:
        raise ItemFailure(
            "imwrite returns True",
            "False",
            "output write failed",
            "check output path, extension and directory",
        )

    reloaded = cv2.imread(str(output_path), cv2.IMREAD_UNCHANGED)
    if reloaded is None or reloaded.shape != binary.shape or reloaded.dtype != binary.dtype:
        raise ItemFailure(
            f"shape={binary.shape}, dtype={binary.dtype}",
            "reload failed or output contract changed",
            "output verification failed",
            "inspect the written file before accepting this item",
        )

    np.testing.assert_array_equal(image, source_snapshot)
    if input_path.read_bytes() != source_bytes:
        raise AssertionError("source file bytes changed")
    return {
        "input_contract": input_contract,
        "output_contract": inspect_array(reloaded),
        "metrics": {
            "foreground_count": int(np.count_nonzero(binary)),
            "contour_count": len(contours),
            "largest_contour_area": max(areas, default=0.0),
        },
    }


def validate_record_identities(
    discovered_names: list[str], items: list[dict[str, object]]
) -> None:
    record_names = [item["input_path"] for item in items]
    assert len(record_names) == len(discovered_names), "record count mismatch"
    assert len(set(record_names)) == len(record_names), "duplicate input_path"
    assert set(record_names) == set(discovered_names), "missing or unexpected input_path"


def failure_record(input_name: str, error: Exception) -> dict[str, object]:
    if isinstance(error, ItemFailure):
        expected = error.expected
        actual = error.actual
        reason = error.reason
        correction = error.correction
    else:
        expected = "process_one completes with a verified output"
        actual = f"{type(error).__name__}: {error}"
        reason = "processing exception"
        correction = "reproduce this input independently and inspect the traceback"

    return {
        "input": input_name,
        "expected": expected,
        "actual": actual,
        "reason": reason,
        "correction": correction,
        "exceptionType": type(error).__name__,
        "message": str(error),
        "policyAction": "record-and-continue",
    }


def stable_config(config: dict[str, object]) -> dict[str, object]:
    return {
        "allowed_suffixes": sorted(
            str(item).lower() for item in config["allowed_suffixes"]
        ),
        "threshold": int(config["threshold"]),
        "output_extension": str(config["output_extension"]),
        "continue_on_error": bool(config["continue_on_error"]),
        "output_policy": str(config["output_policy"]),
    }


def write_manifest(manifest_path: Path, manifest: dict[str, object]) -> None:
    temporary_path = manifest_path.with_suffix(".json.tmp")
    try:
        temporary_path.write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True),
            encoding="utf-8",
        )
        temporary_path.replace(manifest_path)
    except OSError as error:
        raise BatchPreflightError("manifest 无法可靠保存") from error


def run_batch(
    input_dir: Path,
    output_dir: Path,
    config: dict[str, object],
    writer: Callable[[str, np.ndarray], bool] = cv2.imwrite,
) -> dict[str, object]:
    plan = preflight(input_dir, output_dir, config)
    input_root = plan["input_root"]
    output_root = plan["output_root"]
    output_plan = plan["output_plan"]
    allowed = {str(item).lower() for item in config["allowed_suffixes"]}
    records: list[dict[str, object]] = []

    for input_path in plan["files"]:
        relative_input = input_path.relative_to(input_root).as_posix()
        parameters = {"threshold": int(config["threshold"])}
        if input_path.suffix.lower() not in allowed:
            records.append(
                {
                    "input_path": relative_input,
                    "output_path": None,
                    "status": "skipped",
                    "input_contract": None,
                    "parameters": parameters,
                    "metrics": None,
                    "error": {
                        "input": relative_input,
                        "expected": f"suffix in {sorted(allowed)}",
                        "actual": input_path.suffix.lower() or "<no suffix>",
                        "reason": "extension not allowed",
                        "correction": "add an intended format to the allowlist or remove the file",
                        "exceptionType": None,
                        "message": "not attempted",
                        "policyAction": "record-as-skipped",
                    },
                }
            )
            continue

        output_path = output_plan[input_path]
        try:
            result = process_one(input_path, output_path, config, writer=writer)
            records.append(
                {
                    "input_path": relative_input,
                    "output_path": output_path.relative_to(output_root).as_posix(),
                    "status": "succeeded",
                    "input_contract": result["input_contract"],
                    "output_contract": result["output_contract"],
                    "parameters": parameters,
                    "metrics": result["metrics"],
                    "error": None,
                }
            )
        except Exception as error:  # item boundary intentionally records all failures
            records.append(
                {
                    "input_path": relative_input,
                    "output_path": None,
                    "status": "failed",
                    "input_contract": None,
                    "parameters": parameters,
                    "metrics": None,
                    "error": failure_record(relative_input, error),
                }
            )
            if not bool(config["continue_on_error"]):
                raise BatchPreflightError(
                    f"fail-fast 在 {relative_input} 停止"
                ) from error

    succeeded = sum(record["status"] == "succeeded" for record in records)
    failed = sum(record["status"] == "failed" for record in records)
    skipped = sum(record["status"] == "skipped" for record in records)
    summary = {
        "discovered": len(plan["files"]),
        "eligible": len(plan["eligible"]),
        "processed": succeeded + failed,
        "succeeded": succeeded,
        "failed": failed,
        "skipped": skipped,
    }
    if summary["processed"] != summary["succeeded"] + summary["failed"]:
        raise AssertionError("processed invariant failed")
    if summary["eligible"] != summary["processed"]:
        raise AssertionError("eligible invariant failed")
    if summary["discovered"] != summary["processed"] + summary["skipped"]:
        raise AssertionError("discovered invariant failed")

    discovered_names = [path.relative_to(input_root).as_posix() for path in plan["files"]]
    validate_record_identities(discovered_names, records)

    manifest = {
        "schema_version": 1,
        "config": stable_config(config),
        "input_dir": "input",
        "output_dir": "output",
        "items": records,
        "summary": summary,
    }
    write_manifest(plan["manifest_path"], manifest)
    return manifest


def make_color(path: Path, offset: int = 0) -> None:
    image = np.full((12, 16, 3), 30 + offset, dtype=np.uint8)
    image[3:9, 5:12] = (220, 220, 220)
    if not cv2.imwrite(str(path), image):
        raise AssertionError(f"fixture write failed: {path}")


def make_mixed_fixture(input_dir: Path) -> None:
    input_dir.mkdir(parents=True)
    make_color(input_dir / "01-part.png")
    (input_dir / "02-broken.png").write_bytes(b"not a valid image")
    make_color(input_dir / "03-part.png", 10)
    gray = np.full((12, 16), 120, dtype=np.uint8)
    if not cv2.imwrite(str(input_dir / "04-gray.png"), gray):
        raise AssertionError("grayscale fixture write failed")
    make_color(input_dir / "05-part.PNG", 20)
    make_color(input_dir / "06-part.bmp", 30)
    (input_dir / "07-notes.txt").write_text("not an image", encoding="utf-8")


class PipelineBatchImagesBehaviorTest(unittest.TestCase):
    def test_published_worked_example_runs_without_hidden_helpers(self) -> None:
        article = (Path(__file__).resolve().parents[2] / "content/concepts/image-processing/pipeline-batch-images.mdx").read_text(encoding="utf-8")
        worked = article.split("## 8. Worked Example", 1)[1].split("## 9. Active Recall", 1)[0]
        blocks = re.findall(r"```python\n(.*?)\n```", worked, re.S)
        namespace = {"__name__": "worked_example"}
        try:
            exec(compile("\n\n".join(blocks), "published-worked-example", "exec"), namespace)
            self.assertEqual(namespace["manifest_a"]["summary"], {"discovered": 7, "eligible": 6, "processed": 6, "succeeded": 4, "failed": 2, "skipped": 1})
            self.assertEqual(len(namespace["verified_outputs"]), 4)
            self.assertEqual(namespace["before_rerun"], namespace["after_rerun"])
            self.assertEqual(len(namespace["before_rerun"]), 5)
            self.assertIn("batch-manifest.json", namespace["before_rerun"])
            self.assertFalse(namespace["root"].exists())
            validator = namespace["validate_record_identities"]
            for names in (["a.png", "a.png"], ["a.png", "c.png"], ["a.png"]):
                with self.subTest(published_record_names=names):
                    with self.assertRaises(AssertionError):
                        validator(["a.png", "b.png"], [{"input_path": name} for name in names])
        finally:
            if "temporary_root" in namespace:
                namespace["temporary_root"].cleanup()

    def test_counts_alone_accept_duplicate_missing_but_identity_rejects(self) -> None:
        names = ["a.png", "b.png"]
        records = [{"input_path": "a.png", "status": "succeeded"}] * 2
        succeeded = sum(item["status"] == "succeeded" for item in records)
        failed = skipped = 0
        processed = succeeded + failed
        self.assertEqual(processed, succeeded + failed)
        self.assertEqual(len(names), processed)
        self.assertEqual(len(names), processed + skipped)
        with self.assertRaisesRegex(AssertionError, "duplicate"):
            validate_record_identities(names, records)

    def test_identity_includes_success_failure_skipped_and_rejects_wrong_file(self) -> None:
        names = ["valid.png", "broken.png", "notes.txt"]
        records = [
            {"input_path": name, "status": status}
            for name, status in zip(names, ["succeeded", "failed", "skipped"])
        ]
        validate_record_identities(names, records)
        with self.assertRaisesRegex(AssertionError, "count"):
            validate_record_identities(names, records[:-1])
        records[-1] = {"input_path": "unknown.txt", "status": "skipped"}
        with self.assertRaisesRegex(AssertionError, "missing or unexpected"):
            validate_record_identities(names, records)

    def test_deterministic_order_ignores_subdirectories(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ["b.png", "A.PNG", "c.txt"]:
                (root / name).write_bytes(b"x")
            (root / "folder.png").mkdir()

            expected = ["A.PNG", "b.png", "c.txt"]
            self.assertEqual(
                [path.name for path in stable_regular_files(root)], expected
            )
            self.assertEqual(
                [path.name for path in stable_regular_files(root)], expected
            )

    def test_suffix_allowlist_is_case_insensitive_and_non_image_is_skipped(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "input"
            root.mkdir()
            make_color(root / "upper.PNG")
            (root / "notes.txt").write_text("note", encoding="utf-8")
            plan = preflight(root, Path(directory) / "output", default_config())

            self.assertEqual([path.name for path in plan["eligible"]], ["upper.PNG"])
            self.assertEqual([path.name for path in plan["skipped"]], ["notes.txt"])

    def test_empty_directory_has_explicit_run_level_diagnosis(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "input"
            root.mkdir()
            with self.assertRaisesRegex(BatchPreflightError, "没有 eligible input"):
                preflight(root, Path(directory) / "output", default_config())

    def test_no_eligible_input_reports_discovered_count(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "input"
            root.mkdir()
            (root / "notes.txt").write_text("note", encoding="utf-8")
            with self.assertRaisesRegex(
                BatchPreflightError, "discovered=1"
            ):
                preflight(root, Path(directory) / "output", default_config())

    def test_valid_bgr_process_one_writes_reloads_and_returns_metrics(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            input_path = root / "part.png"
            output_path = root / "result.png"
            make_color(input_path)
            source_bytes = input_path.read_bytes()

            result = process_one(input_path, output_path, default_config())

            self.assertEqual(result["input_contract"]["shape"], [12, 16, 3])
            self.assertEqual(result["output_contract"]["shape"], [12, 16])
            self.assertEqual(result["output_contract"]["dtype"], "uint8")
            self.assertEqual(set(result["metrics"]), {
                "foreground_count",
                "contour_count",
                "largest_contour_area",
            })
            self.assertEqual(input_path.read_bytes(), source_bytes)

    def test_damaged_image_is_failed_and_later_image_still_succeeds(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            input_dir = root / "input"
            input_dir.mkdir()
            (input_dir / "01-broken.png").write_bytes(b"broken")
            make_color(input_dir / "02-valid.png")

            manifest = run_batch(input_dir, root / "output", default_config())

            self.assertEqual(
                [item["status"] for item in manifest["items"]],
                ["failed", "succeeded"],
            )
            self.assertEqual(
                manifest["items"][0]["error"]["reason"], "decode failure"
            )

    def test_grayscale_contract_failure_is_recorded(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            input_dir = root / "input"
            input_dir.mkdir()
            gray = np.full((4, 6), 100, dtype=np.uint8)
            self.assertTrue(cv2.imwrite(str(input_dir / "gray.png"), gray))

            manifest = run_batch(input_dir, root / "output", default_config())
            item = manifest["items"][0]

            self.assertEqual(item["status"], "failed")
            self.assertEqual(item["error"]["expected"], "H×W×3 uint8 BGR")
            self.assertIn("shape=(4, 6)", item["error"]["actual"])

    def test_controlled_processing_exception_is_recorded_without_exact_message_contract(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            input_dir = root / "input"
            input_dir.mkdir()
            make_color(input_dir / "part.png")

            with mock.patch.object(
                cv2, "cvtColor", side_effect=RuntimeError("controlled failure")
            ):
                manifest = run_batch(input_dir, root / "output", default_config())

            error = manifest["items"][0]["error"]
            self.assertEqual(error["exceptionType"], "RuntimeError")
            self.assertEqual(error["reason"], "processing exception")
            self.assertEqual(error["policyAction"], "record-and-continue")

    def test_imwrite_false_is_recorded_with_stable_writer_stub(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            input_dir = root / "input"
            input_dir.mkdir()
            make_color(input_dir / "part.png")

            manifest = run_batch(
                input_dir,
                root / "output",
                default_config(),
                writer=lambda _path, _image: False,
            )

            error = manifest["items"][0]["error"]
            self.assertEqual(error["reason"], "output write failed")
            self.assertEqual(manifest["summary"]["failed"], 1)

    def test_same_stem_different_extension_gets_distinct_output_names(self) -> None:
        self.assertEqual(output_name_for(Path("sample.jpg")), "sample__jpg.png")
        self.assertEqual(output_name_for(Path("sample.png")), "sample__png.png")

    def test_case_insensitive_output_collision_is_preflight_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory)
            with self.assertRaisesRegex(BatchPreflightError, "collision"):
                build_output_plan(
                    [Path("Sample.JPG"), Path("sample.jpg")], output_dir
                )

    def test_existing_output_stops_before_any_processing(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            input_dir = root / "input"
            output_dir = root / "output"
            input_dir.mkdir()
            output_dir.mkdir()
            make_color(input_dir / "part.png")
            (output_dir / "part__png.png").write_bytes(b"old")
            writer_calls = 0

            def counting_writer(_path: str, _image: np.ndarray) -> bool:
                nonlocal writer_calls
                writer_calls += 1
                return True

            with self.assertRaisesRegex(BatchPreflightError, "error-on-existing"):
                run_batch(input_dir, output_dir, default_config(), counting_writer)
            self.assertEqual(writer_calls, 0)

    def test_input_output_same_or_nested_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            input_dir = Path(directory)
            make_color(input_dir / "part.png")
            with self.assertRaisesRegex(BatchPreflightError, "同一目录"):
                preflight(input_dir, input_dir, default_config())
            with self.assertRaisesRegex(BatchPreflightError, "discovery 范围"):
                preflight(input_dir, input_dir / "output", default_config())

    def test_mixed_fixture_summary_invariants_and_failure_records(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            input_dir = root / "input"
            make_mixed_fixture(input_dir)

            manifest = run_batch(input_dir, root / "output", default_config())
            summary = manifest["summary"]

            self.assertEqual(summary, {
                "discovered": 7,
                "eligible": 6,
                "processed": 6,
                "succeeded": 4,
                "failed": 2,
                "skipped": 1,
            })
            validate_record_identities(
                [path.name for path in stable_regular_files(input_dir)], manifest["items"]
            )
            self.assertEqual(
                summary["processed"], summary["succeeded"] + summary["failed"]
            )
            self.assertEqual(summary["eligible"], summary["processed"])
            self.assertEqual(
                summary["discovered"], summary["processed"] + summary["skipped"]
            )
            for item in manifest["items"]:
                if item["status"] == "failed":
                    self.assertEqual(
                        set(item["error"]),
                        {
                            "input",
                            "expected",
                            "actual",
                            "reason",
                            "correction",
                            "exceptionType",
                            "message",
                            "policyAction",
                        },
                    )

    def test_output_is_not_reingested_and_source_bytes_are_unchanged(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            input_dir = root / "input"
            input_dir.mkdir()
            make_color(input_dir / "part.png")
            source_before = (input_dir / "part.png").read_bytes()
            discovered_before = [path.name for path in stable_regular_files(input_dir)]

            run_batch(input_dir, root / "output", default_config())

            self.assertEqual(
                [path.name for path in stable_regular_files(input_dir)],
                discovered_before,
            )
            self.assertEqual((input_dir / "part.png").read_bytes(), source_before)
            self.assertFalse((input_dir / "output").exists())

    def test_manifest_is_stable_machine_readable_and_uses_relative_paths(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            input_dir = root / "input"
            input_dir.mkdir()
            make_color(input_dir / "part.png")
            output_dir = root / "output"

            manifest = run_batch(input_dir, output_dir, default_config())
            manifest_path = output_dir / "batch-manifest.json"
            text = manifest_path.read_text(encoding="utf-8")

            self.assertEqual(json.loads(text), manifest)
            self.assertNotIn(str(root), text)
            self.assertEqual(manifest["input_dir"], "input")
            self.assertEqual(manifest["output_dir"], "output")
            self.assertEqual(
                manifest["items"][0]["output_path"], "part__png.png"
            )

    def test_clean_output_directories_produce_equal_semantic_manifests_and_pixels(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            input_dir = root / "input"
            input_dir.mkdir()
            make_color(input_dir / "part.png")

            first = run_batch(input_dir, root / "output-a", default_config())
            second = run_batch(input_dir, root / "output-b", default_config())

            self.assertEqual(first, second)
            first_image = cv2.imread(
                str(root / "output-a" / "part__png.png"), cv2.IMREAD_UNCHANGED
            )
            second_image = cv2.imread(
                str(root / "output-b" / "part__png.png"), cv2.IMREAD_UNCHANGED
            )
            np.testing.assert_array_equal(first_image, second_image)

    def test_same_output_rerun_fails_without_changing_existing_results(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            input_dir = root / "input"
            input_dir.mkdir()
            make_color(input_dir / "part.png")
            output_dir = root / "output"
            run_batch(input_dir, output_dir, default_config())
            snapshot = {
                path.name: path.read_bytes()
                for path in output_dir.iterdir()
                if path.is_file()
            }

            with self.assertRaisesRegex(BatchPreflightError, "error-on-existing"):
                run_batch(input_dir, output_dir, default_config())

            self.assertEqual(
                {
                    path.name: path.read_bytes()
                    for path in output_dir.iterdir()
                    if path.is_file()
                },
                snapshot,
            )

    def test_manifest_write_failure_is_run_level_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest_path = root / "batch-manifest.json"
            with mock.patch.object(
                Path, "replace", side_effect=OSError("controlled manifest failure")
            ):
                with self.assertRaisesRegex(
                    BatchPreflightError, "manifest 无法可靠保存"
                ):
                    write_manifest(manifest_path, {"schema_version": 1})
            self.assertFalse(manifest_path.exists())


if __name__ == "__main__":
    unittest.main()
