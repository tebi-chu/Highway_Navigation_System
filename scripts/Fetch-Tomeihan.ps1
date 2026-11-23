$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
foreach($taskRoad in @(@{direction='down';relation=7573693},@{direction='up';relation=7573695})) {
    $taskCache=Join-Path $taskRoot "data-osm-tomeihan-$($taskRoad.direction).json"
    if(Test-Path -LiteralPath $taskCache){continue}
    Start-Sleep -Seconds 1
    $taskRoadData=Invoke-RestMethod -Uri "https://www.openstreetmap.org/api/0.6/relation/$($taskRoad.relation)/full.json" -Headers @{'User-Agent'='Highway-Navigation-System route verification'} -TimeoutSec 30
    $taskRoadData | ConvertTo-Json -Depth 100 -Compress | Set-Content -LiteralPath $taskCache -Encoding utf8
}
