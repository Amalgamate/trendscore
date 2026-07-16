from pathlib import Path

helper = Path("/mnt/extra-addons/hospital_patient/models/action_helpers.py")
text = helper.read_text()
text = text.replace(
    "from odoo import models\n",
    "from odoo import fields, models\n",
)
text = text.replace(
    "class HospitalPatient(models.Model):\n    _inherit = 'hospital.patient'\n",
    """class HospitalPatient(models.Model):
    _inherit = 'hospital.patient'

    appointment_count = fields.Integer(string='Appointments', default=0)
    visit_count = fields.Integer(string='Visits', default=0)
    admission_count = fields.Integer(string='Admissions', default=0)
""",
)
helper.write_text(text)
print(helper)

view = Path("/mnt/extra-addons/hospital_patient/views/patient_views.xml")
view_text = view.read_text()
view_text = view_text.replace('name="appointment_ids"', 'name="appointment_count"')
view_text = view_text.replace('name="visit_ids"', 'name="visit_count"')
view_text = view_text.replace('name="admission_ids"', 'name="admission_count"')
view.write_text(view_text)
print(view)
