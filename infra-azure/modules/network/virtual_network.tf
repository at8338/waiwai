resource "azurerm_virtual_network" "office" {
  name                = var.names.virtual_network
  location            = var.location
  resource_group_name = var.resource_group_name
  address_space       = [var.vnet_cidr]
  tags                = var.tags
}
