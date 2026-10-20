resource "google_compute_disk" "boot" {
  project = var.project_id
  name    = var.names.boot_disk
  zone    = var.zone
  type    = "pd-balanced"
  size    = 20
  image   = var.boot_image
  labels  = var.labels
  lifecycle { prevent_destroy = true }
}
resource "google_compute_disk" "data" {
  project = var.project_id
  name    = var.names.data_disk
  zone    = var.zone
  type    = "pd-balanced"
  size    = 32
  labels  = var.labels
  lifecycle { prevent_destroy = true }
}
