variable "project_name" {
  type        = string
  default     = "waiwai"
  description = "Lowercase application identifier; resource-specific limits are handled here."
  validation {
    condition     = can(regex("^[a-z][a-z0-9]{2,11}$", var.project_name))
    error_message = "project_name must be 3–12 lowercase alphanumeric characters, starting with a letter."
  }
}
variable "environment" {
  type = string
  validation {
    condition     = contains(["dev", "stg", "prd"], var.environment)
    error_message = "environment must be dev, stg or prd. Only dev has a deployable root in this repository."
  }
}
variable "location" {
  type    = string
  default = "japaneast"
  validation {
    condition     = var.location == "japaneast"
    error_message = "Only japaneast (jpe) is qualified for this VM/network configuration."
  }
}
variable "subscription_id" {
  type = string
  validation {
    condition     = can(regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", var.subscription_id))
    error_message = "subscription_id must be a subscription UUID."
  }
}
variable "instance_number" {
  type    = number
  default = 1
  validation {
    condition     = var.instance_number >= 1 && var.instance_number <= 999 && floor(var.instance_number) == var.instance_number
    error_message = "instance_number must be an integer from 1 to 999."
  }
}
variable "tags" {
  type        = map(string)
  default     = {}
  description = "Company owner/cost_center tags. Reserved identity tags cannot be overridden."
}
