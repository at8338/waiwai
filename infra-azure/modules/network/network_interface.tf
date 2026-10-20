resource "azurerm_network_interface" "office" {
  name                = var.names.network_interface
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = var.tags
  ip_configuration {
    name                          = "primary"
    subnet_id                     = azurerm_subnet.office.id
    private_ip_address_allocation = "Static"
    private_ip_address            = local.private_ip
    public_ip_address_id          = azurerm_public_ip.office.id
  }
}
