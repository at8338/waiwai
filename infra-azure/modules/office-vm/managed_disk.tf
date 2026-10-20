resource "azurerm_managed_disk" "data" {
  name                 = var.names.data_disk
  location             = var.location
  resource_group_name  = var.resource_group_name
  storage_account_type = "StandardSSD_LRS"
  create_option        = "Empty"
  disk_size_gb         = 32
  tags                 = var.tags
  lifecycle { prevent_destroy = true }
}
