output "project_id" { value = var.project_id }
output "domain" { value = var.domain }
output "zone_name" { value = google_dns_managed_zone.office.name }
output "name_servers" { value = google_dns_managed_zone.office.name_servers }
