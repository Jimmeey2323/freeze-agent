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
const operationField = document.querySelector('#operationField');
const operationLabel = document.querySelector('#operation-label');
const operationSelect = document.querySelector('#operationType');
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
    operations: [
      {
        value: 'scheduled-window',
        label: 'Schedule freeze + unfreeze',
        buttonLabel: 'Schedule freeze',
        badge: 'Date range required',
        startLabel: 'Freeze start date',
        endLabel: 'Freeze end date',
        showStartDate: true,
        showEndDate: true,
        selectionHint: 'Choose an eligible membership above to schedule a freeze window.',
        activeHint: membership => `You can request up to ${membership.freezeEligibility.daysRemaining} more day(s) across ${membership.freezeEligibility.attemptsRemaining} remaining attempt(s).`,
        submittingMessage: 'Scheduling the membership freeze with Momence…',
        successBanner: 'Membership freeze scheduled successfully.',
        successTitle: 'Membership freeze scheduled successfully',
        summaryLabel: 'Freeze window',
        secondaryLabel: 'Requested duration',
        secondaryFallback: 'Scheduled',
      },
      {
        value: 'schedule-freeze-only',
        label: 'Schedule freeze only',
        buttonLabel: 'Schedule freeze only',
        badge: 'Single date required',
        startLabel: 'Freeze start date',
        endLabel: 'Freeze end date',
        showStartDate: true,
        showEndDate: false,
        selectionHint: 'Choose an eligible membership above to schedule its freeze start date.',
        activeHint: membership => `This will schedule the freeze start only. ${membership.freezeEligibility.attemptsRemaining} attempt(s) remain for this membership.`,
        submittingMessage: 'Scheduling the freeze start date with Momence…',
        successBanner: 'Membership freeze scheduled successfully.',
        successTitle: 'Membership freeze scheduled successfully',
        summaryLabel: 'Scheduled freeze',
        secondaryLabel: 'Action',
        secondaryFallback: 'Scheduled only',
      },
      {
        value: 'freeze-now',
        label: 'Freeze immediately',
        buttonLabel: 'Freeze immediately',
        badge: 'No dates needed',
        startLabel: 'Freeze start date',
        endLabel: 'Freeze end date',
        showStartDate: false,
        showEndDate: false,
        selectionHint: 'Choose an eligible membership above to freeze it immediately.',
        activeHint: membership => `This will freeze the membership right away. ${membership.freezeEligibility.attemptsRemaining} attempt(s) remain for this membership.`,
        submittingMessage: 'Freezing the membership immediately with Momence…',
        successBanner: 'Membership frozen immediately.',
        successTitle: 'Membership frozen immediately',
        summaryLabel: 'Status',
        secondaryLabel: 'Action',
        secondaryFallback: 'Frozen immediately',
      },
      {
        value: 'freeze-now-until',
        label: 'Freeze immediately + schedule unfreeze',
        buttonLabel: 'Freeze now with unfreeze date',
        badge: 'Single date required',
        startLabel: 'Scheduled unfreeze date',
        endLabel: 'Freeze end date',
        showStartDate: true,
        showEndDate: false,
        selectionHint: 'Choose an eligible membership above to freeze it now and set the unfreeze date.',
        activeHint: membership => `This will freeze the membership immediately and unfreeze it on the chosen date. ${membership.freezeEligibility.daysRemaining} day(s) remain.`,
        submittingMessage: 'Freezing the membership now and scheduling the unfreeze…',
        successBanner: 'Membership frozen now with scheduled unfreeze.',
        successTitle: 'Membership frozen now with scheduled unfreeze',
        summaryLabel: 'Freeze window',
        secondaryLabel: 'Requested duration',
        secondaryFallback: 'Scheduled',
      },
    ],
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
    operations: [
      {
        value: 'schedule-unfreeze',
        label: 'Schedule unfreeze',
        buttonLabel: 'Save updated unfreeze date',
        badge: 'Single date required',
        startLabel: 'Scheduled unfreeze date',
        endLabel: 'Freeze end date',
        showStartDate: true,
        showEndDate: false,
        selectionHint: 'Choose a currently frozen membership above to edit its unfreeze date.',
        activeHint: () => 'Choose the new date when the membership should unfreeze. The resume date will be the next day automatically.',
        submittingMessage: 'Updating the scheduled unfreeze date with Momence…',
        successBanner: 'Scheduled unfreeze updated successfully.',
        successTitle: 'Frozen membership updated successfully',
        summaryLabel: 'Updated freeze window',
        secondaryLabel: 'Total frozen duration',
        secondaryFallback: 'Updated',
      },
      {
        value: 'remove-scheduled-unfreeze',
        label: 'Remove scheduled unfreeze',
        buttonLabel: 'Remove scheduled unfreeze',
        badge: 'No dates needed',
        startLabel: 'Scheduled unfreeze date',
        endLabel: 'Freeze end date',
        showStartDate: false,
        showEndDate: false,
        selectionHint: 'Choose a frozen membership that already has a scheduled unfreeze.',
        activeHint: () => 'This will delete the scheduled unfreeze and keep the membership frozen.',
        submittingMessage: 'Removing the scheduled unfreeze with Momence…',
        successBanner: 'Scheduled unfreeze removed successfully.',
        successTitle: 'Scheduled unfreeze removed successfully',
        summaryLabel: 'Status',
        secondaryLabel: 'Action',
        secondaryFallback: 'Scheduled unfreeze removed',
      },
    ],
    getActionState: (membership, operation) => ({
      available: operation.value === 'remove-scheduled-unfreeze'
        ? Boolean(membership.actions?.canRemoveScheduledUnfreeze)
        : Boolean(membership.actions?.canModifyFrozen),
      label: operation.value === 'remove-scheduled-unfreeze'
        ? (membership.actions?.canRemoveScheduledUnfreeze ? 'Remove scheduled unfreeze' : 'No scheduled unfreeze')
        : (membership.actions?.canModifyFrozen ? 'Modify this frozen membership' : 'Not currently frozen'),
    }),
  },
  restart: {
    pill: 'Restart frozen membership',
    membershipsHeading: 'Choose a membership to unfreeze or remove scheduled freeze',
    schedulerHeading: 'Unfreeze or remove scheduled freeze',
    schedulerBadge: 'No dates needed',
    operations: [
      {
        value: 'remove-scheduled-freeze',
        label: 'Unfreeze or remove scheduled freeze',
        buttonLabel: 'Run freeze removal',
        badge: 'No dates needed',
        startLabel: 'Freeze start date',
        endLabel: 'Freeze end date',
        showStartDate: false,
        showEndDate: false,
        selectionHint: 'Choose a frozen membership or one that already has a scheduled freeze.',
        activeHint: membership => membership.isFrozen
          ? 'This will unfreeze the membership immediately.'
          : 'This will remove the scheduled freeze before it starts.',
        submittingMessage: 'Removing the freeze or scheduled freeze with Momence…',
        successBanner: 'Freeze removal completed successfully.',
        successTitle: 'Freeze removal completed successfully',
        summaryLabel: 'Status',
        secondaryLabel: 'Action',
        secondaryFallback: 'Completed',
      },
    ],
    getActionState: membership => ({
      available: Boolean(membership.actions?.canRestartFrozen),
      label: membership.actions?.canRestartFrozen ? 'Remove freeze from this membership' : 'No removable freeze found',
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
operationSelect.addEventListener('change', () => {
  resetSuccessState();
  state.selectedMembership = null;
  applyOperationUi();
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

  if (state.activeMode === 'restart') {
    return '<span class="status-pill warning">Scheduled or active freeze required</span>';
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

function currentOperationConfig() {
  const modeConfig = currentModeConfig();
  return modeConfig.operations.find(operation => operation.value === operationSelect.value) || modeConfig.operations[0];
}

function hasScheduledFreeze(membership) {
  return Boolean(
    membership.freeze?.scheduledFreezeAt
    || membership.freeze?.freezeScheduledAt
    || membership.freeze?.freezeAt,
  );
}

function hasScheduledUnfreeze(membership) {
  return Boolean(
    membership.freeze?.unfreezedScheduledAt
    || membership.freeze?.scheduledUnfreezeAt
    || membership.freeze?.unfreezeScheduledAt,
  );
}

function getVisibleMemberships() {
  const operation = currentOperationConfig().value;

  return state.memberships.filter(membership => {
    if (state.activeMode === 'freeze') {
      return Boolean(membership.actions?.canFreeze);
    }

    if (state.activeMode === 'modify') {
      if (operation === 'remove-scheduled-unfreeze') {
        return Boolean(membership.actions?.canRemoveScheduledUnfreeze || hasScheduledUnfreeze(membership));
      }

      return Boolean(membership.actions?.canModifyFrozen);
    }

    return Boolean(membership.actions?.canRestartFrozen || membership.isFrozen || hasScheduledFreeze(membership));
  });
}

function getEmptyMembershipMessage() {
  const operation = currentOperationConfig().value;

  if (state.activeMode === 'freeze') {
    return 'No active memberships are currently eligible for a new freeze request.';
  }

  if (state.activeMode === 'modify' && operation === 'remove-scheduled-unfreeze') {
    return 'There are no frozen memberships with a scheduled unfreeze to remove.';
  }

  if (state.activeMode === 'modify') {
    return 'There are no frozen memberships available to modify right now.';
  }

  return 'There are no frozen or scheduled-to-freeze memberships available to restart or remove.';
}

function populateOperationOptions() {
  const modeConfig = currentModeConfig();
  operationSelect.innerHTML = modeConfig.operations
    .map(operation => `<option value="${escapeHtml(operation.value)}">${escapeHtml(operation.label)}</option>`)
    .join('');
}

function applyOperationUi() {
  const modeConfig = currentModeConfig();
  const operationConfig = currentOperationConfig();

  operationLabel.textContent = modeConfig === MODE_CONFIG.restart ? 'Action' : 'Action type';
  operationField.classList.toggle('hidden', modeConfig.operations.length <= 1);
  schedulerBadge.textContent = operationConfig.badge || modeConfig.schedulerBadge;
  successTitle.textContent = operationConfig.successTitle;
  actionButton.textContent = operationConfig.buttonLabel;
  startDateLabel.textContent = operationConfig.startLabel;
  endDateLabel.textContent = operationConfig.endLabel;
  startDateField.classList.toggle('hidden', !operationConfig.showStartDate);
  endDateField.classList.toggle('hidden', !operationConfig.showEndDate);
  startDateInput.required = operationConfig.showStartDate;
  endDateInput.required = operationConfig.showEndDate;

  if (!operationConfig.showStartDate) {
    startDateInput.value = '';
  }

  if (!operationConfig.showEndDate) {
    endDateInput.value = '';
  }

  schedulerSection.classList.add('hidden');

  renderMemberships();
  renderSelectedMembership();
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
  populateOperationOptions();
  applyOperationUi();
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
  const visibleMemberships = getVisibleMemberships();
  membershipCount.textContent = `${visibleMemberships.length} matching membership${visibleMemberships.length === 1 ? '' : 's'}`;
  const operationConfig = currentOperationConfig();

  if (!visibleMemberships.length) {
    membershipsGrid.innerHTML = `
      <article class="empty-state-card">
        <span class="label">No matching memberships</span>
        <strong>${escapeHtml(getEmptyMembershipMessage())}</strong>
        <p class="helper-text">Try a different top-level flow only if the member's state actually changed. For example: create new freeze for active memberships, modify for currently frozen memberships, restart for frozen or scheduled freezes.</p>
      </article>
    `;
    return;
  }

  membershipsGrid.innerHTML = visibleMemberships.map(membership => {
    const selected = state.selectedMembership?.id === membership.id;
    const policyText = membership.freezePolicy
      ? `${membership.freezePolicy.attempts} attempts · ${membership.freezePolicy.days} total days`
      : 'No configured freeze policy';
    const usageSource = membership.freezeUsage.available
      ? membership.freezeUsage.source
      : 'history unavailable';
    const actionState = currentModeConfig().getActionState(membership, operationConfig);

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
  const operationConfig = currentOperationConfig();

  if (!membership) {
    selectedMembershipSummary.innerHTML = '';
    actionHint.textContent = operationConfig.selectionHint;
    return;
  }

  actionHint.textContent = operationConfig.activeHint(membership);
  selectedMembershipSummary.innerHTML = `
    <div class="detail-row"><span>Membership</span><strong>${escapeHtml(membership.membership.name)}</strong></div>
    <div class="detail-row"><span>Location</span><strong>${escapeHtml(membership.location || '—')}</strong></div>
    <div class="detail-row"><span>Status</span><strong>${escapeHtml(membership.isFrozen ? 'Currently frozen' : hasScheduledFreeze(membership) ? 'Freeze scheduled' : 'Active')}</strong></div>
    <div class="detail-row"><span>Scheduled freeze</span><strong>${escapeHtml(membership.freeze?.scheduledFreezeAt ? formatDate(membership.freeze.scheduledFreezeAt) : '—')}</strong></div>
    <div class="detail-row"><span>Scheduled unfreeze</span><strong>${escapeHtml(membership.freeze?.unfreezedScheduledAt ? formatDate(membership.freeze.unfreezedScheduledAt) : '—')}</strong></div>
    <div class="detail-row"><span>Policy</span><strong>${escapeHtml(`${membership.freezePolicy.attempts} attempts · ${membership.freezePolicy.days} days`)}</strong></div>
    <div class="detail-row"><span>Already used</span><strong>${escapeHtml(`${membership.freezeUsage.attemptsUsed} attempts · ${membership.freezeUsage.frozenDaysUsed} days`)}</strong></div>
    <div class="detail-row"><span>Still available</span><strong>${escapeHtml(`${membership.freezeEligibility.attemptsRemaining} attempts · ${membership.freezeEligibility.daysRemaining} days`)}</strong></div>
    <div class="detail-row"><span>Freeze history</span><strong>${escapeHtml(membership.freezeHistory?.summary || 'No freeze history yet')}</strong></div>
  `;
}

function selectMembership(membershipId) {
  state.selectedMembership = getVisibleMemberships().find(item => String(item.id) === String(membershipId)) || null;
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

    if (!getVisibleMemberships().length) {
      setBanner(getEmptyMembershipMessage(), 'error');
      return;
    }

    setBanner('Member found. The interface is now filtered to the flow you selected, so only relevant memberships are shown.', 'success');
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
  const operationConfig = currentOperationConfig();
  const operation = operationConfig.value;
  const startDateForApi = formatDateForApi(startDateInput.value);
  const endDateForApi = formatDateForApi(endDateInput.value);

  if (operation === 'scheduled-window') {
    if (!startDateInput.value || !endDateInput.value) {
      setBanner('Please choose both a freeze start date and end date.', 'error');
      return;
    }

    const requestedDays = calculateRequestedDays(startDateInput.value, endDateInput.value);
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
  }

  if (operation === 'schedule-freeze-only' && !startDateForApi) {
    setBanner('Please choose a valid freeze start date.', 'error');
    return;
  }

  if (operation === 'freeze-now-until' && !startDateForApi) {
    setBanner('Please choose a valid scheduled unfreeze date.', 'error');
    return;
  }

  try {
    toggleBusy(actionButton, true, 'Working…', operationConfig.buttonLabel);
    setBanner(operationConfig.submittingMessage, 'info');

    const response = await apiFetch('/api/freeze-membership', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        memberId: state.member.id,
        boughtMembershipId: state.selectedMembership.id,
        operation,
        startDate: startDateForApi,
        endDate: endDateForApi,
        unfreezeDate: operation === 'freeze-now-until' ? startDateForApi : null,
      }),
    });

    const data = await readApiResponse(response);
    if (!response.ok) {
      throw new Error(getApiErrorMessage(data, 'Freeze request failed.'));
    }

    renderSuccess(data, operationConfig);
  } catch (error) {
    setBanner(error.message || 'Freeze failed. Please try again.', 'error');
  } finally {
    toggleBusy(actionButton, false, 'Working…', operationConfig.buttonLabel);
  }
}

async function handleModifyAction() {
  const operationConfig = currentOperationConfig();
  const operation = operationConfig.value;
  const unfreezeDate = formatDateForApi(startDateInput.value);

  if (operation === 'schedule-unfreeze' && (!startDateInput.value || !unfreezeDate)) {
    setBanner('Please choose a valid scheduled unfreeze date.', 'error');
    return;
  }

  try {
    toggleBusy(actionButton, true, 'Working…', operationConfig.buttonLabel);
    setBanner(operationConfig.submittingMessage, 'info');

    const response = await apiFetch('/api/unfreeze-membership', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        memberId: state.member.id,
        boughtMembershipId: state.selectedMembership.id,
        operation,
        unfreezeDate,
      }),
    });

    const data = await readApiResponse(response);
    if (!response.ok) {
      throw new Error(getApiErrorMessage(data, 'Update request failed.'));
    }

    renderSuccess(data, operationConfig);
  } catch (error) {
    setBanner(error.message || 'Update failed. Please try again.', 'error');
  } finally {
    toggleBusy(actionButton, false, 'Working…', operationConfig.buttonLabel);
  }
}

async function handleRestartAction() {
  const operationConfig = currentOperationConfig();

  try {
    toggleBusy(actionButton, true, 'Working…', operationConfig.buttonLabel);
    setBanner(operationConfig.submittingMessage, 'info');

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

    renderSuccess(data, operationConfig);
  } catch (error) {
    setBanner(error.message || 'Restart failed. Please try again.', 'error');
  } finally {
    toggleBusy(actionButton, false, 'Working…', operationConfig.buttonLabel);
  }
}

function formatSuccessWindow(freezeWindow, fallbackText) {
  if (!freezeWindow) {
    return fallbackText;
  }

  if (freezeWindow.freezeAt && freezeWindow.unfreezeAt) {
    return `${formatDate(freezeWindow.freezeAt)} → ${formatDate(freezeWindow.unfreezeAt)}`;
  }

  if (freezeWindow.freezeAt) {
    return `Starts ${formatDate(freezeWindow.freezeAt)}`;
  }

  return fallbackText;
}

function renderSuccess(data, operationConfig) {
  setBanner(operationConfig.successBanner, 'success');
  successTitle.textContent = operationConfig.successTitle;
  successMessage.textContent = data.message;

  const actionValue = Number.isFinite(data.requestedDays)
    ? `${data.requestedDays} day(s)`
    : operationConfig.secondaryFallback;
  const windowValue = formatSuccessWindow(data.freezeWindow, operationConfig.secondaryFallback);

  successDetails.innerHTML = `
    <div class="detail-row"><span>Member</span><strong>${escapeHtml(`${state.member.firstName} ${state.member.lastName}`)}</strong></div>
    <div class="detail-row"><span>Membership</span><strong>${escapeHtml(data.membershipName)}</strong></div>
    <div class="detail-row"><span>${escapeHtml(operationConfig.summaryLabel)}</span><strong>${escapeHtml(windowValue)}</strong></div>
    <div class="detail-row"><span>${escapeHtml(operationConfig.secondaryLabel)}</span><strong>${escapeHtml(actionValue)}</strong></div>
    ${data.resumeAt ? `<div class="detail-row"><span>Resume date</span><strong>${escapeHtml(formatDate(data.resumeAt))}</strong></div>` : ''}
  `;

  successSection.classList.remove('hidden');
  successSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
