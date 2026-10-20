mock_provider "google" { source = "../../tests/mocks" }
variables {
  project_id        = "waiwai-dev-example"
  region            = "asia-northeast1"
  zone              = "asia-northeast1-a"
  names             = { virtual_machine = "dev-waiwai-tky-vm-office-001", boot_disk = "dev-waiwai-tky-disk-os-001", data_disk = "dev-waiwai-tky-disk-data-001", snapshot_policy = "dev-waiwai-tky-snap-office-001" }
  labels            = { environment = "dev" }
  subnetwork        = "projects/waiwai-dev-example/regions/asia-northeast1/subnetworks/office"
  public_ip         = "203.0.113.50"
  private_ip        = "10.84.1.10"
  firewall_target   = "dev-waiwai-tky-office-001"
  domain            = "waiwai-dev.example.com"
  acme_email        = "ops@example.com"
  web_allowed_cidrs = ["203.0.113.20/32"]
  operator_members  = ["user:operator@example.com"]
}
run "persistent_disks_and_human_mfa" {
  command = apply
  assert {
    condition     = google_compute_instance.office.machine_type == "e2-custom-2-4096" && google_compute_instance.office.deletion_protection && google_compute_instance.office.deletion_policy == "PREVENT" && !google_compute_instance.office.boot_disk[0].auto_delete && google_compute_disk.data.size == 32
    error_message = "Keep the agreed initial capacity and independently preserved boot/data disks."
  }
  assert {
    condition     = google_compute_instance.office.metadata["enable-oslogin"] == "TRUE" && google_compute_instance.office.metadata["enable-oslogin-2fa"] == "TRUE" && google_compute_instance.office.shielded_instance_config[0].enable_secure_boot && length(google_compute_instance.office.service_account) == 0
    error_message = "Require OS Login MFA and Shielded VM; do not attach a privileged cloud identity to the app."
  }
  assert {
    condition     = strcontains(local.cloud_init, "not remote_ip 203.0.113.20/32") && strcontains(local.cloud_init, "/dev/disk/by-id/google-waiwai-data") && strcontains(local.cloud_init, "ConditionPathIsMountPoint=/var/lib/waiwai") && !strcontains(local.cloud_init, "KbdInteractiveAuthentication no") && !strcontains(local.cloud_init, "static-auth-secret=")
    error_message = "Preserve the company-IP web gate, persistent mount and OS Login PAM flow without putting relay secrets in metadata."
  }
  assert {
    condition     = can(yamldecode(local.cloud_init))
    error_message = "The rendered Google cloud-init must be valid YAML."
  }
  assert {
    condition     = google_compute_resource_policy.backup.snapshot_schedule_policy[0].retention_policy[0].max_retention_days == 7 && google_compute_resource_policy.backup.snapshot_schedule_policy[0].schedule[0].daily_schedule[0].start_time == "17:00" && length(google_compute_disk_resource_policy_attachment.backup) == 2
    error_message = "Schedule daily retained snapshots for both OS and app data disks."
  }
}
run "explicit_capacity_double" {
  command = apply
  variables { machine_type = "e2-custom-4-8192" }
  assert {
    condition     = output.machine_type == "e2-custom-4-8192" && strcontains(local.cloud_init, "MemoryMax=1536M")
    error_message = "Allow the agreed larger VM while retaining explicit service memory limits."
  }
}
run "reject_public_web_access" {
  command = plan
  variables { web_allowed_cidrs = ["0.0.0.0/0"] }
  expect_failures = [var.web_allowed_cidrs]
}
run "reject_non_human_admin" {
  command = plan
  variables { operator_members = ["serviceAccount:robot@example.iam.gserviceaccount.com"] }
  expect_failures = [var.operator_members]
}
run "reject_url_in_domain" {
  command = plan
  variables { domain = "https://example.com/" }
  expect_failures = [var.domain]
}
