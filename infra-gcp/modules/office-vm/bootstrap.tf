locals {
  cloud_init = templatefile("${path.module}/templates/cloud-init.yaml.tftpl", {
    domain            = var.domain, acme_email = var.acme_email,
    web_allowed_cidrs = var.web_allowed_cidrs, public_slack_events = var.public_slack_events
  })
}
# GCE user-data is only consumed on first cloud-init. Block silent template drift:
# a changed template requires an explicit VM maintenance/replacement decision.
resource "terraform_data" "bootstrap_revision" { input = sha256(local.cloud_init) }
