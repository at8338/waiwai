resource "azurerm_recovery_services_vault" "office" {
  name                = var.names.backup_vault
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "Standard"
  storage_mode_type   = "LocallyRedundant"
  soft_delete_enabled = true
  tags                = var.tags
  lifecycle { prevent_destroy = true }
}
