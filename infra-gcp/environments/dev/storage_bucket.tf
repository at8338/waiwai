# Private deployment bundles, including the runtime configuration. Never store
# secrets in instance metadata or give the VM access to Terraform state.
resource "google_storage_bucket" "releases" {
  project                     = var.project_id
  name                        = module.naming.names.release_bucket
  location                    = var.region
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
  labels                      = module.naming.labels
  soft_delete_policy { retention_duration_seconds = 604800 }
  lifecycle_rule {
    condition { age = 7 }
    action { type = "Delete" }
  }
  lifecycle { prevent_destroy = true }
}
