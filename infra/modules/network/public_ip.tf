resource "azurerm_public_ip" "office" {
  name                    = var.names.public_ip
  location                = var.location
  resource_group_name     = var.resource_group_name
  allocation_method       = "Static"
  sku                     = "Standard"
  zones                   = ["1", "2", "3"]
  domain_name_label       = var.names.dns_label
  domain_name_label_scope = "SubscriptionReuse"
  ip_tags                 = { RoutingPreference = "Internet" }
  tags                    = var.tags
}
