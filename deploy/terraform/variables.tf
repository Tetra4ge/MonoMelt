variable "aws_region" {
  description = "Region for every resource. Must match the region the SSM parameters were created in."
  type        = string
  default     = "ap-south-1"
}

variable "project" {
  description = "Name prefix for resources and the SSM parameter path (/<project>/...)."
  type        = string
  default     = "monomelt"
}

variable "vpc_cidr" {
  description = "CIDR block of the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "redis_node_type" {
  description = "ElastiCache node size. One node is enough for a demo."
  type        = string
  default     = "cache.t4g.micro"
}

variable "desired_count" {
  description = "Tasks per ECS service. Keep the gateway at 1: Socket.IO events only reach sockets on the same task."
  type        = number
  default     = 1
}

variable "neo4j_database" {
  description = "Neo4j Aura database name. Aura names the default database after the instance id. Leave empty to use the driver default."
  type        = string
  default     = "4bb40a2f"
}
