resource "google_identity_platform_config" "office" {
  project            = var.project_id
  authorized_domains = [var.domain]
  sign_in {
    allow_duplicate_emails = false
    email {
      enabled           = true
      password_required = true
    }
    anonymous { enabled = false }
    phone_number { enabled = false }
  }
  client {
    permissions {
      disabled_user_signup   = true
      disabled_user_deletion = true
    }
  }
  # First-login enrollment must remain possible; the application rejects every
  # office session without a verified TOTP second-factor sign-in.
  mfa {
    state = "ENABLED"
    provider_configs {
      state = "ENABLED"
      totp_provider_config { adjacent_intervals = 1 }
    }
  }
  lifecycle { prevent_destroy = true }
  depends_on = [google_project_service.required]
}
