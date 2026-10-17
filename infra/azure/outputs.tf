output "url" { value = "https://${azurerm_public_ip.app.fqdn}" }
output "slack_redirect_uri" { value = "https://${azurerm_public_ip.app.fqdn}/auth/slack/callback" }
output "public_ip" { value = azurerm_public_ip.app.ip_address }
output "domain" { value = azurerm_public_ip.app.fqdn }
output "ssh_target" { value = "waiwaiadmin@${azurerm_public_ip.app.fqdn}" }
output "resource_group" { value = azurerm_resource_group.app.name }
output "vm_name" { value = azurerm_linux_virtual_machine.app.name }
