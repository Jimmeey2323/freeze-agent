const lookupForm = document.querySelector('#lookup-form');
const actionForm = document.querySelector('#freeze-form');
const feedbackBanner = document.querySelector('#feedback-banner');
const lookupButton = document.querySelector('#lookup-button');
const actionButton = document.querySelector('#freeze-button');
const memberSection = document.querySelector('#member-section');
const membershipsSection = document.querySelector('#memberships-section');
const schedulerSection = document.querySelector('#scheduler-section');
const successSection = document.querySelector('#success-section');
const memberSummary = document.querySelector('#member-summary');
const membershipsGrid = document.querySelector('#memberships-grid');
const membershipCount = document.querySelector('#membership-count');
const verificationPill = document.querySelector('#verification-pill');
const selectedMembershipSummary = document.querySelector('#selected-membership-summary');
const successTitle = document.querySelector('#success-title');
const successMessage = document.querySelector('#success-message');
const successDetails = document.querySelector('#success-details');
const actionHint = document.querySelector('#freeze-hint');
const startDateInput = document.querySelector('#startDate');
const endDateInput = document.querySelector('#endDate');
const modeTabs = Array.from(document.querySelectorAll('.mode-tab'));
const modePill = document.querySelector('#mode-pill');
const membershipsHeading = document.querySelector('#memberships-heading');
const schedulerHeading = document.querySelector('#scheduler-heading');
const schedulerBadge = document.querySelector('#scheduler-badge');
const startDateField = document.querySelector('#startDateField');
const endDateField = document.querySelector('#endDateField');
const startDateLabel = document.querySelector('#start-date-label');
const endDateLabel = document.querySelector('#end-date-label');

const API_BASE_CANDIDATES = window.location.protocol === 'file:'
  ? ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003']
  : ['', 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'];

const MODE_CONFIG = {
  freeze: {
    pill: 'Freeze current membership',
    membershipsHeading: 'Choose a membership to freeze',
    schedulerHeading: 'Schedule freeze window',
    schedulerBadge: 'Date picker ready',
    actionLabel: 'Freeze membership',
    successTitle: 'Membership freeze scheduled successfully',
    selectionHint: 'Choose an eligible membership above to unlock scheduling.',
    activeHint: membership => `You can request up to ${membership.freezeEligibility.daysRemaining} more day(s) across ${membership.freezeEligibility.attemptsRemaining} remaining attempt(s).`,
    startLabel: 'Freeze start date',
    endLabel: 'Freeze end date',
    showStartDate: true,
    showEndDate: true,
    getActionState: membership => ({
      available: Boolean(membership.actions?.canFreeze),
      label: membership.actions?.canFreeze ? 'Select this membership' : 'Unavailable for freeze',
    }),
  },
  modify: {
    pill: 'Modify existing frozen membership',
    membershipsHeading: 'Choose a frozen membership to modify',
    schedulerHeading: 'Update scheduled unfreeze date',
    schedulerBadge: 'Single date required',
    actionLabel: 'Save updated unfreeze date',
    successTitle: 'Frozen membership updated successfully',
    selectionHint: 'Choose a currently frozen membership above to edit its unfreeze date.',
    activeHint: () => 'Choose the new date when the membership should unfreeze. The resume date will be the next day automatically.',
    startLabel: 'Scheduled unfreeze date',
    endLabel: 'Freeze end date',
    showStartDate: true,
    showEndDate: false,
    getActionState: membership => ({
      available: Boolean(membership.actions?.canModifyFrozen),
      label: membership.actions?.canModifyFrozen ? 'Modify this frozen membership' : 'Not currently frozen',
    }),
  },
  restart: {
    pill: 'Restart frozen membership',
    membershipsHeading: 'Choose a frozen membership to restart',
    schedulerHeading: 'Restart membership now',
    schedulerBadge: 'No dates needed',
    actionLabel: 'Restart membership now',
    successTitle: 'Frozen membership restarted successfully',
    selectionHint: 'Choose a currently frozen membership above to restart it immediately.',
    activeHint: () => 'This will remove the scheduled freeze and restart the membership immediately.',
    startLabel: 'Freeze start date',
    endLabel: 'Freeze end date',
    showStartDate: false,
    showEndDate: false,
    getActionState: membership => ({
      available: Boolean(membership.actions?.canRestartFrozen),
      label: membership.actions?.canRestartFrozen ? 'Restart this membership' : 'Not currently frozen',
    }),
  },
};

const state = {
  member: null,
  verification: null,
  memberships: [],
  selectedMembership: null,
  activeMode: 'freeze',
};

lookupForm.addEventListener('submit', handleLookup);
actionForm.addEventListener('submit', handleMembershipAction);
modeTabs.forEach(tab => {
  tab.addEventListener('click', () => setActiveMode(tab.dataset.mode));
});

const apiBaseUrlPromise = resolveApiBaseUrl();
setActiveMode(state.activeMode);

function setBanner(message, type = 'info') {
  feedbackBanner.textContent = message;
  feedbackBanner.className = `feedback-banner ${type}`;
}

function clearBanner() {
  feedbackBanner.className = 'feedback-banner hidden';
  feedbackBanner.textContent = '';
}

function toggleBusy(button, busy, busyLabel, idleLabel) {
  button.disabled = busy;
  button.textContent = busy ? busyLabel : idleLabel;
}

async function resolveApiBaseUrl() {
  for (const candidate of API_BASE_CANDIDATES) {
    try {
      const response = await fetch(`${candidate}/api/health`);
      if (response.ok) {
        if (candidate) {
          setBanner(`Interface loaded. API requests will use ${candidate}.`, 'info');
        }

        return candidate;
      }
    } catch {
      // Try the next candidate.
    }
  }

  if (window.location.protocol === 'file:') {
    setBanner('The interface opened from a file, but no local API server was found. Start the app server and open http://localhost:3002.', 'error');
  }

  return '';
}

async function apiUrl(pathname) {
  const baseUrl = await apiBaseUrlPromise;
  return `${baseUrl}${pathname}`;
}

async function apiFetch(pathname, init) {
  return fetch(await apiUrl(pathname), init);
}

function formatDateForApi(value) {
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function parseDateOnly(value) {
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
}

function calculateRequestedDays(startDate, endDate) {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }

  if (end < start) {
    return -1;
  }

  return Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;
}

function getApiErrorMessage(data, fallback) {
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  if (data.error && data.details?.membershipName) {
    return `${data.error} (${data.details.membershipName})`;
  }

  return data.error || fallback;
}

async function readApiResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const rawText = await response.text();

  if (!rawText) {
    return {};
  }

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(rawText);
    } catch {
      return { error: 'The server returned invalid JSON.', raw: rawText };
    }
  }

  return {
    error: rawText,
    raw: rawText,
  };
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getStatusPill(eligibility, isFrozen) {
  if (isFrozen) {
    return '<span class="status-pill warning">Currently frozen</span>';
  }

  if (eligibility.eligible) {
    return '<span class="status-pill success">Eligible to freeze</span>';
  }

  if (eligibility.daysRemaining > 0 || eligibility.attemptsRemaining > 0) {
    return '<span class="status-pill warning">Needs attention</span>';
  }

  return '<span class="status-pill danger">Not eligible</span>';
}

function currentModeConfig() {
  return MODE_CONFIG[state.activeMode];
}

function resetSuccessState() {
  successSection.classList.add('hidden');
  successMessage.textContent = '';
  successDetails.innerHTML = '';
}

function setActiveMode(mode) {
  if (!MODE_CONFIG[mode]) {
    return;
  }

  state.activeMode = mode;
  state.selectedMembership = null;
  resetSuccessState();

  const config = currentModeConfig();

  modeTabs.forEach(tab => {
    const isActive = tab.dataset.mode === mode;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });

  modePill.textContent = config.pill;
  membershipsHeading.textContent = config.membershipsHeading;
  schedulerHeading.textContent = config.schedulerHeading;
  schedulerBadge.textContent = config.schedulerBadge;
  successTitle.textContent = config.successTitle;
  actionButton.textContent = config.actionLabel;
  startDateLabel.textContent = config.startLabel;
  endDateLabel.textContent = config.endLabel;
  startDateField.classList.toggle('hidden', !config.showStartDate);
  endDateField.classList.toggle('hidden', !config.showEndDate);
  startDateInput.required = config.showStartDate;
  endDateInput.required = config.showEndDate;

  if (!config.showStartDate) {
    startDateInput.value = '';
  }

  if (!config.showEndDate) {
    endDateInput.value = '';
  }

  renderMemberships();
  renderSelectedMembership();
}

function renderMemberSummary() {
  const { member, verification } = state;
  verificationPill.textContent = `${verification.matchedFields}/3 fields matched`;

  memberSummary.innerHTML = `
    <article class="summary-card">
      <span class="label">Member</span>
      <strong>${escapeHtml(`${member.firstName || ''} ${member.lastName || ''}`.trim() || '—')}</strong>
      <div class="helper-text">ID ${escapeHtml(member.id)}</div>
    </article>
    <article class="summary-card">
      <span class="label">Email</span>
      <strong>${escapeHtml(member.email || '—')}</strong>
      <div class="helper-text">Phone ${escapeHtml(member.phoneNumber || '—')}</div>
    </article>
    <article class="summary-card">
      <span class="label">Seen</span>
      <strong>${escapeHtml(formatDate(member.lastSeen))}</strong>
      <div class="helper-text">First seen ${escapeHtml(formatDate(member.firstSeen))}</div>
    </article>
    <article class="summary-card">
      <span class="label">Verification</span>
      <strong>${verification.firstNameMatches ? 'First name ✓' : 'First name ✕'}</strong>
      <div class="helper-text">
        ${verification.lastNameMatches ? 'Last name ✓' : 'Last name ✕'} · ${verification.phoneMatches ? 'Phone ✓' : 'Phone ✕'}
      </div>
    </article>
  `;
}

function renderMemberships() {
  membershipCount.textContent = `${state.memberships.length} membership${state.memberships.length === 1 ? '' : 's'}`;

  membershipsGrid.innerHTML = state.memberships.map(membership => {
    const selected = state.selectedMembership?.id === membership.id;
    const policyText = membership.freezePolicy
      ? `${membership.freezePolicy.attempts} attempts · ${membership.freezePolicy.days} total days`
      : 'No configured freeze policy';
    const usageSource = membership.freezeUsage.available
      ? membership.freezeUsage.source
      : 'history unavailable';
    const actionState = currentModeConfig().getActionState(membership);

    return `
      <article class="membership-card ${selected ? 'selected' : ''}">
        <div>
          <span class="label">Membership</span>
          <strong class="membership-title">${escapeHtml(membership.membership.name || 'Unnamed membership')}</strong>
        </div>

        ${getStatusPill(membership.freezeEligibility, membership.isFrozen)}

        <div class="membership-meta">
          <div class="meta-row"><span>Type</span><strong>${escapeHtml(membership.type || '—')}</strong></div>
          <div class="meta-row"><span>Location</span><strong>${escapeHtml(membership.location || '—')}</strong></div>
          <div class="meta-row"><span>Validity</span><strong>${escapeHtml(formatDate(membership.startDate))} → ${escapeHtml(formatDate(membership.endDate))}</strong></div>
          <div class="meta-row"><span>Freeze rule</span><strong>${escapeHtml(policyText)}</strong></div>
          <div class="meta-row"><span>Used so far</span><strong>${escapeHtml(String(membership.freezeUsage.attemptsUsed))} attempts · ${escapeHtml(String(membership.freezeUsage.frozenDaysUsed))} days</strong></div>
          <div class="meta-row"><span>Remaining</span><strong>${escapeHtml(String(membership.freezeEligibility.attemptsRemaining))} attempts · ${escapeHtml(String(membership.freezeEligibility.daysRemaining))} days</strong></div>
          <div class="meta-row"><span>Usage source</span><strong>${escapeHtml(usageSource)}</strong></div>
        </div>

        <p class="helper-text">${escapeHtml(membership.freezeEligibility.reason)}</p>
        ${membership.freezeHistory?.summary ? `<p class="helper-text">${escapeHtml(membership.freezeHistory.summary)}</p>` : ''}

        <button
          class="button ${actionState.available ? 'button-primary' : 'button-secondary'}"
          type="button"
          data-membership-id="${escapeHtml(membership.id)}"
          ${actionState.available ? '' : 'disabled'}
        >
          ${escapeHtml(actionState.label)}
        </button>
      </article>
    `;
  }).join('');

  membershipsGrid.querySelectorAll('[data-membership-id]').forEach(button => {
    button.addEventListener('click', () => selectMembership(button.dataset.membershipId));
  });
}

function renderSelectedMembership() {
  const membership = state.selectedMembership;

  if (!membership) {
    selectedMembershipSummary.innerHTML = '';
    actionHint.textContent = currentModeConfig().selectionHint;
    return;
  }

  actionHint.textContent = currentModeConfig().activeHint(membership);
  selectedMembershipSummary.innerHTML = `
    <div class="detail-row"><span>Membership</span><strong>${escapeHtml(membership.membership.name)}</strong></div>
    <div class="detail-row"><span>Location</span><strong>${escapeHtml(membership.location || '—')}</strong></div>
    <div class="detail-row"><span>Status</span><strong>${escapeHtml(membership.isFrozen ? 'Currently frozen' : 'Active')}</strong></div>
    <div class="detail-row"><span>Policy</span><strong>${escapeHtml(`${membership.freezePolicy.attempts} attempts · ${membership.freezePolicy.days} days`)}</strong></div>
    <div class="detail-row"><span>Already used</span><strong>${escapeHtml(`${membership.freezeUsage.attemptsUsed} attempts · ${membership.freezeUsage.frozenDaysUsed} days`)}</strong></div>
    <div class="detail-row"><span>Still available</span><strong>${escapeHtml(`${membership.freezeEligibility.attemptsRemaining} attempts · ${membership.freezeEligibility.daysRemaining} days`)}</strong></div>
    <div class="detail-row"><span>Freeze history</span><strong>${escapeHtml(membership.freezeHistory?.summary || 'No freeze history yet')}</strong></div>
  `;
}

function selectMembership(membershipId) {
  state.selectedMembership = state.memberships.find(item => String(item.id) === String(membershipId)) || null;
  renderMemberships();
  renderSelectedMembership();
  schedulerSection.classList.remove('hidden');
  schedulerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function handleLookup(event) {
  event.preventDefault();
  resetSuccessState();
  clearBanner();

  const payload = Object.fromEntries(new FormData(lookupForm).entries());

  try {
    toggleBusy(lookupButton, true, 'Finding memberships...', 'Find memberships');
    setBanner('Looking up the member and checking active memberships…', 'info');

    const response = await apiFetch('/api/member-lookup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await readApiResponse(response);
    if (!response.ok) {
      throw new Error(data.error || 'Lookup failed.');
    }

    state.member = data.member;
    state.verification = data.verification;
    state.memberships = data.memberships || [];
    state.selectedMembership = null;

    renderMemberSummary();
    renderMemberships();
    renderSelectedMembership();

    memberSection.classList.remove('hidden');
    membershipsSection.classList.remove('hidden');
    schedulerSection.classList.add('hidden');

    if (!state.memberships.length) {
      setBanner('Member found, but there are no memberships available for the selected action.', 'error');
      return;
    }

    setBanner('Member found. Pick a tab, then choose a matching membership to continue.', 'success');
  } catch (error) {
    setBanner(error.message || 'Lookup failed. Please try again.', 'error');
    memberSection.classList.add('hidden');
    membershipsSection.classList.add('hidden');
    schedulerSection.classList.add('hidden');
  } finally {
    toggleBusy(lookupButton, false, 'Finding memberships...', 'Find memberships');
  }
}

async function handleMembershipAction(event) {
  event.preventDefault();

  if (!state.selectedMembership) {
    setBanner('Please select a matching membership before continuing.', 'error');
    return;
  }

  if (state.activeMode === 'freeze') {
    await handleFreezeAction();
    return;
  }

  if (state.activeMode === 'modify') {
    await handleModifyAction();
    return;
  }

  await handleRestartAction();
}

async function handleFreezeAction() {
  if (!startDateInput.value || !endDateInput.value) {
    setBanner('Please choose both a freeze start date and end date.', 'error');
    return;
  }

  const requestedDays = calculateRequestedDays(startDateInput.value, endDateInput.value);
  const startDateForApi = formatDateForApi(startDateInput.value);
  const endDateForApi = formatDateForApi(endDateInput.value);

  if (requestedDays === null || !startDateForApi || !endDateForApi) {
    setBanner('Please choose valid freeze dates.', 'error');
    return;
  }

  if (requestedDays < 0) {
    setBanner('Freeze end date must be the same day or later than the start date.', 'error');
    return;
  }

  if (requestedDays > state.selectedMembership.freezeEligibility.daysRemaining) {
    setBanner(`That range requests ${requestedDays} day(s), but only ${state.selectedMembership.freezeEligibility.daysRemaining} freeze day(s) remain for this membership.`, 'error');
    return;
  }

  try {
    toggleBusy(actionButton, true, 'Freezing membership...', MODE_CONFIG.freeze.actionLabel);
    setBanner('Scheduling the membership freeze with Momence…', 'info');

    const response = await apiFetch('/api/freeze-membership', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        memberId: state.member.id,
        boughtMembershipId: state.selectedMembership.id,
        startDate: startDateForApi,
        endDate: endDateForApi,
      }),
    });

    const data = await readApiResponse(response);
    if (!response.ok) {
      throw new Error(getApiErrorMessage(data, 'Freeze request failed.'));
    }

    renderSuccess(data, {
      banner: 'Membership freeze scheduled successfully.',
      windowLabel: 'Freeze window',
      requestedLabel: 'Requested duration',
      fallbackStatus: '',
    });
  } catch (error) {
    setBanner(error.message || 'Freeze failed. Please try again.', 'error');
  } finally {
    toggleBusy(actionButton, false, 'Freezing membership...', MODE_CONFIG.freeze.actionLabel);
  }
}

async function handleModifyAction() {
  const unfreezeDate = formatDateForApi(startDateInput.value);

  if (!startDateInput.value || !unfreezeDate) {
    setBanner('Please choose a valid scheduled unfreeze date.', 'error');
    return;
  }

  try {
    toggleBusy(actionButton, true, 'Saving updated date...', MODE_CONFIG.modify.actionLabel);
    setBanner('Updating the scheduled unfreeze date with Momence…', 'info');

    const response = await apiFetch('/api/unfreeze-membership', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        memberId: state.member.id,
        boughtMembershipId: state.selectedMembership.id,
        unfreezeDate,
      }),
    });

    const data = await readApiResponse(response);
    if (!response.ok) {
      throw new Error(getApiErrorMessage(data, 'Update request failed.'));
    }

    renderSuccess(data, {
      banner: 'Scheduled unfreeze updated successfully.',
      windowLabel: 'Updated freeze window',
      requestedLabel: 'Total frozen duration',
      fallbackStatus: '',
    });
  } catch (error) {
    setBanner(error.message || 'Update failed. Please try again.', 'error');
  } finally {
    toggleBusy(actionButton, false, 'Saving updated date...', MODE_CONFIG.modify.actionLabel);
  }
}

async function handleRestartAction() {
  try {
    toggleBusy(actionButton, true, 'Restarting membership...', MODE_CONFIG.restart.actionLabel);
    setBanner('Restarting the frozen membership with Momence…', 'info');

    const response = await apiFetch('/api/restart-membership', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        memberId: state.member.id,
        boughtMembershipId: state.selectedMembership.id,
      }),
    });

    const data = await readApiResponse(response);
    if (!response.ok) {
      throw new Error(getApiErrorMessage(data, 'Restart request failed.'));
    }

    renderSuccess(data, {
      banner: 'Frozen membership restarted successfully.',
      windowLabel: 'Status',
      requestedLabel: 'Action',
      fallbackStatus: 'Restarted immediately',
    });
  } catch (error) {
    setBanner(error.message || 'Restart failed. Please try again.', 'error');
  } finally {
    toggleBusy(actionButton, false, 'Restarting membership...', MODE_CONFIG.restart.actionLabel);
  }
}

function renderSuccess(data, { banner, windowLabel, requestedLabel, fallbackStatus }) {
  setBanner(banner, 'success');
  successTitle.textContent = currentModeConfig().successTitle;
  successMessage.textContent = data.message;

  const actionValue = fallbackStatus || `${data.requestedDays} day(s)`;
  const windowValue = data.freezeWindow
    ? `${formatDate(data.freezeWindow.freezeAt)} → ${formatDate(data.freezeWindow.unfreezeAt)}`
    : fallbackStatus;

  successDetails.innerHTML = `
    <div class="detail-row"><span>Member</span><strong>${escapeHtml(`${state.member.firstName} ${state.member.lastName}`)}</strong></div>
    <div class="detail-row"><span>Membership</span><strong>${escapeHtml(data.membershipName)}</strong></div>
    <div class="detail-row"><span>${escapeHtml(windowLabel)}</span><strong>${escapeHtml(windowValue)}</strong></div>
    <div class="detail-row"><span>${escapeHtml(requestedLabel)}</span><strong>${escapeHtml(actionValue)}</strong></div>
    ${data.resumeAt ? `<div class="detail-row"><span>Resume date</span><strong>${escapeHtml(formatDate(data.resumeAt))}</strong></div>` : ''}
  `;

  successSection.classList.remove('hidden');
  successSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
