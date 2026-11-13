// Camada mínima sobre o IndexedDB. Cada coleção é um object store com chave "id".
const DB_NAME = 'arsenal';
const VERSION = 1;
export const STORES = ['tasks', 'sessions', 'journal', 'habits', 'habitLogs', 'settings'];

let dbPromise;
function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Banco bloqueado por outra janela do app.'));
    });
  }
  return dbPromise;
}

async function run(stores, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result;
    const r = fn(tx);
    if (r && 'onsuccess' in r) r.onsuccess = () => { result = r.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transação abortada'));
  });
}

export const db = {
  all: (s) => run(s, 'readonly', (tx) => tx.objectStore(s).getAll()),
  get: (s, id) => run(s, 'readonly', (tx) => tx.objectStore(s).get(id)),
  put: (s, v) => run(s, 'readwrite', (tx) => { tx.objectStore(s).put(v); }),
  del: (s, id) => run(s, 'readwrite', (tx) => { tx.objectStore(s).delete(id); }),
  // Substitui o conteúdo de todas as coleções numa única transação (usado na restauração do backup).
  replaceAll: (data) => run(STORES, 'readwrite', (tx) => {
    for (const s of STORES) {
      const st = tx.objectStore(s);
      st.clear();
      for (const v of data[s] || []) st.put(v);
    }
  }),
};
