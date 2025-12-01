
import { ProjectConfig } from './types';

export const SAMPLE_INPUT_NEW: ProjectConfig = {
  "use_case": "new",
  "project_name": "payments-app",
  "terraform_version": "1.5.0",
  "use_community_modules": true,
  "modules_repo": "./output/modules",
  "ecosystem_repo": "./output/ecosystem",
  "deployments_repo": "./output/deployments",
  "services": [
    {
      "service": "VPC",
      "region": "us-east-1",
      "resources": [
        {
          "name": "vpc_new1",
          "details": [
            { "name": "cidr", "value": "10.0.0.0/16" },
            { "name": "public_subnets", "value": "10.0.1.0/24,10.0.2.0/24" },
            { "name": "private_subnets", "value": "10.0.3.0/24,10.0.4.0/24" }
          ]
        }
      ]
    },
    {
      "service": "EC2",
      "region": "us-east-1",
      "resources": [
        {
          "name": "payment-processor",
          "type": "t3.medium",
          "details": [
            { "name": "ami", "value": "ami-0c55b159cbfafe1f0" },
            { "name": "environment", "value": "Production" }
          ]
        }
      ]
    }
  ]
};

export const SAMPLE_INPUT_EXISTING: ProjectConfig = {
  "use_case": "existing",
  "project_name": "payments-app-migration",
  "terraform_version": "1.5.0",
  "use_community_modules": false,
  "modules_repo": "./output/modules",
  "ecosystem_repo": "./output/ecosystem",
  "deployments_repo": "./output/deployments",
  "services": [
    {
      "service": "VPC",
      "region": "us-east-1",
      "resources": [
        {
          "name": "vpc_existing1",
          "resource_id": "vpc-0abc12345def67890",
          "details": [
            { "name": "public_1", "value": null },
            { "name": "private_1", "value": null }
          ]
        },
        {
          "name": "vpc_existing2",
          "resource_id": "vpc-0987654321fedcba0",
          "details": [
            { "name": "public_1", "value": null },
            { "name": "private_1", "value": null },
            { "name": "private_2", "value": null }
          ]
        }
      ]
    },
    {
      "service": "S3",
      "region": "us-west-1",
      "resources": [
        {
          "name": "legacy-logs-bucket",
          "resource_id": "my-legacy-logs-bucket-001",
          "details": [
            { "name": "Versioning", "value": "Enabled" }
          ]
        }
      ]
    }
  ]
};