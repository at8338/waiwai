module "naming" {
  source          = "../../modules/naming"
  project_name    = var.project_name
  environment     = "dev"
  location        = var.location
  subscription_id = var.subscription_id
  instance_number = var.instance_number
  tags            = var.tags
}
