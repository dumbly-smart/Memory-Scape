#!/usr/bin/env python3
"""Request Linux to discard clean PostgreSQL relation-file pages from cache."""

import argparse
import json
import os
import stat
import sys


def evict_relation_pages(data_directory: str) -> dict[str, object]:
    root = os.path.realpath(data_directory)
    if not os.path.isdir(root):
        raise ValueError(f"PostgreSQL data directory does not exist: {data_directory}")
    if not hasattr(os, "posix_fadvise") or not hasattr(os, "POSIX_FADV_DONTNEED"):
        raise RuntimeError("This Python runtime does not expose POSIX_FADV_DONTNEED")

    report: dict[str, object] = {
        "success": True,
        "strategy": "posix_fadvise_dontneed",
        "directories": ["base", "global"],
        "filesVisited": 0,
        "bytesTargeted": 0,
        "evictionRequests": 0,
        "errors": [],
        "guarantee": "best_effort_advisory_only",
    }
    errors = report["errors"]
    assert isinstance(errors, list)
    os.sync()

    for relative_directory in ("base", "global"):
        directory = os.path.join(root, relative_directory)
        if not os.path.isdir(directory):
            errors.append(f"Missing expected PostgreSQL directory: {relative_directory}")
            continue
        for current, subdirectories, filenames in os.walk(directory, followlinks=False):
            subdirectories[:] = [
                name for name in subdirectories
                if not os.path.islink(os.path.join(current, name))
            ]
            for filename in filenames:
                file_path = os.path.join(current, filename)
                try:
                    file_info = os.stat(file_path, follow_symlinks=False)
                    if not stat.S_ISREG(file_info.st_mode):
                        continue
                    with open(file_path, "rb") as relation_file:
                        os.posix_fadvise(
                            relation_file.fileno(),
                            0,
                            0,
                            os.POSIX_FADV_DONTNEED,
                        )
                    report["filesVisited"] = int(report["filesVisited"]) + 1
                    report["bytesTargeted"] = int(report["bytesTargeted"]) + file_info.st_size
                    report["evictionRequests"] = int(report["evictionRequests"]) + 1
                except OSError as error:
                    errors.append(f"{os.path.relpath(file_path, root)}: {error}")

    if not report["filesVisited"]:
        errors.append("No regular relation files were found under base/ or global/")
    report["success"] = not errors
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-directory", required=True)
    arguments = parser.parse_args()
    try:
        report = evict_relation_pages(arguments.data_directory)
    except (OSError, RuntimeError, ValueError) as error:
        print(json.dumps({"success": False, "error": str(error)}))
        return 1
    print(json.dumps(report, sort_keys=True))
    return 0 if report["success"] else 1


if __name__ == "__main__":
    sys.exit(main())
