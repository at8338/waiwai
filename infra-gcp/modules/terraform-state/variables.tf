variable "project_id" { type = string }
variable "region" { type = string }
variable "bucket_name" { type = string }
variable "state_prefix" { type = string }
variable "labels" { type = map(string) }
variable "state_members" {
  type = set(string)
  validation {
    condition     = length(var.state_members) > 0 && length(var.state_members) <= 20 && alltrue([for m in var.state_members : can(regex("^(user|group|serviceAccount):[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", m))])
    error_message = "Specify 1–20 approved user/group/serviceAccount principals; public access is forbidden."
  }
}
