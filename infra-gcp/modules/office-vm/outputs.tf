output "vm_name" { value = google_compute_instance.office.name }
output "machine_type" { value = google_compute_instance.office.machine_type }
output "data_disk" { value = google_compute_disk.data.name }
output "snapshot_policy" { value = google_compute_resource_policy.backup.name }
