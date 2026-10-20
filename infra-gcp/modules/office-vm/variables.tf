variable "project_id" { type = string }
variable "region" { type = string }
variable "zone" {
  type = string
  validation {
    condition     = contains(["asia-northeast1-a", "asia-northeast1-b", "asia-northeast1-c"], var.zone)
    error_message = "Use a zone in the Tokyo region."
  }
}
variable "names" { type = object({ virtual_machine = string, boot_disk = string, data_disk = string, snapshot_policy = string }) }
variable "labels" { type = map(string) }
variable "subnetwork" { type = string }
variable "public_ip" { type = string }
variable "private_ip" { type = string }
variable "firewall_target" { type = string }
variable "machine_type" {
  type    = string
  default = "e2-custom-2-4096"
  validation {
    condition     = contains(["e2-custom-2-4096", "e2-custom-4-8192"], var.machine_type)
    error_message = "Choose 2 vCPU / 4 GiB initially, or 4 vCPU / 8 GiB after load-test evidence."
  }
}
variable "boot_image" {
  type    = string
  default = "projects/ubuntu-os-cloud/global/images/family/ubuntu-2404-lts-amd64"
}
variable "domain" {
  type = string
  validation {
    condition     = length(var.domain) <= 253 && can(regex("^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}$", var.domain))
    error_message = "Provide a lowercase public DNS hostname you control, without scheme, path, or wildcards."
  }
}
variable "acme_email" {
  type = string
  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.acme_email))
    error_message = "Provide an operations email address."
  }
}
variable "web_allowed_cidrs" {
  type = list(string)
  validation {
    condition     = length(var.web_allowed_cidrs) > 0 && length(var.web_allowed_cidrs) <= 32 && alltrue([for c in var.web_allowed_cidrs : can(cidrnetmask(c)) && can(regex("/(2[4-9]|3[0-2])$", c))])
    error_message = "Provide 1–32 company/VPN IPv4 /24–/32 CIDRs for all web routes."
  }
}
variable "operator_members" {
  type = set(string)
  validation {
    condition     = length(var.operator_members) > 0 && length(var.operator_members) <= 20 && alltrue([for m in var.operator_members : can(regex("^(user|group):[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", m))])
    error_message = "Specify 1–20 approved human users/groups for OS Admin Login; no public/service-account access."
  }
}
variable "public_slack_events" {
  type    = bool
  default = false
}
