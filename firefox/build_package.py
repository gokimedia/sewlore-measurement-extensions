"""Deterministically package the runtime and separately the reviewable sources."""
from pathlib import Path
import hashlib
import json
import zipfile

BASE = Path(__file__).resolve().parent
RUNTIME = BASE / "extension"
VERSION = json.loads((RUNTIME / "manifest.json").read_text(encoding="utf-8"))["version"]

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def archive(target, files):
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as handle:
        for file, name in sorted(files, key=lambda pair: pair[1]):
            info = zipfile.ZipInfo(name, date_time=(2026, 10, 9, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            handle.writestr(info, file.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)

runtime_files = [(file, file.relative_to(RUNTIME).as_posix()) for file in RUNTIME.rglob("*") if file.is_file()]
allowed = {"manifest.json", "popup.html", "popup.js", "popup.css", "measurement.js", "privacy.html", "icons/measurement.svg", "LICENSE"}
assert {name for _, name in runtime_files} == allowed, "Unexpected or missing runtime file"
upload = BASE / f"sewlore-measurement-check-{VERSION}.zip"
archive(upload, runtime_files)
source_paths = [BASE / "README.md", BASE / "package.json", BASE / "build_package.py", BASE / "amo-listing.candidate.json", BASE / "PRIVACY.md", BASE / "provenance.json"]
source_paths += [file for file in (BASE / "tests").rglob("*") if file.is_file()]
if (BASE / "package-lock.json").is_file(): source_paths.append(BASE / "package-lock.json")
source_files = [(file, file.relative_to(BASE).as_posix()) for file, _ in runtime_files] + [(file, file.relative_to(BASE).as_posix()) for file in source_paths]
source_zip = BASE / f"sewlore-measurement-check-{VERSION}-source.zip"
archive(source_zip, source_files)
receipt = {
    "status": "packaged_candidate_not_published",
    "version": VERSION,
    "runtime_zip": upload.name,
    "runtime_zip_sha256": sha(upload),
    "runtime_files": [{"path": name, "sha256": sha(file), "bytes": file.stat().st_size} for file, name in sorted(runtime_files, key=lambda pair: pair[1])],
    "source_zip": source_zip.name,
    "source_zip_sha256": sha(source_zip),
    "source_files": [name for _, name in sorted(source_files, key=lambda pair: pair[1])],
    "account_credentials_included": False,
    "runtime_dependencies": [],
    "publication_or_backlink_verified": False,
}
(BASE / "build-manifest.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"runtime_zip": upload.name, "runtime_zip_sha256": sha(upload), "runtime_files": len(runtime_files), "source_zip": source_zip.name, "source_zip_sha256": sha(source_zip)}))
