resource "google_compute_subnetwork" "office" {
  project                  = var.project_id
  name                     = var.names.subnet
  region                   = var.region
  network                  = google_compute_network.office.id
  ip_cidr_range            = var.subnet_cidr
  private_ip_google_access = true
}
