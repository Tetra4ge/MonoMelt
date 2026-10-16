# DRAFT - generated scaffold. Review before `terraform apply`.
terraform {
  required_providers {
    google = { source = "hashicorp/google", version = "~> 5.0" }
  }
}

variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "europe-west1"
}

provider "google" {
  project = var.project_id
  region  = var.region
}

locals {
  services = ["components-service", "app-service", "utils-service", "config-service", "contexts-service", "firebase-service", "store-service"]
}

resource "google_artifact_registry_repository" "service" {
  for_each      = toset(local.services)
  repository_id = each.key
  format        = "DOCKER"
  location      = var.region
}
