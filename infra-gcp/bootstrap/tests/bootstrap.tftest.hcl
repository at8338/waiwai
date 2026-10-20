mock_provider "google" { source = "../tests/mocks" }
variables {
  project_id    = "waiwai-dev-example"
  state_members = ["user:operator@example.com"]
}
run "separate_gcs_backend" {
  command = apply
  assert {
    condition     = strcontains(output.backend, "waiwai/gcp/dev/001") && startswith(output.bucket, "dev-waiwai-tky-gcs-tfstate-001-") && !google_project_service.storage.disable_on_destroy
    error_message = "Bootstrap must provision a protected, independently managed GCP state bucket."
  }
}
