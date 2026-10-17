# Record former local-state addresses. New names intentionally do NOT silently
# rename existing state storage: prevent_destroy blocks replacement. See migration docs.
moved {
  from = azurerm_resource_group.state
  to   = module.terraform_state.azurerm_resource_group.state
}
moved {
  from = azurerm_storage_account.state
  to   = module.terraform_state.azurerm_storage_account.state
}
moved {
  from = azurerm_role_assignment.operator
  to   = module.terraform_state.azurerm_role_assignment.operator
}
moved {
  from = azurerm_storage_container.state
  to   = module.terraform_state.azurerm_storage_container.state
}
