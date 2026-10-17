resource "azurerm_storage_container" "state" {
  name                  = var.names.state_container
  storage_account_id    = azurerm_storage_account.state.id
  container_access_type = "private"
  depends_on            = [azurerm_role_assignment.operator]
  lifecycle { prevent_destroy = true }
}
