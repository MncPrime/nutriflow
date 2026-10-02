import { groupItemsIntoLines } from './pdf-lines.js';
import { extractPlanSchedules } from './pdf-plan.js';

const MAX_BYTES = 15 * 1024 * 1024;
let enginePromise;

function loadEngine() {
  enginePromise ||= (async () => {
    const [pdfjs, worker] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const response = await fetch(worker.default);
    if (!response.ok) throw new Error(`Não foi possível preparar o worker PDF: ${response.status}`);
    return pdfjs;
  })().catch(error => { enginePromise = undefined; throw error; });
  return enginePromise;
}

export function preloadPdfEngine() {
  return loadEngine();
}

export async function extractPdfLines(file) {
  if (!file) throw new Error('Nenhum arquivo selecionado.');
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
  if (!isPdf) throw new Error('O arquivo precisa ser um PDF.');
  if (file.size > MAX_BYTES) throw new Error('O PDF é grande demais (máximo de 15 MB).');
  let pdfjs;
  try { pdfjs = await loadEngine(); }
  catch { throw new Error('O leitor de PDF ainda não está disponível offline. Conecte-se uma vez ou cole o texto.'); }
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  let document;
  try { document = await loadingTask.promise; }
  catch (error) {
    if (error?.name === 'PasswordException') throw new Error('O PDF está protegido por senha.');
    throw new Error('Não foi possível ler este PDF.');
  }
  const pages = document.numPages;
  const lines = [];
  const planPages = [];
  try {
    for (let number = 1; number <= pages; number += 1) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      planPages.push({ items: content.items });
      lines.push(...groupItemsIntoLines(content.items));
    }
  } finally {
    await loadingTask.destroy();
  }
  if (!lines.length) throw new Error('Este PDF não tem texto selecionável (parece escaneado). Use a opção de colar o texto.');
  return { text: lines.join('\n'), pages, schedules: extractPlanSchedules(planPages) };
}
