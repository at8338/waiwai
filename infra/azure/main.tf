locals {
  prefix = "${var.name}-${substr(sha256(var.subscription_id), 0, 8)}"
  tags   = { application = "waiwai", environment = "production", managed_by = "terraform" }
}
resource "azurerm_resource_group" "app" {
  name     = "rg-${local.prefix}"
  location = var.location
  tags     = local.tags
}
resource "azurerm_virtual_network" "app" {
  name                = "vnet-${local.prefix}"
  location            = var.location
  resource_group_name = azurerm_resource_group.app.name
  address_space       = ["10.83.0.0/16"]
  tags                = local.tags
}
resource "azurerm_subnet" "app" {
  name                 = "app"
  resource_group_name  = azurerm_resource_group.app.name
  virtual_network_name = azurerm_virtual_network.app.name
  address_prefixes     = ["10.83.1.0/24"]
}
resource "azurerm_public_ip" "app" {
  name                    = "pip-${local.prefix}"
  location                = var.location
  resource_group_name     = azurerm_resource_group.app.name
  allocation_method       = "Static"
  sku                     = "Standard"
  zones                   = ["1", "2", "3"]
  domain_name_label       = local.prefix
  domain_name_label_scope = "SubscriptionReuse"
  ip_tags                 = { RoutingPreference = "Internet" }
  tags                    = local.tags
}
resource "azurerm_network_security_group" "app" {
  name                = "nsg-${local.prefix}"
  location            = var.location
  resource_group_name = azurerm_resource_group.app.name
  tags                = local.tags
  security_rule {
    name                       = "ssh-admin"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = var.admin_cidr
    destination_address_prefix = "*"
  }
  security_rule {
    name                       = "web-and-turn-tcp"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_ranges    = ["80", "443", "3478", "5349"]
    source_address_prefix      = "Internet"
    destination_address_prefix = "*"
  }
  security_rule {
    name                       = "turn-udp"
    priority                   = 120
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Udp"
    source_port_range          = "*"
    destination_port_ranges    = ["3478", "49160-49959"]
    source_address_prefix      = "Internet"
    destination_address_prefix = "*"
  }
}
resource "azurerm_network_interface" "app" {
  name                = "nic-${local.prefix}"
  location            = var.location
  resource_group_name = azurerm_resource_group.app.name
  tags                = local.tags
  ip_configuration {
    name                          = "primary"
    subnet_id                     = azurerm_subnet.app.id
    private_ip_address_allocation = "Static"
    private_ip_address            = "10.83.1.4"
    public_ip_address_id          = azurerm_public_ip.app.id
  }
}
resource "azurerm_network_interface_security_group_association" "app" {
  network_interface_id      = azurerm_network_interface.app.id
  network_security_group_id = azurerm_network_security_group.app.id
}
resource "azurerm_linux_virtual_machine" "app" {
  name                            = local.prefix
  location                        = var.location
  resource_group_name             = azurerm_resource_group.app.name
  size                            = var.vm_size
  admin_username                  = "waiwaiadmin"
  disable_password_authentication = true
  network_interface_ids           = [azurerm_network_interface.app.id]
  secure_boot_enabled             = true
  vtpm_enabled                    = true
  patch_assessment_mode           = "AutomaticByPlatform"
  tags                            = local.tags
  admin_ssh_key {
    username   = "waiwaiadmin"
    public_key = var.ssh_public_key
  }
  os_disk {
    name                 = "os-${local.prefix}"
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
  boot_diagnostics {}
  custom_data = base64encode(templatefile("${path.module}/templates/cloud-init.yaml.tftpl", {
    domain = azurerm_public_ip.app.fqdn, acme_email = var.acme_email
  }))
  depends_on = [azurerm_network_interface_security_group_association.app]
}
