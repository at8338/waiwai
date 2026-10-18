mock_provider "azurerm" { source = "../../tests/mocks" }
variables {
  subscription_id   = "00000000-0000-0000-0000-000000000000"
  ssh_public_key    = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJFm7O0F3W6DEMRvGVeCiTEj2hFmWmiPMJx2JOcBExm9 fixture"
  admin_cidr        = "203.0.113.20/32"
  web_allowed_cidrs = ["203.0.113.20/32"]
  acme_email        = "ops@example.com"
}
run "dev_composition_and_deploy_contract" {
  command = apply
  assert {
    condition     = output.environment == "dev" && output.resource_group == "dev-waiwai-jpe-rg-office-001" && output.vm_name == "dev-waiwai-jpe-vm-office-001" && output.vm_size == "Standard_B2als_v2"
    error_message = "Only dev infrastructure with the initial capacity may be composed by this root."
  }
  assert {
    condition     = output.slack_redirect_uri == "${output.url}/auth/slack/callback" && output.ssh_target == "waiwaiadmin@${output.domain}" && output.private_ip == "10.83.1.4"
    error_message = "The Terraform output contract must match the app/TURN deployment script."
  }
}
