resource "azurerm_resource_group" "state" {
  name     = var.names.state_resource_group
  location = var.location
  tags     = var.tags
  lifecycle { prevent_destroy = true }
}
