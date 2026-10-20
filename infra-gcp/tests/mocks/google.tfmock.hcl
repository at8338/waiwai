mock_resource "google_compute_address" {
  defaults = { address = "203.0.113.50" }
}
mock_resource "google_compute_subnetwork" {
  defaults = { id = "projects/waiwai-dev-example/regions/asia-northeast1/subnetworks/dev-waiwai-tky-snet-office-001" }
}
mock_resource "google_compute_disk" {
  defaults = { self_link = "https://www.googleapis.com/compute/v1/projects/waiwai-dev-example/zones/asia-northeast1-a/disks/mock-disk" }
}
mock_resource "google_dns_managed_zone" {
  defaults = { name_servers = ["ns-cloud-a1.googledomains.com.", "ns-cloud-a2.googledomains.com."] }
}
mock_data "google_dns_managed_zone" {
  defaults = { dns_name = "waiwai-dev.example.com." }
}
mock_resource "google_service_account" {
  defaults = { email = "dev-waiwai-tky-sa-id-001@waiwai-dev-example.iam.gserviceaccount.com" }
}
