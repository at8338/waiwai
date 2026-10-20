output "vm_name" { value = azurerm_linux_virtual_machine.office.name }
output "vm_size" { value = azurerm_linux_virtual_machine.office.size }
output "ssh_target" { value = "${azurerm_linux_virtual_machine.office.admin_username}@${var.domain}" }
