module "naming" {
  source          = "../modules/naming"
  project_id      = var.project_id
  project_name    = var.project_name
  region          = var.region
  instance_number = var.instance_number
  labels          = var.labels
}
module "state" {
  source        = "../modules/terraform-state"
  project_id    = var.project_id
  region        = var.region
  bucket_name   = module.naming.names.state_bucket
  state_prefix  = module.naming.names.state_prefix
  labels        = module.naming.labels
  state_members = var.state_members
  depends_on    = [google_project_service.storage]
}
