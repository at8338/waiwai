mock_provider "google" { source = "../../tests/mocks" }
variables {
  project_id    = "waiwai-dev-example"
  region        = "asia-northeast1"
  bucket_name   = "dev-waiwai-tky-gcs-tfstate-001-example"
  state_prefix  = "waiwai/gcp/dev/001"
  labels        = { environment = "dev" }
  state_members = ["user:operator@example.com"]
}
run "private_versioned_recoverable_state" {
  command = apply
  assert {
    condition     = google_storage_bucket.state.uniform_bucket_level_access && google_storage_bucket.state.public_access_prevention == "enforced" && !google_storage_bucket.state.force_destroy && google_storage_bucket.state.versioning[0].enabled && google_storage_bucket.state.soft_delete_policy[0].retention_duration_seconds == 2592000
    error_message = "State must be private, versioned, recoverable and protected against bucket deletion."
  }
  assert {
    condition     = google_storage_bucket_iam_member.operators["user:operator@example.com"].role == "roles/storage.objectAdmin" && strcontains(output.backend, "waiwai/gcp/dev/001")
    error_message = "Grant object-level state access only and keep GCP state separate from Azure."
  }
}
run "reject_public_state_access" {
  command = plan
  variables { state_members = ["allUsers"] }
  expect_failures = [var.state_members]
}
