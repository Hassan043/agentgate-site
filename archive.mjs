import { rank } from './rank.mjs';
import { semanticRank } from './semantic-rank.mjs';

const byId = id => document.getElementById(id);
const form = byId('search');
const query = byId('query');
const source = byId('source');
const status = byId('status');
const results = byId('results');
const detail = byId('detail');
const cases = byId('case');
const rankingMode = byId('ranking-mode');
let activeMode = 'keyword';
let dataset;
let requestId = 0;
let worker;
let modelReady = false;
let embeddings;

function loadDataset() {
  dataset ??= Promise.all(['corpus.json', 'replays.json'].map(async path => {
    const response = await fetch('./' + path);
    if (!response.ok) throw new Error('Archive unavailable');
    return response.json();
  })).catch(error => { dataset = undefined; throw error; });
  return dataset;
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function showDetail(record, button) {
  for (const other of results.querySelectorAll('button')) other.setAttribute('aria-pressed', String(other === button));
  const passage = element('p', record.text, 'passage');
  const meta = element('dl', undefined, 'citation-meta');
  for (const [name, value] of [['Source', record.title], ['Citation', record.locator], ['Revision', record.revision], ['Revision SHA-256', record.hash]]) {
    if (value) meta.append(element('dt', name), element('dd', value));
  }
  detail.replaceChildren(passage, meta);
}

function render(records, context) {
  results.replaceChildren();
  detail.replaceChildren(element('p', 'Select a result to inspect its passage and source.'));
  status.textContent = records.length
    ? `${records.length} ${records.length === 1 ? 'result' : 'results'} · ${context}`
    : `No results · ${context}`;
  for (const [index, record] of records.entries()) {
    const button = element('button', undefined, 'result');
    button.type = 'button';
    button.setAttribute('aria-pressed', 'false');
    button.append(
      element('span', String(index + 1).padStart(2, '0'), 'rank'),
      element('strong', record.title),
      element('span', [record.type, record.locator, record.revision,
        record.score === undefined ? '' : 'cosine ' + record.score.toFixed(3)].filter(Boolean).join(' · '), 'result-meta'),
    );
    button.addEventListener('click', () => showDetail(record, button));
    results.append(button);
    if (index === 0) showDetail(record, button);
  }
}

async function run() {
  const id = ++requestId;
  status.textContent = 'Loading evidence…';
  try {
    const [records, replays] = await loadDataset();
    if (requestId !== id) return;
    if (!cases.options.length) {
      for (const item of replays) {
        const option = element('option', item.id + ' · ' + item.question);
        option.value = item.id;
        cases.append(option);
      }
      cases.value = 'Q02';
    }
    if (activeMode === 'keyword') {
      const value = query.value.trim();
      render(rank(records, value, source.value), value ? 'browser keyword search' : 'enter a search query');
    } else {
      const selected = replays.find(item => item.id === cases.value);
      const saved = selected.rankings[rankingMode.value];
      const byKey = new Map(records.map(record => [record.key, record]));
      const rankLabel = saved.firstRank === null ? 'missed at top 10' : 'first relevant at rank ' + saved.firstRank;
      const matches = saved.keys.map(key => byKey.get(key));
      if (matches.some(match => !match)) throw new Error('Citation mismatch');
      render(matches, 'recorded · ' + rankLabel);
    }
  } catch {
    if (requestId === id) {
      results.replaceChildren();
      detail.replaceChildren();
      status.textContent = 'The sample archive could not load. Please try again.';
    }
  }
}

function switchMode(mode) {
  ++requestId;
  activeMode = mode;
  const isKeyword = mode === 'keyword';
  byId('keywords-tab').setAttribute('aria-pressed', String(isKeyword));
  byId('live-tab').setAttribute('aria-pressed', String(mode === 'live'));
  byId('semantic-tab').setAttribute('aria-pressed', String(mode === 'semantic'));
  byId('keyword-panel').hidden = !isKeyword;
  byId('live-panel').hidden = mode !== 'live';
  byId('semantic-panel').hidden = mode !== 'semantic';
}

function browserEmbedding(id, text) {
  worker ??= new Worker(new URL('./semantic-worker.mjs', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    const session = worker;
    const close = () => {
      clearTimeout(timer);
      session.removeEventListener('message', onMessage);
      session.removeEventListener('error', onError);
    };
    const onError = () => {
      close();
      session.terminate();
      worker = undefined;
      modelReady = false;
      reject(new Error('Browser model unavailable'));
    };
    const timer = setTimeout(onError, 180_000);
    function onMessage({ data }) {
      if (data.id !== id) return;
      if (data.progress !== undefined) {
        if (requestId === id) status.textContent = 'Downloading BGE model · ' + data.progress + '%';
      } else {
        close();
        if (data.error) reject(new Error(data.error));
        else resolve(data.vector);
      }
    }
    session.addEventListener('message', onMessage);
    session.addEventListener('error', onError);
    session.postMessage({ id, query: text });
  });
}

async function runLive(event) {
  event.preventDefault();
  const text = byId('live-query').value.trim();
  if (!text) {
    status.textContent = 'Enter a search question.';
    return;
  }
  const selectedSource = byId('live-source').value;
  const button = byId('live-submit');
  const id = ++requestId;
  button.disabled = true;
  status.textContent = modelReady ? 'Ranking evidence…' : 'Loading the browser model…';
  detail.replaceChildren();
  results.replaceChildren();
  try {
    embeddings ??= fetch('./semantic-index.json').then(response => {
      if (!response.ok) throw new Error('Semantic index unavailable');
      return response.json();
    }).catch(error => { embeddings = undefined; throw error; });
    const [[records], index, vector] = await Promise.all([loadDataset(), embeddings, browserEmbedding(id, text)]);
    modelReady = true;
    if (requestId === id) render(semanticRank(records, index, vector, selectedSource), 'live BGE cosine search');
  } catch {
    if (requestId === id) status.textContent = 'Live semantic search is unavailable in this browser. Try again or use keyword search.';
  } finally {
    button.disabled = false;
    button.textContent = modelReady ? 'Search by meaning' : 'Load model & search';
  }
}

form.addEventListener('submit', event => { event.preventDefault(); void run(); });
byId('keywords-tab').addEventListener('click', () => { switchMode('keyword'); void run(); });
byId('live-tab').addEventListener('click', () => {
  switchMode('live');
  results.replaceChildren();
  detail.replaceChildren(element('p', 'Select a result to inspect its passage and source.'));
  status.textContent = 'Enter a question to run the browser model.';
});
byId('semantic-tab').addEventListener('click', () => { switchMode('semantic'); void run(); });
byId('live-search').addEventListener('submit', runLive);
cases.addEventListener('change', run);
rankingMode.addEventListener('change', run);
source.addEventListener('change', run);
for (const button of document.querySelectorAll('[data-query]')) {
  button.addEventListener('click', () => {
    query.value = button.dataset.query;
    source.value = 'all';
    void run();
  });
}
for (const button of document.querySelectorAll('[data-case]')) {
  button.addEventListener('click', async () => {
    switchMode('semantic');
    await run();
    cases.value = button.dataset.case;
    await run();
    byId('workbench').scrollIntoView();
    cases.focus({ preventScroll: true });
  });
}
query.value = 'freezer alarm threshold';
void run();
