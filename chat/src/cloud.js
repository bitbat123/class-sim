import cloudbase from '@cloudbase/js-sdk';

const ENV_ID = 'interim-toucan-d4g2tnti4470549e1';
const PUBLISHABLE_KEY = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImJiZDBjZTU4LWUwNmUtNDRhZC04N2I2LWZlYWU2MjkzZmUwOSJ9.eyJpc3MiOiJodHRwczovL2ludGVyaW0tdG91Y2FuLWQ0ZzJ0bnRpNDQ3MDU0OWUxLmFwLXNoYW5naGFpLnRjYi1hcGkudGVuY2VudGNsb3VkYXBpLmNvbSIsInN1YiI6ImFub24iLCJhdWQiOiJpbnRlcmltLXRvdWNhbi1kNGcydG50aTQ0NzA1NDllMSIsImV4cCI6NDA5ODA3NTU5MiwiaWF0IjoxNzk0MzkyMzkyLCJub25jZSI6ImJKY04zLVN6UVFLTHdGSDNYN3NGQVEiLCJhdF9oYXNoIjoiYkpjTjMtU3pRUUtMd0ZIM1g3c0ZBUSIsIm5hbWUiOiJBbm9ueW1vdXMiLCJzY29wZSI6ImFub255bW91cyIsInByb2plY3RfaWQiOiJpbnRlcmltLXRvdWNhbi1kNGcydG50aTQ0NzA1NDllMSIsIm1ldGEiOnsicGxhdGZvcm0iOiJQdWJsaXNoYWJsZUtleSJ9LCJyb2xlIjoiYW5vbiIsImlzX2Fub255bW91cyI6dHJ1ZSwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiYW5vbnltb3VzIiwicHJvdmlkZXJzIjpbImFub255bW91cyJdfSwidXNlcl9tZXRhZGF0YSI6eyJuYW1lIjoiQW5vbnltb3VzIn0sInVzZXJfdHlwZSI6IiIsImNsaWVudF90eXBlIjoiY2xpZW50X3VzZXIiLCJpc19zeXN0ZW1fYWRtaW4iOmZhbHNlfQ.TTEpUSgY-NO9zDk0yADRFc1BXgTvXR9KbmIhXLAJ-PvQrgvGQMF9IpdYc-flXJRL6VqUKgrpKQO8flZyd5sDJwA5x1h_Hz94mJCr2NwxYzzXKdmmlA4H90JtSkikanfY63pdjRgoDvWGICby4z4d6bMlEurxq8axk1T7MpelcqTYcOhEWPkmT2vV-s77GGihHw16eePpg0w2ip7d8__r3lyXTEQ7AXJ4_M5aMGF6on1_zjnYXip8MUgX1Dc9GXJYooNtSUp6eJtUivCT4zgAZgEkrLAiqrNJG1UapkBeeRL7T3uLivu6rbO9ySGSzm2kAmRETEX8Q0zWHrw3hjbjtg';

let app = null;
function getApp() {
  if (!app) app = cloudbase.init({ env: ENV_ID, persistence: 'local', accessKey: PUBLISHABLE_KEY });
  return app;
}

const SHARED_USER = 'Temp';
const SHARED_PASSWORD = 'TestTest123';
let loginPromise = null;

async function ensureSharedLogin() {
  if (!loginPromise) {
    loginPromise = getApp().auth().signInWithPassword({ username: SHARED_USER, password: SHARED_PASSWORD })
      .then((r) => { if (r.error) throw new Error('共享账号登录失败：' + r.error.message); })
      .catch((e) => { loginPromise = null; throw e; });
  }
  return loginPromise;
}

export async function callAuth(action, payload = {}) {
  await ensureSharedLogin();
  const token = localStorage.getItem('authToken');
  const data = { action, ...payload };
  if (token && data.token === undefined) data.token = token;
  const res = await getApp().callFunction({ name: 'auth', data });
  return res.result;
}

export const getToken = () => localStorage.getItem('authToken');
