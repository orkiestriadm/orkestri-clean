// Orkestri Service Worker
const CACHE_NAME = "orkestri-v1";
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(clients.claim()); });

self.addEventListener("message", (e) => {
  if (!e.data || e.data.type !== "SCHEDULE_NOTIFICATION") return;
  const { id, titulo, inicio, minutos } = e.data;
  const agora = Date.now();
  const eventoMs = new Date(inicio).getTime();
  const alertaMs = eventoMs - (minutos * 60 * 1000);
  const delay = alertaMs - agora;
  if (delay <= 0) return;
  setTimeout(() => {
    const hora = new Date(inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const tituloNotif = minutos === 0 ? "Acontecendo agora" : "Orkestri - em " + minutos + " min";
    const body = titulo + " as " + hora;
    self.registration.showNotification(tituloNotif, {
      body: body,
      icon: "/icon-192.png",
      tag: "orkestri-" + id + "-" + minutos,
      renotify: true,
      data: { url: "/dashboard/agenda" },
    });
  }, delay);
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) ? e.notification.data.url : "/dashboard";
  e.waitUntil(
    clients.matchAll({ type: "window" }).then((list) => {
      for (const client of list) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// Tela de falta de rede, para o aplicativo instalado não cair no dinossauro
// do Chrome.
//
// Sem marca e sem a cor do produto: este arquivo é estático, não passa pelo
// build e não tem como ler o nome nem o acento do ambiente. Um cinza neutro
// serve a qualquer um; o laranja daqui apareceria no servidor do cliente.
//
// O texto não promete que o formulário sobreviveu — ele não sobrevive. Esta
// tela SUBSTITUI a navegação que falhou, então o que estava digitado na
// página anterior já se foi. Diz só o que é verdade e o que fazer.
const SEM_REDE = '<!doctype html><html lang="pt-BR"><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width,initial-scale=1">'
  + '<title>Sem conexão</title>'
  + '<style>html,body{height:100%;margin:0}body{background:#09090b;color:#e4e4e7;'
  + 'font-family:system-ui,-apple-system,Segoe UI,sans-serif;display:flex;align-items:center;'
  + 'justify-content:center;text-align:center;padding:24px}'
  + 'p{margin:10px 0 22px;color:#a1a1aa;font-size:14px;line-height:1.5}'
  + 'h1{font-size:17px;font-weight:600;margin:0}'
  + 'i{display:block;width:40px;height:40px;border-radius:50%;border:2px solid #3f3f46;margin:0 auto 18px}'
  + 'button{font:inherit;font-size:14px;color:#e4e4e7;background:transparent;border:1px solid #3f3f46;'
  + 'border-radius:9px;padding:9px 18px;cursor:pointer}</style>'
  + '<div><i></i><h1>Sem conexão</h1>'
  + '<p>Você está sem internet.<br>Assim que ela voltar, é só tentar de novo.</p>'
  + '<button onclick="location.reload()">Tentar de novo</button></div>';
/**
 * NADA e guardado em cache aqui, e isso e decisao, nao esquecimento.
 *
 * Um service worker que guarda o JS da aplicacao continua servindo a versao
 * velha depois do deploy, sem erro nenhum na tela — o sistema simplesmente
 * fica no ar com o codigo da semana passada. Entao a rede atende tudo, igual
 * a antes, e o unico momento em que este handler faz algo e quando a rede
 * falha numa navegacao: ai responde a tela acima em vez do erro do navegador.
 *
 * Ele tambem e requisito: o Chrome so oferece "Instalar" quando o service
 * worker tem um handler de fetch.
 */
self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(
    fetch(e.request).catch(() => new Response(SEM_REDE, {
      status: 503,
      headers: { "content-type": "text/html; charset=utf-8" },
    }))
  );
});
