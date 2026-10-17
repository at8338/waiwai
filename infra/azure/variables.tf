variable "subscription_id" {
  type        = string
  description = "Company subscription selected with az account set."
}
variable "location" {
  type    = string
  default = "japaneast"
}
variable "name" {
  type    = string
  default = "waiwai"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,20}$", var.name))
    error_message = "Use 3–21 lowercase letters, numbers, or hyphens."
  }
}
variable "vm_size" {
  type        = string
  default     = "Standard_B2als_v2"
  description = "2 vCPU / 4 GiB burstable pilot. Validate CPU credits under sustained load before rollout."
}
variable "ssh_public_key" {
  type        = string
  description = "Public SSH key only. Private key never enters Terraform."
}
variable "admin_cidr" {
  type        = string
  description = "Company VPN / current operator public IPv4 CIDR for SSH (normally /32)."
  validation {
    condition     = can(cidrnetmask(var.admin_cidr)) && can(regex("/([89]|[12][0-9]|3[0-2])$", var.admin_cidr))
    error_message = "Supply an IPv4 CIDR with prefix /8–/32; SSH cannot be open to the entire Internet."
  }
}
variable "acme_email" {
  type        = string
  description = "Operations email for HTTPS certificate expiry notices."
  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.acme_email))
    error_message = "Provide an operations email address."
  }
}
