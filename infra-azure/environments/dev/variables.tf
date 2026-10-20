variable "subscription_id" { type = string }
variable "location" {
  type    = string
  default = "japaneast"
}
variable "project_name" {
  type    = string
  default = "waiwai"
}
variable "instance_number" {
  type    = number
  default = 1
}
variable "vm_size" {
  type    = string
  default = "Standard_B2als_v2"
}
variable "vnet_cidr" {
  type    = string
  default = "10.83.0.0/16"
}
variable "admin_cidr" { type = string }
variable "ssh_public_key" { type = string }
variable "acme_email" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}

variable "web_allowed_cidrs" {
  type        = list(string)
  description = "Allowed company/VPN public IPv4 CIDRs for all Waiwai web routes. No Internet-wide range."
  validation {
    condition     = length(var.web_allowed_cidrs) > 0 && length(var.web_allowed_cidrs) <= 32 && alltrue([for cidr in var.web_allowed_cidrs : can(cidrnetmask(cidr)) && can(regex("/(2[4-9]|3[0-2])$", cidr))])
    error_message = "Provide 1–32 company/VPN IPv4 CIDRs with prefixes /24–/32."
  }
}

variable "public_slack_events" {
  type        = bool
  default     = false
  description = "Expose only POST /api/slack/events for Slack's signed webhook; all office routes retain IP restriction."
}
