locals {
  subnet_cidr = cidrsubnet(var.vnet_cidr, 8, 1)
  private_ip  = cidrhost(local.subnet_cidr, 4)
  ingress_rules = {
    ssh_admin    = { name = "allow-ssh-admin", priority = 100, protocol = "Tcp", ports = ["22"], source = var.admin_cidr }
    web_turn_tcp = { name = "allow-web-turn-tcp", priority = 110, protocol = "Tcp", ports = ["80", "443", "3478", "5349"], source = "Internet" }
    turn_udp     = { name = "allow-turn-udp", priority = 120, protocol = "Udp", ports = ["3478", "49160-49959"], source = "Internet" }
  }
}
