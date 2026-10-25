/* Presentation metadata. Facility/store/note overrides remain separate. */
(function(root) {
  const romanizedNames={
    '滝沢':'Takizawa','茅ヶ崎中央':'Chigasaki-chuo','狭山':'Sayama','坂東':'Bando',
    '大網白里':'Oamishirasato','茂原長柄':'Mobara-Nagara','大泉':'Oizumi','松代':'Matsushiro','小布施':'Obuse',
    '東京':'Tokyo','綾瀬':'Ayase','海老名':'Ebina','厚木':'Atsugi','伊勢原':'Isehara','秦野中井':'Hadano-Nakai',
    '大井松田':'Oi-Matsuda','鮎沢':'Ayuzawa','足柄':'Ashigara','富士':'Fuji','清水':'Shimizu',
    '日本平久能山':'Nihondaira-Kunozan','大井川焼津藤枝':'Oigawa-Yaizu-Fujieda','吉田':'Yoshida',
    '相良牧之原':'Sagara-Makinohara','菊川':'Kikugawa','掛川':'Kakegawa','袋井':'Fukuroi','磐田':'Iwata',
    '遠州豊田':'Enshu-Toyoda','浜松':'Hamamatsu','浜松西':'Hamamatsu-nishi','舘山寺':'Kanzanji','浜名湖':'Hamanako',
    '三ヶ日':'Mikkabi','豊橋':'Toyohashi','豊川':'Toyokawa','音羽蒲郡':'Otowa-Gamagori','愛鷹':'Ashitaka',
    '厚木南':'Atsugi-minami','伊勢原大山':'Isehara-Oyama','新秦野':'Shin-Hadano','新御殿場':'Shin-Gotemba',
    '長泉沼津':'Nagaizumi-Numazu','駿河湾沼津':'Surugawan-Numazu','新富士':'Shin-Fuji','新清水':'Shin-Shimizu',
    '静岡':'Shizuoka','藤枝岡部':'Fujieda-Okabe','藤枝':'Fujieda','島田金谷':'Shimada-Kanaya',
    '遠州森町':'Enshu-Morimachi','新磐田':'Shin-Iwata','浜松いなさ':'Hamamatsu-Inasa','新城':'Shinshiro',
    '長篠設楽原':'Nagashino-Shitaragahara','岡崎東':'Okazaki-higashi','湾岸弥富':'Wangan-Yatomi',
    '弥富木曽岬':'Yatomi-Kisosaki','安濃':'Ano',
    '高滝湖':'Takatakiko','小黒川':'Ogurogawa','小笠':'Ogasa','三方原':'Mikatahara','嬉野':'Ureshino',
  };
  const baseName=name=>String(name||'').normalize('NFKC').replace(/\s/g,'')
    .replace(/(?:SA|PA)?スマート(?:IC|インターチェンジ)?$/i,'').replace(/(?:SA|PA|IC)$/i,'');
  function romanizedName(point) {
    const name=baseName(point.name);
    if(romanizedNames[name])return romanizedNames[name];
    return String(point.romanizedName||'').normalize('NFKC')
      .replace(/\b(?:S\.?A\.?|P\.?A\.?|I\.?C\.?|JCT|Junction|Smart|Parking)\b\.?/gi,'')
      .replace(/\s*\/\s*$/,'').replace(/\s+/g,' ').trim();
  }
  // Operator service-area smart-IC lists: these associations are independent
  // of the imported ramp coordinates (which can be >600m from the area exit).
  const associatedAreas={
    e4:new Set(['蓮田','佐野','都賀西方','上河内','矢板北','那須高原','鏡石','福島松川','菅生','三本木','長者原','北上金ヶ崎','矢巾']),
    'e1a-shintomei':new Set(['駿河湾沼津','静岡','遠州森町','浜松']),
  };
  function colocated(area,ic) {
    if(area.linkID!==ic.linkID||baseName(area._sourceName||area.name)!==baseName(ic._sourceName||ic.name))return false;
    const family=Object.keys(associatedAreas).find(id=>area.linkID.startsWith(id+'-'));
    return associatedAreas[family]?.has(baseName(area._sourceName||area.name))||Math.abs(area.offsetMeters-ic.offsetMeters)<600;
  }
  function groupedPoints(points) {
    const consumed=new Set(),groups=[];
    for(const area of points.filter(point=>!point.hidden&&['SA','PA'].includes(point.kind))) {
      const partners=points.filter(ic=>!ic.hidden&&ic.kind==='IC'&&colocated(area,ic));
      for(const partner of partners)consumed.add(partner.id);
      consumed.add(area.id);
      const members=[area,...partners];
      groups.push({...area,romanizedName:romanizedName(area),kinds:partners.length?[area.kind,'IC']:[area.kind],
        correctionPoints:members.map(point=>({pointId:point.id,originalOffsetMeters:point.offsetMeters}))});
    }
    for(const point of points)if(!point.hidden&&!consumed.has(point.id))groups.push({...point,romanizedName:romanizedName(point),kinds:[point.kind],correctionPoints:[{pointId:point.id,originalOffsetMeters:point.offsetMeters}]});
    return groups;
  }
  const helpers={romanizedName,groupedPoints,baseName};
  root.HighwayNavigationData=helpers;
  if(typeof module!=='undefined')module.exports=helpers;
})(globalThis);
