# ── OCI API auth (key/ folder — cùng pattern portfolio-site/iac) ─────────────

variable "tenancy_ocid" {
  type        = string
  description = "OCID của tenancy OCI."
}

variable "user_ocid" {
  type        = string
  description = "OCID của user dùng API key."
}

variable "fingerprint" {
  type        = string
  description = "Fingerprint của API public key trên OCI."
}

variable "private_key_path" {
  type        = string
  description = "Đường dẫn file private key PEM (local). Để trống nếu dùng private_key."
  default     = "../key/api_key_name.pem"
}

variable "private_key" {
  type        = string
  description = "Nội dung PEM (CI/secret). Dùng khi private_key_path rỗng."
  default     = ""
  sensitive   = true
}

variable "region" {
  type        = string
  description = "OCI region, e.g. ap-tokyo-1, us-ashburn-1."
  default     = "ap-tokyo-1"
}

# ── Compartment & naming ───────────────────────────────────────────────────────

variable "compartment_ocid" {
  type        = string
  description = "Existing compartment OCID. Leave empty to create a dedicated compartment."
  default     = ""
}

variable "project_name" {
  type        = string
  description = "Prefix for created OCI resources."
  default     = "pad-search"
}

# ── Networking (create new VCN or reuse) ───────────────────────────────────────

variable "use_existing_network" {
  type        = bool
  description = "When true, use existing_subnet_id instead of creating VCN/subnet."
  default     = false
}

variable "existing_subnet_id" {
  type        = string
  description = "Subnet OCID when use_existing_network = true."
  default     = ""

  validation {
    condition     = var.use_existing_network == false || length(var.existing_subnet_id) > 0
    error_message = "Set existing_subnet_id when use_existing_network = true."
  }
}

variable "vcn_cidr" {
  type        = string
  description = "CIDR for the new VCN."
  default     = "10.20.0.0/16"
}

variable "subnet_cidr" {
  type        = string
  description = "Public subnet CIDR inside the VCN."
  default     = "10.20.1.0/24"
}

# ── Compute ──────────────────────────────────────────────────────────────────

variable "instance_shape" {
  type        = string
  description = "OCI shape. Always Free: VM.Standard.E2.1.Micro or VM.Standard.A1.Flex."
  default     = "VM.Standard.A1.Flex"
}

variable "instance_ocpus" {
  type        = number
  description = "OCPUs for Flex shapes (A1/E4)."
  default     = 1
}

variable "instance_memory_in_gbs" {
  type        = number
  description = "Memory (GB) for Flex shapes."
  default     = 6
}

variable "instance_os" {
  type        = string
  description = "Guest OS for the platform image lookup."
  default     = "Oracle Linux"
}

variable "instance_os_version" {
  type        = string
  description = "Guest OS version."
  default     = "9"
}

variable "ssh_allowed_cidrs" {
  type        = list(string)
  description = "CIDRs allowed to SSH (port 22). Restrict to your IP in production."
  default     = ["0.0.0.0/0"]
}

variable "http_allowed_cidrs" {
  type        = list(string)
  description = "CIDRs allowed on ports 80/443 (Cloudflare proxy or 0.0.0.0/0)."
  default     = ["0.0.0.0/0"]
}

# ── App / reverse proxy ───────────────────────────────────────────────────────

variable "app_domain" {
  type        = string
  description = "Public hostname for Caddy (e.g. pad.example.com). Empty = HTTP on :80 only."
  default     = ""
}

variable "origin_hostname" {
  type        = string
  description = "Grey-cloud origin for Cloudflare Worker (e.g. origin-pst.example.com). Auto from app_domain if empty."
  default     = ""
}

variable "remote_app_dir" {
  type        = string
  description = "Directory on the VM for the Docker app (Makefile REMOTE_DIR)."
  default     = "/home/opc/pad-searching-tool"
}
