resource "google_project_service" "storage" {
  project                    = var.project_id
  service                    = "storage.googleapis.com"
  disable_on_destroy         = false
  disable_dependent_services = false
}

# The dev provider explicitly attributes all user-ADC requests to this project.
# Enable these management APIs before that provider refreshes project services.
resource "google_project_service" "resource_manager" {
  project                    = var.project_id
  service                    = "cloudresourcemanager.googleapis.com"
  disable_on_destroy         = false
  disable_dependent_services = false
}

resource "google_project_service" "service_usage" {
  project                    = var.project_id
  service                    = "serviceusage.googleapis.com"
  disable_on_destroy         = false
  disable_dependent_services = false
}
