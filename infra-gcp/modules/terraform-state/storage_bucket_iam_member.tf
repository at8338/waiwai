resource "google_storage_bucket_iam_member" "operators" {
  for_each = var.state_members
  bucket   = google_storage_bucket.state.name
  role     = "roles/storage.objectAdmin"
  member   = each.value
}
