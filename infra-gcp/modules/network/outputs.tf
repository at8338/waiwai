output "subnetwork" { value = google_compute_subnetwork.office.id }
output "public_ip" { value = google_compute_address.office.address }
output "private_ip" { value = cidrhost(var.subnet_cidr, 10) }
output "firewall_target" { value = var.names.firewall_target }
