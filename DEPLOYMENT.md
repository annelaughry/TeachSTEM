# Deploying `lessons` to AWS

## Architecture

- **Django API** — runs as a container on **ECS Fargate**, behind an **Application Load Balancer (ALB)**, on its own subdomain (`api.yourdomain.org`). Handles `/api/*`, `/admin/`, and the existing server-rendered pages (login, dashboards).
- **React app** — built as static files and served from **S3 + CloudFront** on its own subdomain (`app.yourdomain.org`). Talks to the API cross-origin via `VITE_API_BASE_URL`.
- **Database** — **RDS Postgres**.
- **Media uploads** (activity PDFs, handouts, student videos) — **S3** (ECS containers have no persistent disk).
- **Secrets** — **AWS Secrets Manager**.
- **CI/CD** — GitHub Actions builds/pushes the Docker image to **ECR** and updates the ECS service; builds the React app and syncs it to S3, then invalidates CloudFront. Workflow already added at `.github/workflows/deploy.yml`.

Two origins means the browser talks to `app.yourdomain.org` for the UI and `api.yourdomain.org` for data — CORS and CSRF settings in `settings.py` are already wired for this via env vars.

Prerequisites: an AWS account, the AWS CLI configured (`aws configure`), Docker installed locally, and a domain you can create DNS records for (Route53 or elsewhere).

---

## 0. Test the Docker image locally first

Before touching AWS, confirm the container actually works:

```bash
docker compose up --build
```

Visit `http://localhost:8000/admin/`. Create a superuser in another terminal:

```bash
docker compose exec web python manage.py createsuperuser
```

Fix anything that breaks here — it'll behave the same way on ECS.

Also generate a frontend lockfile now (the CI workflow expects one eventually):

```bash
cd frontend && npm install && cd ..
git add frontend/package-lock.json
```

Then switch `npm install` back to `npm ci` in `.github/workflows/deploy.yml` for reproducible builds.

---

## 1. One-time AWS setup

Set some shell variables you'll reuse below:

```bash
export AWS_REGION=us-east-1
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export APP_DOMAIN=app.yourdomain.org      # React
export API_DOMAIN=api.yourdomain.org      # Django
```

### 1.1 ECR repository (Docker image registry)

```bash
aws ecr create-repository --repository-name lessons-backend --region $AWS_REGION
```

### 1.2 S3 buckets

```bash
# Frontend static site (private; served only via CloudFront)
aws s3api create-bucket --bucket lessons-frontend-prod --region $AWS_REGION

# Media uploads (PDFs, videos)
aws s3api create-bucket --bucket lessons-media-prod --region $AWS_REGION
```

Block public access on both (CloudFront and Django reach them via IAM, not public ACLs):

```bash
aws s3api put-public-access-block --bucket lessons-frontend-prod --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

aws s3api put-public-access-block --bucket lessons-media-prod --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

For the media bucket, set CORS so the browser can request files directly (adjust `AllowedOrigins` to `$APP_DOMAIN`):

```bash
aws s3api put-bucket-cors --bucket lessons-media-prod --cors-configuration '{
  "CORSRules": [{"AllowedOrigins": ["https://app.yourdomain.org"], "AllowedMethods": ["GET"], "AllowedHeaders": ["*"]}]
}'
```

### 1.3 RDS Postgres

Easiest path: RDS console → **Create database** → Postgres → **Free tier** or **db.t4g.micro** for a first deploy → set a master username/password → note the **endpoint** it gives you. Put it in a private subnet and only allow inbound connections from the ECS tasks' security group (create that security group in step 1.5, then edit the RDS security group afterward).

Or via CLI:

```bash
aws rds create-db-instance \
  --db-instance-identifier lessons-db \
  --db-instance-class db.t4g.micro \
  --engine postgres \
  --master-username lessons \
  --master-user-password '<CHOOSE_A_STRONG_PASSWORD>' \
  --allocated-storage 20 \
  --db-name lessons \
  --no-publicly-accessible
```

### 1.4 Secrets Manager

Store the Django secret key and DB password so they never sit in plaintext in the task definition:

```bash
aws secretsmanager create-secret --name lessons/django-secret-key \
  --secret-string "$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')"

aws secretsmanager create-secret --name lessons/db-password \
  --secret-string '<THE_SAME_RDS_PASSWORD_FROM_1.3>'
```

### 1.5 Security groups

```bash
VPC_ID=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)

ALB_SG=$(aws ec2 create-security-group --group-name lessons-alb-sg --description "ALB" --vpc-id $VPC_ID --query GroupId --output text)
aws ec2 authorize-security-group-ingress --group-id $ALB_SG --protocol tcp --port 443 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $ALB_SG --protocol tcp --port 80 --cidr 0.0.0.0/0

ECS_SG=$(aws ec2 create-security-group --group-name lessons-ecs-sg --description "ECS tasks" --vpc-id $VPC_ID --query GroupId --output text)
aws ec2 authorize-security-group-ingress --group-id $ECS_SG --protocol tcp --port 8000 --source-group $ALB_SG
```

Then add an inbound rule on the **RDS** security group allowing port 5432 from `$ECS_SG`.

---

## 2. ECS: cluster, ALB, task definition, service

### 2.1 Cluster

```bash
aws ecs create-cluster --cluster-name lessons-cluster
```

### 2.2 ALB + target group

```bash
SUBNETS=$(aws ec2 describe-subnets --filters Name=vpc-id,Values=$VPC_ID --query 'Subnets[].SubnetId' --output text)

ALB_ARN=$(aws elbv2 create-load-balancer --name lessons-alb \
  --subnets $SUBNETS --security-groups $ALB_SG --query 'LoadBalancers[0].LoadBalancerArn' --output text)

TG_ARN=$(aws elbv2 create-target-group --name lessons-tg \
  --protocol HTTP --port 8000 --vpc-id $VPC_ID --target-type ip \
  --health-check-path /health/ --query 'TargetGroups[0].TargetGroupArn' --output text)
```

Request an ACM certificate for `api.yourdomain.org` (in `$AWS_REGION`), validate it via the DNS record ACM gives you, then create the HTTPS listener:

```bash
CERT_ARN=$(aws acm request-certificate --domain-name $API_DOMAIN --validation-method DNS --query CertificateArn --output text)
# -- validate via DNS, then --
aws elbv2 create-listener --load-balancer-arn $ALB_ARN --protocol HTTPS --port 443 \
  --certificates CertificateArn=$CERT_ARN --default-actions Type=forward,TargetGroupArn=$TG_ARN
```

Point `api.yourdomain.org` (Route53 or your DNS provider) at the ALB's DNS name as an alias/CNAME.

### 2.3 IAM roles

Two roles: an **execution role** (pulls the image, reads secrets) and a **task role** (what your Django code can do at runtime — here, read/write the media S3 bucket).

```bash
# Execution role: attach the AWS-managed AmazonECSTaskExecutionRolePolicy,
# plus an inline policy granting secretsmanager:GetSecretValue on the two
# secrets from step 1.4.

# Task role: attach an inline policy granting s3:GetObject/PutObject/DeleteObject
# on arn:aws:s3:::lessons-media-prod/*
```

(Easiest done in the IAM console: Roles → Create role → ECS Task → attach policies as above.)

### 2.4 Task definition

```json
{
  "family": "lessons-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/lessons-ecs-execution-role",
  "taskRoleArn": "arn:aws:iam::ACCOUNT_ID:role/lessons-ecs-task-role",
  "containerDefinitions": [
    {
      "name": "lessons-backend",
      "image": "ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/lessons-backend:latest",
      "portMappings": [{ "containerPort": 8000 }],
      "environment": [
        { "name": "DJANGO_DEBUG", "value": "False" },
        { "name": "DJANGO_ALLOWED_HOSTS", "value": "api.yourdomain.org" },
        { "name": "CORS_ALLOWED_ORIGINS", "value": "https://app.yourdomain.org" },
        { "name": "CSRF_TRUSTED_ORIGINS", "value": "https://api.yourdomain.org" },
        { "name": "DB_HOST", "value": "<RDS_ENDPOINT_FROM_1.3>" },
        { "name": "DB_NAME", "value": "lessons" },
        { "name": "DB_USER", "value": "lessons" },
        { "name": "AWS_STORAGE_BUCKET_NAME", "value": "lessons-media-prod" },
        { "name": "AWS_S3_REGION_NAME", "value": "REGION" }
      ],
      "secrets": [
        { "name": "DJANGO_SECRET_KEY", "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT_ID:secret:lessons/django-secret-key" },
        { "name": "DB_PASSWORD", "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT_ID:secret:lessons/db-password" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/lessons-backend",
          "awslogs-region": "REGION",
          "awslogs-stream-prefix": "ecs",
          "awslogs-create-group": "true"
        }
      }
    }
  ]
}
```

Fill in the real ARNs/values and register it:

```bash
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

### 2.5 Service

```bash
aws ecs create-service \
  --cluster lessons-cluster \
  --service-name lessons-backend-service \
  --task-definition lessons-backend \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$ECS_SG],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=$TG_ARN,containerName=lessons-backend,containerPort=8000"
```

Give it a few minutes, then check `https://api.yourdomain.org/admin/` loads.

---

## 3. CloudFront + S3 for the React app

CloudFront's certificate **must** be requested in `us-east-1`, regardless of where everything else lives.

```bash
FRONTEND_CERT_ARN=$(aws acm request-certificate --domain-name $APP_DOMAIN --validation-method DNS \
  --region us-east-1 --query CertificateArn --output text)
# -- validate via DNS --
```

Create the CloudFront distribution (console is easiest for this one): origin = `lessons-frontend-prod.s3.amazonaws.com` with **Origin Access Control (OAC)** so the bucket stays private, default root object `index.html`, and a **custom error response**: 403/404 → `/index.html` with 200 status (required for React Router's client-side routes to work on refresh/direct link). Attach `$FRONTEND_CERT_ARN` and set the alternate domain name to `app.yourdomain.org`.

After creating it, update the bucket policy to allow that distribution's OAC to read objects (CloudFront console gives you the exact policy JSON to paste — click "Copy policy" in the setup banner).

Point `app.yourdomain.org` at the CloudFront distribution's domain name (alias in Route53, or CNAME elsewhere).

---

## 4. Wire up GitHub Actions

The workflow at `.github/workflows/deploy.yml` needs:

**An OIDC deploy role** (avoids storing long-lived AWS keys in GitHub):
1. IAM → Identity providers → add `token.actions.githubusercontent.com`.
2. Create a role trusting that provider, scoped to your repo, with permissions for ECR push, ECS deploy, S3 sync, and CloudFront invalidation.
3. Add its ARN as the repo secret `AWS_DEPLOY_ROLE_ARN`.

**Repo secrets** (Settings → Secrets and variables → Actions):
- `AWS_DEPLOY_ROLE_ARN`
- `FRONTEND_S3_BUCKET` = `lessons-frontend-prod`
- `CLOUDFRONT_DISTRIBUTION_ID`
- `VITE_API_BASE_URL` = `https://api.yourdomain.org/api/`

Push to `main` and watch the Actions tab. First run needs the ECS task definition to already exist (step 2.4) — after that, every push builds a new image and rolls the service.

---

## 5. Ongoing

- **Migrations** run automatically on container start (`docker-entrypoint.sh`).
- **Superuser**: `aws ecs execute-command` into a running task, or run `python manage.py createsuperuser` once via a one-off Fargate task.
- **Logs**: CloudWatch Logs group `/ecs/lessons-backend`.
- **Rollback**: `aws ecs update-service --cluster lessons-cluster --service lessons-backend-service --task-definition lessons-backend:<previous-revision>`.
- **Rough monthly cost** (us-east-1, low traffic): Fargate 0.5 vCPU/1GB ~$15, RDS db.t4g.micro ~$13, ALB ~$18, S3/CloudFront a few dollars. Roughly $50–60/month before real traffic.

## Notes / assumptions worth double-checking

- Package versions in `requirements.txt` are best-effort based on what your code imports (DRF, SimpleJWT, CORS headers) — since this session couldn't run `pip freeze` in your actual environment, run it yourself and reconcile before deploying.
- The security-group and IAM steps above use the default VPC and console-driven role creation for a first deploy. For a hardened production setup later, move RDS and ECS tasks into private subnets with a NAT gateway, and consider Terraform/CDK once this manual pass is working, so the whole stack becomes reproducible.
