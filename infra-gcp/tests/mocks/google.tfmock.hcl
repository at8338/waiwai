mock_resource "google_compute_address" {
  defaults = { address = "203.0.113.50" }
}
mock_resource "google_compute_subnetwork" {
  defaults = { id = "projects/waiwai-dev-example/regions/asia-northeast1/subnetworks/dev-waiwai-tky-snet-office-001" }
}
mock_resource "google_compute_disk" {
  defaults = { self_link = "https://www.googleapis.com/compute/v1/projects/waiwai-dev-example/zones/asia-northeast1-a/disks/mock-disk" }
}
