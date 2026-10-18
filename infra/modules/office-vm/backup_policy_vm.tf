resource "azurerm_backup_policy_vm" "office" {
  name                = var.names.backup_policy
  resource_group_name = var.resource_group_name
  recovery_vault_name = azurerm_recovery_services_vault.office.name
  timezone            = "Tokyo Standard Time"
  backup {
    frequency = "Daily"
    time      = "02:00"
  }
  retention_daily { count = 7 }
  instant_restore_retention_days = 2
}
