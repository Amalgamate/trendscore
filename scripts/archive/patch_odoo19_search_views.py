from pathlib import Path
import re


def flatten_search_groups(match):
    block = match.group(0)
    block = re.sub(r"\n\s*<group[^>]*string=\"Group By\"[^>]*>", "", block)
    block = re.sub(r"\n\s*</group>", "", block)
    return block


for path in Path("/mnt/extra-addons").glob("hospital*/**/*.xml"):
    text = path.read_text()
    updated = re.sub(r"<search[\s\S]*?</search>", flatten_search_groups, text)
    updated = updated.replace("list,form,tree", "list,form")
    updated = updated.replace("tree,form", "list,form")
    updated = updated.replace("form,tree", "form,list")
    updated = updated.replace(">tree<", ">list<")
    if updated != text:
        path.write_text(updated)
        print(path)
