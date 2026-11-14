// Sincronização entre aparelhos.
//
// Modelo: o IndexedDB de cada aparelho continua sendo a fonte principal (o app funciona
// offline). Cada registro vira um documento na nuvem em users/{uid}/items/{coleção~id}
// com: s (coleção), i (id), u (hora da última mudança, ms), d (excluído), v (dados) e
// t (hora do servidor, usada para buscar só o que mudou). Em conflito, vence a mudança
// mais recente (maior "u"). Exclusões viram "tombstones" para se propagarem.
//
// A nuvem padrão é o Firebase (Google), carregado sob demanda do CDN oficial. Os
// módulos ficam em cache pelo service worker, então o app abre offline mesmo assim.

const FB = 'https://www.gstatic.com/firebasejs/12.19.0/';
const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } };

export const keyOf = (s, i) => `${s}~${i}`;

/* ---------- Mesclagem (função pura, testável) ----------
   Recebe as entradas locais e remotas ({s,i,u,d,v}) e diz o que enviar e o que aplicar. */
export function plan(localList, remoteList) {
  const L = new Map(localList.map((e) => [keyOf(e.s, e.i), e]));
  const R = new Map(remoteList.map((e) => [keyOf(e.s, e.i), e]));
  const push = [];
  const apply = [];
  for (const [k, l] of L) {
    const r = R.get(k);
    if (!r || l.u > r.u) push.push(l);
    else if (r.u > l.u) apply.push(r);
  }
  for (const [k, r] of R) if (!L.has(k) && !r.d) apply.push(r);
  return { push, apply };
}

/* ---------- Backend Firebase ---------- */
export async function firebaseBackend(config) {
  const [A, Au, F] = await Promise.all([
    import(`${FB}firebase-app.js`),
    import(`${FB}firebase-auth.js`),
    import(`${FB}firebase-firestore.js`),
  ]);
  const app = A.initializeApp(config);
  const auth = Au.initializeAuth(app, {
    persistence: [Au.indexedDBLocalPersistence],
    popupRedirectResolver: Au.browserPopupRedirectResolver,
  });
  let fs;
  try {
    fs = F.initializeFirestore(app, {
      localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }),
      ignoreUndefinedProperties: true,
    });
  } catch {
    fs = F.initializeFirestore(app, { ignoreUndefinedProperties: true });
  }
  const col = (uid) => F.collection(fs, 'users', uid, 'items');
  const toEntry = (snap) => {
    const x = snap.data({ serverTimestamps: 'estimate' });
    return { s: x.s, i: x.i, u: x.u || 0, d: !!x.d, v: x.v ?? null, t: x.t?.toMillis?.() ?? 0, pending: snap.metadata.hasPendingWrites };
  };
  return {
    onAuth: (cb) => Au.onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email || u.displayName || 'conta Google' } : null)),
    signIn: (e, p) => Au.signInWithEmailAndPassword(auth, e, p),
    signUp: (e, p) => Au.createUserWithEmailAndPassword(auth, e, p),
    google: () => Au.signInWithPopup(auth, new Au.GoogleAuthProvider()),
    reset: (e) => Au.sendPasswordResetEmail(auth, e),
    signOut: () => Au.signOut(auth),
    getAll: async (uid) => (await F.getDocs(col(uid))).docs.map(toEntry),
    listen: (uid, since, cb, onErr) => F.onSnapshot(
      F.query(col(uid), F.where('t', '>=', F.Timestamp.fromMillis(since))),
      { includeMetadataChanges: true },
      (snap) => cb(snap.docChanges().filter((c) => c.type !== 'removed').map((c) => toEntry(c.doc)), snap.metadata.fromCache),
      onErr
    ),
    put: (uid, e) => F.setDoc(F.doc(col(uid), keyOf(e.s, e.i)), {
      s: e.s, i: e.i, u: e.u, d: !!e.d, v: e.d ? null : e.v, t: F.serverTimestamp(),
    }),
  };
}

/* ---------- Mensagens de erro em português ---------- */
export function errorText(err) {
  const code = err?.code || '';
  const map = {
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'Não existe conta com esse e-mail.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/email-already-in-use': 'Já existe uma conta com esse e-mail. Use “Entrar”.',
    'auth/weak-password': 'Senha fraca: use pelo menos 6 caracteres.',
    'auth/missing-password': 'Digite a senha.',
    'auth/too-many-requests': 'Muitas tentativas. Espere alguns minutos.',
    'auth/network-request-failed': 'Sem internet. Tente de novo quando estiver conectado.',
    'auth/popup-closed-by-user': 'Janela do Google fechada antes de concluir.',
    'auth/popup-blocked': 'O navegador bloqueou a janela do Google. Use e-mail e senha.',
    'auth/unauthorized-domain': 'Este endereço não está autorizado no Firebase (veja o guia, passo 3).',
    'auth/operation-not-allowed': 'Esse tipo de login não está ativado no Firebase (veja o guia, passo 3).',
    'auth/admin-restricted-operation': 'Criação de contas desativada no Firebase. Use “Entrar”.',
    'permission-denied': 'A nuvem recusou o acesso. Confira as regras do Firestore (guia, passo 4).',
    'unavailable': 'Nuvem indisponível no momento. Os dados ficam salvos no aparelho.',
  };
  if (code.startsWith('auth/api-key-not-valid') || code === 'auth/invalid-api-key') return 'Configuração do Firebase inválida: confira o arquivo firebase-config.js (guia, passo 5).';
  if (code === 'auth/configuration-not-found') return 'O login ainda não foi ativado no Firebase (guia, passo 3).';
  return map[code] || err?.message || 'Erro desconhecido.';
}

/* ---------- Controlador ----------
   hooks:
     localEntries()        -> todas as entradas locais {s,i,u,d,v}
     localEntry(s, i)      -> entrada local ou null
     apply(entries)        -> grava no aparelho o que veio da nuvem
     clearTombstone(s, i)  -> descarta uma exclusão já enviada
     onChange(state)       -> estado mudou (para a interface) */
export function createSync({ config, hooks, backendFactory = firebaseBackend, ns = '' }) {
  const LS = { uid: `${ns}arsenal.sync.uid`, seen: `${ns}arsenal.sync.seen`, dirty: `${ns}arsenal.sync.dirty`, last: `${ns}arsenal.sync.last` };
  const st = { status: config ? 'loading' : 'off', user: null, lastSync: lsGet(LS.last), error: null };
  let be = null;
  let unsub = null;
  let fullRunning = false;
  const emit = () => hooks.onChange({ ...st });
  const dirty = new Set(lsGet(LS.dirty) || []);
  const saveDirty = () => lsSet(LS.dirty, [...dirty]);

  function fail(err) {
    console.warn('Sincronização:', err);
    st.error = errorText(err);
    st.status = err?.code === 'unavailable' ? 'offline' : 'error';
    emit();
  }
  const put = (e) => {
    be.put(st.user.uid, e).catch(fail);
    if (e.d) hooks.clearTombstone(e.s, e.i);
  };

  function flush() {
    if (!be || !st.user || fullRunning) return;
    for (const k of dirty) {
      const [s, ...rest] = k.split('~');
      const e = hooks.localEntry(s, rest.join('~'));
      if (e) put(e);
      dirty.delete(k);
    }
    saveDirty();
  }

  async function full() {
    if (!be || !st.user) return;
    fullRunning = true;
    st.status = 'syncing';
    st.error = null;
    emit();
    try {
      const remote = await be.getAll(st.user.uid);
      const { push, apply } = plan(hooks.localEntries(), remote);
      if (apply.length) await hooks.apply(apply);
      push.forEach(put);
      const seen = Math.max(lsGet(LS.seen) || 0, ...remote.map((e) => e.t));
      lsSet(LS.seen, seen);
      lsSet(LS.uid, st.user.uid);
      st.lastSync = Date.now();
      lsSet(LS.last, st.lastSync);
      st.status = navigator.onLine === false ? 'offline' : 'ok';
      emit();
      listen();
      return { pushed: push.length, applied: apply.length };
    } catch (err) {
      fail(err);
      return null;
    } finally {
      fullRunning = false;
      flush(); // envia o que mudou no aparelho enquanto a mesclagem rodava
    }
  }

  function listen() {
    unsub?.();
    const since = lsGet(LS.seen) || 0;
    unsub = be.listen(st.user.uid, since, async (entries, fromCache) => {
      const fresh = entries.filter((e) => !e.pending);
      const apply = fresh.filter((e) => {
        const l = hooks.localEntry(e.s, e.i);
        return l ? e.u > l.u : !e.d;
      });
      if (apply.length) await hooks.apply(apply);
      if (fresh.length) lsSet(LS.seen, Math.max(lsGet(LS.seen) || 0, ...fresh.map((e) => e.t)));
      st.status = fromCache ? 'offline' : 'ok';
      if (!fromCache) { st.lastSync = Date.now(); lsSet(LS.last, st.lastSync); st.error = null; }
      emit();
    }, fail);
  }

  async function onUser(user) {
    st.user = user;
    if (!user) {
      unsub?.();
      unsub = null;
      st.status = 'signedOut';
      emit();
      return;
    }
    if (lsGet(LS.uid) !== user.uid) {
      lsSet(LS.seen, 0); // conta nova neste aparelho: mescla tudo uma vez
      await full();
    } else {
      st.status = 'syncing';
      emit();
      flush();
      listen();
    }
  }

  const ready = (async () => {
    if (!config) return;
    try {
      be = await backendFactory(config);
      be.onAuth((u) => { onUser(u); });
    } catch (err) {
      // Sem internet na primeira abertura, o SDK não carrega. O app segue local.
      st.status = 'unavailable';
      st.error = 'Não foi possível carregar a sincronização (sem internet?). Os dados ficam salvos no aparelho.';
      emit();
    }
  })();

  addEventListener('online', () => { if (st.user) { st.status = 'syncing'; emit(); flush(); } });
  addEventListener('offline', () => { if (st.user) { st.status = 'offline'; emit(); } });

  const guard = async (fn) => {
    await ready;
    if (!be) throw new Error(st.error || 'Sincronização indisponível.');
    st.error = null;
    try { return await fn(); } catch (err) { st.error = errorText(err); emit(); throw err; }
  };

  return {
    get state() { return { ...st }; },
    ready,
    // Chamado a cada mudança local. Só registra pendências se este aparelho já sincronizou
    // alguma vez (antes disso, a primeira mesclagem envia tudo).
    track(s, i) {
      if (!config || !lsGet(LS.uid)) return;
      dirty.add(keyOf(s, i));
      saveDirty();
      flush();
    },
    signIn: (e, p) => guard(() => be.signIn(e, p)),
    signUp: (e, p) => guard(() => be.signUp(e, p)),
    google: () => guard(() => be.google()),
    reset: (e) => guard(() => be.reset(e)),
    signOut: () => guard(() => be.signOut()),
    syncNow: () => guard(() => full()),
  };
}
