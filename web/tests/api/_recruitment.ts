/**
 * Fixtures shared by the recruitment-module tests (candidates, jobs, profile
 * shares, tracking, ...). Everything created here is removed by the returned
 * cleanup functions.
 */
import { TAG, api, expectStatus, testEmail } from './_client';

let seq = 0;
const uniq = () => `${TAG}${++seq}`;

export async function createCandidate(token: string, overrides: Record<string, any> = {}) {
  const n = uniq();
  const res = await api('POST', '/candidates', {
    firstName: 'Test', lastName: `Candidate ${n}`, email: testEmail(`cand${n}`), phone: '+971500000001',
    ...overrides,
  }, { token });
  expectStatus(res, 201);
  return res.data;
}

export async function deleteCandidate(token: string, id: string) {
  if (id) await api('DELETE', `/candidates/${id}`, undefined, { token });
}

export async function createClient(token: string, overrides: Record<string, any> = {}) {
  const n = uniq();
  const res = await api('POST', '/clients', {
    companyName: `Test Co ${n}`, contactPerson: 'Test Contact', email: testEmail(`client${n}`), phone: '+971500000002',
    ...overrides,
  }, { token });
  expectStatus(res, 201);
  if (res.data.status && res.data.status !== 'APPROVED') {
    expectStatus(await api('PATCH', `/clients/${res.data.id}/approve`, {}, { token }), 200);
  }
  return res.data;
}

export async function createJob(token: string, clientId: string, overrides: Record<string, any> = {}) {
  const res = await api('POST', '/jobs', { title: `Test Job ${uniq()}`, clientId, ...overrides }, { token });
  expectStatus(res, 201);
  return res.data;
}

/** Transactional emails are logged to the scheduled-emails history; returns the ones sent to `to`. */
export async function sentEmails(token: string, to: string) {
  const res = await api('GET', `/emails/scheduled?search=${encodeURIComponent(to)}&limit=50`, undefined, { token });
  expectStatus(res, 200);
  return (res.data.data as any[]).filter((e) => e.to === to);
}

/**
 * Creates a company-portal user for `clientId`, accepts the invite and returns
 * its access token. The invite token comes from the create response when it is
 * exposed there, otherwise from the invite email in the send history.
 */
export async function companyUser(token: string, clientId: string, role = 'COMPANY_ADMIN') {
  const email = testEmail(`portal${uniq()}`);
  const created = await api('POST', '/client-users', { clientId, name: 'Portal Tester', email, role }, { token });
  expectStatus(created, 201);
  let inviteToken: string | undefined = created.data.inviteToken;
  if (!inviteToken) {
    const mails = await sentEmails(token, email);
    const html = mails.map((m) => m.html || '').join('\n');
    inviteToken = /accept-invite\/([a-f0-9]{64})|invite\/([a-f0-9]{64})|token=([a-f0-9]{64})|([a-f0-9]{64})/.exec(html)?.slice(1).find(Boolean);
  }
  if (!inviteToken) throw new Error('Could not find the invite token for the portal user');
  const accepted = await api('POST', `/client-auth/accept-invite/${inviteToken}`, { password: 'Portal@12345' });
  expectStatus(accepted, 200);
  return {
    id: created.data.id as string,
    email,
    token: accepted.data.accessToken as string,
    cleanup: () => api('DELETE', `/client-users/${created.data.id}`, undefined, { token }),
  };
}

/** A tracking-enabled industry with a small template covering every field kind. */
export async function createTrackingIndustry(token: string) {
  const res = await api('POST', '/industries', {
    name: `Test Tracking ${uniq()}`,
    hasTracking: true,
    trackingSections: [
      {
        key: 'onboarding', label: 'Onboarding',
        fields: [
          { key: 'site', label: 'Site', type: 'text' },
          { key: 'years', label: 'Years', type: 'number' },
          { key: 'docs', label: 'Docs', type: 'checklist', items: ['Passport', 'Visa'] },
          { key: 'certs', label: 'Certs', type: 'table', columns: [{ key: 'name', label: 'Name' }, { key: 'year', label: 'Year', type: 'number' }] },
        ],
      },
    ],
  }, { token });
  expectStatus(res, 201);
  return res.data;
}
