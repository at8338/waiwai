variable "names" {
  type = object({ virtual_network = string, subnet = string, network_security_group = string, network_interface = string, public_ip = string, dns_label = string })
}
variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "tags" { type = map(string) }
variable "vnet_cidr" {
  type        = string
  description = "Dedicated IPv4 /16. Office subnet is subnet 1 (/24); VM uses host 4."
  validation {
    condition     = can(cidrnetmask(var.vnet_cidr)) && can(regex("/16$", var.vnet_cidr)) && try(var.vnet_cidr == "${cidrhost(var.vnet_cidr, 0)}/16", false)
    error_message = "vnet_cidr must be a canonical IPv4 /16 network, e.g. 10.83.0.0/16."
  }
}
variable "admin_cidr" {
  type        = string
  description = "Company VPN or operator public IPv4 /24–/32, never the entire Internet."
  validation {
    condition     = can(cidrnetmask(var.admin_cidr)) && can(regex("/(2[4-9]|3[0-2])$", var.admin_cidr))
    error_message = "SSH requires an IPv4 CIDR with prefix /24–/32."
  }
}
