# PAD Searching Tool — Oracle Cloud (Terraform)

Terraform trong folder này provision toàn bộ hạ tầng Oracle Cloud cho PAD app:

- Compartment (tùy chọn)
- VCN, public subnet, Internet Gateway, route table
- Security List: SSH `22`, HTTP `80`, HTTPS `443`
- Compute VM (Oracle Linux 9) + public IP
- Cloud-init: Docker, Caddy reverse proxy, firewalld
- SSH key riêng cho VM (`key/vm_ssh.pem`) — **khác** với OCI API key

Sau `terraform apply`, chạy `make -f deploy.mk deploy` từ **`iac/`** để sync Docker app lên VM.

## Prerequisites

| Tool | Version |
|------|---------|
| [Terraform](https://developer.hashicorp.com/terraform/install) | >= 1.5 |
| OCI API key | `key/api_key_name.pem` (cùng pattern `portfolio-site/iac`) |
| Cloudflare | Domain + A record (manual, xem output `cloudflare_dns_hint`) |

### Lấy OCIDs & fingerprint

1. **Tenancy OCID** — Console → avatar → Tenancy → Copy OCID
2. **User OCID** — Profile → User information
3. **API key fingerprint** — Profile → API keys → fingerprint của key khớp `api_key_name.pem`

Nếu chưa có API key trên Console, upload public key:

```bash
openssl rsa -pubout -in ../key/api_key_name.pem -out /tmp/oci_api_pub.pem
# Console → Identity → Users → your user → API keys → Add public key → paste /tmp/oci_api_pub.pem
```

> `key/api_key_name.pem` là **OCI API key** (giống portfolio-site). `key/vm_ssh.pem` được Terraform tạo để SSH vào VM.

## Quick start

```bash
cd iac
cp terraform.tfvars.example terraform.tfvars
# Điền tenancy_ocid, user_ocid, fingerprint, private_key_path, app_domain

make init
make plan
make apply
```

Ghi lại output:

```bash
make output
```

## Deploy app lên VM

Từ **`iac/`** (sau khi `../.env` đã có secrets):

```bash
cd iac
make -f deploy.mk deploy-all
```

Hoặc từng bước:

```bash
cd iac
make apply
make -f deploy.mk deploy
```

## Cloudflare (Worker gateway + DNS)

Sau `terraform apply`:

```bash
terraform output cloudflare_dns
```

Tạo **2** DNS records (cùng VM IP):

| Name | Proxy | Mục đích |
|------|-------|----------|
| `pst` | **Proxied** (orange) | User → `https://pst.hassasin.com` |
| `origin-pst` | **DNS only** (grey) | Worker fetch → VM (tránh error 1003) |

Deploy Worker (path router — thêm service sau trong `src/routes.js`):

```bash
cd cloudflare/pst-gateway
npm install && npm run deploy
```

Chi tiết: **`cloudflare/pst-gateway/README.md`**

SSL/TLS: **Flexible** hoặc **Full**. Cache rule: **Bypass** `/monsters/*`, `/admin/*`, `/patterns/*`, `/health`.

## Variables quan trọng

| Variable | Mô tả |
|----------|--------|
| `app_domain` | Hostname Caddy (e.g. `pad.example.com`). Rỗng = listen `:80` |
| `instance_shape` | `VM.Standard.A1.Flex` (ARM, khuyến nghị) hoặc `VM.Standard.E2.1.Micro` |
| `use_existing_network` | `true` + `existing_subnet_id` để dùng VCN có sẵn |
| `ssh_allowed_cidrs` | Giới hạn SSH theo IP của bạn |

## Makefiles (`iac/`)

| File | Targets |
|------|---------|
| `Makefile` | `init`, `plan`, `apply`, `destroy`, `output` |
| `deploy.mk` | `deploy`, `deploy-all`, `update`, `restart`, `logs`, `status`, `ssh` |

```bash
cd iac
make apply
make -f deploy.mk deploy
make -f deploy.mk deploy-all   # apply + deploy
```

## Files

```
iac/
  versions.tf          # Providers + OCI auth (fingerprint + private_key_path)
  variables.tf
  locals.tf
  compartment.tf
  data.tf
  network.tf
  security.tf
  compute.tf
  outputs.tf
  templates/cloud-init.yaml.tftpl
  terraform.tfvars.example
  Makefile              # Terraform
  deploy.mk             # Sync app to VM
```

## Destroy

```bash
cd iac
make destroy
```

Volume Docker trên VM (`dadguide_working_sqlite`) sẽ mất khi destroy instance — backup trước nếu cần.
