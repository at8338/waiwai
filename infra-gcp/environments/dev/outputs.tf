output "environment" { value = "dev" }
output "cloud" { value = "gcp" }
output "project_id" { value = var.project_id }
output "region" { value = var.region }
output "zone" { value = var.zone }
output "vm_name" { value = module.office_vm.vm_name }
output "machine_type" { value = module.office_vm.machine_type }
output "public_ip" { value = module.network.public_ip }
output "private_ip" { value = module.network.private_ip }
output "domain" { value = var.domain }
output "dns_zone" { value = data.google_dns_managed_zone.office.name }
output "url" { value = "https://${var.domain}" }
output "data_disk" { value = module.office_vm.data_disk }
output "snapshot_policy" { value = module.office_vm.snapshot_policy }
output "public_slack_events" { value = var.public_slack_events }
output "slack_redirect_uri" { value = "https://${var.domain}/auth/slack/callback" }
output "microsoft_redirect_uri" { value = "https://${var.domain}/auth/microsoft/callback" }
output "identity_project_id" { value = var.project_id }
output "identity_origin" { value = "https://${var.domain}" }
output "identity_service_account" { value = google_service_account.identity_reader.email }
output "release_bucket" { value = google_storage_bucket.releases.name }
output "identity_api_key" {
  value     = google_identity_platform_config.office.client[0].api_key
  sensitive = true
}
output "ssh_command" { value = "gcloud compute ssh ${module.office_vm.vm_name} --project=${var.project_id} --zone=${var.zone} --configuration=waiwai-dev" }
