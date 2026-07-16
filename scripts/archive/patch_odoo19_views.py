from pathlib import Path

for path in Path("/mnt/extra-addons").glob("hospital*/**/*.xml"):
    text = path.read_text()
    updated = (
        text.replace("<tree", "<list")
        .replace("</tree>", "</list>")
        .replace(">tree<", ">list<")
        .replace("view_mode\">tree", "view_mode\">list")
        .replace("view_mode\">form,tree", "view_mode\">form,list")
        .replace("view_mode\">tree,form", "view_mode\">list,form")
        .replace("view_mode\">kanban,tree,form", "view_mode\">kanban,list,form")
    )
    if updated != text:
        path.write_text(updated)
        print(path)
