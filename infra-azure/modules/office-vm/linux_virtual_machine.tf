resource "azurerm_linux_virtual_machine" "office" {
  name                            = var.names.virtual_machine
  location                        = var.location
  resource_group_name             = var.resource_group_name
  size                            = var.vm_size
  admin_username                  = "waiwaiadmin"
  disable_password_authentication = true
  network_interface_ids           = [var.network_interface_id]
  secure_boot_enabled             = true
  vtpm_enabled                    = true
  patch_assessment_mode           = "AutomaticByPlatform"
  tags                            = var.tags
  admin_ssh_key {
    username   = "waiwaiadmin"
    public_key = var.ssh_public_key
  }
  os_disk {
    name                 = var.names.os_disk
    caching              = "ReadWrite"
    storage_account_type = "StandardSSD_LRS"
    disk_size_gb         = 32
  }
  source_image_reference {
    publisher = "Canonical"
    offer     = "ubuntu-24_04-lts"
    sku       = "server"
    version   = "latest"
  }
  # Cloud-init/image changes require an explicit maintenance decision, never implicit VM replacement.
  lifecycle { prevent_destroy = true }
  boot_diagnostics {}
  custom_data = base64encode(templatefile("${path.module}/templates/cloud-init.yaml.tftpl", {
    domain = var.domain, acme_email = var.acme_email, web_allowed_cidrs = var.web_allowed_cidrs, public_slack_events = var.public_slack_events
  }))
}
