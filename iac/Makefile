# PAD Searching Tool — Oracle Cloud (Terraform)
# Run from repo:  cd iac && make apply
# Works on Windows CMD / Git Bash / WSL (no bash required)

TF_VARS ?= terraform.tfvars

.PHONY: help init plan apply destroy output check-tfvars

help:
	@echo "Terraform (Oracle VM + network + cloud-init)"
	@echo ""
	@echo "  make init     — terraform init"
	@echo "  make plan     — terraform plan"
	@echo "  make apply    — terraform apply"
	@echo "  make destroy  — terraform destroy"
	@echo "  make output   — show public_ip, deploy_command, cloudflare_dns_hint"
	@echo ""
	@echo "App deploy (after apply):  make -f deploy.mk deploy"
	@echo "Full bootstrap:            make -f deploy.mk deploy-all"

check-tfvars:
ifeq ($(wildcard $(TF_VARS)),)
	$(error ERROR: copy terraform.tfvars.example → $(TF_VARS))
endif

init:
	terraform init

plan: init check-tfvars
	terraform plan -var-file=$(TF_VARS)

apply: init check-tfvars
	terraform apply -var-file=$(TF_VARS)

destroy: init check-tfvars
	terraform destroy -var-file=$(TF_VARS)

output:
	terraform output
