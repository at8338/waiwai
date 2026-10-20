resource "google_compute_instance" "office" {
  project                   = var.project_id
  name                      = var.names.virtual_machine
  zone                      = var.zone
  machine_type              = var.machine_type
  allow_stopping_for_update = true
  deletion_protection       = true
  deletion_policy           = "PREVENT"
  can_ip_forward            = false
  tags                      = [var.firewall_target]
  labels                    = var.labels
  boot_disk {
    source      = google_compute_disk.boot.self_link
    auto_delete = false
  }
  attached_disk {
    source      = google_compute_disk.data.self_link
    device_name = "waiwai-data"
    mode        = "READ_WRITE"
  }
  network_interface {
    subnetwork = var.subnetwork
    network_ip = var.private_ip
    access_config {
      nat_ip       = var.public_ip
      network_tier = "STANDARD"
    }
  }
  shielded_instance_config {
    enable_secure_boot          = true
    enable_vtpm                 = true
    enable_integrity_monitoring = true
  }
  # Keyless ADC for Identity Platform user lookups only; IAM grants the single
  # firebaseauth.users.get permission, never user administration or Editor.
  dynamic "service_account" {
    for_each = var.service_account_email == null ? [] : [var.service_account_email]
    content {
      email  = service_account.value
      scopes = ["https://www.googleapis.com/auth/cloud-platform"]
    }
  }
  metadata = {
    enable-oslogin         = "TRUE"
    enable-oslogin-2fa     = "TRUE"
    block-project-ssh-keys = "TRUE"
    serial-port-enable     = "FALSE"
    user-data              = local.cloud_init
  }
  scheduling {
    provisioning_model  = "STANDARD"
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
  }
  lifecycle {
    prevent_destroy      = true
    replace_triggered_by = [terraform_data.bootstrap_revision]
  }
}
