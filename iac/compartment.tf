resource "oci_identity_compartment" "pad" {
  count = var.compartment_ocid == "" ? 1 : 0

  compartment_id = var.tenancy_ocid
  name           = local.name_prefix
  description    = "PAD Searching Tool — Terraform managed"
  enable_delete  = true
}
