resource "azurerm_subnet" "office" {
  name                 = var.names.subnet
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.office.name
  address_prefixes     = [local.subnet_cidr]
  # Egress uses the explicit public IP on the NIC, not Azure default outbound access.
  default_outbound_access_enabled = false
}
