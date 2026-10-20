# Deliberate hard stop: this former production root has been retired.
# Use infra-azure/environments/dev for NEW dev resources. Never migrate production state into dev.
terraform { required_version = "< 0.0.0" }
