import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{normalizeLocationCorrection,normalizeUpdate} from '../src/index.js';

test('accepts a known facility update',()=>{
  assert.deepEqual(normalizeUpdate({pointId:'e4-north-1',roadId:'e4-north',facilities:['restaurant','fuel'],brands:['matsuya']}),{
    pointId:'e4-north-1',roadId:'e4-north',facilities:['restaurant','fuel'],brands:['matsuya'],
  });
});

test('rejects unknown values and unsafe ids',()=>{
  assert.throws(()=>normalizeUpdate({pointId:'<script>',roadId:'e4',facilities:[],brands:[]}));
  assert.throws(()=>normalizeUpdate({pointId:'e4-1',roadId:'e4',facilities:['unknown'],brands:[]}));
});

test('accepts display name and hidden state',()=>{
  assert.deepEqual(normalizeUpdate({pointId:'e4-north-1',roadId:'e4-north',facilities:[],brands:[],displayName:'仙台宮城',hidden:true}),{
    pointId:'e4-north-1',roadId:'e4-north',facilities:[],brands:[],displayName:'仙台宮城',hidden:true,
  });
  assert.throws(()=>normalizeUpdate({pointId:'e4-north-1',roadId:'e4-north',facilities:[],brands:[],displayName:'<script>',hidden:false}));
});

test('accepts and validates a short note',()=>{
  assert.deepEqual(normalizeUpdate({pointId:'e4-north-1',roadId:'e4-north',facilities:[],brands:[],note:'  景色がきれい  '}),{
    pointId:'e4-north-1',roadId:'e4-north',facilities:[],brands:[],note:'景色がきれい',
  });
  assert.throws(()=>normalizeUpdate({pointId:'e4-north-1',roadId:'e4-north',facilities:[],brands:[],note:'あ'.repeat(41)}));
  assert.throws(()=>normalizeUpdate({pointId:'e4-north-1',roadId:'e4-north',facilities:[],brands:[],note:'<b>危険</b>'}));
});

test('accepts a recent and accurate location correction',()=>{
  const capturedAt=Date.now();
  assert.deepEqual(normalizeLocationCorrection({roadId:'e4-north',points:[{pointId:'e4-north-1',originalOffsetMeters:12000}],offsetMeters:11350,latitude:38.2,longitude:140.9,accuracyMeters:8,capturedAt}),{
    roadId:'e4-north',points:[{pointId:'e4-north-1',originalOffsetMeters:12000}],offsetMeters:11350,latitude:38.2,longitude:140.9,accuracyMeters:8,capturedAt,
  });
});

test('rejects unsafe or unreliable location corrections',()=>{
  const base={roadId:'e4-north',points:[{pointId:'e4-north-1',originalOffsetMeters:12000}],offsetMeters:11350,latitude:38.2,longitude:140.9,accuracyMeters:8,capturedAt:Date.now()};
  assert.throws(()=>normalizeLocationCorrection({...base,accuracyMeters:31}));
  assert.throws(()=>normalizeLocationCorrection({...base,offsetMeters:8000}));
  assert.throws(()=>normalizeLocationCorrection({...base,capturedAt:Date.now()-5*60*1000-1}));
  assert.throws(()=>normalizeLocationCorrection({...base,points:[{pointId:'<bad>',originalOffsetMeters:12000}]}));
});

test('requires a registered Google editor before saving a location correction',async()=>{
  const request=new Request('https://worker.example/v1/location-corrections',{method:'POST',headers:{origin:'https://example.com','content-type':'application/json'},body:JSON.stringify({})});
  const response=await worker.fetch(request,{ALLOWED_ORIGINS:'https://example.com'});
  assert.equal(response.status,403);
  assert.match((await response.json()).error,/Googleログイン/);
});
