mock_provider "azurerm" { source = "../../tests/mocks" }
variables {
  names                = { virtual_machine = "dev-waiwai-jpe-vm-office-001", os_disk = "dev-waiwai-jpe-osdisk-office-001" }
  resource_group_name  = "dev-waiwai-jpe-rg-office-001"
  location             = "japaneast"
  tags                 = { environment = "dev" }
  network_interface_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/dev-waiwai-jpe-rg-office-001/providers/Microsoft.Network/networkInterfaces/test"
  domain               = "dev-waiwai-test.japaneast.cloudapp.azure.com"
  ssh_public_key       = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJFm7O0F3W6DEMRvGVeCiTEj2hFmWmiPMJx2JOcBExm9 fixture"
  acme_email           = "ops@example.com"
}
run "secured_pilot_with_secret_free_bootstrap" {
  command = apply
  assert {
    condition     = azurerm_linux_virtual_machine.office.size == "Standard_B2als_v2" && azurerm_linux_virtual_machine.office.disable_password_authentication && azurerm_linux_virtual_machine.office.secure_boot_enabled && azurerm_linux_virtual_machine.office.vtpm_enabled
    error_message = "Use the costed VM size, SSH keys, Secure Boot and vTPM."
  }
  assert {
    condition     = azurerm_linux_virtual_machine.office.os_disk[0].disk_size_gb == 32 && azurerm_linux_virtual_machine.office.os_disk[0].storage_account_type == "StandardSSD_LRS"
    error_message = "Use the budgeted 32 GiB Standard SSD."
  }
  assert {
    condition     = !strcontains(base64decode(azurerm_linux_virtual_machine.office.custom_data), "SLACK_CLIENT_SECRET") && !strcontains(base64decode(azurerm_linux_virtual_machine.office.custom_data), "static-auth-secret") && strcontains(base64decode(azurerm_linux_virtual_machine.office.custom_data), "reverse_proxy 127.0.0.1:5173")
    error_message = "Cloud-init must be secret-free and proxy only to loopback."
  }
}
run "double_capacity_after_failed_load_test" {
  command = plan
  variables { vm_size = "Standard_B4als_v2" }
  assert {
    condition     = azurerm_linux_virtual_machine.office.size == "Standard_B4als_v2"
    error_message = "The agreed doubled size must remain available through Terraform."
  }
}
run "reject_private_key" {
  command = plan
  variables { ssh_public_key = "-----BEGIN OPENSSH PRIVATE KEY-----" }
  expect_failures = [var.ssh_public_key]
}
run "reject_template_injection" {
  command = plan
  variables { acme_email = "ops@example.com\nunsafe-setting" }
  expect_failures = [var.acme_email]
}
