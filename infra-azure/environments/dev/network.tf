module "network" {
  source              = "../../modules/network"
  names               = module.naming.names
  resource_group_name = azurerm_resource_group.office.name
  location            = var.location
  tags                = module.naming.tags
  vnet_cidr           = var.vnet_cidr
  admin_cidr          = var.admin_cidr
}
