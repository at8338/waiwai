resource "azurerm_network_security_group" "office" {
  name                = var.names.network_security_group
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = var.tags
}
