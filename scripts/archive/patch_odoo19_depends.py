from pathlib import Path

needle = "@api.depends('id')"
replacement = "@api.depends_context('uid')"

for path in Path("/mnt/extra-addons").glob("hospital*/**/*.py"):
    text = path.read_text()
    if needle not in text:
        continue
    path.write_text(text.replace(needle, replacement))
    print(path)
