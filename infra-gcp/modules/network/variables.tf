variable "project_id" { type = string }
variable "region" { type = string }
variable "names" {
  type = object({
    network         = string
    subnet          = string
    public_ip       = string
    firewall_target = string
    firewall_rules  = object({ ssh = string, web = string, turn_tcp = string, turn_udp = string })
  })
}
variable "subnet_cidr" {
  type    = string
  default = "10.84.1.0/24"
  validation {
    condition     = can(cidrnetmask(var.subnet_cidr)) && can(regex("/24$", var.subnet_cidr)) && try(var.subnet_cidr == cidrsubnet(var.subnet_cidr, 0, 0), false)
    error_message = "Use an aligned IPv4 /24 subnet that does not overlap company networks."
  }
}
variable "admin_cidrs" {
  type = set(string)
  validation {
    condition     = length(var.admin_cidrs) > 0 && length(var.admin_cidrs) <= 32 && alltrue([for c in var.admin_cidrs : can(cidrnetmask(c)) && can(regex("/(2[4-9]|3[0-2])$", c))])
    error_message = "Provide 1–32 operator/VPN IPv4 /24–/32 CIDRs; do not expose SSH to the Internet."
  }
}
