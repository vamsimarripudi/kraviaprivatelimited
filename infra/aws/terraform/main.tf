data "aws_caller_identity" "current" {}

data "aws_kms_key" "kravia" {
  key_id = var.kms_key_id
}

data "aws_iam_policy" "ssm_core" {
  arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_instance" "existing" {
  count       = var.existing_instance_id == null ? 0 : 1
  instance_id = var.existing_instance_id
}

data "aws_iam_openid_connect_provider" "github" {
  count = var.github_oidc_provider_arn == null ? 0 : 1
  arn   = var.github_oidc_provider_arn
}

locals {
  managed_network = var.network_mode == "managed"
  vpc_id          = local.managed_network ? aws_vpc.this[0].id : var.existing_vpc_id
  public_subnets  = local.managed_network ? aws_subnet.public[*].id : var.existing_public_subnet_ids
  private_subnets = local.managed_network ? aws_subnet.private[*].id : var.existing_private_subnet_ids
  instance_id     = var.existing_instance_id != null ? var.existing_instance_id : try(aws_instance.this[0].id, null)
  instance_arn    = local.instance_id == null ? null : "arn:aws:ec2:${var.region}:${data.aws_caller_identity.current.account_id}:instance/${local.instance_id}"
  parameter_arn   = "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter/kravia/${var.environment}/*"
  log_group_arn   = "arn:aws:logs:${var.region}:${data.aws_caller_identity.current.account_id}:log-group:/kravia/${var.environment}/ec2:*"
}

resource "terraform_data" "configuration_guard" {
  input = {
    region = var.region
    mode   = var.network_mode
  }

  lifecycle {
    precondition {
      condition     = var.existing_instance_id != null || var.create_ec2
      error_message = "Provide existing_instance_id after discovery, or explicitly approve create_ec2."
    }
    precondition {
      condition     = !var.manage_existing_instance || var.existing_instance_id != null
      error_message = "manage_existing_instance=true requires a discovered existing_instance_id."
    }
    precondition {
      condition     = var.network_mode == "managed" || (var.existing_vpc_id != null && length(var.existing_public_subnet_ids) >= 2 && length(var.existing_private_subnet_ids) >= 1)
      error_message = "Existing network mode requires existing_vpc_id, two public subnet IDs and one private subnet ID."
    }
    precondition {
      condition     = !var.create_ec2 || (var.ami_id != null && var.network_mode == "managed")
      error_message = "New EC2 creation requires a pinned ami_id and managed network mode."
    }
    precondition {
      condition     = var.github_oidc_provider_arn != null
      error_message = "Supply the existing GitHub OIDC provider ARN; this stack does not silently create a broad trust provider."
    }
    precondition {
      condition     = var.importer_principal_arn != null
      error_message = "Supply a specific importer principal ARN; account-root trust is prohibited."
    }
    precondition {
      condition     = var.certificate_arn != null
      error_message = "Supply an approved ACM certificate ARN before creating the HTTPS listener."
    }
  }
}

resource "aws_vpc" "this" {
  count                = local.managed_network ? 1 : 0
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
}

resource "aws_internet_gateway" "this" {
  count  = local.managed_network ? 1 : 0
  vpc_id = aws_vpc.this[0].id
}

resource "aws_subnet" "public" {
  count                   = local.managed_network ? length(var.public_subnet_cidrs) : 0
  vpc_id                  = aws_vpc.this[0].id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = false
}

resource "aws_subnet" "private" {
  count             = local.managed_network ? length(var.private_subnet_cidrs) : 0
  vpc_id            = aws_vpc.this[0].id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]
}

resource "aws_route_table" "public" {
  count  = local.managed_network ? 1 : 0
  vpc_id = aws_vpc.this[0].id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this[0].id
  }
}

resource "aws_route_table_association" "public" {
  count          = local.managed_network ? length(aws_subnet.public) : 0
  route_table_id = aws_route_table.public[0].id
  subnet_id      = aws_subnet.public[count.index].id
}

resource "aws_eip" "nat" {
  count  = local.managed_network && var.enable_nat_gateway ? 1 : 0
  domain = "vpc"
}

resource "aws_nat_gateway" "this" {
  count         = local.managed_network && var.enable_nat_gateway ? 1 : 0
  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.public[0].id
  depends_on    = [aws_internet_gateway.this]
}

resource "aws_route_table" "private" {
  count  = local.managed_network ? 1 : 0
  vpc_id = aws_vpc.this[0].id
  dynamic "route" {
    for_each = var.enable_nat_gateway ? [1] : []
    content {
      cidr_block     = "0.0.0.0/0"
      nat_gateway_id = aws_nat_gateway.this[0].id
    }
  }
}

resource "aws_route_table_association" "private" {
  count          = local.managed_network ? length(aws_subnet.private) : 0
  route_table_id = aws_route_table.private[0].id
  subnet_id      = aws_subnet.private[count.index].id
}

resource "aws_security_group" "alb" {
  name        = "${var.name}-${var.environment}-alb"
  description = "Public TLS ingress for KRAVIA API"
  vpc_id      = local.vpc_id
  ingress {
    description = "HTTPS"
    protocol    = "tcp"
    from_port   = 443
    to_port     = 443
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ec2" {
  name        = "${var.name}-${var.environment}-ec2"
  description = "Private KRAVIA backend; no public SSH ingress"
  vpc_id      = local.vpc_id
  ingress {
    description     = "API only from the ALB"
    protocol        = "tcp"
    from_port       = 8000
    to_port         = 8000
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_network_interface_sg_attachment" "existing" {
  count                = var.existing_instance_id != null && var.manage_existing_instance ? 1 : 0
  security_group_id    = aws_security_group.ec2.id
  network_interface_id = data.aws_instance.existing[0].primary_network_interface_id
}

resource "aws_lb" "api" {
  name                       = "${var.name}-${var.environment}-api"
  internal                   = false
  load_balancer_type         = "application"
  subnets                    = local.public_subnets
  security_groups            = [aws_security_group.alb.id]
  enable_deletion_protection = var.environment == "prod"
}

resource "aws_lb_target_group" "api" {
  name        = "${var.name}-${var.environment}-api"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = local.vpc_id
  target_type = "instance"
  health_check {
    enabled             = true
    path                = "/health/live"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 3
    unhealthy_threshold = 3
  }
}

resource "aws_lb_target_group_attachment" "api" {
  target_group_arn = aws_lb_target_group.api.arn
  target_id        = local.instance_id
  port             = 8000
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.api.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = var.certificate_arn
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}
