output "frontend_url" {
  description = "Public address of the app. Add it to the Supabase Auth redirect URLs."
  value       = local.frontend_url
}

output "supabase_redirect_url" {
  description = "Redirect URL to allow in Supabase > Authentication > URL Configuration."
  value       = "${local.frontend_url}/**"
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.frontend.id
}

output "frontend_bucket" {
  value = aws_s3_bucket.frontend.bucket
}

output "ecs_cluster" {
  value = aws_ecs_cluster.main.name
}

output "ecs_services" {
  value = {
    api-gateway = aws_ecs_service.api_gateway.name
    ai-service  = aws_ecs_service.ai_service.name
    worker      = aws_ecs_service.worker.name
  }
}

output "ecr_repositories" {
  value = { for k, r in aws_ecr_repository.service : k => r.repository_url }
}

output "redis_endpoint" {
  value = local.redis_url
}

output "alb_dns_name" {
  description = "Only reachable with the CloudFront origin header; use frontend_url instead."
  value       = aws_lb.main.dns_name
}
