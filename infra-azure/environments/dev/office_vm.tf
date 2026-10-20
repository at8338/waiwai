module "office_vm" {
  source               = "../../modules/office-vm"
  names                = module.naming.names
  resource_group_name  = azurerm_resource_group.office.name
  location             = var.location
  tags                 = module.naming.tags
  network_interface_id = module.network.network_interface_id
  domain               = module.network.domain
  vm_size              = var.vm_size
  ssh_public_key       = var.ssh_public_key
  public_slack_events  = var.public_slack_events
  web_allowed_cidrs    = var.web_allowed_cidrs
  acme_email           = var.acme_email
  depends_on           = [module.network]
}
