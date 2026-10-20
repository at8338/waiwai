locals {
  ingress = {
    ssh      = { sources = var.admin_cidrs, tcp = ["22"], udp = [] }
    web      = { sources = toset(["0.0.0.0/0"]), tcp = ["80", "443"], udp = [] }
    turn_tcp = { sources = toset(["0.0.0.0/0"]), tcp = ["3478", "5349"], udp = [] }
    turn_udp = { sources = toset(["0.0.0.0/0"]), tcp = [], udp = ["3478", "49160-49959"] }
  }
}
resource "google_compute_firewall" "ingress" {
  for_each      = local.ingress
  project       = var.project_id
  name          = "${var.names.firewall_prefix}-${replace(each.key, "_", "-")}"
  network       = google_compute_network.office.id
  direction     = "INGRESS"
  priority      = 1000
  source_ranges = each.value.sources
  target_tags   = [var.names.firewall_target]
  dynamic "allow" {
    for_each = length(each.value.tcp) > 0 ? [each.value.tcp] : []
    content {
      protocol = "tcp"
      ports    = allow.value
    }
  }
  dynamic "allow" {
    for_each = length(each.value.udp) > 0 ? [each.value.udp] : []
    content {
      protocol = "udp"
      ports    = allow.value
    }
  }
}
