import 'dotenv/config';
import express from 'express';
import fs from 'fs/promises';
import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_FILE_PATH = path.join(__dirname, '.env');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const IS_VERCEL = Boolean(process.env.VERCEL);
const HOST_ID = String(process.env.MOMENCE_HOST_ID || '13752');
const MOMENCE_API_BASE = 'https://api.momence.com/api/v2';
const AUTHORIZE_URL = `${MOMENCE_API_BASE}/auth/authorize`;
const TOKEN_URL = `${MOMENCE_API_BASE}/auth/token`;
const TOKEN_REFRESH_SKEW_MS = 60_000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_MEMBERSHIP_ACTION_DAYS = 30;
const ACTIVITY_SPREADSHEET_ID = process.env.ACTIVITY_SPREADSHEET_ID || '1tmrT6ZNWRzWdvG5H31bBLAfTz4nd8G6vMjqRjrsMbLI';
const ACTIVITY_SHEET_NAME = process.env.ACTIVITY_SHEET_NAME || 'Activity';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN || '';

const MOMENCE_CLIENT_ID = process.env.MOMENCE_CLIENT_ID || '';
const MOMENCE_CLIENT_SECRET = process.env.MOMENCE_CLIENT_SECRET || '';
const MOMENCE_REDIRECT_URI = process.env.MOMENCE_REDIRECT_URI || process.env.MOMENCE_REDIRECT_URL || '';
const MOMENCE_SCOPE = process.env.MOMENCE_SCOPE || 'public-api-v2';
let currentMomenceBasicAuth = process.env.MOMENCE_BASIC_AUTH || '';
const MOMENCE_API_USERNAME = process.env.MOMENCE_API_USERNAME || process.env.MOMENCE_USER_EMAIL || '';
const MOMENCE_API_PASSWORD = process.env.MOMENCE_API_PASSWORD || process.env.MOMENCE_USER_PASSWORD || '';
const MOMENCE_X_APP = process.env.MOMENCE_X_APP || '';
const MOMENCE_HISTORY_COOKIE = process.env.MOMENCE_HISTORY_COOKIE || '';
const MOMENCE_USE_HISTORY_ENDPOINT = process.env.MOMENCE_USE_HISTORY_ENDPOINT === 'true';

const tokenStore = {
  accessToken: process.env.MOMENCE_ACCESS_TOKEN || '',
  refreshToken: process.env.MOMENCE_REFRESH_TOKEN || '',
  expiresAt: Number(process.env.MOMENCE_ACCESS_TOKEN_EXPIRES_AT || 0),
};

let cachedSheetsClient = null;

const FREEZE_POLICY_ROWS = [
  ['Barre 1 month Unlimited', 1, 30],
  ['Barre 2 week Unlimited', 0, 14],
  ['Barre 3 months Unlimited', 3, 90],
  ['Barre 6 month Unlimited', 6, 180],
  ['Barre Annual Membership', 12, 365],
  ['powerCycle 1 month Unlimited', 1, 30],
  ['powerCycle 2 week Unlimited', 0, 14],
  ['powerCycle 3 months Unlimited', 3, 90],
  ['powerCycle 6 months Unlimited', 6, 180],
  ['powerCycle Annual Membership', 12, 365],
  ['Strength Lab 1 month Unlimited', 1, 30],
  ['Strength Lab 2 week Unlimited', 0, 14],
  ['Strength Lab 3 months Unlimited', 3, 90],
  ['Strength Lab 6 months Unlimited', 6, 180],
  ['Strength Lab Annual Membership', 12, 365],
  ['Studio 1 Month Unlimited Membership', 1, 30],
  ['Studio 10 Single Class Pack', 2, 70],
  ['Studio 12 Class Package', 2, 45],
  ['Studio 2 Week Unlimited Membership', 0, 14],
  ['Studio 20 Single Class Pack', 4, 105],
  ['Studio 3 Month U/L Monthly Installment', 1, 30],
  ['Studio 3 Month Unlimited Membership', 3, 90],
  ['Studio 30 Single Class Pack', 5, 140],
  ['Studio 4 Class Package', 0, 14],
  ['Studio 6 Month Unlimited Membership', 6, 180],
  ['Studio 8 Class Package', 1, 30],
  ['Studio Annual Membership - Monthly Intsallment', 1, 30],
  ['Studio Annual Unlimited Membership', 12, 365],
  ['Studio Extended 10 Single Class Pack', 3, 90],
  ['Studio Happy Hour Private', 0, 7],
  ['Studio Newcomers 2 Week Unlimited Membership', 0, 14],
  ['Studio Private - Anisha (Single Class)', 0, 7],
  ['Studio Private Class', 0, 7],
  ['Studio Private Class X 10', 2, 70],
  ['Studio Privates - Anisha x 10', 2, 70],
  ['Summer Bootcamp - Studio 6 Week Unlimited', 1, 42],
  ['Virtual Private - Anisha', 0, 7],
  ['Virtual Private Class', 0, 7],
  ['Virtual Private Class X 10', 2, 70],
  ['Virtual Privates - Anisha x 10', 17, 500],
];

const FREEZE_POLICY_MAP = new Map(
  FREEZE_POLICY_ROWS.map(([name, attempts, days]) => [normalizeMembershipName(name), { name, attempts, days }]),
);

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function normalizeMembershipName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ');
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatUtcIsoWithoutMilliseconds(value) {
  const isoString = value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  return isoString.replace(/\.\d{3}Z$/, 'Z');
}

function addDaysUtc(value, days) {
  return formatUtcIsoWithoutMilliseconds(new Date(new Date(value).getTime() + days * MS_PER_DAY));
}

function formatDateOnlyUtc(value) {
  return formatUtcIsoWithoutMilliseconds(value).slice(0, 10);
}

function formatSheetTimestamp(value = new Date()) {
  return formatUtcIsoWithoutMilliseconds(value).replace('T', ' ');
}

function escapeEnvValue(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

async function upsertEnvValues(entries) {
  if (IS_VERCEL) {
    return;
  }

  let envContents = '';

  try {
    envContents = await fs.readFile(ENV_FILE_PATH, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  let updatedContents = envContents;

  for (const [key, rawValue] of Object.entries(entries)) {
    const nextLine = `${key}="${escapeEnvValue(rawValue)}"`;
    const keyPattern = new RegExp(`^${key}=.*$`, 'm');

    if (keyPattern.test(updatedContents)) {
      updatedContents = updatedContents.replace(keyPattern, nextLine);
    } else {
      if (updatedContents.length > 0 && !updatedContents.endsWith('\n')) {
        updatedContents += '\n';
      }
      updatedContents += `${nextLine}\n`;
    }
  }

  if (updatedContents !== envContents) {
    await fs.writeFile(ENV_FILE_PATH, updatedContents, 'utf8');
  }
}

function normalizeBasicAuthValue(value) {
  if (!value) return '';
  return value.startsWith('Basic ') ? value : `Basic ${value}`;
}

function isPlaceholderBasicAuth(value) {
  return !value || /base64\(client_id:client_secret\)/i.test(value);
}

function deriveBasicAuthorizationHeader() {
  if (!MOMENCE_CLIENT_ID || !MOMENCE_CLIENT_SECRET) {
    return '';
  }

  const encoded = Buffer.from(`${MOMENCE_CLIENT_ID}:${MOMENCE_CLIENT_SECRET}`, 'utf8').toString('base64');
  return `Basic ${encoded}`;
}

async function ensureBasicAuthorizationHeader() {
  if (isPlaceholderBasicAuth(currentMomenceBasicAuth)) {
    const derivedBasicAuth = deriveBasicAuthorizationHeader();
    if (!derivedBasicAuth) {
      throw createHttpError(500, 'Missing MOMENCE_BASIC_AUTH and unable to derive it because MOMENCE_CLIENT_ID or MOMENCE_CLIENT_SECRET is missing.');
    }

    currentMomenceBasicAuth = derivedBasicAuth;
    process.env.MOMENCE_BASIC_AUTH = derivedBasicAuth;
    await upsertEnvValues({ MOMENCE_BASIC_AUTH: derivedBasicAuth });
  }

  return normalizeBasicAuthValue(currentMomenceBasicAuth);
}

function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function isValidAbsoluteUrl(value) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function getMissingMomenceConfig() {
  const missing = [];

  if (isPlaceholderBasicAuth(currentMomenceBasicAuth) && (!MOMENCE_CLIENT_ID || !MOMENCE_CLIENT_SECRET)) {
    missing.push('MOMENCE_BASIC_AUTH or MOMENCE_CLIENT_ID + MOMENCE_CLIENT_SECRET');
  }
  if (!MOMENCE_API_USERNAME) missing.push('MOMENCE_API_USERNAME (or MOMENCE_USER_EMAIL)');
  if (!MOMENCE_API_PASSWORD) missing.push('MOMENCE_API_PASSWORD');

  return missing;
}

function isGoogleSheetsLoggingConfigured() {
  return Boolean(
    GOOGLE_CLIENT_ID
      && GOOGLE_CLIENT_SECRET
      && GOOGLE_REFRESH_TOKEN
      && ACTIVITY_SPREADSHEET_ID
      && ACTIVITY_SHEET_NAME,
  );
}

async function getSheetsClient() {
  if (!isGoogleSheetsLoggingConfigured()) {
    throw createHttpError(500, 'Google Sheets activity logging is not configured.');
  }

  if (!cachedSheetsClient) {
    const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
    cachedSheetsClient = google.sheets({ version: 'v4', auth });
  }

  return cachedSheetsClient;
}

async function appendActivityLog(entry) {
  const sheets = await getSheetsClient();
  const row = [
    formatSheetTimestamp(),
    entry.status || 'SUCCESS',
    entry.action || 'unknown',
    entry.memberId || '',
    entry.memberName || '',
    entry.memberEmail || '',
    entry.boughtMembershipId || '',
    entry.membershipName || '',
    entry.location || '',
    entry.membershipStartDate || '',
    entry.membershipEndDate || '',
    entry.freezeHistory || '',
    entry.freezeEligibility || '',
    entry.freezeAt || '',
    entry.unfreezeAt || '',
    entry.resumeAt || '',
    entry.requestedDays || '',
    entry.note || '',
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: ACTIVITY_SPREADSHEET_ID,
    range: `${ACTIVITY_SHEET_NAME}!A:R`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [row],
    },
  });
}

async function appendActivityLogSafe(entry) {
  try {
    if (!isGoogleSheetsLoggingConfigured()) {
      return { logged: false, error: 'Google Sheets logging is not configured.' };
    }

    await appendActivityLog(entry);
    return { logged: true, error: null };
  } catch (error) {
    console.error('Failed to append activity log:', error);
    return { logged: false, error: error.message };
  }
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  const text = await response.text();
  return text ? { raw: text } : {};
}

function parseFreezeDateInput(value, { endOfDay = false } = {}) {
  const trimmedValue = String(value || '').trim();

  if (!trimmedValue) {
    return Number.NaN;
  }

  const hasExplicitTime = trimmedValue.includes('T');
  const normalizedValue = hasExplicitTime
    ? trimmedValue
    : `${trimmedValue}${endOfDay ? 'T23:59:59Z' : 'T00:00:00Z'}`;

  return Date.parse(normalizedValue);
}

async function warmAuthorizeFlow() {
  if (!MOMENCE_CLIENT_ID || !MOMENCE_REDIRECT_URI) {
    return;
  }

  if (!isValidAbsoluteUrl(MOMENCE_REDIRECT_URI)) {
    console.warn(`Skipping authorize warm-up because MOMENCE_REDIRECT_URI is not a valid absolute URL: ${MOMENCE_REDIRECT_URI}`);
    return;
  }

  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('client_id', MOMENCE_CLIENT_ID);
  url.searchParams.set('redirect_uri', MOMENCE_REDIRECT_URI);
  url.searchParams.set('prompt', 'login');
  url.searchParams.set('scope', MOMENCE_SCOPE);
  url.searchParams.set('response_type', 'code');

  try {
    const basicAuthorizationHeader = await ensureBasicAuthorizationHeader();
    await fetch(url, {
      method: 'GET',
      headers: {
        authorization: basicAuthorizationHeader,
      },
      redirect: 'manual',
    });
  } catch {
    // Best-effort preflight only.
  }
}

async function requestToken(bodyParams) {
  const basicAuthorizationHeader = await ensureBasicAuthorizationHeader();

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization: basicAuthorizationHeader,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(bodyParams),
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    throw createHttpError(response.status, 'Momence token request failed.', data);
  }

  const accessToken = data.access_token || data.accessToken;
  const refreshToken = data.refresh_token || data.refreshToken;
  const expiresIn = Number(data.expires_in || data.expiresIn || 3600);

  if (!accessToken) {
    throw createHttpError(502, 'Momence token response did not include an access token.', data);
  }

  tokenStore.accessToken = accessToken;
  tokenStore.refreshToken = refreshToken || tokenStore.refreshToken;
  tokenStore.expiresAt = Date.now() + expiresIn * 1000;

  process.env.MOMENCE_ACCESS_TOKEN = tokenStore.accessToken;
  process.env.MOMENCE_REFRESH_TOKEN = tokenStore.refreshToken;
  process.env.MOMENCE_ACCESS_TOKEN_EXPIRES_AT = String(tokenStore.expiresAt);

  await upsertEnvValues({
    MOMENCE_BASIC_AUTH: basicAuthorizationHeader,
    MOMENCE_ACCESS_TOKEN: tokenStore.accessToken,
    MOMENCE_REFRESH_TOKEN: tokenStore.refreshToken,
    MOMENCE_ACCESS_TOKEN_EXPIRES_AT: String(tokenStore.expiresAt),
    LAST_AUTH_TIMESTAMP: new Date().toISOString(),
    AUTH_SUCCESS: 'true',
  });

  return tokenStore.accessToken;
}

async function loginWithPasswordGrant() {
  const missingConfig = getMissingMomenceConfig();
  if (missingConfig.length > 0) {
    throw createHttpError(500, `Missing Momence environment configuration: ${missingConfig.join(', ')}.`, {
      missingConfig,
    });
  }

  await warmAuthorizeFlow();

  return requestToken({
    grant_type: 'password',
    username: MOMENCE_API_USERNAME,
    password: MOMENCE_API_PASSWORD,
  });
}

async function refreshAccessToken() {
  if (!tokenStore.refreshToken) {
    return loginWithPasswordGrant();
  }

  return requestToken({
    grant_type: 'refresh_token',
    refresh_token: tokenStore.refreshToken,
  });
}

async function ensureAccessToken({ forceRefresh = false } = {}) {
  const shouldRefresh =
    forceRefresh ||
    !tokenStore.accessToken ||
    !tokenStore.expiresAt ||
    Date.now() + TOKEN_REFRESH_SKEW_MS >= tokenStore.expiresAt;

  if (!shouldRefresh) {
    return tokenStore.accessToken;
  }

  if (tokenStore.refreshToken && !forceRefresh) {
    try {
      return await refreshAccessToken();
    } catch {
      return loginWithPasswordGrant();
    }
  }

  return loginWithPasswordGrant();
}

async function momenceRequest(pathname, init = {}, retry = true) {
  const accessToken = await ensureAccessToken();
  const url = pathname.startsWith('http') ? pathname : `${MOMENCE_API_BASE}${pathname}`;

  const response = await fetch(url, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init.headers || {}),
      authorization: `Bearer ${accessToken}`,
    },
  });

  if ((response.status === 401 || response.status === 403) && retry) {
    await ensureAccessToken({ forceRefresh: true });
    return momenceRequest(pathname, init, false);
  }

  const data = await parseResponse(response);
  if (!response.ok) {
    throw createHttpError(response.status, 'Momence API request failed.', data);
  }

  return data;
}

function getFreezePolicy(membershipName) {
  return FREEZE_POLICY_MAP.get(normalizeMembershipName(membershipName)) || null;
}

function calculateRequestedFreezeDays(startDate, endDate) {
  const start = parseFreezeDateInput(startDate);
  const endExclusive = parseFreezeDateInput(endDate) + MS_PER_DAY;

  if (!Number.isFinite(start) || !Number.isFinite(endExclusive)) {
    throw createHttpError(400, 'Please choose valid freeze start and end dates.');
  }

  if (endExclusive <= start) {
    throw createHttpError(400, 'Freeze end date must be the same day or later than the start date.');
  }

  return Math.ceil((endExclusive - start) / MS_PER_DAY);
}

function calculateScheduledFreezeWindow(startDate, durationDays) {
  const freezeAtTimestamp = parseFreezeDateInput(startDate);
  const requestedDays = Number(durationDays);

  if (!Number.isInteger(requestedDays) || requestedDays <= 0) {
    throw createHttpError(400, 'Please choose a valid freeze duration in days.');
  }

  if (requestedDays > MAX_MEMBERSHIP_ACTION_DAYS) {
    throw createHttpError(400, `A membership can only be frozen for up to ${MAX_MEMBERSHIP_ACTION_DAYS} days at a time.`);
  }

  if (!Number.isFinite(freezeAtTimestamp)) {
    throw createHttpError(400, 'Please choose a valid freeze start date.');
  }

  const unfreezeAtTimestamp = freezeAtTimestamp + (requestedDays - 1) * MS_PER_DAY;

  return {
    requestedDays,
    freezeAt: formatUtcIsoWithoutMilliseconds(freezeAtTimestamp),
    unfreezeAt: formatUtcIsoWithoutMilliseconds(unfreezeAtTimestamp),
    resumeAt: addDaysUtc(unfreezeAtTimestamp, 1),
  };
}

function toScheduledFreezeWindow(startDate, endDate) {
  const freezeAtTimestamp = parseFreezeDateInput(startDate);
  const unfreezeAtTimestamp = parseFreezeDateInput(endDate);

  if (!Number.isFinite(freezeAtTimestamp) || !Number.isFinite(unfreezeAtTimestamp)) {
    throw createHttpError(400, 'Please choose valid freeze start and end dates.');
  }

  return {
    freezeAt: formatUtcIsoWithoutMilliseconds(freezeAtTimestamp),
    unfreezeAt: formatUtcIsoWithoutMilliseconds(unfreezeAtTimestamp),
  };
}

function calculateScheduledUnfreezeWindow(membership, unfreezeDate) {
  const unfreezeAtTimestamp = parseFreezeDateInput(unfreezeDate);
  const freezeStartedAt = membership.freeze?.freezedAt || membership.freeze?.scheduledFreezeAt || formatUtcIsoWithoutMilliseconds(new Date());
  const freezeStartedTimestamp = parseFreezeDateInput(freezeStartedAt);

  if (!Number.isFinite(unfreezeAtTimestamp)) {
    throw createHttpError(400, 'Please choose a valid scheduled unfreeze date.');
  }

  if (!Number.isFinite(freezeStartedTimestamp)) {
    throw createHttpError(400, 'The membership freeze start date could not be determined.');
  }

  if (unfreezeAtTimestamp < freezeStartedTimestamp) {
    throw createHttpError(400, 'Scheduled unfreeze date must be on or after the current freeze date.');
  }

  const totalFrozenDays = Math.floor((unfreezeAtTimestamp - freezeStartedTimestamp) / MS_PER_DAY) + 1;
  if (totalFrozenDays > MAX_MEMBERSHIP_ACTION_DAYS) {
    throw createHttpError(400, `A frozen membership cannot remain frozen for more than ${MAX_MEMBERSHIP_ACTION_DAYS} days.`);
  }

  return {
    totalFrozenDays,
    freezeStartedAt: formatUtcIsoWithoutMilliseconds(freezeStartedTimestamp),
    unfreezeAt: formatUtcIsoWithoutMilliseconds(unfreezeAtTimestamp),
    resumeAt: addDaysUtc(unfreezeAtTimestamp, 1),
  };
}

function calculateInclusiveDaySpan(startValue, endValue) {
  const startDayTimestamp = parseFreezeDateInput(formatDateOnlyUtc(startValue));
  const endDayTimestamp = parseFreezeDateInput(formatDateOnlyUtc(endValue));

  if (!Number.isFinite(startDayTimestamp) || !Number.isFinite(endDayTimestamp)) {
    throw createHttpError(400, 'Please choose valid membership action dates.');
  }

  if (endDayTimestamp < startDayTimestamp) {
    throw createHttpError(400, 'The end date must be the same day or later than the start date.');
  }

  return Math.floor((endDayTimestamp - startDayTimestamp) / MS_PER_DAY) + 1;
}

function calculateImmediateFreezeWindow(unfreezeDate) {
  const freezeAt = formatUtcIsoWithoutMilliseconds(new Date());

  if (!unfreezeDate) {
    return {
      requestedDays: null,
      freezeAt,
      unfreezeAt: null,
      resumeAt: null,
    };
  }

  const unfreezeAtTimestamp = parseFreezeDateInput(unfreezeDate);
  if (!Number.isFinite(unfreezeAtTimestamp)) {
    throw createHttpError(400, 'Please choose a valid scheduled unfreeze date.');
  }

  const requestedDays = calculateInclusiveDaySpan(freezeAt, unfreezeAtTimestamp);
  if (requestedDays > MAX_MEMBERSHIP_ACTION_DAYS) {
    throw createHttpError(400, `A membership can only be frozen for up to ${MAX_MEMBERSHIP_ACTION_DAYS} days at a time.`);
  }

  return {
    requestedDays,
    freezeAt,
    unfreezeAt: formatUtcIsoWithoutMilliseconds(unfreezeAtTimestamp),
    resumeAt: addDaysUtc(unfreezeAtTimestamp, 1),
  };
}

function buildCurrentFreezeFallback(membership) {
  const freeze = membership.freeze || {};
  const freezeStart = freeze.freezedAt || freeze.scheduledFreezeAt;
  const freezeEnd = freeze.unfrozenAt || freeze.unfreezedScheduledAt;

  if (!freezeStart) {
    return {
      available: false,
      source: 'active-membership-fallback',
      attemptsUsed: 0,
      frozenDaysUsed: 0,
      intervals: [],
      note: 'Historical freeze usage is unavailable from the active-membership response alone.',
    };
  }

  const startMs = Date.parse(freezeStart);
  const endMs = Date.parse(freezeEnd || new Date().toISOString());
  const frozenDaysUsed = Number.isFinite(startMs) && Number.isFinite(endMs)
    ? Math.max(0, Math.ceil((endMs - startMs) / MS_PER_DAY))
    : 0;

  return {
    available: true,
    source: 'active-membership-fallback',
    attemptsUsed: 1,
    frozenDaysUsed,
    intervals: [{ freezeAt: freezeStart, unfreezeAt: freezeEnd || null }],
    note: 'Using current membership freeze data as a fallback because full history is not configured.',
  };
}

function getMembershipLocation(membership) {
  return (
    membership.location?.name
    || membership.location?.title
    || membership.hostLocation?.name
    || membership.hostLocation?.title
    || membership.membership?.location?.name
    || membership.membership?.location?.title
    || membership.bookableLocation?.name
    || membership.bookableLocation?.title
    || membership.businessLocation?.name
    || membership.businessLocation?.title
    || 'Location unavailable'
  );
}

function getScheduledFreezeAt(membership) {
  return (
    membership.freeze?.scheduledFreezeAt
    || membership.freeze?.freezeScheduledAt
    || membership.freeze?.freezeAt
    || null
  );
}

function getScheduledUnfreezeAt(membership) {
  return (
    membership.freeze?.unfreezedScheduledAt
    || membership.freeze?.scheduledUnfreezeAt
    || membership.freeze?.unfreezeScheduledAt
    || null
  );
}

function formatFreezeHistorySummary(usage) {
  if (!usage?.intervals?.length) {
    return usage?.note || 'No freeze history recorded yet.';
  }

  return usage.intervals
    .map(interval => `${formatDateOnlyUtc(interval.freezeAt)} → ${interval.unfreezeAt ? formatDateOnlyUtc(interval.unfreezeAt) : 'Currently frozen'}`)
    .join(' • ');
}

function summarizeFreezeHistory(historyEntries, boughtMembershipId) {
  const events = [];

  for (const entry of historyEntries) {
    if (String(entry?.boughtMembershipId || '') !== String(boughtMembershipId)) {
      continue;
    }

    for (const activity of entry.activities || []) {
      if (activity.type === 'bought-membership-freezed') {
        events.push({ type: 'freeze', at: activity.createdAt });
      }
      if (activity.type === 'bought-membership-unfreezed') {
        events.push({ type: 'unfreeze', at: activity.createdAt });
      }
    }
  }

  events.sort((left, right) => Date.parse(left.at) - Date.parse(right.at));

  let attemptsUsed = 0;
  let frozenDaysUsed = 0;
  let openFreezeAt = null;
  const intervals = [];

  for (const event of events) {
    const eventMs = Date.parse(event.at);
    if (!Number.isFinite(eventMs)) {
      continue;
    }

    if (event.type === 'freeze' && openFreezeAt === null) {
      attemptsUsed += 1;
      openFreezeAt = eventMs;
      continue;
    }

    if (event.type === 'unfreeze' && openFreezeAt !== null) {
      frozenDaysUsed += Math.max(0, Math.ceil((eventMs - openFreezeAt) / MS_PER_DAY));
      intervals.push({
        freezeAt: new Date(openFreezeAt).toISOString(),
        unfreezeAt: new Date(eventMs).toISOString(),
      });
      openFreezeAt = null;
    }
  }

  if (openFreezeAt !== null) {
    frozenDaysUsed += Math.max(0, Math.ceil((Date.now() - openFreezeAt) / MS_PER_DAY));
    intervals.push({
      freezeAt: new Date(openFreezeAt).toISOString(),
      unfreezeAt: null,
    });
  }

  return {
    available: true,
    source: 'history-endpoint',
    attemptsUsed,
    frozenDaysUsed,
    intervals,
  };
}

async function getFreezeUsageSummary(memberId, membership) {
  if (!MOMENCE_USE_HISTORY_ENDPOINT) {
    return buildCurrentFreezeFallback(membership);
  }

  try {
    const accessToken = await ensureAccessToken();
    const historyUrl = `https://api.momence.com/host/${HOST_ID}/customers/${memberId}/history`;
    const response = await fetch(historyUrl, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${accessToken}`,
        ...(MOMENCE_X_APP ? { 'x-app': MOMENCE_X_APP } : {}),
        ...(MOMENCE_HISTORY_COOKIE ? { cookie: MOMENCE_HISTORY_COOKIE } : {}),
      },
    });

    const data = await parseResponse(response);
    if (!response.ok || !Array.isArray(data)) {
      return buildCurrentFreezeFallback(membership);
    }

    return summarizeFreezeHistory(data, membership.id);
  } catch {
    return buildCurrentFreezeFallback(membership);
  }
}

function evaluateFreezeEligibility({ membership, policy, usage, requestedDays = null }) {
  if (!policy) {
    return {
      eligible: false,
      reason: 'This membership does not have a configured freeze policy.',
      attemptsRemaining: 0,
      daysRemaining: 0,
    };
  }

  if (policy.attempts <= 0 || policy.days <= 0) {
    return {
      eligible: false,
      reason: 'This membership is configured with no freeze allowance.',
      attemptsRemaining: 0,
      daysRemaining: 0,
    };
  }

  if (membership.isFrozen) {
    return {
      eligible: false,
      reason: 'This membership is already frozen.',
      attemptsRemaining: Math.max(policy.attempts - usage.attemptsUsed, 0),
      daysRemaining: Math.max(policy.days - usage.frozenDaysUsed, 0),
    };
  }

  const attemptsRemaining = Math.max(policy.attempts - usage.attemptsUsed, 0);
  const daysRemaining = Math.max(policy.days - usage.frozenDaysUsed, 0);

  if (attemptsRemaining <= 0) {
    return {
      eligible: false,
      reason: 'The freeze-attempt limit for this membership has already been reached.',
      attemptsRemaining,
      daysRemaining,
    };
  }

  if (daysRemaining <= 0) {
    return {
      eligible: false,
      reason: 'The total freeze-day limit for this membership has already been reached.',
      attemptsRemaining,
      daysRemaining,
    };
  }

  if (requestedDays !== null && requestedDays > daysRemaining) {
    return {
      eligible: false,
      reason: `Requested freeze duration exceeds the remaining allowance of ${daysRemaining} day(s).`,
      attemptsRemaining,
      daysRemaining,
    };
  }

  return {
    eligible: true,
    reason: 'This membership is eligible for a scheduled freeze.',
    attemptsRemaining,
    daysRemaining,
  };
}

function buildVerificationSummary(submitted, member) {
  const submittedPhone = normalizePhone(`${submitted.countryCode || ''}${submitted.phoneNumber || ''}`);
  const memberPhone = normalizePhone(member.phoneNumber);

  const firstNameMatches = normalizeText(submitted.firstName) === normalizeText(member.firstName);
  const lastNameMatches = normalizeText(submitted.lastName) === normalizeText(member.lastName);
  const phoneMatches = !submittedPhone || !memberPhone
    ? false
    : memberPhone.endsWith(submittedPhone) || submittedPhone.endsWith(memberPhone);

  return {
    firstNameMatches,
    lastNameMatches,
    phoneMatches,
    matchedFields: [firstNameMatches, lastNameMatches, phoneMatches].filter(Boolean).length,
  };
}

function serializeMembership(membership, usage) {
  const policy = getFreezePolicy(membership.membership?.name);
  const eligibility = evaluateFreezeEligibility({ membership, policy, usage });
  const maxWindowDays = Math.max(0, Math.min(eligibility.daysRemaining, MAX_MEMBERSHIP_ACTION_DAYS));

  return {
    id: membership.id,
    type: membership.type,
    startDate: membership.startDate,
    endDate: membership.endDate,
    isFrozen: membership.isFrozen,
    usageLimitForSessions: membership.usageLimitForSessions,
    usageLimitForAppointments: membership.usageLimitForAppointments,
    usedSessions: membership.usedSessions,
    usedAppointments: membership.usedAppointments,
    location: getMembershipLocation(membership),
    freeze: membership.freeze || null,
    freezeHistory: {
      intervals: usage?.intervals || [],
      summary: formatFreezeHistorySummary(usage),
    },
    membership: {
      id: membership.membership?.id,
      name: membership.membership?.name,
      description: membership.membership?.description,
      autoRenewing: membership.membership?.autoRenewing,
      duration: membership.membership?.duration,
      durationUnit: membership.membership?.durationUnit,
    },
    freezePolicy: policy,
    freezeUsage: usage,
    freezeEligibility: {
      ...eligibility,
      maxWindowDays,
    },
    actions: {
      canFreeze: eligibility.eligible && !membership.isFrozen,
      canModifyFrozen: Boolean(membership.isFrozen),
      canRestartFrozen: Boolean(membership.isFrozen || getScheduledFreezeAt(membership)),
      canRemoveScheduledUnfreeze: Boolean(getScheduledUnfreezeAt(membership)),
    },
  };
}

async function resolveMembershipContext(memberId, boughtMembershipId) {
  const [memberDetails, membershipsResponse] = await Promise.all([
    momenceRequest(`/host/members/${memberId}`),
    momenceRequest(`/host/members/${memberId}/bought-memberships/active?page=0&pageSize=200&includeFrozen=true`),
  ]);

  const memberships = Array.isArray(membershipsResponse.payload) ? membershipsResponse.payload : [];
  const selectedMembership = memberships.find(item => String(item.id) === String(boughtMembershipId));

  if (!selectedMembership) {
    throw createHttpError(404, 'The selected active membership could not be found.');
  }

  const usage = await getFreezeUsageSummary(memberId, selectedMembership);
  const membershipView = serializeMembership(selectedMembership, usage);

  return {
    memberDetails,
    selectedMembership,
    membershipView,
  };
}

function buildActivityEntry({
  status,
  action,
  memberId,
  memberContext,
  memberDetails,
  membershipView,
  freezeAt = '',
  unfreezeAt = '',
  resumeAt = '',
  requestedDays = '',
  note = '',
}) {
  const memberName = `${memberContext?.firstName || memberDetails?.firstName || ''} ${memberContext?.lastName || memberDetails?.lastName || ''}`.trim();
  const memberEmail = memberContext?.email || memberDetails?.email || '';

  return {
    status,
    action,
    memberId,
    memberName,
    memberEmail,
    boughtMembershipId: membershipView?.id || '',
    membershipName: membershipView?.membership?.name || '',
    location: membershipView?.location || '',
    membershipStartDate: membershipView?.startDate ? formatDateOnlyUtc(membershipView.startDate) : '',
    membershipEndDate: membershipView?.endDate ? formatDateOnlyUtc(membershipView.endDate) : '',
    freezeHistory: membershipView?.freezeHistory?.summary || '',
    freezeEligibility: membershipView?.freezeEligibility?.reason || '',
    freezeAt,
    unfreezeAt,
    resumeAt,
    requestedDays,
    note,
  };
}

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    port: PORT,
    configured: {
      hasClientId: Boolean(MOMENCE_CLIENT_ID),
      hasClientSecret: Boolean(MOMENCE_CLIENT_SECRET),
      hasRedirectUri: Boolean(MOMENCE_REDIRECT_URI),
      redirectUriIsValid: !MOMENCE_REDIRECT_URI || isValidAbsoluteUrl(MOMENCE_REDIRECT_URI),
      hasBasicAuth: !isPlaceholderBasicAuth(currentMomenceBasicAuth) || Boolean(MOMENCE_CLIENT_ID && MOMENCE_CLIENT_SECRET),
      basicAuthIsPlaceholder: isPlaceholderBasicAuth(currentMomenceBasicAuth),
      hasUsername: Boolean(MOMENCE_API_USERNAME),
      hasPassword: Boolean(MOMENCE_API_PASSWORD),
      usesHistoryEndpoint: MOMENCE_USE_HISTORY_ENDPOINT,
      activityLoggingConfigured: isGoogleSheetsLoggingConfigured(),
      missingConfig: getMissingMomenceConfig(),
    },
  });
});

app.post('/api/member-lookup', async (request, response, next) => {
  try {
    const { firstName, lastName, countryCode, phoneNumber, email } = request.body || {};

    if (!email || !String(email).includes('@')) {
      throw createHttpError(400, 'Please provide a valid email address.');
    }

    const membersSearch = await momenceRequest(
      `/host/members?page=0&pageSize=100&sortOrder=DESC&sortBy=lastSeenAt&query=${encodeURIComponent(email)}`,
    );

    const members = Array.isArray(membersSearch.payload) ? membersSearch.payload : [];
    const member = members.find(item => normalizeText(item.email) === normalizeText(email)) || members[0];

    if (!member?.id) {
      throw createHttpError(404, 'No member was found for that email address.');
    }

    const [memberDetails, membershipsResponse] = await Promise.all([
      momenceRequest(`/host/members/${member.id}`),
      momenceRequest(`/host/members/${member.id}/bought-memberships/active?page=0&pageSize=200&includeFrozen=true`),
    ]);

    const activeMemberships = Array.isArray(membershipsResponse.payload) ? membershipsResponse.payload : [];
    const membershipViews = await Promise.all(
      activeMemberships.map(async membership => {
        const usage = await getFreezeUsageSummary(member.id, membership);
        return serializeMembership(membership, usage);
      }),
    );

    response.json({
      member: memberDetails,
      verification: buildVerificationSummary(
        { firstName, lastName, countryCode, phoneNumber, email },
        memberDetails,
      ),
      memberships: membershipViews,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/freeze-membership', async (request, response, next) => {
  let activityContext = null;

  try {
    const {
      memberId,
      boughtMembershipId,
      startDate,
      endDate,
      unfreezeDate,
      durationDays,
      memberContext,
      operation = 'scheduled-window',
      reason = '',
    } = request.body || {};

    if (!memberId || !boughtMembershipId) {
      throw createHttpError(400, 'Member and membership identifiers are required.');
    }

    const { memberDetails, membershipView } = await resolveMembershipContext(memberId, boughtMembershipId);
    activityContext = { memberId, memberContext, memberDetails, membershipView };

    if (membershipView.isFrozen) {
      throw createHttpError(400, 'This membership is already frozen. Use Modify Existing Frozen Membership or Restart Frozen Membership instead.');
    }

    let actionLabel = 'Freeze current membership';
    let successMessage = 'Membership freeze scheduled successfully.';
    let activityNote = 'Membership action saved successfully.';
    let freezeWindow = null;
    let requestPath = '';
    let requestBody = null;

    switch (operation) {
      case 'freeze-now': {
        actionLabel = 'Freeze bought membership immediately';
        successMessage = 'Membership frozen immediately.';
        activityNote = 'Membership frozen immediately.';
        freezeWindow = calculateImmediateFreezeWindow(null);
        requestPath = `/host/members/${memberId}/bought-memberships/${boughtMembershipId}/membership-freeze`;
        requestBody = {
          freezeType: 'now',
          freezeAt: null,
          unfreezeType: 'not_set',
          unfreezeAt: null,
          reason: reason || null,
        };
        break;
      }

      case 'freeze-now-until': {
        actionLabel = 'Freeze bought membership immediately or schedule freeze/unfreeze';
        successMessage = 'Membership frozen now with scheduled unfreeze.';
        activityNote = 'Membership frozen immediately with scheduled unfreeze.';
        freezeWindow = calculateImmediateFreezeWindow(unfreezeDate || endDate);
        requestPath = `/host/members/${memberId}/bought-memberships/${boughtMembershipId}/membership-freeze`;
        requestBody = {
          freezeType: 'now',
          freezeAt: null,
          unfreezeType: 'scheduled',
          unfreezeAt: freezeWindow.unfreezeAt,
          reason: reason || null,
        };
        break;
      }

      case 'schedule-freeze-only': {
        if (!startDate) {
          throw createHttpError(400, 'Please provide a freeze start date.');
        }

        const freezeAtTimestamp = parseFreezeDateInput(startDate);
        if (!Number.isFinite(freezeAtTimestamp)) {
          throw createHttpError(400, 'Please choose a valid freeze start date.');
        }

        actionLabel = 'Schedule bought membership freeze';
        successMessage = 'Membership freeze scheduled successfully.';
        activityNote = 'Membership freeze scheduled without an unfreeze date.';
        freezeWindow = {
          requestedDays: null,
          freezeAt: formatUtcIsoWithoutMilliseconds(freezeAtTimestamp),
          unfreezeAt: null,
          resumeAt: null,
        };
        requestPath = `/host/members/${memberId}/bought-memberships/${boughtMembershipId}/membership-schedule-freeze`;
        requestBody = {
          freezeType: 'scheduled',
          freezeAt: freezeWindow.freezeAt,
        };
        break;
      }

      case 'scheduled-window':
      default: {
        if (!startDate) {
          throw createHttpError(400, 'Please provide a freeze start date.');
        }

        actionLabel = 'Freeze bought membership immediately or schedule freeze/unfreeze';
        successMessage = 'Membership freeze scheduled successfully.';
        activityNote = 'Membership freeze scheduled successfully.';
        freezeWindow = durationDays
          ? calculateScheduledFreezeWindow(startDate, durationDays)
          : {
            ...toScheduledFreezeWindow(startDate, endDate),
            requestedDays: calculateRequestedFreezeDays(startDate, endDate),
            resumeAt: addDaysUtc(parseFreezeDateInput(endDate), 1),
          };
        requestPath = `/host/members/${memberId}/bought-memberships/${boughtMembershipId}/membership-freeze`;
        requestBody = {
          freezeType: 'scheduled',
          unfreezeType: 'scheduled',
          freezeAt: freezeWindow.freezeAt,
          unfreezeAt: freezeWindow.unfreezeAt,
          reason: reason || null,
        };
        break;
      }
    }

    const eligibility = evaluateFreezeEligibility({
      membership: membershipView,
      policy: membershipView.freezePolicy,
      usage: membershipView.freezeUsage,
      requestedDays: freezeWindow?.requestedDays ?? null,
    });

    if (!eligibility.eligible) {
      throw createHttpError(400, eligibility.reason, {
        membershipName: membershipView.membership?.name,
        requestedDays: freezeWindow?.requestedDays ?? null,
        usage: membershipView.freezeUsage,
        policy: membershipView.freezePolicy,
      });
    }

    if ((freezeWindow?.requestedDays ?? 0) > MAX_MEMBERSHIP_ACTION_DAYS) {
      throw createHttpError(400, `A membership can only be frozen for up to ${MAX_MEMBERSHIP_ACTION_DAYS} days at a time.`);
    }

    const freezeResponse = await momenceRequest(
      requestPath,
      {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
    );

    const activityLog = await appendActivityLogSafe(
      buildActivityEntry({
        status: 'SUCCESS',
        action: actionLabel,
        memberId,
        memberContext,
        memberDetails,
        membershipView,
        freezeAt: freezeWindow?.freezeAt || '',
        unfreezeAt: freezeWindow?.unfreezeAt || '',
        resumeAt: freezeWindow?.resumeAt || '',
        requestedDays: freezeWindow?.requestedDays || '',
        note: activityNote,
      }),
    );

    response.json({
      ok: true,
      action: 'freeze',
      operation,
      message: successMessage,
      memberId,
      boughtMembershipId,
      membershipName: membershipView.membership?.name,
      requestedDays: freezeWindow?.requestedDays ?? null,
      freezeWindow,
      resumeAt: freezeWindow?.resumeAt ?? null,
      policy: membershipView.freezePolicy,
      usage: membershipView.freezeUsage,
      eligibility,
      activityLogged: activityLog.logged,
      activityLogError: activityLog.error,
      apiResponse: freezeResponse,
    });
  } catch (error) {
    if (activityContext) {
      await appendActivityLogSafe(
        buildActivityEntry({
          status: 'FAILED',
          action: 'Bought membership freeze operation',
          memberId: activityContext.memberId,
          memberContext: activityContext.memberContext,
          memberDetails: activityContext.memberDetails,
          membershipView: activityContext.membershipView,
          note: error.message,
        }),
      );
    }

    next(error);
  }
});

app.post('/api/unfreeze-membership', async (request, response, next) => {
  let activityContext = null;

  try {
    const {
      memberId,
      boughtMembershipId,
      unfreezeDate,
      memberContext,
      operation = 'schedule-unfreeze',
    } = request.body || {};

    if (!memberId || !boughtMembershipId) {
      throw createHttpError(400, 'Member and membership identifiers are required.');
    }

    const { memberDetails, membershipView } = await resolveMembershipContext(memberId, boughtMembershipId);
    activityContext = { memberId, memberContext, memberDetails, membershipView };

    if (!membershipView.isFrozen) {
      throw createHttpError(400, 'This membership is not currently frozen.');
    }

    let actionLabel = 'Schedule bought membership unfreeze';
    let successMessage = 'Scheduled unfreeze updated successfully.';
    let activityNote = 'Scheduled unfreeze saved successfully.';
    let freezeWindow = {
      freezeAt: membershipView.freeze?.freezedAt || membershipView.freeze?.scheduledFreezeAt || '',
      unfreezeAt: null,
    };
    let requestedDays = null;
    let resumeAt = null;
    let momenceInit = { method: 'DELETE' };

    if (operation === 'remove-scheduled-unfreeze') {
      const scheduledUnfreezeAt = getScheduledUnfreezeAt(membershipView);
      if (!scheduledUnfreezeAt) {
        throw createHttpError(400, 'This membership does not have a scheduled unfreeze to remove.');
      }

      actionLabel = 'Remove bought membership scheduled unfreeze';
      successMessage = 'Scheduled unfreeze removed successfully.';
      activityNote = 'Scheduled unfreeze removed successfully.';
      freezeWindow.unfreezeAt = null;
    } else {
      if (!unfreezeDate) {
        throw createHttpError(400, 'Please provide a scheduled unfreeze date.');
      }

      const scheduledWindow = calculateScheduledUnfreezeWindow(membershipView, unfreezeDate);
      freezeWindow = {
        freezeAt: membershipView.freeze?.freezedAt || membershipView.freeze?.scheduledFreezeAt || '',
        unfreezeAt: scheduledWindow.unfreezeAt,
      };
      requestedDays = scheduledWindow.totalFrozenDays;
      resumeAt = scheduledWindow.resumeAt;
      momenceInit = {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          unfreezeType: 'scheduled',
          unfreezeAt: scheduledWindow.unfreezeAt,
        }),
      };
    }

    const unfreezeResponse = await momenceRequest(
      `/host/members/${memberId}/bought-memberships/${boughtMembershipId}/membership-schedule-unfreeze`,
      momenceInit,
    );

    const activityLog = await appendActivityLogSafe(
      buildActivityEntry({
        status: 'SUCCESS',
        action: actionLabel,
        memberId,
        memberContext,
        memberDetails,
        membershipView,
        freezeAt: freezeWindow.freezeAt,
        unfreezeAt: freezeWindow.unfreezeAt || '',
        resumeAt: resumeAt || '',
        requestedDays: requestedDays || '',
        note: activityNote,
      }),
    );

    response.json({
      ok: true,
      action: 'modify',
      operation,
      message: successMessage,
      memberId,
      boughtMembershipId,
      membershipName: membershipView.membership?.name,
      freezeWindow,
      resumeAt,
      requestedDays,
      activityLogged: activityLog.logged,
      activityLogError: activityLog.error,
      apiResponse: unfreezeResponse,
    });
  } catch (error) {
    if (activityContext) {
      await appendActivityLogSafe(
        buildActivityEntry({
          status: 'FAILED',
          action: 'Bought membership unfreeze operation',
          memberId: activityContext.memberId,
          memberContext: activityContext.memberContext,
          memberDetails: activityContext.memberDetails,
          membershipView: activityContext.membershipView,
          note: error.message,
        }),
      );
    }

    next(error);
  }
});

app.post('/api/restart-membership', async (request, response, next) => {
  let activityContext = null;

  try {
    const { memberId, boughtMembershipId, memberContext } = request.body || {};

    if (!memberId || !boughtMembershipId) {
      throw createHttpError(400, 'Member and membership identifiers are required.');
    }

    const { memberDetails, membershipView } = await resolveMembershipContext(memberId, boughtMembershipId);
    activityContext = { memberId, memberContext, memberDetails, membershipView };

    const scheduledFreezeAt = getScheduledFreezeAt(membershipView);

    if (!membershipView.isFrozen && !scheduledFreezeAt) {
      throw createHttpError(400, 'This membership is neither frozen nor scheduled to freeze.');
    }

    const restartResponse = await momenceRequest(
      `/host/members/${memberId}/bought-memberships/${boughtMembershipId}/membership-schedule-freeze`,
      {
        method: 'DELETE',
      },
    );

    const activityLog = await appendActivityLogSafe(
      buildActivityEntry({
        status: 'SUCCESS',
        action: 'Unfreeze bought membership or remove scheduled freeze',
        memberId,
        memberContext,
        memberDetails,
        membershipView,
        freezeAt: membershipView.freeze?.freezedAt || scheduledFreezeAt || '',
        note: membershipView.isFrozen ? 'Membership restarted immediately.' : 'Scheduled membership freeze removed successfully.',
      }),
    );

    response.json({
      ok: true,
      action: 'restart',
      message: membershipView.isFrozen ? 'Frozen membership restarted successfully.' : 'Scheduled membership freeze removed successfully.',
      memberId,
      boughtMembershipId,
      membershipName: membershipView.membership?.name,
      removedScheduledFreeze: !membershipView.isFrozen,
      activityLogged: activityLog.logged,
      activityLogError: activityLog.error,
      apiResponse: restartResponse,
    });
  } catch (error) {
    if (activityContext) {
      await appendActivityLogSafe(
        buildActivityEntry({
          status: 'FAILED',
          action: 'Unfreeze bought membership or remove scheduled freeze',
          memberId: activityContext.memberId,
          memberContext: activityContext.memberContext,
          memberDetails: activityContext.memberDetails,
          membershipView: activityContext.membershipView,
          note: error.message,
        }),
      );
    }

    next(error);
  }
});

app.use((error, _request, response, _next) => {
  const status = error.status || 500;
  response.status(status).json({
    error: error.message || 'Something went wrong.',
    details: error.details || null,
  });
});

app.get('*', (_request, response) => {
  response.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (!IS_VERCEL) {
  app.listen(PORT, () => {
    console.log(`Freeze Concierge is running on http://localhost:${PORT}`);
  });
}

export default app;
