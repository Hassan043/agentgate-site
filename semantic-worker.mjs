const MODEL = 'BAAI/bge-small-en-v1.5';
const REVISION = '5c38ec7c405ec4b44b94cc5a9bb96e735b38267a';
const PREFIX = 'Represent this sentence for searching relevant passages: ';
let model;

async function load(id) {
  const { env, pipeline } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
  env.allowLocalModels = false;
  env.backends.onnx.wasm.numThreads = 1;
  return pipeline('feature-extraction', MODEL, {
    revision: REVISION, dtype: 'fp32', device: 'wasm',
    progress_callback: progress => {
      if (progress.status === 'progress' && progress.file?.endsWith('model.onnx')) {
        self.postMessage({ id, progress: Math.round(progress.progress) });
      }
    },
  });
}

self.onmessage = async ({ data: { id, query } }) => {
  try {
    model ??= load(id).catch(error => { model = undefined; throw error; });
    const embed = await model;
    const result = await embed(PREFIX + query, { pooling: 'cls', normalize: true });
    self.postMessage({ id, vector: Array.from(result.data) });
  } catch {
    self.postMessage({ id, error: 'The browser model could not load or run. Try again or use keyword search.' });
  }
};
