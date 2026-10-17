# Standalone rules only: never mix with inline security_rule blocks on the NSG.
resource "azurerm_network_security_rule" "ingress" {
  for_each                    = local.ingress_rules
  name                        = each.value.name
  priority                    = each.value.priority
  direction                   = "Inbound"
  access                      = "Allow"
  protocol                    = each.value.protocol
  source_port_range           = "*"
  destination_port_ranges     = each.value.ports
  source_address_prefix       = each.value.source
  destination_address_prefix  = "*"
  resource_group_name         = var.resource_group_name
  network_security_group_name = azurerm_network_security_group.office.name
}
