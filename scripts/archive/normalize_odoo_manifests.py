from pathlib import Path

for manifest in Path("/mnt/extra-addons").glob("hospital*/__manifest__.py"):
    text = manifest.read_text()
    start = text.find("{")
    if start == -1:
        raise SystemExit(f"No manifest dict found in {manifest}")
    normalized = text[start:].lstrip()
    manifest.write_text(normalized)
    print(manifest)
