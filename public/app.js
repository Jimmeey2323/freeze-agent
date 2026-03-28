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
const operationHeading = document.querySelector('#operation-heading');
const operationPill = document.querySelector('#operation-pill');
const operationShortcuts = document.querySelector('#operation-shortcuts');
const membershipsHeading = document.querySelector('#memberships-heading');
const schedulerHeading = document.querySelector('#scheduler-heading');
const schedulerBadge = document.querySelector('#scheduler-badge');
const startDateField = document.querySelector('#startDateField');
const endDateField = document.querySelector('#endDateField');
const startDateLabel = document.querySelector('#start-date-label');
const endDateLabel = document.querySelector('#end-date-label');
const toastRegion = document.querySelector('#toast-region');

let toastCounter = 0;
let activeToastTimeout = null;

const API_BASE_CANDIDATES = window.location.protocol === 'file:'
  ? ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003']
  : ['', 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'];

const MODE_CONFIG = {
  freeze: {
    pill: 'New freeze request',
    membershipsHeading: 'Choose membership',
    schedulerHeading: 'Complete request',
    schedulerBadge: 'Date picker ready',
    operationHeading: 'Choose freeze request type',
    operationPill: 'Freeze options',
    operations: [
      {
        value: 'scheduled-window',
        label: 'Schedule freeze + unfreeze',
        shortLabel: 'Planned freeze window',
        description: 'Pick a start time and an end time in one request.',
        buttonLabel: 'Schedule freeze',
        badge: 'Start and end time required',
        startLabel: 'Freeze start date & time',
        endLabel: 'Freeze end date & time',
        showStartDate: true,
        showEndDate: true,
        selectionHint: 'Select a membership to continue.',
        activeHint: membership => `Creating a request for ${membership.membership.name}.`,
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
        shortLabel: 'Schedule freeze start',
        description: 'Choose when the freeze should begin and leave the end open.',
        buttonLabel: 'Schedule freeze only',
        badge: 'Start time required',
        startLabel: 'Freeze start date & time',
        endLabel: 'Freeze end date & time',
        showStartDate: true,
        showEndDate: false,
        selectionHint: 'Select a membership to continue.',
        activeHint: membership => `Creating a request for ${membership.membership.name}.`,
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
        shortLabel: 'Freeze right now',
        description: 'Send an immediate freeze request with no scheduled end.',
        buttonLabel: 'Freeze immediately',
        badge: 'No dates needed',
        startLabel: 'Freeze start date & time',
        endLabel: 'Freeze end date & time',
        showStartDate: false,
        showEndDate: false,
        selectionHint: 'Select a membership to continue.',
        activeHint: membership => `Creating a request for ${membership.membership.name}.`,
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
        shortLabel: 'Freeze now, end later',
        description: 'Freeze now and specify the exact unfreeze time.',
        buttonLabel: 'Freeze now with unfreeze date',
        badge: 'Unfreeze time required',
        startLabel: 'Scheduled unfreeze date & time',
        endLabel: 'Freeze end date & time',
        showStartDate: true,
        showEndDate: false,
        selectionHint: 'Select a membership to continue.',
        activeHint: membership => `Creating a request for ${membership.membership.name}.`,
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
    pill: 'Update frozen membership',
    membershipsHeading: 'Choose membership',
    schedulerHeading: 'Update request',
    schedulerBadge: 'Specific action required',
    operationHeading: 'Choose frozen membership update',
    operationPill: 'Update options',
    operations: [
      {
        value: 'schedule-unfreeze',
        label: 'Schedule unfreeze',
        shortLabel: 'Set unfreeze time',
        description: 'Choose the exact moment the membership should resume.',
        buttonLabel: 'Save updated unfreeze date',
        badge: 'Unfreeze time required',
        startLabel: 'Scheduled unfreeze date & time',
        endLabel: 'Freeze end date & time',
        showStartDate: true,
        showEndDate: false,
        selectionHint: 'Select a frozen membership to continue.',
        activeHint: membership => `Updating ${membership.membership.name}.`,
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
        shortLabel: 'Clear unfreeze time',
        description: 'Keep the membership frozen and remove the planned resume time.',
        buttonLabel: 'Remove scheduled unfreeze',
        badge: 'No dates needed',
        startLabel: 'Scheduled unfreeze date & time',
        endLabel: 'Freeze end date & time',
        showStartDate: false,
        showEndDate: false,
        selectionHint: 'Select a frozen membership to continue.',
        activeHint: membership => `Updating ${membership.membership.name}.`,
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
    pill: 'Restart membership',
    membershipsHeading: 'Choose membership',
    schedulerHeading: 'Complete request',
    schedulerBadge: 'No dates needed',
    operationHeading: 'Choose restart action',
    operationPill: 'Restart options',
    operations: [
      {
        value: 'remove-scheduled-freeze',
        label: 'Unfreeze or remove scheduled freeze',
        shortLabel: 'Restart or clear freeze',
        description: 'Immediately restart a frozen membership or cancel a future freeze.',
        buttonLabel: 'Run freeze removal',
        badge: 'No dates needed',
        startLabel: 'Freeze start date & time',
        endLabel: 'Freeze end date & time',
        showStartDate: false,
        showEndDate: false,
        selectionHint: 'Select a membership to continue.',
        activeHint: membership => `Updating ${membership.membership.name}.`,
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
  feedbackBanner.className = 'feedback-banner hidden';

  if (!message) {
    return;
  }

  if (activeToastTimeout) {
    clearTimeout(activeToastTimeout);
  }

  const toast = document.createElement('div');
  const toastId = `toast-${++toastCounter}`;
  toast.className = `toast toast-${type}`;
  toast.dataset.toastId = toastId;
  toast.innerHTML = `
    <div class="toast-copy">
      <strong>${type === 'error' ? 'Please check this' : type === 'success' ? 'Done' : 'Notice'}</strong>
      <span>${escapeHtml(message)}</span>
    </div>
    <button type="button" class="toast-close" aria-label="Dismiss notification">×</button>
  `;

  toast.querySelector('.toast-close')?.addEventListener('click', () => removeToast(toastId));
  toastRegion.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  activeToastTimeout = window.setTimeout(() => removeToast(toastId), type === 'error' ? 7000 : 4200);
}

function clearBanner() {
  feedbackBanner.className = 'feedback-banner hidden';
  feedbackBanner.textContent = '';
}

function removeToast(toastId) {
  const toast = toastRegion.querySelector(`[data-toast-id="${toastId}"]`);
  if (!toast) {
    return;
  }

  toast.classList.remove('visible');
  window.setTimeout(() => toast.remove(), 180);
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
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function parseDateOnly(value) {
  const timestamp = Date.parse(value);
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

  renderOperationShortcuts();
}

function renderOperationShortcuts() {
  const modeConfig = currentModeConfig();
  const selectedValue = operationSelect.value || modeConfig.operations[0]?.value;

  operationHeading.textContent = modeConfig.operationHeading;
  operationPill.textContent = modeConfig.operationPill;
  operationShortcuts.innerHTML = modeConfig.operations.map(operation => `
    <button
      type="button"
      class="operation-chip ${operation.value === selectedValue ? 'active' : ''}"
      data-operation-value="${escapeHtml(operation.value)}"
      role="tab"
      aria-selected="${String(operation.value === selectedValue)}"
    >
      <span class="operation-chip-title">${escapeHtml(operation.shortLabel || operation.label)}</span>
      <span class="operation-chip-copy">${escapeHtml(operation.description || '')}</span>
    </button>
  `).join('');

  operationShortcuts.querySelectorAll('[data-operation-value]').forEach(button => {
    button.addEventListener('click', () => {
      operationSelect.value = button.dataset.operationValue;
      resetSuccessState();
      state.selectedMembership = null;
      applyOperationUi();
    });
  });
}

function applyOperationUi() {
  const modeConfig = currentModeConfig();
  const operationConfig = currentOperationConfig();

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
  renderOperationShortcuts();

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
      <div class="helper-text">${escapeHtml(member.email || '—')}</div>
    </article>
    <article class="summary-card">
      <span class="label">Contact</span>
      <strong>${escapeHtml(member.phoneNumber || '—')}</strong>
      <div class="helper-text">Member record found</div>
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
    const actionState = currentModeConfig().getActionState(membership, operationConfig);
    const statusText = membership.isFrozen ? 'Frozen' : hasScheduledFreeze(membership) ? 'Scheduled' : 'Active';
    const nextEvent = hasScheduledUnfreeze(membership)
      ? `Unfreezes ${formatDate(membership.freeze?.unfreezedScheduledAt || membership.freeze?.scheduledUnfreezeAt || membership.freeze?.unfreezeScheduledAt)}`
      : hasScheduledFreeze(membership)
        ? `Starts ${formatDate(membership.freeze?.scheduledFreezeAt || membership.freeze?.freezeScheduledAt || membership.freeze?.freezeAt)}`
        : 'Ready for selection';

    return `
      <article class="membership-card ${selected ? 'selected' : ''}">
        <div>
          <span class="label">Membership</span>
          <strong class="membership-title">${escapeHtml(membership.membership.name || 'Unnamed membership')}</strong>
        </div>

        ${getStatusPill(membership.freezeEligibility, membership.isFrozen)}

        <div class="membership-meta">
          <div class="meta-row"><span>Status</span><strong>${escapeHtml(statusText)}</strong></div>
          <div class="meta-row"><span>Location</span><strong>${escapeHtml(membership.location || '—')}</strong></div>
          <div class="meta-row"><span>Dates</span><strong>${escapeHtml(formatDate(membership.startDate))} → ${escapeHtml(formatDate(membership.endDate))}</strong></div>
        </div>

        <p class="membership-subnote">${escapeHtml(nextEvent)}</p>

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

      setBanner('Member found. Choose the exact action at the top, then select a matching membership below.', 'success');
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
        memberContext: {
          firstName: state.member.firstName,
          lastName: state.member.lastName,
          email: state.member.email,
        },
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
        memberContext: {
          firstName: state.member.firstName,
          lastName: state.member.lastName,
          email: state.member.email,
        },
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
        memberContext: {
          firstName: state.member.firstName,
          lastName: state.member.lastName,
          email: state.member.email,
        },
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

  const windowValue = formatSuccessWindow(data.freezeWindow, operationConfig.secondaryFallback);

  successDetails.innerHTML = `
    <div class="detail-row"><span>Membership</span><strong>${escapeHtml(data.membershipName)}</strong></div>
    <div class="detail-row"><span>${escapeHtml(operationConfig.summaryLabel)}</span><strong>${escapeHtml(windowValue)}</strong></div>
    ${data.resumeAt ? `<div class="detail-row"><span>Resume date</span><strong>${escapeHtml(formatDate(data.resumeAt))}</strong></div>` : ''}
  `;

  successSection.classList.remove('hidden');
  successSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
