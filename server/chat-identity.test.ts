import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { MemberStore } from './members.ts';
import { BirthdayStore } from './birthdays.ts';
import { userIdentity } from '../src/game/identity.ts';
import { directoryPeople } from '../src/game/directory.ts';
import { parseClientMessage } from '../src/network/protocol.ts';
import { buildAuthEnv } from '../scripts/azure/auth-config.ts';
const accountId = 'entra:11111111-1111-1111-1111-111111111111:22222222-2222-2222-2222-222222222222';
test('Microsoft directory and birthdays persist under the same account after a name/email change', async t=>{
  const dir=await mkdtemp(join(tmpdir(),'waiwai-identity-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const user={name:'はな',accountId,email:'before@example.test'}; const members=new MemberStore(join(dir,'members.json'));await members.remember(user);await members.remember({...user,email:'after@example.test',name:'はな新'});
  const restored=new MemberStore(join(dir,'members.json'));assert.equal(restored.list().length,1);assert.equal(directoryPeople(restored.list(),[])[0].verified,true);assert.equal(directoryPeople(restored.list(),[])[0].online,false);
  const now=Date.parse('2026-10-18T12:00:00+09:00'),birthdays=new BirthdayStore(join(dir,'birthdays.json'),()=>now);
  await birthdays.apply({type:'birthday-save',month:10,day:18,expectedVersion:0,actionId:randomUUID()},userIdentity(user),user.name,()=>true);
  const reloaded=new BirthdayStore(join(dir,'birthdays.json'),()=>now);assert.equal(reloaded.snapshot(accountId).persistent,true);assert.equal(reloaded.snapshot(accountId).entries[0].id,accountId);
  assert.ok(parseClientMessage(JSON.stringify({type:'birthday-comment',id:accountId,date:'2026-10-18',text:'おめでとう！',actionId:randomUUID()})));
});
test('Azure deployment enables Microsoft-required login without requiring Slack credentials',()=>{
  const env=buildAuthEnv({ENTRA_TENANT_ID:'11111111-1111-1111-1111-111111111111',ENTRA_CLIENT_ID:'33333333-3333-3333-3333-333333333333',ENTRA_CLIENT_SECRET:'test-only',ENTRA_MFA_POLICY_ID:'44444444-4444-4444-4444-444444444444'},'office.example');
  assert.equal(env.REQUIRE_ENTRA_LOGIN,'true'); assert.equal(env.ENTRA_REDIRECT_URI,'https://office.example/auth/microsoft/callback');assert.equal(env.SLACK_CLIENT_ID,undefined);assert.throws(()=>buildAuthEnv({},'office.example'));
});
