variable "region" {
  description = "AWS region for the Hyderabad deployment. Mumbai is intentionally not supported by this stack."
  type        = string
  default     = "ap-south-2"

  validation {
    condition     = var.region == "ap-south-2"
    error_message = "KRAVIA AWS migration is restricted to ap-south-2 (Hyderabad)."
  }
}

variable "environment" {
  type    = string
  default = "prod"
  validation {
    condition     = contains(["staging", "prod"], var.environment)
    error_message = "environment must be staging or prod."
  }
}

variable "name" {
  type    = string
  default = "kravia"
}

variable "tags" {
  type    = map(string)
  default = {}
}

variable "network_mode" {
  description = "managed creates a VPC; existing reuses operator-supplied VPC and subnet IDs."
  type        = string
  default     = "managed"
  validation {
    condition     = contains(["managed", "existing"], var.network_mode)
    error_message = "network_mode must be managed or existing."
  }
}

variable "vpc_cidr" {
  type    = string
  default = "10.72.0.0/16"
}

variable "availability_zones" {
  type    = list(string)
  default = ["ap-south-2a", "ap-south-2b"]
  validation {
    condition     = length(var.availability_zones) == 2 && alltrue([for az in var.availability_zones : startswith(az, "ap-south-2")])
    error_message = "Provide exactly two ap-south-2 availability zones."
  }
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.72.0.0/24", "10.72.1.0/24"]
}

variable "private_subnet_cidrs" {
  type    = list(string)
  default = ["10.72.10.0/24", "10.72.11.0/24"]
}

variable "existing_vpc_id" {
  type    = string
  default = null
}

variable "existing_public_subnet_ids" {
  type    = list(string)
  default = []
}

variable "existing_private_subnet_ids" {
  type    = list(string)
  default = []
}

variable "enable_nat_gateway" {
  description = "Required for private-subnet egress to Supabase/Brevo and image updates; incurs AWS cost."
  type        = bool
  default     = true
}

variable "existing_instance_id" {
  description = "Existing EC2 instance to reuse. Leave null only when create_ec2=true."
  type        = string
  default     = null
}

variable "manage_existing_instance" {
  description = "Explicitly attach the managed IAM profile and ALB-only security group to the discovered instance. Keep false until the maintenance plan is approved."
  type        = bool
  default     = false
}

variable "create_ec2" {
  description = "Create an EC2 instance when an approved existing instance is not supplied."
  type        = bool
  default     = false
}

variable "ami_id" {
  description = "Pinned Amazon Linux 2023 AMI ID for a new instance; never use latest dynamically in production."
  type        = string
  default     = null
}

variable "instance_type" {
  type    = string
  default = "t3.medium"
}

variable "key_name" {
  description = "Optional EC2 key pair name. SSH ingress remains disabled; SSM is the access path."
  type        = string
  default     = null
}

variable "kms_key_id" {
  description = "Existing customer-managed symmetric KMS key; it is referenced, never replaced."
  type        = string
  default     = "0d7820e2-bd32-48e4-8246-f0082aeebc04"
}

variable "github_oidc_provider_arn" {
  description = "Existing GitHub Actions OIDC provider ARN."
  type        = string
  default     = null
}

variable "importer_principal_arn" {
  description = "Specific pre-existing operator role/user ARN allowed to assume the SSM importer role. Account-root trust is not permitted."
  type        = string
  default     = null
}

variable "github_repository" {
  type    = string
  default = "vamsimarripudi/kraviaprivatelimited"
}

variable "certificate_arn" {
  description = "Existing ACM certificate ARN for the HTTPS ALB listener."
  type        = string
  default     = null
}

variable "budget_email" {
  description = "Optional recipient for the monthly AWS budget alert."
  type        = string
  default     = null
}

variable "monthly_budget_usd" {
  type    = number
  default = 250
}
