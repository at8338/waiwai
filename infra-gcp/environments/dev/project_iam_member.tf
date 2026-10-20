resource "google_project_iam_member" "identity_reader" {
  project = var.project_id
  role    = google_project_iam_custom_role.identity_reader.name
  member  = "serviceAccount:${google_service_account.identity_reader.email}"
}
