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
