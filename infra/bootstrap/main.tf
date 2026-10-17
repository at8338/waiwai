terraform {
  required_version = ">= 1.10, < 2.0"
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 4.0" }
  }
}
provider "azurerm" {
  subscription_id                 = var.subscription_id
  resource_provider_registrations = "none"
  storage_use_azuread             = true
  features {}
}
variable "subscription_id" { type = string }
variable "location" {
  type    = string
  default = "japaneast"
}
data "azurerm_client_config" "current" {}
locals { suffix = substr(sha256(var.subscription_id), 0, 12) }
resource "azurerm_resource_group" "state" {
  name     = "rg-waiwai-tfstate"
  location = var.location
}
resource "azurerm_storage_account" "state" {
  name                            = "waiwaitf${local.suffix}"
  resource_group_name             = azurerm_resource_group.state.name
  location                        = var.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  shared_access_key_enabled       = false
  default_to_oauth_authentication = true
  allow_nested_items_to_be_public = false
  blob_properties {
    versioning_enabled = true
    delete_retention_policy { days = 30 }
    container_delete_retention_policy { days = 30 }
  }
  lifecycle { prevent_destroy = true }
}
resource "azurerm_role_assignment" "operator" {
  scope                = azurerm_storage_account.state.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = data.azurerm_client_config.current.object_id
}
resource "azurerm_storage_container" "state" {
  name                  = "tfstate"
  storage_account_id    = azurerm_storage_account.state.id
  container_access_type = "private"
  depends_on            = [azurerm_role_assignment.operator]
}
output "backend" {
  value = <<-BACKEND
resource_group_name  = "${azurerm_resource_group.state.name}"
storage_account_name = "${azurerm_storage_account.state.name}"
container_name       = "${azurerm_storage_container.state.name}"
key                  = "waiwai.production.tfstate"
use_azuread_auth     = true
subscription_id      = "${var.subscription_id}"
BACKEND
}
