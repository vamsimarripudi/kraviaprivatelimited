resource "aws_iam_role" "ec2" {
  name = "${var.name}-${var.environment}-ec2"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ec2_ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = data.aws_iam_policy.ssm_core.arn
}

resource "aws_iam_role_policy" "ec2_runtime" {
  name = "${var.name}-${var.environment}-runtime"
  role = aws_iam_role.ec2.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParametersByPath", "ssm:GetParameter"]
        Resource = local.parameter_arn
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = local.kms_key_arn
        Condition = {
          StringEquals = { "kms:ViaService" = "ssm.${var.region}.amazonaws.com" }
        }
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"]
        Resource = local.log_group_arn
      }
    ]
  })
}

resource "aws_iam_instance_profile" "ec2" {
  name = "${var.name}-${var.environment}-ec2"
  role = aws_iam_role.ec2.name
}

resource "aws_iam_role" "importer" {
  name = "${var.name}-${var.environment}-ssm-importer"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { AWS = var.importer_principal_arn }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "importer" {
  name = "${var.name}-${var.environment}-ssm-import"
  role = aws_iam_role.importer.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter", "ssm:GetParametersByPath", "ssm:PutParameter"]
        Resource = local.parameter_arn
      },
      {
        Effect   = "Allow"
        Action   = ["kms:DescribeKey", "kms:Encrypt", "kms:Decrypt"]
        Resource = local.kms_key_arn
      },
      {
        Effect   = "Allow"
        Action   = ["sts:GetCallerIdentity"]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role" "github_deploy" {
  # Keep the instance count plan-time known. The provider ARN is unknown when
  # this stack creates the account-level OIDC provider in the same apply.
  count = (var.create_github_oidc_provider || var.github_oidc_provider_arn != null) ? 1 : 0
  name  = "${var.name}-${var.environment}-github-deploy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = local.github_oidc_arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:environment:aws-production"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_deploy" {
  count = (var.create_github_oidc_provider || var.github_oidc_provider_arn != null) ? 1 : 0
  name  = "${var.name}-${var.environment}-github-ssm"
  role  = aws_iam_role.github_deploy[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ssm:SendCommand"]
        Resource = "arn:aws:ssm:${var.region}::document/AWS-RunShellScript"
      },
      {
        Effect    = "Allow"
        Action    = ["ssm:SendCommand"]
        Resource  = compact([local.instance_arn])
        Condition = { StringEquals = { "aws:ResourceTag/Project" = "kravia" } }
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:GetCommandInvocation", "ssm:ListCommandInvocations"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["ec2:DescribeInstances"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["sts:GetCallerIdentity"]
        Resource = "*"
      }
    ]
  })
}
