data "oci_core_subnet" "existing" {
  count     = var.use_existing_network ? 1 : 0
  subnet_id = var.existing_subnet_id
}

resource "oci_core_security_list" "pad" {
  count = var.use_existing_network ? 0 : 1

  compartment_id = local.compartment_id
  vcn_id         = oci_core_vcn.pad[0].id
  display_name   = "${local.name_prefix}-sl"

  egress_security_rules {
    protocol    = "all"
    destination = "0.0.0.0/0"
  }

  dynamic "ingress_security_rules" {
    for_each = var.ssh_allowed_cidrs
    content {
      protocol = "6"
      source   = ingress_security_rules.value
      tcp_options {
        min = 22
        max = 22
      }
    }
  }

  dynamic "ingress_security_rules" {
    for_each = var.http_allowed_cidrs
    content {
      protocol = "6"
      source   = ingress_security_rules.value
      tcp_options {
        min = 80
        max = 80
      }
    }
  }

  dynamic "ingress_security_rules" {
    for_each = var.http_allowed_cidrs
    content {
      protocol = "6"
      source   = ingress_security_rules.value
      tcp_options {
        min = 443
        max = 443
      }
    }
  }

  ingress_security_rules {
    protocol = "1"
    source   = "0.0.0.0/0"
    icmp_options {
      type = 3
      code = 4
    }
  }
}
