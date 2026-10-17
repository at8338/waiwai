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
