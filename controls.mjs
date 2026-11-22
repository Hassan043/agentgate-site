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
  return { state, events: record ? [...current.events, record] : current.events };
}

if (typeof document !== 'undefined') {
  const buttons = [...document.querySelectorAll('[data-control]')];
  const labels = { pending: 'Awaiting approval', approved: 'Approved', rejected: 'Rejected', executed: 'Receipt recorded' };
  let current = transition(null, 'reset');
  function render() {
    document.querySelector('#approval-state').textContent = labels[current.state];
    document.querySelector('#approval-trace').replaceChildren(...current.events.map(event => {
      const item = document.createElement('li');
      item.textContent = event;
      return item;
    }));
    for (const button of buttons) {
      if (['approve', 'reject'].includes(button.dataset.control)) button.disabled = current.state !== 'pending';
      if (button.dataset.control === 'execute') button.disabled = current.state !== 'approved';
    }
  }
  for (const button of buttons) button.addEventListener('click', () => {
    current = transition(current, button.dataset.control);
    render();
  });
  render();
}
