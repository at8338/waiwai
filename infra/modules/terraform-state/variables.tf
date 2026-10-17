variable "names" { type = object({ state_resource_group = string, state_storage_account = string, state_container = string }) }
variable "location" { type = string }
variable "tags" { type = map(string) }
variable "operator_object_id" { type = string }
