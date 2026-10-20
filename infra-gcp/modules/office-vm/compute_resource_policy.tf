resource "google_compute_resource_policy" "backup" {
  project = var.project_id
  name    = var.names.snapshot_policy
  region  = var.region
  snapshot_schedule_policy {
    schedule {
      daily_schedule {
        days_in_cycle = 1
        start_time    = "17:00"
      }
    }
    retention_policy {
      max_retention_days    = 7
      on_source_disk_delete = "KEEP_AUTO_SNAPSHOTS"
    }
    snapshot_properties {
      storage_locations = [var.region]
      labels            = var.labels
      guest_flush       = false
    }
  }
  lifecycle { prevent_destroy = true }
}
