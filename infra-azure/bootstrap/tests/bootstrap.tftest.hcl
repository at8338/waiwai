mock_provider "azurerm" { source = "../tests/mocks" }
variables { subscription_id = "00000000-0000-0000-0000-000000000000" }
run "dev_backend_without_keys" {
  command = apply
  assert {
    condition     = output.environment == "dev" && strcontains(output.backend, "waiwai.dev.tfstate") && strcontains(output.backend, "use_azuread_auth     = true") && !strcontains(output.backend, "access_key")
    error_message = "Bootstrap must generate a dev-only Entra backend without shared keys."
  }
}
