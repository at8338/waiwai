mock_provider "azurerm" { source = "../../tests/mocks" }
variables {
  names              = { state_resource_group = "dev-waiwai-jpe-rg-tfstate-001", state_storage_account = "devwaiwaijpesttf12345678", state_container = "tfstate" }
  location           = "japaneast"
  tags               = { environment = "dev" }
  operator_object_id = "11111111-1111-1111-1111-111111111111"
}
run "private_state_with_entra_and_recovery" {
  command = apply
  assert {
    condition     = !azurerm_storage_account.state.shared_access_key_enabled && !azurerm_storage_account.state.allow_nested_items_to_be_public && azurerm_storage_account.state.https_traffic_only_enabled && azurerm_storage_account.state.min_tls_version == "TLS1_2" && azurerm_storage_container.state.container_access_type == "private"
    error_message = "State requires Entra authorization, private blobs and HTTPS/TLS1.2."
  }
  assert {
    condition     = azurerm_storage_account.state.blob_properties[0].versioning_enabled && azurerm_storage_account.state.blob_properties[0].delete_retention_policy[0].days == 30 && azurerm_storage_account.state.blob_properties[0].container_delete_retention_policy[0].days == 30
    error_message = "Keep versioning and thirty-day recovery policies."
  }
  assert {
    condition     = azurerm_role_assignment.operator.role_definition_name == "Storage Blob Data Contributor" && azurerm_role_assignment.operator.principal_id == var.operator_object_id && azurerm_role_assignment.operator.scope == azurerm_storage_account.state.id
    error_message = "Grant only blob-data access on this state account to the bootstrap operator."
  }
}
