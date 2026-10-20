resource "google_compute_instance_iam_member" "operators" {
  for_each      = var.operator_members
  project       = var.project_id
  zone          = var.zone
  instance_name = google_compute_instance.office.name
  role          = "roles/compute.osAdminLogin"
  member        = each.value
}
