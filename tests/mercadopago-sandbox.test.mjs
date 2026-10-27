import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
test('fresh managed test schema bootstraps all app migrations without copying production users',async()=>{
 const db=new PGlite()
 try{
  // Only substitutes managed services. Never install this harness on Supabase.
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
   grant usage on schema auth,storage,public to anon,authenticated,service_role;
   create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   create table storage.objects(id uuid primary key,owner_id text);alter table storage.objects enable row level security;`)
  await db.exec(fs.readFileSync('supabase/sandbox/00_base_app.sql','utf8'))
  const id='00000000-0000-4000-8000-000000000001'
  await db.query('insert into auth.users(id) values($1)',[id])
  for(const file of fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'))
  assert.equal((await db.query('select count(*)::integer as n from public.perfiles')).rows[0].n,1)
  assert.equal((await db.query('select public.privacy_registration_ready() as ready')).rows[0].ready,false)
  assert.equal((await db.query("select has_function_privilege('authenticated','public.mp_test_store(text,jsonb)','execute') as allowed")).rows[0].allowed,false)
  await assert.rejects(db.exec(fs.readFileSync('supabase/sandbox/00_base_app.sql','utf8')),/not an empty test project/)
  await db.exec('rollback')
 }finally{await db.close()}
})
