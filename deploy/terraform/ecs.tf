resource "aws_ecs_cluster" "main" {
  name = local.name
}

resource "aws_cloudwatch_log_group" "service" {
  for_each = local.services

  name              = "/ecs/${var.project}/${each.key}"
  retention_in_days = 7
}

# The gateway and worker reach the AI service by name: ai-service.<project>.local
resource "aws_service_discovery_private_dns_namespace" "main" {
  name = "${var.project}.local"
  vpc  = aws_vpc.main.id
}

resource "aws_service_discovery_service" "ai_service" {
  name = "ai-service"

  dns_config {
    namespace_id   = aws_service_discovery_private_dns_namespace.main.id
    routing_policy = "MULTIVALUE"

    dns_records {
      ttl  = 10
      type = "A"
    }
  }

  health_check_custom_config {}
}

locals {
  # Images are pushed by the deploy workflow; the services pick up the `latest` tag.
  image = { for k, r in aws_ecr_repository.service : k => "${r.repository_url}:latest" }

  log_config = { for k, g in aws_cloudwatch_log_group.service : k => {
    logDriver = "awslogs"
    options = {
      "awslogs-group"         = g.name
      "awslogs-region"        = var.aws_region
      "awslogs-stream-prefix" = "ecs"
    }
  } }
}

# --- API gateway ---

resource "aws_ecs_task_definition" "api_gateway" {
  family                   = "${local.name}-api-gateway"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name      = "api-gateway"
    image     = local.image["api-gateway"]
    essential = true

    portMappings = [{ containerPort = 4000, protocol = "tcp" }]

    environment = [
      { name = "PORT", value = "4000" },
      { name = "NODE_ENV", value = "production" },
      { name = "FRONTEND_URL", value = local.frontend_url },
      { name = "AI_SERVICE_URL", value = local.ai_service_url },
      { name = "REDIS_URL", value = local.redis_url },
    ]

    secrets = [
      { name = "SUPABASE_URL", valueFrom = local.ssm_arn["supabase-url"] },
      { name = "SUPABASE_JWT_SECRET", valueFrom = local.ssm_arn["supabase-jwt-secret"] },
      { name = "SUPABASE_SERVICE_ROLE_KEY", valueFrom = local.ssm_arn["supabase-service-role-key"] },
      { name = "DATABASE_URL", valueFrom = local.ssm_arn["database-url"] },
      { name = "INTERNAL_API_KEY", valueFrom = local.ssm_arn["internal-api-key"] },
      { name = "NOTION_API_KEY", valueFrom = local.ssm_arn["notion-api-key"] },
      { name = "NOTION_DATABASE_ID", valueFrom = local.ssm_arn["notion-database-id"] },
    ]

    logConfiguration = local.log_config["api-gateway"]
  }])
}

resource "aws_ecs_service" "api_gateway" {
  name                               = "${local.name}-api-gateway"
  cluster                            = aws_ecs_cluster.main.id
  task_definition                    = aws_ecs_task_definition.api_gateway.arn
  desired_count                      = var.desired_count
  launch_type                        = "FARGATE"
  enable_execute_command             = true
  health_check_grace_period_seconds  = 60
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.gateway.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.gateway.arn
    container_name   = "api-gateway"
    container_port   = 4000
  }

  depends_on = [aws_lb_listener_rule.from_cloudfront]
}

# --- AI service ---

resource "aws_ecs_task_definition" "ai_service" {
  family                   = "${local.name}-ai-service"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 2048
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name      = "ai-service"
    image     = local.image["ai-service"]
    essential = true

    portMappings = [{ containerPort = 8000, protocol = "tcp" }]

    environment = concat(
      [
        { name = "PORT", value = "8000" },
        { name = "REDIS_URL", value = local.redis_url },
        { name = "ALLOWED_ORIGINS", value = local.frontend_url },
      ],
      var.neo4j_database == "" ? [] : [{ name = "NEO4J_DATABASE", value = var.neo4j_database }],
    )

    secrets = [
      { name = "SUPABASE_URL", valueFrom = local.ssm_arn["supabase-url"] },
      { name = "SUPABASE_SERVICE_ROLE_KEY", valueFrom = local.ssm_arn["supabase-service-role-key"] },
      { name = "DATABASE_URL", valueFrom = local.ssm_arn["database-url"] },
      { name = "NEO4J_URI", valueFrom = local.ssm_arn["neo4j-uri"] },
      { name = "NEO4J_USERNAME", valueFrom = local.ssm_arn["neo4j-username"] },
      { name = "NEO4J_PASSWORD", valueFrom = local.ssm_arn["neo4j-password"] },
      { name = "OPENROUTER_API_KEY", valueFrom = local.ssm_arn["openrouter-api-key"] },
      { name = "GEMINI_API_KEY", valueFrom = local.ssm_arn["gemini-api-key"] },
      { name = "INTERNAL_API_KEY", valueFrom = local.ssm_arn["internal-api-key"] },
    ]

    logConfiguration = local.log_config["ai-service"]
  }])
}

resource "aws_ecs_service" "ai_service" {
  name                               = "${local.name}-ai-service"
  cluster                            = aws_ecs_cluster.main.id
  task_definition                    = aws_ecs_task_definition.ai_service.arn
  desired_count                      = var.desired_count
  launch_type                        = "FARGATE"
  enable_execute_command             = true
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ai_service.id]
    assign_public_ip = false
  }

  service_registries {
    registry_arn = aws_service_discovery_service.ai_service.arn
  }
}

# --- Worker ---

resource "aws_ecs_task_definition" "worker" {
  family                   = "${local.name}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 2048
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name      = "worker"
    image     = local.image["worker"]
    essential = true

    environment = [
      { name = "REDIS_URL", value = local.redis_url },
      { name = "AI_SERVICE_URL", value = local.ai_service_url },
      { name = "MAX_SOURCE_FILES", value = "10000" },
      { name = "MAX_EXTRACTED_BYTES", value = "209715200" },
    ]

    secrets = [
      { name = "SUPABASE_URL", valueFrom = local.ssm_arn["supabase-url"] },
      { name = "SUPABASE_SERVICE_ROLE_KEY", valueFrom = local.ssm_arn["supabase-service-role-key"] },
      { name = "INTERNAL_API_KEY", valueFrom = local.ssm_arn["internal-api-key"] },
    ]

    logConfiguration = local.log_config["worker"]
  }])
}

resource "aws_ecs_service" "worker" {
  name                               = "${local.name}-worker"
  cluster                            = aws_ecs_cluster.main.id
  task_definition                    = aws_ecs_task_definition.worker.arn
  desired_count                      = var.desired_count
  launch_type                        = "FARGATE"
  enable_execute_command             = true
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.worker.id]
    assign_public_ip = false
  }
}
