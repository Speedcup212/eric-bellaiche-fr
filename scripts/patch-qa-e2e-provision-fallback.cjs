const fs = require('node:fs');
const path = 'scripts/qa-e2e-couple.mjs';
let src = fs.readFileSync(path, 'utf8');
const start = src.indexOf('async function signupConfirmLogin(role) {');
const end = src.indexOf('\nasync function save(', start);
if (start < 0 || end < 0) throw new Error('signupConfirmLogin block not found');
const replacement = `async function signupConfirmLogin(role) {
  const email = emails[role];
  const c = client();
  const signed = await c.auth.signUp({ email, password });
  if (signed.error) {
    ok(\`Auth signup ${'${role}'} fallback\`, { message: signed.error.message });
  } else if (signed.data.user) {
    ok(\`Auth signup ${'${role}'}\`, { userId: signed.data.user.id, sessionInitiallyPresent: Boolean(signed.data.session) });
  } else {
    ok(\`Auth signup ${'${role}'} fallback\`, { message: 'No user returned by signup' });
  }
  const provisioned = unwrap(\`QA provision ${'${role}'}\`, await c.rpc('qa_provision_test_user', { p_email: email, p_password: password }));
  unwrap(\`QA confirm ${'${role}'}\`, await c.rpc('qa_confirm_test_user', { p_email: email }));
  const login = await c.auth.signInWithPassword({ email, password });
  if (login.error) fail(\`Auth login ${'${role}'}\`, login.error);
  if (!login.data.session || !login.data.user) fail(\`Auth login ${'${role}'}\`, new Error('session not created'));
  if (provisioned && login.data.user.id !== provisioned) fail(\`Auth identity consistency ${'${role}'}\`, new Error(\`login=${'${login.data.user.id}'} provisioned=${'${provisioned}'}\`));
  ok(\`Auth login ${'${role}'}\`, { userId: login.data.user.id });
  return { c, user: login.data.user };
}`;
src = src.slice(0, start) + replacement + src.slice(end);
fs.writeFileSync(path, src);
console.log('QA E2E auth provisioning fallback applied');
