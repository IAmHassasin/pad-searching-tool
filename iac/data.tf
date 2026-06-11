data "oci_identity_availability_domains" "ads" {
  compartment_id = local.compartment_id
}

data "oci_core_images" "platform" {
  compartment_id           = local.compartment_id
  operating_system         = var.instance_os
  operating_system_version = var.instance_os_version
  shape                    = var.instance_shape
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}
