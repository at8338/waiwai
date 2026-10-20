variable "project_id" { type = string }
variable "project_name" {
  type    = string
  default = "waiwai"
}
variable "region" {
  type    = string
  default = "asia-northeast1"
}
variable "zone" {
  type    = string
  default = "asia-northeast1-a"
}
variable "instance_number" {
  type    = number
  default = 1
}
variable "machine_type" {
  type    = string
  default = "e2-custom-2-4096"
}
variable "subnet_cidr" {
  type    = string
  default = "10.84.1.0/24"
}
variable "domain" { type = string }
variable "admin_cidrs" { type = set(string) }
variable "operator_members" { type = set(string) }
variable "web_allowed_cidrs" { type = list(string) }
variable "acme_email" { type = string }
variable "public_slack_events" {
  type    = bool
  default = false
}
variable "labels" {
  type    = map(string)
  default = {}
}
