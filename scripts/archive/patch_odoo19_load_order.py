from pathlib import Path

bed_path = Path("/mnt/extra-addons/hospital_base/models/bed.py")
bed_text = bed_path.read_text()

for block in [
    """    patient_id = fields.Many2one(
        'hospital.patient',
        string='Current Patient',
        readonly=True,
        tracking=True,
    )
""",
    """    admission_id = fields.Many2one(
        'hospital.admission',
        string='Current Admission',
        readonly=True,
        tracking=True,
    )
""",
    """    @api.constrains('bed_status', 'patient_id')
    def _check_bed_status_patient(self):
        \"\"\"Validate bed status and patient relationship\"\"\"
        for record in self:
            if record.bed_status == 'available' and record.patient_id:
                raise ValueError('Cannot have patient in available bed!')
            if record.bed_status == 'occupied' and not record.patient_id:
                raise ValueError('Occupied bed must have a patient!')

""",
]:
    bed_text = bed_text.replace(block, "")

bed_path.write_text(bed_text)
print(f"patched {bed_path}")

bed_view_path = Path("/mnt/extra-addons/hospital_base/views/bed_views.xml")
bed_view_text = bed_view_path.read_text()
for line in [
    "                            <field name=\"patient_id\"/>\n",
    "                            <field name=\"admission_id\"/>\n",
    "                <field name=\"patient_id\"/>\n",
    "                <field name=\"admission_id\"/>\n",
    "                                <field name=\"patient_id\"/>\n",
]:
    bed_view_text = bed_view_text.replace(line, "")
bed_view_path.write_text(bed_view_text)
print(f"patched {bed_view_path}")

patient_path = Path("/mnt/extra-addons/hospital_patient/models/patient.py")
patient_text = patient_path.read_text()
for block in [
    """    visit_ids = fields.One2many(
        'hospital.consultation',
        'patient_id',
        string='Visits',
    )
""",
    """    appointment_ids = fields.One2many(
        'hospital.appointment',
        'patient_id',
        string='Appointments',
    )
""",
    """    admission_ids = fields.One2many(
        'hospital.admission',
        'patient_id',
        string='Admissions',
    )
""",
]:
    patient_text = patient_text.replace(block, "")
patient_path.write_text(patient_text)
print(f"patched {patient_path}")

ipd_models_dir = Path("/mnt/extra-addons/hospital_ipd/models")
extension_path = ipd_models_dir / "bed_patient_extension.py"
extension_path.write_text(
    """# -*- coding: utf-8 -*-\nfrom odoo import api, fields, models\nfrom odoo.exceptions import ValidationError\n\n\nclass HospitalBed(models.Model):\n    _inherit = 'hospital.bed'\n\n    patient_id = fields.Many2one(\n        'hospital.patient',\n        string='Current Patient',\n        readonly=True,\n        tracking=True,\n    )\n    admission_id = fields.Many2one(\n        'hospital.admission',\n        string='Current Admission',\n        readonly=True,\n        tracking=True,\n    )\n\n    @api.constrains('bed_status', 'patient_id')\n    def _check_bed_status_patient(self):\n        for record in self:\n            if record.bed_status == 'available' and record.patient_id:\n                raise ValidationError('Cannot have patient in available bed!')\n            if record.bed_status == 'occupied' and not record.patient_id:\n                raise ValidationError('Occupied bed must have a patient!')\n\n\nclass HospitalPatient(models.Model):\n    _inherit = 'hospital.patient'\n\n    admission_ids = fields.One2many(\n        'hospital.admission',\n        'patient_id',\n        string='Admissions',\n    )\n"""
)
print(f"created {extension_path}")

init_path = ipd_models_dir / "__init__.py"
init_text = init_path.read_text()
if "bed_patient_extension" not in init_text:
    init_path.write_text(init_text.rstrip() + "\nfrom . import bed_patient_extension\n")
    print(f"patched {init_path}")
