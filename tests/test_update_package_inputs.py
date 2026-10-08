"""Untrusted dispatch metadata must stay data, not paths or commands."""

import importlib.util
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "update_package.py"
spec = importlib.util.spec_from_file_location("update_package", SCRIPT)
update_package = importlib.util.module_from_spec(spec)
spec.loader.exec_module(update_package)


class UpdatePackageInputTests(unittest.TestCase):
    def setUp(self):
        self.values = [
            "halocli", "1.16.1", "https://example.invalid/halocli.msi",
            "a" * 64, "{12345678-1234-1234-1234-123456789abc}",
        ]

    def test_valid_release_metadata(self):
        update_package.validate_metadata(*self.values)

    def test_shell_and_path_payloads_fail_before_file_writes(self):
        attempts = {
            0: ["../outside", "halocli$(touch marker)"],
            1: ["1.16.1\nbranch=evil", "1.16.1$(touch marker)"],
            2: ["https://example.invalid/a.msi\nInjected: true", "http://example.invalid/a.msi"],
            3: ["not-a-hash"],
            4: ["{not-a-guid}"],
        }
        for index, candidates in attempts.items():
            for candidate in candidates:
                with self.subTest(index=index, candidate=candidate):
                    values = list(self.values)
                    values[index] = candidate
                    with self.assertRaises(ValueError):
                        update_package.validate_metadata(*values)


if __name__ == "__main__":
    unittest.main()
