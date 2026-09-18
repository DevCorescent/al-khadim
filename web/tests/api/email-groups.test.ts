import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG, adminAuth, api, expectStatus, staffWithRole, testEmail } from './_client';
import { disconnectDb, prisma } from './_emailDb';

/** /emails/groups CRUD + members. */
describe('email groups', () => {
  let token: string;
  let viewer: Awaited<ReturnType<typeof staffWithRole>>;
  let groupId: string;
  let otherGroupId: string;
  const name = `Group ${TAG}`;

  before(async () => {
    token = await adminAuth();
    viewer = await staffWithRole('VIEWER');
  });

  after(async () => {
    await prisma.emailGroup.deleteMany({ where: { name: { contains: TAG } } });
    await viewer?.cleanup();
    await disconnectDb();
  });

  test('requires a token and an admin role', async () => {
    const calls: [string, string][] = [
      ['GET', '/emails/groups'], ['POST', '/emails/groups'], ['GET', '/emails/groups/x'],
      ['PUT', '/emails/groups/x'], ['DELETE', '/emails/groups/x'], ['POST', '/emails/groups/x/members'],
      ['DELETE', '/emails/groups/x/members/y'],
    ];
    for (const [method, path] of calls) {
      const b = method === 'POST' || method === 'PUT' ? {} : undefined;
      assert.equal((await api(method, path, b)).status, 401, `${method} ${path}`);
      assert.equal((await api(method, path, b, { token: viewer.token })).status, 403, `${method} ${path} as VIEWER`);
    }
  });

  test('create validates the name', async () => {
    expectStatus(await api('POST', '/emails/groups', {}, { token }), 400);
    expectStatus(await api('POST', '/emails/groups', { name: '   ' }, { token }), 400);
    expectStatus(await api('POST', '/emails/groups', { name: 42 }, { token }), 400);
    expectStatus(await api('POST', '/emails/groups', { name: `x ${TAG}`, description: { a: 1 } }, { token }), 400);
  });

  test('creates a group, ignoring server-managed fields', async () => {
    const res = await api('POST', '/emails/groups', {
      name: `  ${name}  `, description: 'Test group', createdBy: 'someone-else', id: 'forced',
    }, { token });
    expectStatus(res, 201);
    groupId = res.data.id;
    assert.notEqual(groupId, 'forced');
    assert.equal(res.data.name, name);
    assert.notEqual(res.data.createdBy, 'someone-else');

    const other = await api('POST', '/emails/groups', { name: `Other ${TAG}` }, { token });
    expectStatus(other, 201);
    otherGroupId = other.data.id;
    assert.equal(other.data.description, null);
  });

  test('duplicate names are rejected', async () => {
    const res = await api('POST', '/emails/groups', { name }, { token });
    expectStatus(res, 400);
    assert.match(res.data.error, /already exists/);
  });

  test('lists groups with member counts', async () => {
    const res = await api('GET', '/emails/groups', undefined, { token });
    expectStatus(res, 200);
    const row = res.data.find((g: any) => g.id === groupId);
    assert.equal(row.memberCount, 0);
    assert.equal(row.name, name);
  });

  test('updates name/description with validation', async () => {
    const res = await api('PUT', `/emails/groups/${groupId}`, { description: 'Renamed desc', createdBy: 'x' }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.description, 'Renamed desc');
    assert.equal(res.data.name, name);
    expectStatus(await api('PUT', `/emails/groups/${groupId}`, { name: '  ' }, { token }), 400);
    expectStatus(await api('PUT', `/emails/groups/${groupId}`, { name: `Other ${TAG}` }, { token }), 400);
    expectStatus(await api('PUT', `/emails/groups/${groupId}`, { name: 5 }, { token }), 400);
    expectStatus(await api('PUT', '/emails/groups/does-not-exist', { name: 'x' }, { token }), 404);
  });

  test('adds members directly, skipping invalid rows and duplicates', async () => {
    const members = [
      { recipientType: 'CANDIDATES', recipientId: `c1-${TAG}`, name: 'Alice', email: testEmail('alice') },
      { recipientType: 'CLIENTS', recipientId: `c2-${TAG}`, name: 'Bob', email: testEmail('bob') },
      { recipientType: 'ALIENS', recipientId: 'x', name: 'Bad', email: testEmail('bad') },
      { recipientType: 'USERS', recipientId: 'y', name: 'No email' },
    ];
    const res = await api('POST', `/emails/groups/${groupId}/members`, { members }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.added, 2);
    const again = await api('POST', `/emails/groups/${groupId}/members`, { members: members.slice(0, 1) }, { token });
    expectStatus(again, 200);
    assert.equal(again.data.added, 0);
  });

  test('bulk-adds everyone matching a filter', async () => {
    const res = await api('POST', `/emails/groups/${groupId}/members`, {
      recipientType: 'USERS', filters: { search: TAG },
    }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.added, 1); // just the VIEWER test user
  });

  test('member add validation and 404', async () => {
    expectStatus(await api('POST', `/emails/groups/${groupId}/members`, {}, { token }), 400);
    expectStatus(await api('POST', `/emails/groups/${groupId}/members`, { recipientType: 'ALIENS' }, { token }), 400);
    expectStatus(await api('POST', '/emails/groups/does-not-exist/members', { members: [] }, { token }), 404);
  });

  test('gets the group with paginated, searchable members', async () => {
    const res = await api('GET', `/emails/groups/${groupId}?page=1&limit=2`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.members.total, 3);
    assert.equal(res.data.members.data.length, 2);
    assert.equal(res.data.members.limit, 2);

    const search = await api('GET', `/emails/groups/${groupId}?search=alice`, undefined, { token });
    expectStatus(search, 200);
    assert.equal(search.data.members.total, 1);
    assert.equal(search.data.members.data[0].name, 'Alice');

    const junk = await api('GET', `/emails/groups/${groupId}?page=zz&limit=-3`, undefined, { token });
    expectStatus(junk, 200);
    assert.equal(junk.data.members.page, 1);
    assert.equal(junk.data.members.limit, 1);

    expectStatus(await api('GET', '/emails/groups/does-not-exist', undefined, { token }), 404);
  });

  test('removes a member, scoped to its group', async () => {
    const detail = await api('GET', `/emails/groups/${groupId}?search=bob`, undefined, { token });
    const memberId = detail.data.members.data[0].id;
    expectStatus(await api('DELETE', `/emails/groups/${otherGroupId}/members/${memberId}`, undefined, { token }), 404);
    const res = await api('DELETE', `/emails/groups/${groupId}/members/${memberId}`, undefined, { token });
    expectStatus(res, 200);
    expectStatus(await api('DELETE', `/emails/groups/${groupId}/members/${memberId}`, undefined, { token }), 404);
    const list = await api('GET', '/emails/groups', undefined, { token });
    assert.equal(list.data.find((g: any) => g.id === groupId).memberCount, 2);
  });

  test('deletes groups (members cascade), 404 afterwards', async () => {
    expectStatus(await api('DELETE', `/emails/groups/${groupId}`, undefined, { token }), 200);
    expectStatus(await api('DELETE', `/emails/groups/${otherGroupId}`, undefined, { token }), 200);
    expectStatus(await api('GET', `/emails/groups/${groupId}`, undefined, { token }), 404);
    expectStatus(await api('DELETE', `/emails/groups/${groupId}`, undefined, { token }), 404);
    assert.equal(await prisma.emailGroupMember.count({ where: { groupId } }), 0);
  });
});
