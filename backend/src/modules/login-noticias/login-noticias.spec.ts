import { converterPosts, textoPuro } from "./login-noticias.module";

const BASE = "https://triunfotransbrasiliana.com.br";

describe("notícias da tela de login", () => {
  it("tira HTML e decodifica entidades do WordPress", () => {
    expect(textoPuro("<p>Campanha &#8220;Desacelere&#8221; &amp; vida&nbsp;[&hellip;]</p>")).toBe("Campanha “Desacelere” & vida");
  });

  it("converte posts com imagem destacada e limita a 4", () => {
    const post = (i: number) => ({
      date: `2026-09-0${i}T09:00:00`, link: `${BASE}/noticia-${i}/`,
      title: { rendered: `Notícia ${i}` }, excerpt: { rendered: "<p>Resumo</p>" },
      _embedded: { "wp:featuredmedia": [{ media_details: { sizes: { medium: { source_url: `${BASE}/wp-content/uploads/${i}.jpg` } } } }] },
    });
    const itens = converterPosts([1, 2, 3, 4, 5, 6].map(post), BASE);
    expect(itens).toHaveLength(4);
    expect(itens[0]).toEqual({ titulo: "Notícia 1", resumo: "Resumo", data: "2026-09-01T09:00:00", link: `${BASE}/noticia-1/`, imagem: `${BASE}/wp-content/uploads/1.jpg` });
  });

  it("recusa link e imagem de outro domínio ou sem https", () => {
    const itens = converterPosts([
      { link: "https://golpe.example/x", title: { rendered: "A" } },
      { link: "http://triunfotransbrasiliana.com.br/y", title: { rendered: "B" } },
      { link: `${BASE}/z/`, title: { rendered: "C" }, _embedded: { "wp:featuredmedia": [{ source_url: "https://outro.site/img.jpg" }] } },
    ], BASE);
    expect(itens.map(i => i.titulo)).toEqual(["C"]);
    expect(itens[0].imagem).toBeNull();
  });
});
