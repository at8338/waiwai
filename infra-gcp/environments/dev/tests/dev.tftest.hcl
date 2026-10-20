mock_provider "google" { source = "../../tests/mocks" }
variables {
  project_id        = "waiwai-dev-example"
  domain            = "waiwai-dev.example.com"
  admin_cidrs       = ["203.0.113.20/32"]
  web_allowed_cidrs = ["203.0.113.20/32"]
  operator_members  = ["user:operator@example.com"]
  acme_email        = "ops@example.com"
}
run "reject_domain_zone_mismatch" {
  command = plan
  override_data {
    target = data.google_dns_managed_zone.office
    values = { dns_name = "another.example.com." }
  }
  expect_failures = [google_dns_record_set.office]
}
run "dev_composition_without_azure_dependencies" {
  command = apply
  assert {
    condition     = google_storage_bucket.releases.public_access_prevention == "enforced" && google_storage_bucket.releases.uniform_bucket_level_access && google_storage_bucket_iam_member.release_reader.role == "roles/storage.objectViewer" && strcontains(google_storage_bucket_iam_member.release_reader.condition[0].expression, "/objects/releases/")
    error_message = "Deployment storage must remain private and the VM may only read release objects."
  }
  assert {
    condition     = output.environment == "dev" && output.cloud == "gcp" && output.project_id == "waiwai-dev-example" && output.vm_name == "dev-waiwai-tky-vm-office-001" && output.machine_type == "e2-custom-2-4096"
    error_message = "Only dev GCP infrastructure may be composed by this root."
  }
  assert {
    condition     = output.private_ip == "10.84.1.10" && output.public_ip == "203.0.113.50" && output.slack_redirect_uri == "${output.url}/auth/slack/callback" && strcontains(output.ssh_command, "--configuration=waiwai-dev")
    error_message = "Endpoint, identity and storage outputs must be explicit and usable without Azure CLI."
  }
  assert {
    condition     = output.dns_zone == "dev-waiwai-tky-dns-office-001" && google_dns_record_set.office.name == "waiwai-dev.example.com." && google_dns_record_set.office.type == "A" && google_dns_record_set.office.ttl == 300 && toset(google_dns_record_set.office.rrdatas) == toset([output.public_ip])
    error_message = "Point the matching registered domain at the reserved VM address, never a placeholder IP."
  }
  assert {
    condition     = google_identity_platform_config.office.sign_in[0].email[0].enabled && google_identity_platform_config.office.sign_in[0].email[0].password_required && !google_identity_platform_config.office.sign_in[0].anonymous[0].enabled && google_identity_platform_config.office.client[0].permissions[0].disabled_user_signup && google_identity_platform_config.office.client[0].permissions[0].disabled_user_deletion && toset(google_identity_platform_config.office.authorized_domains) == toset([var.domain])
    error_message = "Identity Platform must allow password login only on the office domain and disable self-registration."
  }
  assert {
    condition     = google_identity_platform_config.office.mfa[0].state == "ENABLED" && one(google_identity_platform_config.office.mfa[0].provider_configs).totp_provider_config[0].adjacent_intervals == 1 && toset(google_project_iam_custom_role.identity_reader.permissions) == toset(["firebaseauth.users.get"]) && module.office_vm.identity_service_account == google_service_account.identity_reader.email
    error_message = "Enable TOTP enrollment and attach a keyless user-read-only identity to the VM."
  }
}
