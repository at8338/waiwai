resource "google_project_service" "required" {
  for_each                   = toset(["dns.googleapis.com", "domains.googleapis.com"])
  project                    = var.project_id
  service                    = each.value
  disable_on_destroy         = false
  disable_dependent_services = false
}
