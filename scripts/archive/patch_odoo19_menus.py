from pathlib import Path

for path in Path("/mnt/extra-addons").glob("hospital*/**/menus.xml"):
    text = path.read_text()
    if "<data>" in text:
        continue
    updated = text.replace("<odoo>", "<odoo>\n    <data>", 1)
    updated = updated.replace("</odoo>", "    </data>\n</odoo>", 1)
    path.write_text(updated)
    print(path)
