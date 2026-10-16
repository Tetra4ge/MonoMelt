data "aws_caller_identity" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name       = var.project
  account_id = data.aws_caller_identity.current.account_id
  azs        = slice(data.aws_availability_zones.available.names, 0, 2)

  services = toset(["api-gateway", "ai-service", "worker"])

  # Secrets created by hand in SSM Parameter Store (SecureString) before the first apply.
  ssm_parameters = [
    "database-url",
    "gemini-api-key",
    "internal-api-key",
    "neo4j-password",
    "neo4j-uri",
    "neo4j-username",
    "notion-api-key",
    "notion-database-id",
    "openrouter-api-key",
    "supabase-jwt-secret",
    "supabase-service-role-key",
    "supabase-url",
  ]
  ssm_arn = {
    for p in local.ssm_parameters :
    p => "arn:aws:ssm:${var.aws_region}:${local.account_id}:parameter/${var.project}/${p}"
  }

  frontend_bucket = "${var.project}-frontend-${local.account_id}-${var.aws_region}"

  # Wired into the task definitions so no URL has to be edited by hand after the deploy.
  frontend_url   = "https://${aws_cloudfront_distribution.frontend.domain_name}"
  redis_url      = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:${aws_elasticache_cluster.redis.port}"
  ai_service_url = "http://ai-service.${aws_service_discovery_private_dns_namespace.main.name}:8000"
}
