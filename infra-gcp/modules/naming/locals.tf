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
    firewall_prefix = "${local.prefix}-fw-office-${local.sequence}"
    firewall_target = "${local.prefix}-office-${local.sequence}"
    state_bucket    = "${local.prefix}-gcs-tfstate-${local.sequence}-${local.suffix}"
    state_prefix    = "${var.project_name}/gcp/dev/${local.sequence}"
  }
  labels = merge(var.labels, {
    application = var.project_name
    environment = "dev"
    region      = "tky"
    managed_by  = "terraform"
  })
}
