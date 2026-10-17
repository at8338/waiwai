resource "azurerm_resource_group" "office" {
  name     = module.naming.names.resource_group
  location = var.location
  tags     = module.naming.tags
}
