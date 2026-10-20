output "bucket" { value = google_storage_bucket.state.name }
output "backend" {
  value = "bucket = \"${google_storage_bucket.state.name}\"\nprefix = \"${var.state_prefix}\"\n"
}
