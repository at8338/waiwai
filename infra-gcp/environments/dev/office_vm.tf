module "office_vm" {
  source                = "../../modules/office-vm"
  project_id            = var.project_id
  service_account_email = google_service_account.identity_reader.email
  region                = var.region
  zone                  = var.zone
  names                 = module.naming.names
  labels                = module.naming.labels
  subnetwork            = module.network.subnetwork
  private_ip            = module.network.private_ip
  public_ip             = module.network.public_ip
  firewall_target       = module.network.firewall_target
  machine_type          = var.machine_type
  domain                = var.domain
  acme_email            = var.acme_email
  web_allowed_cidrs     = var.web_allowed_cidrs
  operator_members      = var.operator_members
  public_slack_events   = var.public_slack_events
  depends_on            = [google_project_service.required, google_project_iam_member.identity_reader]
}
