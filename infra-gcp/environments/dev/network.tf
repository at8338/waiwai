module "network" {
  source      = "../../modules/network"
  project_id  = var.project_id
  region      = var.region
  names       = module.naming.names
  subnet_cidr = var.subnet_cidr
  admin_cidrs = var.admin_cidrs
  depends_on  = [google_project_service.required]
}
