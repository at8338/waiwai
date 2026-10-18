mock_resource "azurerm_subnet" {
  defaults = { id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/dev-waiwai-jpe-rg-office-001/providers/Microsoft.Network/virtualNetworks/test/subnets/test" }
}
mock_resource "azurerm_network_interface" {
  defaults = { id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/dev-waiwai-jpe-rg-office-001/providers/Microsoft.Network/networkInterfaces/test" }
}
mock_resource "azurerm_network_security_group" {
  defaults = { id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/dev-waiwai-jpe-rg-office-001/providers/Microsoft.Network/networkSecurityGroups/test" }
}
mock_resource "azurerm_storage_account" {
  defaults = { id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/dev-waiwai-jpe-rg-office-001/providers/Microsoft.Storage/storageAccounts/devwaiwaijpetftest" }
}
mock_resource "azurerm_public_ip" {
  defaults = { id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/dev-waiwai-jpe-rg-office-001/providers/Microsoft.Network/publicIPAddresses/test", fqdn = "dev-waiwai-test.japaneast.cloudapp.azure.com", ip_address = "203.0.113.10" }
}
mock_data "azurerm_client_config" {
  defaults = { object_id = "11111111-1111-1111-1111-111111111111", tenant_id = "22222222-2222-2222-2222-222222222222", subscription_id = "00000000-0000-0000-0000-000000000000" }
}
mock_resource "azurerm_linux_virtual_machine" {
  defaults = { id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/dev-waiwai-jpe-rg-office-001/providers/Microsoft.Compute/virtualMachines/test" }
}
mock_resource "azurerm_managed_disk" {
  defaults = { id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/dev-waiwai-jpe-rg-office-001/providers/Microsoft.Compute/disks/test" }
}
mock_resource "azurerm_backup_policy_vm" {
  defaults = { id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/dev-waiwai-jpe-rg-office-001/providers/Microsoft.RecoveryServices/vaults/test/backupPolicies/test" }
}
