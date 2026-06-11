locals {
  name_prefix = replace(var.project_name, "_", "-")

  compartment_id = var.compartment_ocid != "" ? var.compartment_ocid : oci_identity_compartment.pad[0].id

  subnet_id = var.use_existing_network ? var.existing_subnet_id : oci_core_subnet.public[0].id

  is_flex_shape = can(regex("Flex$", var.instance_shape))

  origin_hostname = var.origin_hostname != "" ? var.origin_hostname : (
    var.app_domain != "" ? "origin-${split(".", var.app_domain)[0]}.${join(".", slice(split(".", var.app_domain), 1, length(split(".", var.app_domain))))}" : ""
  )

  caddy_site_block = indent(6, trimspace(
    var.app_domain != "" ? join("\n\n", compact([
      "http://${var.app_domain} {\n    reverse_proxy 127.0.0.1:3000\n}",
      local.origin_hostname != "" ? "http://${local.origin_hostname} {\n    reverse_proxy 127.0.0.1:3000\n}" : "",
      ":80 {\n    reverse_proxy 127.0.0.1:3000\n}",
    ])) : ":80 {\n    reverse_proxy 127.0.0.1:3000\n}"
  ))

  cloud_init = templatefile("${path.module}/templates/cloud-init.yaml.tftpl", {
    caddy_site_block = local.caddy_site_block
    remote_app_dir   = var.remote_app_dir
  })
}
