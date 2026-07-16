from pathlib import Path


def append_import(init_path, module_name):
    text = init_path.read_text()
    line = f"from . import {module_name}"
    if line not in text:
        init_path.write_text(text.rstrip() + f"\n{line}\n")


base_dir = Path("/mnt/extra-addons/hospital_base/models")
(base_dir / "action_helpers.py").write_text("""# -*- coding: utf-8 -*-
from odoo import models


class Hospital(models.Model):
    _inherit = 'hospital.hospital'

    def action_view_branches(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': 'Branches',
            'res_model': 'hospital.branch',
            'view_mode': 'list,form',
            'domain': [('hospital_id', '=', self.id)],
            'context': {'default_hospital_id': self.id},
        }


class HospitalBranch(models.Model):
    _inherit = 'hospital.branch'

    def action_view_departments(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': 'Departments',
            'res_model': 'hospital.department',
            'view_mode': 'list,form',
            'domain': [('branch_id', '=', self.id)],
            'context': {'default_branch_id': self.id},
        }

    def action_view_beds(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': 'Beds',
            'res_model': 'hospital.bed',
            'view_mode': 'list,form',
            'domain': [('branch_id', '=', self.id)],
        }


class HospitalWard(models.Model):
    _inherit = 'hospital.ward'

    def action_view_beds(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': 'Beds',
            'res_model': 'hospital.bed',
            'view_mode': 'list,form',
            'domain': [('ward_id', '=', self.id)],
            'context': {'default_ward_id': self.id},
        }

    def action_view_occupied_beds(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': 'Occupied Beds',
            'res_model': 'hospital.bed',
            'view_mode': 'list,form',
            'domain': [('ward_id', '=', self.id), ('bed_status', '=', 'occupied')],
        }
""")
append_import(base_dir / "__init__.py", "action_helpers")
print(base_dir / "action_helpers.py")

patient_dir = Path("/mnt/extra-addons/hospital_patient/models")
(patient_dir / "action_helpers.py").write_text("""# -*- coding: utf-8 -*-
from odoo import models


class HospitalPatient(models.Model):
    _inherit = 'hospital.patient'

    def action_view_appointments(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': 'Appointments',
            'res_model': 'hospital.appointment',
            'view_mode': 'list,form',
            'domain': [('patient_id', '=', self.id)],
            'context': {'default_patient_id': self.id},
        }

    def action_view_visits(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': 'Visits',
            'res_model': 'hospital.consultation',
            'view_mode': 'list,form',
            'domain': [('patient_id', '=', self.id)],
            'context': {'default_patient_id': self.id},
        }

    def action_view_admissions(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': 'Admissions',
            'res_model': 'hospital.admission',
            'view_mode': 'list,form',
            'domain': [('patient_id', '=', self.id)],
            'context': {'default_patient_id': self.id},
        }
""")
append_import(patient_dir / "__init__.py", "action_helpers")
print(patient_dir / "action_helpers.py")

staff_dir = Path("/mnt/extra-addons/hospital_staff/models")
(staff_dir / "action_helpers.py").write_text("""# -*- coding: utf-8 -*-
from odoo import models


class HospitalDoctor(models.Model):
    _inherit = 'hospital.staff.doctor'

    def action_view_consultations(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': 'Consultations',
            'res_model': 'hospital.consultation',
            'view_mode': 'list,form',
            'domain': [('doctor_id', '=', self.id)],
            'context': {'default_doctor_id': self.id},
        }

    def action_view_appointments(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': 'Appointments',
            'res_model': 'hospital.appointment',
            'view_mode': 'list,form',
            'domain': [('doctor_id', '=', self.id)],
            'context': {'default_doctor_id': self.id},
        }
""")
append_import(staff_dir / "__init__.py", "action_helpers")
print(staff_dir / "action_helpers.py")
