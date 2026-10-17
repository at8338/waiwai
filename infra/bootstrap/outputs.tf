output "backend" {
  description = "Non-secret backend configuration for infra/environments/dev/backend.hcl."
  value       = <<-BACKEND
resource_group_name  = "${module.terraform_state.resource_group_name}"
storage_account_name = "${module.terraform_state.storage_account_name}"
container_name       = "${module.terraform_state.container_name}"
key                  = "${module.naming.names.state_key}"
use_azuread_auth     = true
use_cli              = true
subscription_id      = "${var.subscription_id}"
BACKEND
}
output "environment" { value = "dev" }
