$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
$taskQueries=@('伊豆縦貫自動車道','東駿河湾環状道路','天城北道路','河津下田道路','伊豆中央道','修善寺道路','箱根新道','ターンパイク','保土ヶ谷バイパス','横浜新道')
function Get-RoadJSON([string]$Url) {
    Start-Sleep -Seconds 1
    Invoke-RestMethod -Uri $Url -TimeoutSec 30 -Headers @{'User-Agent'='Highway-Navigation-System data verification'}
}
$taskConnectorCache=Join-Path $taskRoot 'data-osm-local-10.json'
if(-not(Test-Path -LiteralPath $taskConnectorCache)) {
    Write-Output 'Fetching Kannami connector'
    $taskSeeds=Get-RoadJSON ('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=50&dedupe=0&viewbox=138.91,35.105,138.96,35.065&bounded=1&q='+[uri]::EscapeDataString('伊豆縦貫自動車道'))
    $taskElements=[System.Collections.Generic.List[object]]::new()
    foreach($taskSeed in $taskSeeds | Where-Object osm_type -eq 'way') {
        $taskFull=Get-RoadJSON "https://www.openstreetmap.org/api/0.6/way/$($taskSeed.osm_id)/full.json"
        foreach($taskElement in $taskFull.elements){$taskElements.Add($taskElement)}
    }
    @{elements=$taskElements.ToArray();relationIDs=@()} | ConvertTo-Json -Depth 100 -Compress | Set-Content -LiteralPath $taskConnectorCache -Encoding utf8
}
$taskBridgeCache=Join-Path $taskRoot 'data-osm-local-12.json'
if(-not(Test-Path -LiteralPath $taskBridgeCache)) {
    # Open Kawazu bridge, not yet included in the road relation.
    $taskBridge=Get-RoadJSON 'https://www.openstreetmap.org/api/0.6/way/1155458762/full.json'
    $taskBridge | ConvertTo-Json -Depth 100 -Compress | Set-Content -LiteralPath $taskBridgeCache -Encoding utf8
}
@{elements=@();relationIDs=@()} | ConvertTo-Json -Depth 10 -Compress | Set-Content -LiteralPath (Join-Path $taskRoot 'data-osm-local-0.json') -Encoding utf8
for($taskIndex=1;$taskIndex -lt $taskQueries.Count;$taskIndex++) {
    $taskQuery=$taskQueries[$taskIndex]
    $taskCache=Join-Path $taskRoot "data-osm-local-$taskIndex.json"
    if(Test-Path -LiteralPath $taskCache){Write-Output "$taskQuery cached";continue}
    Write-Output "Fetching $taskQuery"
    $taskSeeds=Get-RoadJSON ('https://nominatim.openstreetmap.org/search?format=jsonv2&q='+[uri]::EscapeDataString($taskQuery))
    $taskRelations=@{}
    foreach($taskSeed in $taskSeeds) {
        if($taskSeed.osm_type -eq 'way'){$taskParents=Get-RoadJSON "https://www.openstreetmap.org/api/0.6/way/$($taskSeed.osm_id)/relations.json"}
        elseif($taskSeed.osm_type -eq 'relation'){$taskParents=Get-RoadJSON "https://www.openstreetmap.org/api/0.6/relation/$($taskSeed.osm_id).json"}
        else{continue}
        foreach($taskRelation in $taskParents.elements) {
            $taskName=[string]$taskRelation.tags.name
            if($taskRelation.tags.route -eq 'road' -and ($taskName.Contains($taskQuery) -or $taskName.Contains($taskQuery.Replace('ヶ','ケ')))){$taskRelations[[string]$taskRelation.id]=$taskRelation.id}
        }
        if($taskRelations.Count){break}
    }
    $taskElements=[System.Collections.Generic.List[object]]::new()
    foreach($taskRelationID in $taskRelations.Values) {
        $taskFull=Get-RoadJSON "https://www.openstreetmap.org/api/0.6/relation/$taskRelationID/full.json"
        foreach($taskElement in $taskFull.elements){$taskElements.Add($taskElement)}
    }
    if(-not $taskElements.Count) {
        $taskSeeds=Get-RoadJSON ('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=50&dedupe=0&countrycodes=jp&q='+[uri]::EscapeDataString($taskQuery))
        foreach($taskSeed in $taskSeeds | Where-Object osm_type -eq 'way') {
            $taskFull=Get-RoadJSON "https://www.openstreetmap.org/api/0.6/way/$($taskSeed.osm_id)/full.json"
            foreach($taskElement in $taskFull.elements){$taskElements.Add($taskElement)}
        }
    }
    @{elements=$taskElements.ToArray();relationIDs=@($taskRelations.Values)} | ConvertTo-Json -Depth 100 -Compress | Set-Content -LiteralPath $taskCache -Encoding utf8
    Write-Output "$taskQuery : $($taskElements.Count) elements, $($taskRelations.Count) relations"
}
$taskMaps=@(
    '138.922,35.067,138.947,35.086',
    '139.043,35.178,139.057,35.190',
    '139.095,35.211,139.121,35.231',
    '139.074,35.195,139.101,35.215',
    '139.535,35.419,139.544,35.428',
    '139.565,35.445,139.578,35.457',
    '139.565,35.435,139.580,35.447'
)
for($taskIndex=0;$taskIndex -lt $taskMaps.Count;$taskIndex++) {
    $taskMapCache=Join-Path $taskRoot "data-osm-local-map-$taskIndex.json"
    if(Test-Path -LiteralPath $taskMapCache){continue}
    Write-Output "Map $taskIndex"
    $taskMap=Get-RoadJSON ('https://www.openstreetmap.org/api/0.6/map.json?bbox='+$taskMaps[$taskIndex])
    $taskMap | ConvertTo-Json -Depth 100 -Compress | Set-Content -LiteralPath $taskMapCache -Encoding utf8
}
