resource "google_compute_network" "office" {
  project                 = var.project_id
  name                    = var.names.network
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"
}
