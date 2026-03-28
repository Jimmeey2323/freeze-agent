const lookupForm = document.querySelector('#lookup-form');
const freezeForm = document.querySelector('#freeze-form');
const feedbackBanner = document.querySelector('#feedback-banner');
const lookupButton = document.querySelector('#lookup-button');
const freezeButton = document.querySelector('#freeze-button');
const memberSection = document.querySelector('#member-section');
const membershipsSection = document.querySelector('#memberships-section');
const schedulerSection = document.querySelector('#scheduler-section');
const successSection = document.querySelector('#success-section');
const memberSummary = document.querySelector('#member-summary');
const membershipsGrid = document.querySelector('#memberships-grid');
const membershipCount = document.querySelector('#membership-count');
const verificationPill = document.querySelector('#verification-pill');
const selectedMembershipSummary = document.querySelector('#selected-membership-summary');
const successMessage = document.querySelector('#success-message');
const successDetails = document.querySelector('#success-details');
const freezeHint = document.querySelector('#freeze-hint');
const startDateInput = document.querySelector('#startDate');
const endDateInput = document.querySelector('#endDate');
const API_BASE_URL = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

const state = {
  member: null,
  verification: null,
  memberships: [],
  selectedMembership: null,
};

lookupForm.addEventListener('submit', handleLookup);
freezeForm.addEventListener('submit', handleFreeze);

if (window.location.protocol === 'file:') {
  setBanner('You opened the app directly from a file. That causes API URL errors in the browser, so requests will be routed to http://localhost:3000 instead.', 'info');
}

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

function apiUrl(pathname) {
  return `${API_BASE_URL}${pathname}`;
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

function getStatusPill(eligibility) {
  if (eligibility.eligible) {
    return '<span class="status-pill success">Eligible to freeze</span>';
  }

  if (eligibility.daysRemaining > 0 || eligibility.attemptsRemaining > 0) {
    return '<span class="status-pill warning">Needs attention</span>';
  }

  return '<span class="status-pill danger">Not eligible</span>';
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

    return `
      <article class="membership-card ${selected ? 'selected' : ''}">
        <div>
          <span class="label">Membership</span>
          <strong class="membership-title">${escapeHtml(membership.membership.name || 'Unnamed membership')}</strong>
        </div>

        ${getStatusPill(membership.freezeEligibility)}

        <div class="membership-meta">
          <div class="meta-row"><span>Type</span><strong>${escapeHtml(membership.type || '—')}</strong></div>
          <div class="meta-row"><span>Validity</span><strong>${escapeHtml(formatDate(membership.startDate))} → ${escapeHtml(formatDate(membership.endDate))}</strong></div>
          <div class="meta-row"><span>Freeze rule</span><strong>${escapeHtml(policyText)}</strong></div>
          <div class="meta-row"><span>Used so far</span><strong>${escapeHtml(String(membership.freezeUsage.attemptsUsed))} attempts · ${escapeHtml(String(membership.freezeUsage.frozenDaysUsed))} days</strong></div>
          <div class="meta-row"><span>Remaining</span><strong>${escapeHtml(String(membership.freezeEligibility.attemptsRemaining))} attempts · ${escapeHtml(String(membership.freezeEligibility.daysRemaining))} days</strong></div>
          <div class="meta-row"><span>Usage source</span><strong>${escapeHtml(usageSource)}</strong></div>
        </div>

        <p class="helper-text">${escapeHtml(membership.freezeEligibility.reason)}</p>
        ${membership.freezeUsage.note ? `<p class="helper-text">${escapeHtml(membership.freezeUsage.note)}</p>` : ''}

        <button
          class="button ${membership.freezeEligibility.eligible ? 'button-primary' : 'button-secondary'}"
          type="button"
          data-membership-id="${escapeHtml(membership.id)}"
          ${membership.freezeEligibility.eligible ? '' : 'disabled'}
        >
          ${membership.freezeEligibility.eligible ? 'Select this membership' : 'Unavailable'}
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
    freezeHint.textContent = 'Choose a membership above to unlock scheduling.';
    return;
  }

  freezeHint.textContent = `You can request up to ${membership.freezeEligibility.daysRemaining} more day(s) across ${membership.freezeEligibility.attemptsRemaining} remaining attempt(s).`;
  selectedMembershipSummary.innerHTML = `
    <div class="detail-row"><span>Membership</span><strong>${escapeHtml(membership.membership.name)}</strong></div>
    <div class="detail-row"><span>Policy</span><strong>${escapeHtml(`${membership.freezePolicy.attempts} attempts · ${membership.freezePolicy.days} days`)}</strong></div>
    <div class="detail-row"><span>Already used</span><strong>${escapeHtml(`${membership.freezeUsage.attemptsUsed} attempts · ${membership.freezeUsage.frozenDaysUsed} days`)}</strong></div>
    <div class="detail-row"><span>Still available</span><strong>${escapeHtml(`${membership.freezeEligibility.attemptsRemaining} attempts · ${membership.freezeEligibility.daysRemaining} days`)}</strong></div>
  `;
}

function selectMembership(membershipId) {
  state.selectedMembership = state.memberships.find(item => String(item.id) === String(membershipId)) || null;
  renderMemberships();
  renderSelectedMembership();
  schedulerSection.classList.remove('hidden');
  schedulerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetSuccessState() {
  successSection.classList.add('hidden');
  successMessage.textContent = '';
  successDetails.innerHTML = '';
}

async function handleLookup(event) {
  event.preventDefault();
  resetSuccessState();
  clearBanner();

  const payload = Object.fromEntries(new FormData(lookupForm).entries());

  try {
    toggleBusy(lookupButton, true, 'Finding memberships...', 'Find memberships');
    setBanner('Looking up the member and checking active memberships…', 'info');

    const response = await fetch(apiUrl('/api/member-lookup'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
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
      setBanner('Member found, but there are no active memberships available to freeze.', 'error');
      return;
    }

    setBanner('Member found. Review eligibility and select a membership to continue.', 'success');
  } catch (error) {
    setBanner(error.message || 'Lookup failed. Please try again.', 'error');
    memberSection.classList.add('hidden');
    membershipsSection.classList.add('hidden');
    schedulerSection.classList.add('hidden');
  } finally {
    toggleBusy(lookupButton, false, 'Finding memberships...', 'Find memberships');
  }
}

async function handleFreeze(event) {
  event.preventDefault();

  if (!state.selectedMembership) {
    setBanner('Please select an eligible membership before scheduling a freeze.', 'error');
    return;
  }

  try {
    toggleBusy(freezeButton, true, 'Freezing membership...', 'Freeze membership');
    setBanner('Scheduling the membership freeze with Momence…', 'info');

    const response = await fetch(apiUrl('/api/freeze-membership'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        memberId: state.member.id,
        boughtMembershipId: state.selectedMembership.id,
        startDate: startDateInput.value,
        endDate: endDateInput.value,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Freeze request failed.');
    }

    setBanner('Membership freeze scheduled successfully.', 'success');
    successMessage.textContent = data.message;
    successDetails.innerHTML = `
      <div class="detail-row"><span>Member</span><strong>${escapeHtml(`${state.member.firstName} ${state.member.lastName}`)}</strong></div>
      <div class="detail-row"><span>Membership</span><strong>${escapeHtml(data.membershipName)}</strong></div>
      <div class="detail-row"><span>Freeze window</span><strong>${escapeHtml(formatDate(data.freezeWindow.freezeAt))} → ${escapeHtml(formatDate(data.freezeWindow.unfreezeAt))}</strong></div>
      <div class="detail-row"><span>Requested duration</span><strong>${escapeHtml(`${data.requestedDays} day(s)`)}</strong></div>
    `;
    successSection.classList.remove('hidden');
    successSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    setBanner(error.message || 'Freeze failed. Please try again.', 'error');
  } finally {
    toggleBusy(freezeButton, false, 'Freezing membership...', 'Freeze membership');
  }
}
