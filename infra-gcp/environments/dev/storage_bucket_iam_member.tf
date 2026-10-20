resource "google_storage_bucket_iam_member" "release_reader" {
  bucket = google_storage_bucket.releases.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.identity_reader.email}"
  condition {
    title       = "deployment_bundles_only"
    description = "Read deployment bundles only; no writes or access to state."
    expression  = "resource.name.startsWith('projects/_/buckets/${google_storage_bucket.releases.name}/objects/releases/')"
  }
}
