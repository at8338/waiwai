resource "google_project_iam_custom_role" "identity_reader" {
  project     = var.project_id
  role_id     = module.naming.names.identity_reader_role
  title       = "Waiwai identity member reader"
  description = "Read one authentication user to validate invitation, MFA and revocation; no user administration."
  permissions = ["firebaseauth.users.get"]
  depends_on  = [google_project_service.required]
}
