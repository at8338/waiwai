resource "google_compute_address" "office" {
  project      = var.project_id
  name         = var.names.public_ip
  region       = var.region
  address_type = "EXTERNAL"
  network_tier = "STANDARD"
  lifecycle { prevent_destroy = true }
}
