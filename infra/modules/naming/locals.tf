locals {
  region_code = "jpe"
  prefix      = "${var.environment}-${var.project_name}-${local.region_code}"
  sequence    = format("%03d", var.instance_number)
  # Deterministic uniqueness includes every shortened naming dimension.
  unique_suffix = substr(sha256("${lower(var.subscription_id)}:${local.prefix}:${local.sequence}"), 0, 8)
  names = {
    resource_group         = "${local.prefix}-rg-office-${local.sequence}"
    virtual_network        = "${local.prefix}-vnet-office-${local.sequence}"
    subnet                 = "${local.prefix}-snet-office-${local.sequence}"
    network_security_group = "${local.prefix}-nsg-office-${local.sequence}"
    network_interface      = "${local.prefix}-nic-office-${local.sequence}"
    public_ip              = "${local.prefix}-pip-office-${local.sequence}"
    virtual_machine        = "${local.prefix}-vm-office-${local.sequence}"
    os_disk                = "${local.prefix}-osdisk-office-${local.sequence}"
    dns_label              = "${local.prefix}-office-${local.sequence}-${local.unique_suffix}"
    state_resource_group   = "${local.prefix}-rg-tfstate-${local.sequence}"
    # Storage: 3–24 lowercase letters/digits, globally unique; no hyphens.
    state_storage_account = "${var.environment}${substr(var.project_name, 0, 6)}${local.region_code}sttf${local.unique_suffix}"
    state_container       = "tfstate"
    state_key             = "${var.project_name}.${var.environment}.tfstate"
  }
  tags = merge(var.tags, {
    application = var.project_name
    environment = var.environment
    region      = local.region_code
    managed_by  = "terraform"
  })
}
