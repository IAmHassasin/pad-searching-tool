output "compartment_id" {
  description = "Compartment OCID hosting PAD resources."
  value       = local.compartment_id
}

output "instance_id" {
  description = "Compute instance OCID."
  value       = oci_core_instance.pad.id
}

output "public_ip" {
  description = "Public IPv4 — use for Cloudflare A record and make deploy ORACLE_HOST."
  value       = oci_core_instance.pad.public_ip
}

output "private_ip" {
  description = "Private IPv4 inside the VCN."
  value       = oci_core_instance.pad.private_ip
}

output "ssh_user" {
  description = "SSH login user (Oracle Linux image)."
  value       = "opc"
}

output "ssh_private_key_path" {
  description = "Terraform-generated SSH private key for the VM (not the OCI API key)."
  value       = local_file.vm_ssh_private_key.filename
}

output "ssh_command" {
  description = "Example SSH command after terraform apply."
  value       = "ssh -i ${local_file.vm_ssh_private_key.filename} opc@${oci_core_instance.pad.public_ip}"
}

output "app_domain" {
  description = "Public hostname for Caddy reverse proxy."
  value       = var.app_domain
}

output "app_url_http" {
  description = "Direct HTTP URL (before or without Cloudflare)."
  value       = var.app_domain != "" ? "https://${var.app_domain}" : "http://${oci_core_instance.pad.public_ip}"
}

output "deploy_command" {
  description = "Example make deploy after filling secrets."
  value       = "cd iac && make -f deploy.mk deploy ORACLE_HOST=${oci_core_instance.pad.public_ip} SSH_KEY=${local_file.vm_ssh_private_key.filename}"
}

output "origin_hostname" {
  description = "Grey-cloud hostname for Worker → VM (DNS only, not proxied)."
  value       = local.origin_hostname
}

output "cloudflare_dns" {
  description = "DNS records + Worker deploy path for pst gateway."
  value = {
    public_record = {
      type    = "A"
      name    = var.app_domain != "" ? split(".", var.app_domain)[0] : "pad"
      content = oci_core_instance.pad.public_ip
      proxied = true
    }
    origin_record = local.origin_hostname != "" ? {
      type    = "A"
      name    = split(".", local.origin_hostname)[0]
      content = oci_core_instance.pad.public_ip
      proxied = false
    } : null
    worker = "cd cloudflare/pst-gateway && npm install && npm run deploy"
    origin_pad_url = local.origin_hostname != "" ? "http://${local.origin_hostname}" : "http://${oci_core_instance.pad.public_ip}"
  }
}

output "cloudflare_dns_hint" {
  description = "Deprecated: use cloudflare_dns output."
  value       = "See: terraform output cloudflare_dns"
}
