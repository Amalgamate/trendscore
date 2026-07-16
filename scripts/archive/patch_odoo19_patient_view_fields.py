from pathlib import Path
import re

helper = Path("/mnt/extra-addons/hospital_patient/models/action_helpers.py")
text = helper.read_text()
if "street2 = fields.Char" not in text:
    marker = "    admission_count = fields.Integer(string='Admissions', default=0)\n"
    text = text.replace(marker, marker + "    street2 = fields.Char(string='Street 2')\n")
    helper.write_text(text)
print(helper)

view = Path("/mnt/extra-addons/hospital_patient/views/patient_views.xml")
view_text = view.read_text()
view_text = re.sub(
    r"\n\s*<page string=\"Medical History\">[\s\S]*?</page>",
    "",
    view_text,
)
view.write_text(view_text)
print(view)
