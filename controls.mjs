export function transition(current, action) {
  if (action === 'reset') return { state: 'pending', events: ['Invoice action proposed · Awaiting approval'] };
  let state = current.state;
  let record;
  if (action === 'blocked') record = 'Customer export blocked · No connector effect';
  if (state === 'pending' && action === 'approve') {
    state = 'approved';
    record = 'Exact invoice action approved by the fixture reviewer';
  }
  if (state === 'pending' && action === 'reject') {
    state = 'rejected';
    record = 'Invoice action rejected · No connector effect';
  }
  if (state === 'approved' && action === 'execute') {
    state = 'executed';
    record = 'Simulated connector receipt · USD 75.00 recorded once';
  }
  if (state === 'approved' && action === 'cancel') {
    state = 'cancelled';
    record = 'Posting cancelled · No connector effect';
  }
  return { state, events: record ? [...current.events, record] : current.events };
}

if (typeof document !== 'undefined') {
  const buttons = [...document.querySelectorAll('[data-control]')];
  const stages = [...document.querySelectorAll('[data-stage]')];
  const labels = { pending: 'Awaiting approval', approved: 'Approved', rejected: 'Rejected', executed: 'Receipt recorded', cancelled: 'Cancelled' };
  const hints = {
    pending: 'Review the amount and destination before you approve.',
    approved: 'This action is approved. Post it to the sample ledger to see the receipt.',
    rejected: 'The invoice was rejected. No ledger entry was recorded.',
    executed: 'The approved action completed. The sample ledger recorded one entry.',
    cancelled: 'Posting was cancelled before execution. No ledger entry was recorded.',
  };
  let current = transition(null, 'reset');
  function render() {
    const stage = { pending: 'review', approved: 'post', executed: 'receipt' }[current.state];
    const activeIndex = stages.findIndex(item => item.dataset.stage === stage);
    stages.forEach((item, index) => {
      if (index === activeIndex) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
      item.classList.toggle('is-complete', activeIndex >= 0 && index < activeIndex);
    });
    document.querySelector('#approval-state').textContent = labels[current.state];
    document.querySelector('#review-workspace').dataset.state = current.state;
    document.querySelector('#review-hint').textContent = hints[current.state];
    const receipt = document.querySelector('#review-receipt');
    receipt.hidden = current.state !== 'executed';
    receipt.textContent = receipt.hidden ? '' : 'Receipt INV-018 · USD 75.00 · Sample invoice ledger';
    document.querySelector('#approval-trace').replaceChildren(...current.events.map(event => {
      const item = document.createElement('li');
      item.textContent = event;
      return item;
    }));
    for (const button of buttons) {
      if (['approve', 'reject'].includes(button.dataset.control)) button.hidden = current.state !== 'pending';
      if (button.dataset.control === 'execute') {
        button.hidden = current.state !== 'approved';
        button.disabled = button.hidden;
      }
      if (button.dataset.control === 'cancel') button.hidden = current.state !== 'approved';
    }
  }
  for (const button of buttons) button.addEventListener('click', () => {
    current = transition(current, button.dataset.control);
    render();
    if (button.dataset.control === 'approve') document.querySelector('[data-control="execute"]').focus();
    if (['reject', 'cancel', 'execute'].includes(button.dataset.control)) document.querySelector('[data-control="reset"]').focus();
  });
  render();
}
