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
output "url" { value = "https://${var.domain}" }
output "data_disk" { value = module.office_vm.data_disk }
output "snapshot_policy" { value = module.office_vm.snapshot_policy }
output "public_slack_events" { value = var.public_slack_events }
output "slack_redirect_uri" { value = "https://${var.domain}/auth/slack/callback" }
output "microsoft_redirect_uri" { value = "https://${var.domain}/auth/microsoft/callback" }
output "ssh_command" { value = "gcloud compute ssh ${module.office_vm.vm_name} --project=${var.project_id} --zone=${var.zone} --configuration=waiwai-dev" }
