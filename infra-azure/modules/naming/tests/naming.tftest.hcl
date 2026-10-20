variables {
  environment     = "dev"
  subscription_id = "00000000-0000-0000-0000-000000000000"
  tags            = { environment = "prd", managed_by = "manual", cost_center = "example" }
}
run "dev_names_and_reserved_tags" {
  command = plan
  assert {
    condition     = output.names.virtual_machine == "dev-waiwai-jpe-vm-office-001" && output.names.state_key == "waiwai.dev.tfstate"
    error_message = "Names must follow environment/project/region/type/purpose/sequence; state must remain dev-only."
  }
  assert {
    condition     = output.tags.environment == "dev" && output.tags.managed_by == "terraform" && output.tags.cost_center == "example"
    error_message = "Company tags should be retained without overriding reserved identity tags."
  }
  assert {
    condition     = can(regex("^[a-z0-9]{3,24}$", output.names.state_storage_account)) && length(output.names.dns_label) <= 63
    error_message = "Storage and DNS names must meet Azure character and length constraints."
  }
}
run "long_project_name" {
  command = plan
  variables { project_name = "abcdefghijkl" }
  assert {
    condition     = length(output.names.state_storage_account) == 24
    error_message = "The longest project name must still produce a 24-character storage name."
  }
}
run "same_truncated_prefix_different_project" {
  command = plan
  variables { project_name = "abcdefmnopqr" }
  assert {
    condition     = output.names.state_storage_account != run.long_project_name.names.state_storage_account
    error_message = "Shortening project names must not lose the full identity in the uniqueness hash."
  }
}
run "different_subscription" {
  command = plan
  variables { subscription_id = "11111111-1111-1111-1111-111111111111" }
  assert {
    condition     = output.names.dns_label != run.dev_names_and_reserved_tags.names.dns_label && output.names.state_storage_account != run.dev_names_and_reserved_tags.names.state_storage_account
    error_message = "Globally scoped names must differ across subscriptions."
  }
}
run "reject_unqualified_region" {
  command = plan
  variables { location = "japanwest" }
  expect_failures = [var.location]
}
run "reject_invalid_sequence" {
  command = plan
  variables { instance_number = 1.5 }
  expect_failures = [var.instance_number]
}
run "reject_invalid_project" {
  command = plan
  variables { project_name = "Waiwai_Bad" }
  expect_failures = [var.project_name]
}
