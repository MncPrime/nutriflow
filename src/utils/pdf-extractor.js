/**
 * PDF Extractor - Extração de texto de PDF usando a API nativa do PDF.js
 * Funciona offline, no navegador
 * 
 * Suporta dois modos:
 * 1. PDF.js global (disponível em navegadores modernos)
 * 2. CDN fallback se necessário
 */

/**
 * Obtém a biblioteca PDF.js disponível no navegador
 */
const getPdfJS = async () => {
  // Verificar se PDF.js está disponível globalmente (navegadores modernos)
  if (window.pdfjsLib) return window.pdfjsLib;
  
  // Tentar carregar do CDN como fallback
  if (!window.pdfWorkerLoaded) {
    await ensurePdfJsLoaded();
  }
  
  return window.pdfjsLib || null;
};

/**
 * Extrai texto de um arquivo PDF
 * @param {File} file - Arquivo PDF
 * @returns {Promise<{text: string, pages: number, error?: string}>}
 */
export async function extractPdfText(file) {
  try {
    if (!file || file.type !== 'application/pdf') {
      return { text: '', pages: 0, error: 'Arquivo não é um PDF válido' };
    }

    const pdfJS = await getPdfJS();
    if (!pdfJS) {
      return { 
        text: '', 
        pages: 0, 
        error: 'PDF.js não disponível. Tente colar o texto manualmente ou atualize o navegador.' 
      };
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfJS.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    const pageCount = pdf.numPages;

    for (let i = 1; i <= pageCount; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ')
          .trim();
        
        if (pageText) {
          fullText += (fullText ? '\n' : '') + pageText;
        }
      } catch (pageError) {
        console.warn(`Erro ao processar página ${i}:`, pageError);
      }
    }

    return {
      text: fullText,
      pages: pageCount,
      error: fullText ? '' : 'PDF não contém texto extraível',
    };
  } catch (error) {
    console.error('Erro ao extrair PDF:', error);
    return {
      text: '',
      pages: 0,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao processar PDF',
    };
  }
}

/**
 * Carrega a biblioteca PDF.js de um CDN se necessário
 * Usa a API de worker do PDF.js para processamento eficiente
 */
export async function ensurePdfJsLoaded() {
  // Se já está disponível, não fazer nada
  if (window.pdfjsLib) return true;
  if (window.pdfWorkerLoaded) return true;

  // Tentar carregar do CDN
  return new Promise((resolve) => {
    const script = document.createElement('script');
    // Usar versão estável do PDF.js via CDN
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    
    script.onload = () => {
      // Configurar worker para PDF.js
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        window.pdfWorkerLoaded = true;
      }
      resolve(true);
    };
    
    script.onerror = () => {
      console.warn('Falha ao carregar PDF.js do CDN. Será necessário colar o texto manualmente.');
      window.pdfWorkerLoaded = false;
      resolve(false);
    };
    
    script.async = true;
    document.head.appendChild(script);
  });
}

/**
 * Verifica se PDF.js está disponível (localmente ou pode ser carregado)
 */
export function isPdfJsAvailable() {
  return Boolean(window.pdfjsLib);
}
