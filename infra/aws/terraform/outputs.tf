output "region" {
  value = var.region
}

output "vpc_id" {
  value = local.vpc_id
}

output "alb_dns_name" {
  value = aws_lb.api.dns_name
}

output "instance_id" {
  value = local.instance_id
}

output "kms_key_arn" {
  value = local.kms_key_arn
}

output "ec2_role_name" {
  value = aws_iam_role.ec2.name
}

output "ssm_importer_role_name" {
  value = aws_iam_role.importer.name
}

output "github_deploy_role_name" {
  value = try(aws_iam_role.github_deploy[0].name, null)
}

output "parameter_root" {
  value = "/kravia/${var.environment}"
}
