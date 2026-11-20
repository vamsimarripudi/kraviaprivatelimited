data "aws_kms_key" "existing" {
  count  = var.kms_key_id == null ? 0 : 1
  key_id = var.kms_key_id
}

resource "aws_kms_key" "kravia" {
  count                   = var.create_kms_key ? 1 : 0
  description             = "KRAVIA production SSM and backup encryption key"
  enable_key_rotation     = true
  deletion_window_in_days = var.environment == "prod" ? 30 : 7
}

resource "aws_kms_alias" "kravia" {
  count         = var.create_kms_key ? 1 : 0
  name          = var.kms_key_alias
  target_key_id = aws_kms_key.kravia[0].key_id
}

locals {
  kms_key_arn = var.create_kms_key ? aws_kms_key.kravia[0].arn : data.aws_kms_key.existing[0].arn
}

resource "aws_kms_key_policy" "kravia" {
  count  = var.create_kms_key ? 1 : 0
  key_id = aws_kms_key.kravia[0].key_id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnableAccountAdministration"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "AllowEc2RuntimeViaSsm"
        Effect    = "Allow"
        Principal = { AWS = aws_iam_role.ec2.arn }
        Action    = ["kms:Decrypt", "kms:DescribeKey"]
        Resource  = "*"
        Condition = { StringEquals = { "kms:ViaService" = "ssm.${var.region}.amazonaws.com" } }
      },
      {
        Sid       = "AllowImporter"
        Effect    = "Allow"
        Principal = { AWS = aws_iam_role.importer.arn }
        Action    = ["kms:Encrypt", "kms:Decrypt", "kms:DescribeKey"]
        Resource  = "*"
      }
    ]
  })
}
