variable "names" { type = object({ virtual_machine = string, os_disk = string, data_disk = string, backup_vault = string, backup_policy = string }) }
variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "tags" { type = map(string) }
variable "network_interface_id" { type = string }
variable "domain" {
  type = string
  validation {
    condition     = can(regex("^[a-z0-9.-]+\\.cloudapp\\.azure\\.com$", var.domain))
    error_message = "domain must be an Azure public-IP DNS name."
  }
}
variable "vm_size" {
  type        = string
  default     = "Standard_B2als_v2"
  description = "Initial 2 vCPU / 4 GiB; B4als_v2 (4 vCPU / 8 GiB) only after Azure load-test evidence."
  validation {
    condition     = contains(["Standard_B2als_v2", "Standard_B4als_v2"], var.vm_size)
    error_message = "Choose the initial B2als_v2 or the agreed doubled B4als_v2 size."
  }
}
variable "ssh_public_key" {
  type = string
  validation {
    condition     = can(regex("^(ssh-ed25519|ssh-rsa) [A-Za-z0-9+/=]+( [^\\r\\n]+)?$", var.ssh_public_key))
    error_message = "Provide a one-line OpenSSH public key; never a private key."
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
