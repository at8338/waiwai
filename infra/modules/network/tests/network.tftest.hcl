mock_provider "azurerm" { source = "../../tests/mocks" }
variables {
  names               = { virtual_network = "dev-waiwai-jpe-vnet-office-001", subnet = "dev-waiwai-jpe-snet-office-001", network_security_group = "dev-waiwai-jpe-nsg-office-001", network_interface = "dev-waiwai-jpe-nic-office-001", public_ip = "dev-waiwai-jpe-pip-office-001", dns_label = "dev-waiwai-office-test" }
  resource_group_name = "dev-waiwai-jpe-rg-office-001"
  location            = "japaneast"
  tags                = { environment = "dev" }
  vnet_cidr           = "10.83.0.0/16"
  admin_cidr          = "203.0.113.20/32"
}
run "restricted_ingress_and_fixed_address" {
  command = apply
  assert {
    condition     = length(azurerm_network_security_rule.ingress) == 3 && azurerm_network_security_rule.ingress["ssh_admin"].source_address_prefix == "203.0.113.20/32" && toset(azurerm_network_security_rule.ingress["ssh_admin"].destination_port_ranges) == toset(["22"])
    error_message = "SSH must only be allowed from the supplied operator CIDR."
  }
  assert {
    condition     = toset(azurerm_network_security_rule.ingress["web_turn_tcp"].destination_port_ranges) == toset(["80", "443", "3478", "5349"]) && toset(azurerm_network_security_rule.ingress["turn_udp"].destination_port_ranges) == toset(["3478", "49160-49959"])
    error_message = "Only HTTPS/ACME and the configured TURN listener/relay ports may be exposed; never 5173."
  }
  assert {
    condition     = output.private_ip == "10.83.1.4" && !azurerm_subnet.office.default_outbound_access_enabled && azurerm_public_ip.office.allocation_method == "Static" && azurerm_public_ip.office.ip_tags["RoutingPreference"] == "Internet"
    error_message = "Keep deterministic private IP and explicit public-IP egress/permanent endpoint."
  }
}
run "alternate_company_network" {
  command = apply
  variables { vnet_cidr = "10.84.0.0/16" }
  assert {
    condition     = output.private_ip == "10.84.1.4" && toset(azurerm_subnet.office.address_prefixes) == toset(["10.84.1.0/24"])
    error_message = "Changing the company network must update both subnet and VM private address."
  }
}
run "reject_public_ssh" {
  command = plan
  variables { admin_cidr = "0.0.0.0/0" }
  expect_failures = [var.admin_cidr]
}
run "reject_broad_ssh" {
  command = plan
  variables { admin_cidr = "203.0.0.0/16" }
  expect_failures = [var.admin_cidr]
}
run "reject_invalid_network" {
  command = plan
  variables { vnet_cidr = "2001:db8::/16" }
  expect_failures = [var.vnet_cidr]
}
