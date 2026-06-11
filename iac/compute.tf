resource "tls_private_key" "vm_ssh" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "local_file" "vm_ssh_private_key" {
  content         = tls_private_key.vm_ssh.private_key_pem
  filename        = "${path.module}/../key/vm_ssh.pem"
  file_permission = "0600"
}

resource "oci_core_instance" "pad" {
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  compartment_id      = local.compartment_id
  display_name        = "${local.name_prefix}-vm"
  shape               = var.instance_shape

  dynamic "shape_config" {
    for_each = local.is_flex_shape ? [1] : []
    content {
      ocpus         = var.instance_ocpus
      memory_in_gbs = var.instance_memory_in_gbs
    }
  }

  source_details {
    source_type = "image"
    source_id   = data.oci_core_images.platform.images[0].id
  }

  create_vnic_details {
    subnet_id        = local.subnet_id
    assign_public_ip = true
    display_name     = "${local.name_prefix}-vnic"
    hostname_label   = local.name_prefix
  }

  metadata = {
    ssh_authorized_keys = tls_private_key.vm_ssh.public_key_openssh
    user_data           = base64encode(local.cloud_init)
  }

  agent_config {
    plugins_config {
      desired_state = "ENABLED"
      name          = "Compute Instance Monitoring"
    }
    is_management_disabled = false
    is_monitoring_disabled = false
  }

  lifecycle {
    ignore_changes = [
      metadata["user_data"],
    ]
  }
}
