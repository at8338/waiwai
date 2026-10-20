mock_provider "google" { source = "../../tests/mocks" }
variables {
  project_id  = "waiwai-dev-example"
  region      = "asia-northeast1"
  names       = { network = "dev-waiwai-tky-vpc-office-001", subnet = "dev-waiwai-tky-snet-office-001", public_ip = "dev-waiwai-tky-ip-office-001", firewall_prefix = "dev-waiwai-tky-fw-office-001", firewall_target = "dev-waiwai-tky-office-001" }
  admin_cidrs = ["203.0.113.20/32"]
}
run "custom_network_and_restricted_ports" {
  command = apply
  assert {
    condition     = !google_compute_network.office.auto_create_subnetworks && output.private_ip == "10.84.1.10" && google_compute_address.office.network_tier == "STANDARD"
    error_message = "Use a dedicated custom VPC, deterministic private IP and fixed Standard-tier public IP."
  }
  assert {
    condition     = length(google_compute_firewall.ingress) == 4 && toset(google_compute_firewall.ingress["ssh"].source_ranges) == toset(["203.0.113.20/32"]) && toset(one(google_compute_firewall.ingress["ssh"].allow).ports) == toset(["22"])
    error_message = "Only explicitly allowed company/operator IPs may reach SSH."
  }
  assert {
    condition     = toset(one(google_compute_firewall.ingress["web"].allow).ports) == toset(["80", "443"]) && toset(one(google_compute_firewall.ingress["turn_tcp"].allow).ports) == toset(["3478", "5349"]) && toset(one(google_compute_firewall.ingress["turn_udp"].allow).ports) == toset(["3478", "49160-49959"])
    error_message = "Only web and TURN ports may be exposed; never the Node.js port 5173."
  }
}
run "reject_public_ssh" {
  command = plan
  variables { admin_cidrs = ["0.0.0.0/0"] }
  expect_failures = [var.admin_cidrs]
}
run "reject_non_ipv4_subnet" {
  command = plan
  variables { subnet_cidr = "2001:db8::/24" }
  expect_failures = [var.subnet_cidr]
}
