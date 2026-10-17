mock_provider "azurerm" {
  mock_resource "azurerm_subnet" {
    defaults = { id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-test/providers/Microsoft.Network/virtualNetworks/test/subnets/test" }
  }
  mock_resource "azurerm_network_interface" {
    defaults = { id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-test/providers/Microsoft.Network/networkInterfaces/test" }
  }
  mock_resource "azurerm_network_security_group" {
    defaults = { id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-test/providers/Microsoft.Network/networkSecurityGroups/test" }
  }
  mock_resource "azurerm_public_ip" {
    defaults = {
      id         = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-test/providers/Microsoft.Network/publicIPAddresses/test"
      fqdn       = "waiwai-test.japaneast.cloudapp.azure.com"
      ip_address = "203.0.113.10"
    }
  }
}
variables {
  subscription_id = "00000000-0000-0000-0000-000000000000"
  ssh_public_key  = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJFm7O0F3W6DEMRvGVeCiTEj2hFmWmiPMJx2JOcBExm9 fixture"
  admin_cidr      = "203.0.113.20/32"
  acme_email      = "ops@example.com"
}
run "safe_single_vm_plan" {
  command = apply
  assert {
    condition     = azurerm_linux_virtual_machine.app.size == "Standard_B2als_v2"
    error_message = "Pilot uses the costed VM size."
  }
  assert {
    condition     = azurerm_public_ip.app.allocation_method == "Static" && azurerm_public_ip.app.ip_tags["RoutingPreference"] == "Internet"
    error_message = "The permanent URL requires a static public IP with the costed routing preference."
  }
  assert {
    condition     = length(azurerm_network_security_group.app.security_rule) == 3 && length([for r in azurerm_network_security_group.app.security_rule : r if r.name == "ssh-admin" && r.source_address_prefix == "203.0.113.20/32"]) == 1
    error_message = "SSH must be restricted to the operator CIDR."
  }
  assert {
    condition     = azurerm_linux_virtual_machine.app.disable_password_authentication && azurerm_linux_virtual_machine.app.secure_boot_enabled
    error_message = "Use SSH keys and Secure Boot."
  }
  assert {
    condition     = !strcontains(base64decode(azurerm_linux_virtual_machine.app.custom_data), "SLACK_CLIENT_SECRET") && !strcontains(base64decode(azurerm_linux_virtual_machine.app.custom_data), "static-auth-secret")
    error_message = "Secrets must never enter cloud-init or Terraform state."
  }
  assert {
    condition     = strcontains(output.slack_redirect_uri, "/auth/slack/callback")
    error_message = "Output the exact Slack callback URL."
  }
}
run "reject_public_ssh" {
  command = plan
  variables { admin_cidr = "0.0.0.0/0" }
  expect_failures = [var.admin_cidr]
}
