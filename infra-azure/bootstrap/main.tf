# This local-state root creates only the dev Terraform state store.
module "naming" {
  source          = "../modules/naming"
  project_name    = var.project_name
  environment     = "dev"
  location        = var.location
  subscription_id = var.subscription_id
  instance_number = var.instance_number
  tags            = var.tags
}
module "terraform_state" {
  source             = "../modules/terraform-state"
  names              = module.naming.names
  location           = var.location
  tags               = module.naming.tags
  operator_object_id = data.azurerm_client_config.current.object_id
}
