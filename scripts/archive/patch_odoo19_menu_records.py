from pathlib import Path
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape


def menu_record(menu):
    attrs = menu.attrib
    record_id = attrs["id"]
    parts = [f'    <record id="{escape(record_id)}" model="ir.ui.menu">']
    if attrs.get("name"):
        parts.append(f'        <field name="name">{escape(attrs["name"])}</field>')
    if attrs.get("parent"):
        parts.append(f'        <field name="parent_id" ref="{escape(attrs["parent"])}"/>')
    if attrs.get("action"):
        parts.append(f'        <field name="action" ref="{escape(attrs["action"])}"/>')
    if attrs.get("sequence"):
        parts.append(f'        <field name="sequence">{escape(attrs["sequence"])}</field>')
    parts.append("    </record>")
    return "\n".join(parts)


for path in Path("/mnt/extra-addons").glob("hospital*/**/menus.xml"):
    root = ET.parse(path).getroot()
    menus = root.findall(".//menuitem")
    if not menus:
        continue
    records = "\n\n".join(menu_record(menu) for menu in menus)
    path.write_text('<?xml version="1.0" encoding="utf-8"?>\n<odoo>\n' + records + "\n</odoo>\n")
    print(path)
