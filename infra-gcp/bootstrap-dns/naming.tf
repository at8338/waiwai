module "naming" {
  source          = "../modules/naming"
  project_id      = var.project_id
  project_name    = var.project_name
  region          = var.region
  instance_number = var.instance_number
  labels          = var.labels
}
