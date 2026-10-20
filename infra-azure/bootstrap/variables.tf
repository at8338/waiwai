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
variable "tags" {
  type    = map(string)
  default = {}
}
