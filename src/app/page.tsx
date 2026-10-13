import { ArrowRight, BookOpen, Check, FileSearch, Globe2, Layers3, MessageSquare, PlugZap, Search, Sparkles } from "lucide-react";

const capabilities = [
  { icon: Search, number: "01", title: "Descubra o que importa.", description: "Pesquise resultados, notícias e perguntas na web. Encontre referências e entenda o contexto antes de criar.", tags: ["DataForSEO", "Pesquisa web", "Tendências"] },
  { icon: Layers3, number: "02", title: "Dê contexto às palavras.", description: "Explore ideias, volumes históricos e dados do Google Ads para orientar suas escolhas de conteúdo.", tags: ["Google Ads", "Palavras-chave", "Intenção"] },
  { icon: FileSearch, number: "03", title: "Transforme pesquisa em direção.", description: "Analise sites, compare conteúdos e organize pautas para blogs e redes sociais com apoio do seu chat.", tags: ["SEO on-page", "Blogs", "Redes sociais"] },
];

export default function Home() {
  return <div className="site-shell">
    <header className="site-header">
      <a href="#overview" className="brand" aria-label="SERP Research, início"><span className="brand-mark"><Search size={22} /></span><span>SERP<span className="brand-second">research</span></span></a>
      <nav aria-label="Navegação"><a href="#capacidades">O que faz</a><a href="#como-funciona">Como funciona</a></nav>
      <span className="header-badge"><PlugZap size={14} /> MCP / Plugin</span>
    </header>
    <main>
      <section className="hero" id="overview">
        <div className="hero-copy">
          <span className="eyebrow"><span /> PESQUISA PARA OS SEUS CHATS</span>
          <h1>Boas ideias<br />começam com<br /><em>boas perguntas.</em></h1>
          <p className="hero-description">A web, os dados e o contexto que faltavam na sua conversa. Pesquise, analise e planeje conteúdos diretamente no chat.</p>
          <a className="discover-link" href="#capacidades">Conheça o SERP Research <ArrowRight size={17} /></a>
          <div className="hero-note"><PlugZap size={15} /><span>Conectado ao chat por MCP.</span></div>
        </div>
        <div className="research-visual" aria-label="Ilustração do fluxo: uma pergunta conecta pesquisa, dados e estratégia de conteúdo">
          <div className="visual-grid" aria-hidden="true" />
          <div className="visual-ring ring-one" aria-hidden="true" /><div className="visual-ring ring-two" aria-hidden="true" />
          <div className="question-card"><span className="question-icon"><MessageSquare size={19} /></span><span>Uma pergunta no chat<strong>Como criar conteúdo relevante<br />para o meu público?</strong></span><span className="example-label">EXEMPLO</span></div>
          <div className="connection-line line-left" aria-hidden="true" /><div className="connection-line line-right" aria-hidden="true" />
          <div className="source-card source-web"><span className="source-icon"><Globe2 size={19} /></span><strong>Pesquisa na web</strong><span>Fontes e referências</span><small>DataForSEO</small></div>
          <div className="source-card source-ads"><span className="source-icon"><Layers3 size={19} /></span><strong>Dados de busca</strong><span>Ideias e palavras-chave</span><small>Google Ads</small></div>
          <div className="mcp-node"><PlugZap size={28} /><span>MCP</span></div>
          <div className="strategy-card"><span className="strategy-icon"><Sparkles size={21} /></span><div><span>CONTEXTO PARA CRIAR</span><strong>Uma estratégia com mais fundamento.</strong><p><Check size={13} /> Blog e site <Check size={13} /> Redes sociais</p></div></div>
          <span className="visual-caption">DA PERGUNTA À ESTRATÉGIA</span>
        </div>
      </section>
      <div className="provider-strip"><span>FONTES CONECTADAS.<br /><strong>DECISÕES COM CONTEXTO.</strong></span><div><Globe2 size={21} /><strong>DataForSEO</strong></div><div><Layers3 size={21} /><strong>Google Ads</strong></div><div><BookOpen size={21} /><strong>Conteúdo da web</strong></div></div>
      <section className="capabilities section" id="capacidades"><div className="section-heading"><div><span className="eyebrow">DA PESQUISA AO PLANEJAMENTO</span><h2>Mais contexto.<br />Melhores caminhos.</h2></div><p>Uma ponte entre as fontes de informação e o chat que você já usa para pensar, analisar e criar.</p></div><div className="capability-grid">{capabilities.map(item => <article className="capability-card" key={item.number}><div className="capability-top"><span className="capability-icon"><item.icon size={22} /></span><span>{item.number}</span></div><h3>{item.title}</h3><p>{item.description}</p><div className="tags">{item.tags.map(tag => <span key={tag}>{tag}</span>)}</div></article>)}</div></section>
      <section className="workflow section" id="como-funciona"><div className="workflow-intro"><span className="eyebrow">A CONVERSA É O PONTO DE PARTIDA</span><h2>Você pergunta.<br />O chat vai além.</h2><p>O SERP Research trabalha por trás da conversa, conectando as ferramentas de pesquisa ao seu assistente.</p><span className="workflow-badge"><PlugZap size={16} /> Acesso pelo MCP / Plugin</span></div><ol className="workflow-steps"><li><span className="step-number">01</span><div><h3>Traga o seu objetivo.</h3><p>Um site para analisar, um tema para explorar ou um conteúdo para planejar.</p></div></li><li><span className="step-number">02</span><div><h3>Conecte a pesquisa.</h3><p>O chat consulta as ferramentas do MCP para reunir fontes, dados e observações.</p></div></li><li><span className="step-number">03</span><div><h3>Construa a estratégia.</h3><p>Use as evidências na conversa para desenvolver análises, pautas e conteúdos.</p></div></li></ol></section>
      <section className="closing"><span><Sparkles size={17} /> PESQUISA COM FONTES. CONTEÚDO COM CONTEXTO.</span><h2>Sua próxima ideia<br />pode começar na conversa.</h2><p>Para blogs, sites e redes sociais.<br />Diretamente no seu chat, com SERP Research.</p></section>
    </main>
    <footer className="site-footer"><a href="#overview" className="footer-brand"><Search size={17} /> SERP Research</a><span>Uma conexão Adalba Pro.</span><span>MCP · Pesquisa & conteúdo</span></footer>
  </div>;
}
