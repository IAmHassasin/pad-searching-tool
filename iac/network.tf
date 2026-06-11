resource "oci_core_vcn" "pad" {
  count = var.use_existing_network ? 0 : 1

  compartment_id = local.compartment_id
  cidr_blocks    = [var.vcn_cidr]
  display_name   = "${local.name_prefix}-vcn"
  dns_label      = substr(replace(local.name_prefix, "-", ""), 0, 15)
}

resource "oci_core_internet_gateway" "pad" {
  count = var.use_existing_network ? 0 : 1

  compartment_id = local.compartment_id
  vcn_id         = oci_core_vcn.pad[0].id
  display_name   = "${local.name_prefix}-igw"
  enabled        = true
}

resource "oci_core_route_table" "public" {
  count = var.use_existing_network ? 0 : 1

  compartment_id = local.compartment_id
  vcn_id         = oci_core_vcn.pad[0].id
  display_name   = "${local.name_prefix}-public-rt"

  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.pad[0].id
  }
}

resource "oci_core_subnet" "public" {
  count = var.use_existing_network ? 0 : 1

  compartment_id             = local.compartment_id
  vcn_id                     = oci_core_vcn.pad[0].id
  cidr_block                 = var.subnet_cidr
  display_name               = "${local.name_prefix}-public"
  dns_label                  = "public"
  prohibit_public_ip_on_vnic = false
  route_table_id             = oci_core_route_table.public[0].id
  security_list_ids          = [oci_core_security_list.pad[0].id]
}
