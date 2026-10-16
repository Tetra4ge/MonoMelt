# Security groups are the firewall:
#   CloudFront -> ALB -> gateway -> AI service
#                        worker  -> AI service
#   gateway, AI service, worker -> Redis

data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_security_group" "alb" {
  name        = "${local.name}-alb"
  description = "Load balancer: reachable from CloudFront only"
  vpc_id      = aws_vpc.main.id
}

resource "aws_security_group" "gateway" {
  name        = "${local.name}-gateway"
  description = "API gateway tasks: reachable from the load balancer only"
  vpc_id      = aws_vpc.main.id
}

resource "aws_security_group" "ai_service" {
  name        = "${local.name}-ai-service"
  description = "AI service tasks: reachable from the gateway and worker only"
  vpc_id      = aws_vpc.main.id
}

resource "aws_security_group" "worker" {
  name        = "${local.name}-worker"
  description = "Worker tasks: no inbound traffic"
  vpc_id      = aws_vpc.main.id
}

resource "aws_security_group" "redis" {
  name        = "${local.name}-redis"
  description = "Redis: reachable from the three services only"
  vpc_id      = aws_vpc.main.id
}

# --- Inbound ---

resource "aws_vpc_security_group_ingress_rule" "alb_from_cloudfront" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP from CloudFront"
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront.id
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
}

resource "aws_vpc_security_group_ingress_rule" "gateway_from_alb" {
  security_group_id            = aws_security_group.gateway.id
  description                  = "Gateway port from the load balancer"
  referenced_security_group_id = aws_security_group.alb.id
  ip_protocol                  = "tcp"
  from_port                    = 4000
  to_port                      = 4000
}

resource "aws_vpc_security_group_ingress_rule" "ai_from_gateway" {
  security_group_id            = aws_security_group.ai_service.id
  description                  = "AI service port from the gateway"
  referenced_security_group_id = aws_security_group.gateway.id
  ip_protocol                  = "tcp"
  from_port                    = 8000
  to_port                      = 8000
}

resource "aws_vpc_security_group_ingress_rule" "ai_from_worker" {
  security_group_id            = aws_security_group.ai_service.id
  description                  = "AI service port from the worker"
  referenced_security_group_id = aws_security_group.worker.id
  ip_protocol                  = "tcp"
  from_port                    = 8000
  to_port                      = 8000
}

resource "aws_vpc_security_group_ingress_rule" "redis_from_gateway" {
  security_group_id            = aws_security_group.redis.id
  description                  = "Redis from the gateway"
  referenced_security_group_id = aws_security_group.gateway.id
  ip_protocol                  = "tcp"
  from_port                    = 6379
  to_port                      = 6379
}

resource "aws_vpc_security_group_ingress_rule" "redis_from_ai" {
  security_group_id            = aws_security_group.redis.id
  description                  = "Redis from the AI service"
  referenced_security_group_id = aws_security_group.ai_service.id
  ip_protocol                  = "tcp"
  from_port                    = 6379
  to_port                      = 6379
}

resource "aws_vpc_security_group_ingress_rule" "redis_from_worker" {
  security_group_id            = aws_security_group.redis.id
  description                  = "Redis from the worker"
  referenced_security_group_id = aws_security_group.worker.id
  ip_protocol                  = "tcp"
  from_port                    = 6379
  to_port                      = 6379
}

# --- Outbound ---

resource "aws_vpc_security_group_egress_rule" "alb_to_gateway" {
  security_group_id            = aws_security_group.alb.id
  description                  = "Forward to the gateway"
  referenced_security_group_id = aws_security_group.gateway.id
  ip_protocol                  = "tcp"
  from_port                    = 4000
  to_port                      = 4000
}

# The tasks call Supabase, Neo4j Aura, the LLM providers and Notion through the NAT gateway.
resource "aws_vpc_security_group_egress_rule" "gateway_all" {
  security_group_id = aws_security_group.gateway.id
  description       = "Outbound to Redis, the AI service and the internet"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_vpc_security_group_egress_rule" "ai_service_all" {
  security_group_id = aws_security_group.ai_service.id
  description       = "Outbound to Redis and the internet"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_vpc_security_group_egress_rule" "worker_all" {
  security_group_id = aws_security_group.worker.id
  description       = "Outbound to Redis, the AI service and the internet"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}
