resource "aws_acm_certificate" "api" {
  count             = var.create_acm_certificate ? 1 : 0
  domain_name       = var.acm_domain_name
  validation_method = "DNS"
  lifecycle { create_before_destroy = true }
  tags = { Name = "${var.name}-${var.environment}-api" }
}

output "requested_acm_certificate_arn" {
  value = try(aws_acm_certificate.api[0].arn, null)
}

output "acm_dns_validation_options" {
  value = try(aws_acm_certificate.api[0].domain_validation_options, [])
}
