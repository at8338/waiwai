resource "azurerm_network_interface_security_group_association" "office" {
  network_interface_id      = azurerm_network_interface.office.id
  network_security_group_id = azurerm_network_security_group.office.id
  depends_on                = [azurerm_network_security_rule.ingress]
}
