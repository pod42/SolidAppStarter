####################################################################
# Solid Pod App — AWS S3 + CloudFront Deployment Script
# Usage:
#   .\deploy\deploy.ps1                    # initial setup
#   .\deploy\deploy.ps1 -Action update     # re-deploy after code changes
#   .\deploy\deploy.ps1 -Action invalidate # bust CloudFront cache only
#
# Prerequisites:
#   1. AWS CLI installed and configured (aws configure)
#   2. Node.js installed
#   3. Set DOMAIN and BUCKET below, or pass via -Domain / -Bucket params
####################################################################

param(
    [ValidateSet("setup","update","invalidate")]
    [string]$Action = "setup",

    [string]$Domain = "",   # e.g. "myapp.example.com"
    [string]$Bucket = ""    # e.g. "myapp-example-com"
)

$ErrorActionPreference = "Continue"

# ── Config ───────────────────────────────────────────────────────────────────
# Override via params or edit directly:
if (-not $Domain) { $Domain = "YOUR-APP-DOMAIN" }
if (-not $Bucket) { $Bucket = $Domain.Replace(".", "-").ToLower() }

$REGION     = "us-east-1"
$DIST_DIR   = "dist"
$STATE_FILE = "deploy\state.json"   # persists CloudFront distribution ID
# ─────────────────────────────────────────────────────────────────────────────

function Check-Prerequisites {
    Write-Host "`n[1/2] Checking prerequisites..." -ForegroundColor Cyan
    if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
        Write-Host "  ERROR: AWS CLI not found. Install it first:" -ForegroundColor Red
        Write-Host "         https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html" -ForegroundColor Yellow
        Write-Host "         Then run: aws configure" -ForegroundColor Yellow
        exit 1
    }
    $identity = aws sts get-caller-identity 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: AWS credentials not configured. Run: aws configure" -ForegroundColor Red
        exit 1
    }
    Write-Host "  AWS CLI OK. Identity: $identity" -ForegroundColor Green

    $nodePath = "C:\Program Files\nodejs"
    if (Test-Path "$nodePath\node.exe") { $env:PATH = "$nodePath;" + $env:PATH }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host "  ERROR: Node.js not found." -ForegroundColor Red
        exit 1
    }
    Write-Host "  Node.js OK: $(node --version)" -ForegroundColor Green
}

function Build-App {
    Write-Host "`n[2/2] Building app..." -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) { Write-Host "  Build failed." -ForegroundColor Red; exit 1 }
    Write-Host "  Build complete -> $DIST_DIR/" -ForegroundColor Green
}

function Create-Bucket {
    Write-Host "`n[S3] Creating bucket: $Bucket ..." -ForegroundColor Cyan

    $oldPref = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    $exists = aws s3api head-bucket --bucket $Bucket 2>&1
    $bucketExists = ($LASTEXITCODE -eq 0)
    $ErrorActionPreference = $oldPref

    if ($bucketExists) {
        Write-Host "  Bucket already exists, skipping creation." -ForegroundColor Yellow
    } else {
        # us-east-1 does NOT accept LocationConstraint in the create call
        aws s3api create-bucket --bucket $Bucket --region $REGION
        Write-Host "  Bucket created." -ForegroundColor Green
    }

    # Block public access — CloudFront will serve via OAC, not public S3 URLs
    aws s3api put-public-access-block --bucket $Bucket --public-access-block-configuration `
        "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
    Write-Host "  Public access blocked (CloudFront OAC will serve instead)." -ForegroundColor Green
}

function Sync-To-S3 {
    Write-Host "`n[S3] Syncing $DIST_DIR/ to s3://$Bucket/ ..." -ForegroundColor Cyan
    # Cache JS/CSS/icons forever (content-hashed by Vite); HTML must always revalidate
    aws s3 sync $DIST_DIR s3://$Bucket `
        --delete `
        --cache-control "public, max-age=31536000, immutable" `
        --exclude "*.html" `
        --exclude "manifest.webmanifest"
    aws s3 sync $DIST_DIR s3://$Bucket `
        --delete `
        --cache-control "no-cache" `
        --include "*.html" `
        --include "manifest.webmanifest" `
        --exclude "*"
    Write-Host "  Sync complete." -ForegroundColor Green
}

function Create-CloudFront {
    Write-Host "`n[CloudFront] Creating distribution for $Domain ..." -ForegroundColor Cyan

    # Load state
    $state = @{}
    if (Test-Path $STATE_FILE) {
        $state = Get-Content $STATE_FILE | ConvertFrom-Json -AsHashtable
    }

    if ($state.ContainsKey("DistributionId") -and $state["DistributionId"]) {
        Write-Host "  Distribution already exists: $($state["DistributionId"])" -ForegroundColor Yellow
        return
    }

    # Create OAC
    $oacConfig = @{
        Name = "$Bucket-oac"
        Description = "OAC for $Domain"
        SigningProtocol = "sigv4"
        SigningBehavior = "always"
        OriginAccessControlOriginType = "s3"
    } | ConvertTo-Json -Compress
    $oacResult = aws cloudfront create-origin-access-control `
        --origin-access-control-config $oacConfig | ConvertFrom-Json
    $oacId = $oacResult.OriginAccessControl.Id
    Write-Host "  OAC created: $oacId" -ForegroundColor Green

    # Minimal distribution config
    $s3Origin = "$Bucket.s3.$REGION.amazonaws.com"
    $distConfig = @{
        CallerReference = [System.Guid]::NewGuid().ToString()
        Comment = "$Domain distribution"
        DefaultRootObject = "index.html"
        Enabled = $true
        HttpVersion = "http2"
        Origins = @{
            Quantity = 1
            Items = @(@{
                Id = "S3Origin"
                DomainName = $s3Origin
                S3OriginConfig = @{ OriginAccessIdentity = "" }
                OriginAccessControlId = $oacId
            })
        }
        DefaultCacheBehavior = @{
            TargetOriginId = "S3Origin"
            ViewerProtocolPolicy = "redirect-to-https"
            CachePolicyId = "658327ea-f89d-4fab-a63d-7e88639e58f6"   # CachingOptimized managed policy
            Compress = $true
        }
        CustomErrorResponses = @{
            Quantity = 1
            Items = @(@{ ErrorCode = 404; ResponseCode = 200; ResponsePagePath = "/index.html"; ErrorCachingMinTTL = 0 })
        }
        Aliases = @{ Quantity = 0; Items = @() }
        PriceClass = "PriceClass_100"
        ViewerCertificate = @{ CloudFrontDefaultCertificate = $true }
    } | ConvertTo-Json -Depth 10 -Compress

    $distResult = aws cloudfront create-distribution `
        --distribution-config $distConfig | ConvertFrom-Json
    $distId     = $distResult.Distribution.Id
    $distDomain = $distResult.Distribution.DomainName

    Write-Host "  Distribution ID  : $distId" -ForegroundColor Green
    Write-Host "  CloudFront domain: $distDomain" -ForegroundColor Green
    Write-Host "  Status: $($distResult.Distribution.Status) (may take a few minutes)" -ForegroundColor Yellow

    # Add bucket policy for OAC
    $bucketPolicy = @{
        Version = "2012-10-17"
        Statement = @(@{
            Sid = "AllowCloudFrontOAC"
            Effect = "Allow"
            Principal = @{ Service = "cloudfront.amazonaws.com" }
            Action = "s3:GetObject"
            Resource = "arn:aws:s3:::$Bucket/*"
            Condition = @{ StringEquals = @{ "AWS:SourceArn" = "arn:aws:cloudfront::$(aws sts get-caller-identity --query Account --output text):distribution/$distId" } }
        })
    } | ConvertTo-Json -Depth 10 -Compress
    aws s3api put-bucket-policy --bucket $Bucket --policy $bucketPolicy
    Write-Host "  Bucket policy updated." -ForegroundColor Green

    # Persist state
    @{ DistributionId = $distId; CloudFrontDomain = $distDomain; Bucket = $Bucket; Domain = $Domain } |
        ConvertTo-Json | Set-Content $STATE_FILE
    Write-Host "  State saved to $STATE_FILE" -ForegroundColor Green
    Write-Host ""
    Write-Host "  NEXT STEPS:" -ForegroundColor Cyan
    Write-Host "  1. Point your DNS CNAME $Domain -> $distDomain" -ForegroundColor White
    Write-Host "  2. Request an ACM certificate in us-east-1 for $Domain" -ForegroundColor White
    Write-Host "  3. Update the distribution aliases + viewer certificate once issued" -ForegroundColor White
}

function Invalidate-Cache {
    $state = @{}
    if (Test-Path $STATE_FILE) { $state = Get-Content $STATE_FILE | ConvertFrom-Json -AsHashtable }
    $distId = $state["DistributionId"]
    if (-not $distId) { Write-Host "  No distribution ID in state.json — run setup first." -ForegroundColor Red; return }

    Write-Host "`n[CloudFront] Invalidating $distId ..." -ForegroundColor Cyan
    $inv = aws cloudfront create-invalidation --distribution-id $distId --paths "/*" | ConvertFrom-Json
    Write-Host "  Invalidation $($inv.Invalidation.Id) submitted (~30s to propagate)." -ForegroundColor Green
}

# ── Main ─────────────────────────────────────────────────────────────────────
Write-Host "=== Solid App Deploy: $Action ===" -ForegroundColor Magenta
Write-Host "Domain : $Domain"
Write-Host "Bucket : $Bucket"
Write-Host ""

Check-Prerequisites

switch ($Action) {
    "setup" {
        Build-App
        Create-Bucket
        Sync-To-S3
        Create-CloudFront
    }
    "update" {
        Build-App
        Sync-To-S3
        Invalidate-Cache
    }
    "invalidate" {
        Invalidate-Cache
    }
}

Write-Host "`nDone." -ForegroundColor Green
