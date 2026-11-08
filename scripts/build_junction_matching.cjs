// Supplemental matching geometry only; does not rewrite facilities or offsets.
const fs=require('node:fs');
const path=require('node:path');
const {junctionsFromPoints,distance}=require('../pages/road-matcher.js');
const root=path.resolve(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'web/data/regional-expressways.json'),'utf8'));
const raw=JSON.parse(fs.readFileSync(path.join(root,'data-osm-ramps.json'),'utf8'));
const junctions=junctionsFromPoints(data.links,data.points);
const localFile=path.join(root,'web/data/local-roads.json');
const localRamps=fs.existsSync(localFile)?JSON.parse(fs.readFileSync(localFile,'utf8')).junctionRamps||[]:[];
for(const junction of junctions) {
  junction.ramps=raw.elements.filter(way=>way.tags?.highway==='motorway_link'&&way.geometry?.length>1)
    .map(way=>way.geometry.map(point=>({latitude:point.lat,longitude:point.lon})))
    .filter(line=>line.some(coordinate=>junction.anchors.some(anchor=>distance(coordinate,anchor.coordinate)<2000)));
  junction.ramps.push(...localRamps.filter(line=>line.some(coordinate=>junction.anchors.some(anchor=>distance(coordinate,anchor.coordinate)<2000))));
  console.log(`${junction.name}: ${junction.anchors.length} directions, ${junction.ramps.length} ramp segments`);
}
fs.writeFileSync(path.join(root,'web/data/junction-matching.json'),JSON.stringify({version:1,sourceAttribution:'Ramp geometry © OpenStreetMap contributors, ODbL 1.0. Supplemental matching data; does not select a planned route.',junctions})+'\n');
