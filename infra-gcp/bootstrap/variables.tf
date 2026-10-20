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
variable "labels" {
  type    = map(string)
  default = {}
}
variable "state_members" { type = set(string) }
