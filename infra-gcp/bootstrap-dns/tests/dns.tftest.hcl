mock_provider "google" { source = "../tests/mocks" }
variables {
  project_id = "waiwai-dev-example"
  domain     = "waiwai-dev.example.com"
}
run "signed_public_zone_without_vm_or_contact_data" {
  command = apply
  assert {
    condition     = output.zone_name == "dev-waiwai-tky-dns-office-001" && google_dns_managed_zone.office.dns_name == "waiwai-dev.example.com." && google_dns_managed_zone.office.visibility == "public" && google_dns_managed_zone.office.dnssec_config[0].state == "on" && !google_dns_managed_zone.office.force_destroy
    error_message = "Use the canonical name and a protected, DNSSEC-signed authoritative zone."
  }
  assert {
    condition     = length(google_project_service.required) == 2 && !google_project_service.required["domains.googleapis.com"].disable_on_destroy && !google_project_service.required["dns.googleapis.com"].disable_on_destroy && length(output.name_servers) > 0
    error_message = "Manage only the needed APIs, preserve them on destroy, and return registrar name servers."
  }
}
run "reject_url_in_domain" {
  command = plan
  variables { domain = "https://example.com/" }
  expect_failures = [var.domain]
}
