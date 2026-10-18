resource "azurerm_backup_protected_vm" "office" {
  resource_group_name = var.resource_group_name
  recovery_vault_name = azurerm_recovery_services_vault.office.name
  source_vm_id        = azurerm_linux_virtual_machine.office.id
  backup_policy_id    = azurerm_backup_policy_vm.office.id
  # Both OS and data disk are protected. Do not begin backup before attachment.
  depends_on = [azurerm_virtual_machine_data_disk_attachment.data]
}
