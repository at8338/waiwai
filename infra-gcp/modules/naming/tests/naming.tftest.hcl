variables { project_id = "waiwai-dev-example" }
run "dev_names_and_reserved_labels" {
  command = apply
  variables { labels = { environment = "prod", managed_by = "manual", owner = "team" } }
  assert {
    condition     = output.names.virtual_machine == "dev-waiwai-tky-vm-office-001" && output.names.state_prefix == "waiwai/gcp/dev/001" && length(output.names.state_bucket) <= 63
    error_message = "Keep dev-only names, distinct cloud state and GCS-compatible bucket names."
  }
  assert {
    condition     = output.labels.environment == "dev" && output.labels.managed_by == "terraform" && output.labels.owner == "team"
    error_message = "Company labels may extend but never override reserved labels."
  }
}
run "project_disambiguation" {
  command = apply
  variables { project_id = "another-gcp-project" }
  assert {
    condition     = output.names.state_bucket != run.dev_names_and_reserved_labels.names.state_bucket
    error_message = "State bucket names must include the full GCP project identity."
  }
}
run "reject_other_region" {
  command = plan
  variables { region = "us-central1" }
  expect_failures = [var.region]
}
run "reject_invalid_sequence" {
  command = plan
  variables { instance_number = 1.5 }
  expect_failures = [var.instance_number]
}
