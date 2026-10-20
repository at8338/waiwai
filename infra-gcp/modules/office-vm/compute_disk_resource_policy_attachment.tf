resource "google_compute_disk_resource_policy_attachment" "backup" {
  for_each = { boot = google_compute_disk.boot.name, data = google_compute_disk.data.name }
  project  = var.project_id
  name     = google_compute_resource_policy.backup.name
  disk     = each.value
  zone     = var.zone
}
