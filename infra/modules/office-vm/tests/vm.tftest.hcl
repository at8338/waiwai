mock_provider "azurerm" { source = "../../tests/mocks" }
variables {
  names                = { virtual_machine = "dev-waiwai-jpe-vm-office-001", os_disk = "dev-waiwai-jpe-osdisk-office-001", data_disk = "dev-waiwai-jpe-datadisk-office-001", backup_vault = "dev-waiwai-jpe-rsv-office-001", backup_policy = "dev-waiwai-jpe-bkp-office-001" }
  resource_group_name  = "dev-waiwai-jpe-rg-office-001"
  location             = "japaneast"
  tags                 = { environment = "dev" }
  network_interface_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/dev-waiwai-jpe-rg-office-001/providers/Microsoft.Network/networkInterfaces/test"
  domain               = "dev-waiwai-test.japaneast.cloudapp.azure.com"
  ssh_public_key       = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJFm7O0F3W6DEMRvGVeCiTEj2hFmWmiPMJx2JOcBExm9 fixture"
  web_allowed_cidrs    = ["203.0.113.20/32"]
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
run "company_web_gate_and_durable_backups" {
  command = plan
  assert {
    condition     = strcontains(base64decode(azurerm_linux_virtual_machine.office.custom_data), "not remote_ip 203.0.113.20/32") && strcontains(base64decode(azurerm_linux_virtual_machine.office.custom_data), "ConditionPathIsMountPoint=/var/lib/waiwai")
    error_message = "Web access must check the direct company IP and the app must refuse an unmounted data directory."
  }
  assert {
    condition     = azurerm_managed_disk.data.disk_size_gb == 32 && azurerm_virtual_machine_data_disk_attachment.data.lun == 0 && azurerm_backup_policy_vm.office.retention_daily[0].count == 7 && azurerm_recovery_services_vault.office.soft_delete_enabled
    error_message = "Use a separate persistent data disk plus daily retained, soft-deleted VM backups."
  }
}
run "reject_public_web" {
  command = plan
  variables { web_allowed_cidrs = ["0.0.0.0/0"] }
  expect_failures = [var.web_allowed_cidrs]
}
run "reject_empty_web_allowlist" {
  command = plan
  variables { web_allowed_cidrs = [] }
  expect_failures = [var.web_allowed_cidrs]
}
run "slack_webhook_exception_is_explicit_and_method_scoped" {
  command = plan
  variables { public_slack_events = true }
  assert {
    condition     = strcontains(base64decode(azurerm_linux_virtual_machine.office.custom_data), "path /api/slack/events\n          method POST") && strcontains(base64decode(azurerm_linux_virtual_machine.office.custom_data), "not remote_ip 203.0.113.20/32")
    error_message = "Only the signed POST webhook may bypass the company IP gate."
  }
}
