$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$packageRoot = Join-Path $projectRoot "HighwayAssistPlayground.swiftpm"
$sourceRoot = Join-Path $packageRoot "Sources\AppModule"
$resourceRoot = Join-Path $sourceRoot "Resources"

New-Item -ItemType Directory -Force -Path $sourceRoot | Out-Null
New-Item -ItemType Directory -Force -Path $resourceRoot | Out-Null

$sourceFolders = @("App", "Domain", "Infrastructure", "Services", "Presentation")
foreach ($folder in $sourceFolders) {
    $inputFolder = Join-Path $projectRoot "HighwayAssist\$folder"
    Get-ChildItem -LiteralPath $inputFolder -Filter "*.swift" | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $sourceRoot -Force
    }
}

Copy-Item -LiteralPath (Join-Path $projectRoot "HighwayAssist\Resources\test_highway.json") -Destination $resourceRoot -Force
Copy-Item -LiteralPath (Join-Path $projectRoot "HighwayAssist\Resources\real_highway.json") -Destination $resourceRoot -Force
Write-Host "Updated $packageRoot"
