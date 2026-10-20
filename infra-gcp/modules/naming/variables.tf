variable "project_id" {
  type = string
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "Provide the existing Google Cloud project ID (6–30 lowercase characters)."
  }
}
variable "project_name" {
  type    = string
  default = "waiwai"
  validation {
    condition     = can(regex("^[a-z][a-z0-9]{2,11}$", var.project_name))
    error_message = "project_name must contain 3–12 lowercase letters/digits, starting with a letter."
  }
}
variable "region" {
  type    = string
  default = "asia-northeast1"
  validation {
    condition     = var.region == "asia-northeast1"
    error_message = "This dev design targets Tokyo (asia-northeast1)."
  }
}
variable "instance_number" {
  type    = number
  default = 1
  validation {
    condition     = floor(var.instance_number) == var.instance_number && var.instance_number >= 1 && var.instance_number <= 999
    error_message = "instance_number must be an integer from 1 to 999."
  }
}
variable "labels" {
  type    = map(string)
  default = {}
  validation {
    condition     = length(var.labels) <= 30 && alltrue([for k, v in var.labels : can(regex("^[a-z][a-z0-9_-]{0,62}$", k)) && can(regex("^[a-z0-9_-]{0,63}$", v))])
    error_message = "Use at most 30 additional labels with lowercase GCP-compatible keys and values."
  }
}
