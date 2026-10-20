resource "google_service_account" "identity_reader" {
  project      = var.project_id
  account_id   = module.naming.names.identity_service_account
  display_name = "Waiwai Identity Platform member validation"
  depends_on   = [google_project_service.required]
}
