output "network_interface_id" { value = azurerm_network_interface.office.id }
output "public_ip" { value = azurerm_public_ip.office.ip_address }
output "private_ip" { value = azurerm_network_interface.office.ip_configuration[0].private_ip_address }
output "domain" { value = azurerm_public_ip.office.fqdn }
