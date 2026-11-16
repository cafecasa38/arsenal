// Camada mínima sobre o IndexedDB. Cada coleção é um object store com chave "id".
// "tombstones" guarda as exclusões ainda não confirmadas pela nuvem (sincronização);
// não faz parte do backup.
const DB_NAME = 'arsenal';
const VERSION = 4;
export const STORES = ['tasks', 'sessions', 'journal', 'habits', 'habitLogs', 'cards', 'notes', 'goals', 'premortems', 'reviews', 'settings'];
const ALL = [...STORES, 'tombstones'];

let dbPromise;
function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of ALL) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => db.close(); // outra aba atualizou o banco: libera
        resolve(db);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Feche as outras janelas do ARSENAL e recarregue.'));
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
  // Substitui o conteúdo das coleções de dados numa única transação (restauração e "apagar tudo").
  replaceAll: (data) => run(ALL, 'readwrite', (tx) => {
    for (const s of ALL) {
      const st = tx.objectStore(s);
      st.clear();
      for (const v of data[s] || []) st.put(v);
    }
  }),
};
