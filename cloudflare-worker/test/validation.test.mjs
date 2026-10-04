import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeUpdate} from '../src/index.js';

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
