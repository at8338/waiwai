resource "google_dns_managed_zone" "office" {
  project       = var.project_id
  name          = module.naming.names.dns_zone
  dns_name      = "${var.domain}."
  description   = "Public authoritative DNS for Waiwai dev"
  visibility    = "public"
  force_destroy = false
  labels        = module.naming.labels
  dnssec_config { state = "on" }
  lifecycle { prevent_destroy = true }
  depends_on = [google_project_service.required]
}
