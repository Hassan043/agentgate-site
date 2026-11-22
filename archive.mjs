import { rank } from './rank.mjs';

const form = document.querySelector('#search');
const query = document.querySelector('#query');
const source = document.querySelector('#source');
const status = document.querySelector('#status');
const results = document.querySelector('#results');
let archive;

function render(records) {
  results.replaceChildren();
  status.textContent = records.length
    ? `${records.length} ${records.length === 1 ? 'result' : 'results'} · keyword match`
    : 'No matching passage. Try fewer words or change the source filter.';
  for (const record of records) {
    const article = document.createElement('article');
    article.className = 'result';
    const citation = document.createElement('p');
    citation.className = 'citation';
    citation.textContent = `${record.type} · ${record.locator} · Revision ${record.revision}`;
    const title = document.createElement('h3');
    title.textContent = record.title;
    const text = document.createElement('p');
    text.textContent = record.text;
    article.append(citation, title, text);
    results.append(article);
  }
}

async function run() {
  if (!query.value.trim()) {
    status.textContent = 'Enter a search query.';
    return;
  }
  status.textContent = 'Searching the archive…';
  try {
    archive ??= fetch('./corpus.json').then(response => {
      if (!response.ok) throw new Error('unavailable');
      return response.json();
    });
    const records = await archive;
    render(rank(records, query.value, source.value));
  } catch {
    archive = undefined;
    results.replaceChildren();
    status.textContent = 'The sample archive is unavailable. Try again shortly.';
  }
}

form.addEventListener('submit', event => { event.preventDefault(); void run(); });
for (const button of document.querySelectorAll('[data-query]')) {
  button.addEventListener('click', () => {
    query.value = button.dataset.query;
    source.value = 'all';
    void run();
  });
}
