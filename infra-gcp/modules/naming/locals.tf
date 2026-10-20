locals {
  prefix   = "dev-${var.project_name}-tky"
  sequence = format("%03d", var.instance_number)
  suffix   = substr(sha256("${var.project_id}:${local.prefix}:${local.sequence}"), 0, 8)
  names = {
    network         = "${local.prefix}-vpc-office-${local.sequence}"
    subnet          = "${local.prefix}-snet-office-${local.sequence}"
    public_ip       = "${local.prefix}-ip-office-${local.sequence}"
    virtual_machine = "${local.prefix}-vm-office-${local.sequence}"
    boot_disk       = "${local.prefix}-disk-os-${local.sequence}"
    data_disk       = "${local.prefix}-disk-data-${local.sequence}"
    snapshot_policy = "${local.prefix}-snap-office-${local.sequence}"
    firewall_rules = {
      for rule in ["ssh", "web", "turn_tcp", "turn_udp"] :
      rule => "${local.prefix}-fw-office-${replace(rule, "_", "-")}-${local.sequence}"
    }
    firewall_target          = "${local.prefix}-office-${local.sequence}"
    dns_zone                 = "${local.prefix}-dns-office-${local.sequence}"
    identity_service_account = "${local.prefix}-sa-id-${local.sequence}"
    identity_reader_role     = replace("${local.prefix}-role-id-${local.sequence}", "-", "_")
    state_bucket             = "${local.prefix}-gcs-tfstate-${local.sequence}-${local.suffix}"
    state_prefix             = "${var.project_name}/gcp/dev/${local.sequence}"
  }
  labels = merge(var.labels, {
    application = var.project_name
    environment = "dev"
    region      = "tky"
    managed_by  = "terraform"
  })
}
