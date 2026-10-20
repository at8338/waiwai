data "google_dns_managed_zone" "office" {
  project = var.project_id
  name    = module.naming.names.dns_zone
}
resource "google_dns_record_set" "office" {
  project      = var.project_id
  managed_zone = data.google_dns_managed_zone.office.name
  name         = "${var.domain}."
  type         = "A"
  ttl          = 300
  rrdatas      = [module.network.public_ip]
  lifecycle {
    prevent_destroy = true
    precondition {
      condition     = data.google_dns_managed_zone.office.dns_name == "${var.domain}."
      error_message = "The DNS bootstrap zone must match this dev domain before assigning its public IP."
    }
  }
}
