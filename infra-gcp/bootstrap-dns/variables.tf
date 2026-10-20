variable "project_id" { type = string }
variable "project_name" {
  type    = string
  default = "waiwai"
}
variable "region" {
  type    = string
  default = "asia-northeast1"
}
variable "instance_number" {
  type    = number
  default = 1
}
variable "domain" {
  type = string
  validation {
    condition     = length(var.domain) <= 253 && can(regex("^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}$", var.domain))
    error_message = "Provide the lowercase public domain to register, without scheme, path or trailing dot."
  }
}
variable "labels" {
  type    = map(string)
  default = {}
}
