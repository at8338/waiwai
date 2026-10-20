resource "google_storage_bucket" "state" {
  project                     = var.project_id
  name                        = var.bucket_name
  location                    = var.region
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
  labels                      = var.labels
  versioning { enabled = true }
  soft_delete_policy { retention_duration_seconds = 2592000 }
  lifecycle { prevent_destroy = true }
}
