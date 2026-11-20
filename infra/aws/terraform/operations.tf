resource "aws_cloudwatch_log_group" "ec2" {
  name              = "/kravia/${var.environment}/ec2"
  retention_in_days = var.environment == "prod" ? 90 : 14
}

resource "aws_cloudwatch_metric_alarm" "instance_status" {
  alarm_name          = "${var.name}-${var.environment}-ec2-status"
  alarm_description   = "EC2 status checks failing; retain Railway fallback until resolved."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "StatusCheckFailed"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  treat_missing_data  = "breaching"
  dimensions          = { InstanceId = local.instance_id }
}

resource "aws_cloudwatch_metric_alarm" "alb_unhealthy" {
  alarm_name          = "${var.name}-${var.environment}-alb-unhealthy"
  alarm_description   = "KRAVIA API target is unhealthy behind the ALB."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  treat_missing_data  = "breaching"
  dimensions = {
    LoadBalancer = aws_lb.api.arn_suffix
    TargetGroup  = aws_lb_target_group.api.arn_suffix
  }
}

resource "aws_backup_vault" "kravia" {
  name        = "${var.name}-${var.environment}-backup"
  kms_key_arn = local.kms_key_arn
}

resource "aws_backup_plan" "kravia" {
  name = "${var.name}-${var.environment}-daily"
  rule {
    rule_name         = "daily"
    target_vault_name = aws_backup_vault.kravia.name
    schedule          = "cron(0 18 * * ? *)"
    start_window      = 60
    completion_window = 180
    lifecycle {
      delete_after = var.environment == "prod" ? 35 : 7
    }
  }
}

resource "aws_iam_role" "backup" {
  name = "${var.name}-${var.environment}-backup"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "backup.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "backup" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}

resource "aws_backup_selection" "kravia" {
  iam_role_arn = aws_iam_role.backup.arn
  name         = "${var.name}-${var.environment}-resources"
  plan_id      = aws_backup_plan.kravia.id
  selection_tag {
    type  = "STRINGEQUALS"
    key   = "Project"
    value = "kravia"
  }
}

resource "aws_budgets_budget" "monthly" {
  count        = var.budget_email == null ? 0 : 1
  name         = "${var.name}-${var.environment}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.budget_email]
  }
}

resource "aws_instance" "this" {
  count                       = var.create_ec2 ? 1 : 0
  ami                         = var.ami_id
  instance_type               = var.instance_type
  subnet_id                   = local.private_subnets[0]
  vpc_security_group_ids      = [aws_security_group.ec2.id]
  iam_instance_profile        = aws_iam_instance_profile.ec2.name
  key_name                    = var.key_name
  associate_public_ip_address = false

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  root_block_device {
    encrypted   = true
    volume_type = "gp3"
    volume_size = 40
  }

  user_data = <<-BOOTSTRAP
    #!/usr/bin/env bash
    set -Eeuo pipefail
    dnf install -y docker git python3
    systemctl enable --now docker
    install -d -m 0700 -o root -g root /etc/kravia
    install -d -m 0700 -o 10001 -g 10001 /var/lib/kravia/private-vault
    usermod -aG docker ec2-user || true
  BOOTSTRAP
}
