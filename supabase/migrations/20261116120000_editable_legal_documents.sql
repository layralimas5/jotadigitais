-- Termos de Uso e Política de Privacidade editáveis pelo painel (Site > Termos de uso / Política de privacidade).
-- 1. Cada linha de legal_documents passa a guardar o texto e os dados da empresa que foram publicados.
--    A versão que está no ar (1.1.0) recebe o texto que hoje fica no código; o hash dela continua o mesmo.
-- 2. current_legal_documents: o site lê a versão mais recente de cada um.
-- 3. publish_legal_documents: quem pode mexer no site publica. Só o documento que mudou ganha versão nova
--    (1.1.0 vira 1.2.0), com a data de hoje e uma linha no histórico. O hash sai do próprio banco.
--    Quem comprou antes continua com a prova da versão que aceitou; o checkout passa a gravar a nova.

alter table public.legal_documents
  add column if not exists content jsonb,
  add column if not exists controller jsonb,
  add column if not exists published_by uuid references auth.users (id) on delete set null;

update public.legal_documents
  set content = $legal${
  "slug": "terms",
  "version": "1.1.0",
  "effectiveDate": "2026-10-28",
  "title": "Termos de Uso",
  "summary": "Estas são as regras para usar o site da {{brand}} e comprar uma conta. Elas incluem as condições de compra, entrega, garantia e reembolso. Leia com calma: ao marcar o aceite no checkout, você concorda com elas.",
  "sections": [
    {
      "id": "aceitacao",
      "title": "1. Aceitação e idade mínima",
      "blocks": [
        { "type": "p", "text": "Ao navegar no site você concorda com estes Termos e com a [Política de Privacidade](/politica-de-privacidade). Para comprar, é preciso marcar o aceite no checkout, e a versão aceita fica registrada no seu pedido." },
        { "type": "p", "text": "Só pode comprar quem tem 18 anos ou mais e plena capacidade civil. Quando a compra é feita em nome de uma empresa, quem compra declara ter poderes para representá-la." }
      ]
    },
    {
      "id": "servico",
      "title": "2. O que a {{brand}} faz e o que não faz",
      "blocks": [
        { "type": "p", "text": "A {{brand}} vende contas de redes sociais já criadas (TikTok, Instagram, YouTube e Facebook). Cada página de conta mostra a rede, os números públicos e o status informado, como a Central de Criadores do TikTok Shop liberada. Depois do pagamento, enviamos login, senha e instruções pelo WhatsApp do pedido e ajudamos na troca de nome, @ e foto." },
        { "type": "p", "text": "A {{brand}} não:" },
        {
          "type": "list",
          "items": [
            "é afiliada, patrocinada ou endossada por TikTok, Meta (Instagram, Facebook, WhatsApp) ou Google (YouTube);",
            "garante faturamento, comissões, alcance ou qualquer resultado: isso depende do nicho, dos produtos e da sua dedicação;",
            "vende seguidores, curtidas ou visualizações, nem gerencia a conta depois da entrega;",
            "controla as regras das plataformas, que podem mudar, limitar recursos ou restringir contas por decisão própria."
          ]
        },
        { "type": "note", "text": "As plataformas têm termos próprios, que podem tratar da transferência de contas entre pessoas. Antes de comprar, conheça as regras da rede escolhida. Ao comprar, você declara estar ciente delas." }
      ]
    },
    {
      "id": "cadastro",
      "title": "3. Dados do pedido e conta recebida",
      "blocks": [
        { "type": "p", "text": "O site não tem cadastro com senha para compradores. O seu pedido é identificado pelo WhatsApp e pelo código JD-XXXXXX. Você se compromete a:" },
        {
          "type": "list",
          "items": [
            "informar dados verdadeiros, completos e seus no checkout, incluindo CPF ou CNPJ, e declarar a sua idade com verdade;",
            "manter em sigilo o código do pedido e, depois da entrega, o login e a senha recebidos;",
            "trocar a senha, o e-mail e o telefone da conta assim que receber o acesso, seguindo as nossas instruções;",
            "responder por tudo o que for feito na conta depois da entrega, inclusive o conteúdo publicado e o cumprimento das regras da plataforma;",
            "apagar, sem usar nem divulgar, qualquer dado pessoal de terceiros que encontrar na conta, como mensagens antigas."
          ]
        },
        { "type": "p", "text": "Se suspeitar que alguém teve acesso indevido ao seu pedido ou à conta recebida, avise a gente na hora pelos canais da seção 13." }
      ]
    },
    {
      "id": "pagamento",
      "title": "4. Preço, pagamento, entrega, garantia e reembolso",
      "blocks": [
        {
          "type": "defs",
          "items": [
            { "term": "Preço e moeda", "text": "Os preços estão em reais (R$) e são os da página da conta no momento do pedido." },
            { "term": "Formas de pagamento", "text": "Pix à vista ou cartão de crédito em até 12 vezes, com os juros da operadora no parcelado. O pagamento é processado por {{paymentProvider}}." },
            { "term": "Reserva", "text": "Ao concluir o pedido, a conta fica reservada para você por 2 horas. Sem pagamento nesse prazo, o pedido é cancelado e a conta volta para a vitrine." },
            { "term": "Sem renovação automática", "text": "Cada compra é avulsa. Não há assinatura, mensalidade nem cobrança recorrente." },
            { "term": "Entrega", "text": "Com o pagamento confirmado, enviamos login, senha e o passo a passo pelo WhatsApp do pedido." },
            { "term": "Garantia", "text": "Você tem {{guaranteeDays}} dias a partir da entrega para relatar problema de acesso ou de status anunciado. Se a conta não corresponder ao anúncio, oferecemos outra conta equivalente ou o reembolso integral, à sua escolha." },
            { "term": "Direito de arrependimento", "text": "Como a compra é feita pela internet, você pode desistir em até 7 dias a partir do recebimento do acesso, sem precisar explicar o motivo (art. 49 do Código de Defesa do Consumidor). Para isso, devolva o acesso à conta sem alterações que impeçam a revenda, como exclusão de conteúdo ou violação das regras da plataforma." },
            { "term": "Como é o reembolso", "text": "O valor pago é devolvido integralmente, pelo mesmo meio de pagamento, em até 7 dias úteis depois da devolução do acesso. No cartão, o estorno pode aparecer em até duas faturas, conforme a operadora." }
          ]
        }
      ]
    },
    {
      "id": "uso",
      "title": "5. Uso permitido e proibido",
      "blocks": [
        { "type": "p", "text": "Você pode usar o site para conhecer as contas, comprar, acompanhar o pedido e exercer os seus direitos. É proibido:" },
        {
          "type": "list",
          "items": [
            "usar o site ou a conta comprada para fins ilegais, golpes, fraude, spam ou para enganar outras pessoas;",
            "fazer pedidos falsos para travar o estoque ou usar dados de outra pessoa sem autorização;",
            "copiar o site, fazer engenharia reversa, extrair dados de forma automatizada (scraping) ou usar robôs;",
            "tentar acessar o painel administrativo, o banco de dados ou dados de outros clientes;",
            "sobrecarregar os servidores, espalhar vírus ou atrapalhar o funcionamento do site;",
            "revender a conta prometendo números ou status diferentes dos que você recebeu."
          ]
        }
      ]
    },
    {
      "id": "propriedade",
      "title": "6. Propriedade intelectual",
      "blocks": [
        { "type": "p", "text": "A marca {{brand}}, o site, o código, o layout, os textos e as imagens produzidos por nós pertencem ao controlador indicado na seção 13 ou a quem nos licenciou. Você não pode copiá-los ou usá-los sem autorização por escrito." },
        { "type": "p", "text": "Depois da entrega, o que você publicar na conta comprada é seu. Os nomes e marcas TikTok, Instagram, Facebook, WhatsApp e YouTube pertencem às respectivas empresas e aparecem aqui só para identificar a rede de cada conta." }
      ]
    },
    {
      "id": "conteudo-usuario",
      "title": "7. Conteúdo que você envia",
      "blocks": [
        { "type": "p", "text": "Mensagens, prints e depoimentos que você nos envia são de sua responsabilidade e não podem violar a lei nem direitos de outras pessoas. Se você autorizar a publicação de um print ou depoimento, nos dá uma licença gratuita, não exclusiva e revogável para exibi-lo no site e nas nossas redes, pelo tempo em que a autorização valer." },
        { "type": "p", "text": "Podemos remover, sem aviso prévio, qualquer conteúdo ilegal ou que viole estes Termos." }
      ]
    },
    {
      "id": "disponibilidade",
      "title": "8. Disponibilidade do site",
      "blocks": [
        { "type": "p", "text": "Trabalhamos para manter o site no ar o tempo todo, mas não garantimos funcionamento sem interrupções. Ele pode ficar fora do ar por manutenção, de preferência em horários de pouco movimento, por falha de fornecedores (hospedagem, banco de dados, pagamento) ou por caso fortuito e força maior. Se a sua reserva vencer por falha nossa, combinamos uma solução pelo suporte." }
      ]
    },
    {
      "id": "responsabilidade",
      "title": "9. Limitação de responsabilidade",
      "blocks": [
        { "type": "p", "text": "Respondemos pelo que vendemos: a conta tem que corresponder ao anúncio na entrega, e a garantia e o arrependimento valem como descrito na seção 4. Não respondemos por:" },
        {
          "type": "list",
          "items": [
            "resultados que você esperava obter com a conta, lucros cessantes ou outros danos indiretos;",
            "restrições, mudanças de regra ou decisões tomadas pela plataforma depois da entrega;",
            "o uso que você faz da conta depois de recebê-la, ou falhas por não ter trocado senha, e-mail e telefone."
          ]
        },
        { "type": "p", "text": "Quando a lei permitir limitar, a nossa responsabilidade fica limitada ao valor que você pagou nos últimos 12 meses. Nada aqui afasta os direitos que o Código de Defesa do Consumidor garante e que não podem ser limitados, como a responsabilidade por defeito ou vício do produto (arts. 12, 14, 18 e 20) e a nulidade de cláusulas abusivas (arts. 25 e 51)." }
      ]
    },
    {
      "id": "suspensao",
      "title": "10. Cancelamento de pedido e bloqueio",
      "blocks": [
        { "type": "p", "text": "Podemos recusar ou cancelar um pedido, com devolução integral do que foi pago, quando houver indício de fraude, dados falsos, compra por menor de 18 anos ou violação destes Termos. Avisamos pelo WhatsApp do pedido, com o motivo, em até 2 dias úteis, salvo quando o aviso atrapalhar a apuração de fraude." },
        { "type": "p", "text": "Em caso de violação grave, como fraude ou ataque ao site, podemos bloquear novas compras do mesmo WhatsApp, e-mail ou documento. Mesmo assim, você continua podendo ver e baixar os seus dados em [Meus dados](/meus-dados) e exercer todos os direitos da LGPD." }
      ]
    },
    {
      "id": "alteracoes",
      "title": "11. Mudanças nestes Termos",
      "blocks": [
        { "type": "p", "text": "Podemos atualizar estes Termos. A versão nova vale para compras feitas a partir da data dela; a compra que você já fez continua regida pela versão que você aceitou, que fica registrada no pedido. Mudanças relevantes são avisadas no site com pelo menos 15 dias de antecedência. Se você não concordar, pode deixar de usar o site, e os pedidos em aberto podem ser cancelados com reembolso integral." }
      ]
    },
    {
      "id": "foro",
      "title": "12. Lei aplicável e foro",
      "blocks": [
        { "type": "p", "text": "Estes Termos seguem a legislação brasileira, em especial o Código de Defesa do Consumidor, o Marco Civil da Internet e a LGPD. Qualquer questão pode ser levada ao foro do seu domicílio (art. 101, I, do Código de Defesa do Consumidor). Antes, tente resolver com a gente pelos canais abaixo ou pelo [consumidor.gov.br](https://www.consumidor.gov.br)." }
      ]
    },
    {
      "id": "contato",
      "title": "13. Contato",
      "blocks": [
        {
          "type": "defs",
          "items": [
            { "term": "Quem vende", "text": "{{legalName}}, {{document}}, {{address}}" },
            { "term": "Dúvidas e suporte", "text": "{{email}} ou pelo Instagram {{instagram}}" },
            { "term": "Privacidade e dados pessoais", "text": "[Meus dados](/meus-dados) ou {{privacyEmail}}" }
          ]
        }
      ]
    }
  ],
  "history": [
    { "version": "1.1.0", "date": "2026-10-28", "summary": "Checkout mais curto: sem e-mail e sem data de nascimento. O acesso e os avisos do pedido chegam pelo WhatsApp, e a maioridade é declarada no aceite." },
    { "version": "1.0.0", "date": "2026-10-21", "summary": "Primeira versão. Substitui os antigos Termos de compra e garantia." }
  ]
}$legal$::jsonb,
      controller = $legal${
  "brand": "Jota Digitais",
  "legalName": null,
  "document": null,
  "address": null,
  "email": null,
  "privacyEmail": null,
  "dpoName": null,
  "dpoEmail": null,
  "paymentProvider": null,
  "invoiceProvider": null
}$legal$::jsonb
  where slug = 'terms' and version = '1.1.0' and content is null;

update public.legal_documents
  set content = $legal${
  "slug": "privacy",
  "version": "1.1.0",
  "effectiveDate": "2026-10-28",
  "title": "Política de Privacidade",
  "summary": "Aqui explicamos, sem juridiquês, quais dados a {{brand}} coleta quando você visita o site, fala com a gente ou compra uma conta, para que usamos cada um, com quem dividimos, por quanto tempo guardamos e como você exerce os seus direitos pela Lei Geral de Proteção de Dados (Lei nº 13.709/2018).",
  "sections": [
    {
      "id": "controlador",
      "title": "1. Quem cuida dos seus dados",
      "blocks": [
        { "type": "p", "text": "O controlador dos seus dados pessoais, ou seja, quem decide como eles são tratados, é:" },
        {
          "type": "defs",
          "items": [
            { "term": "Nome ou razão social", "text": "{{legalName}}, que atua com a marca {{brand}}" },
            { "term": "CNPJ ou CPF", "text": "{{document}}" },
            { "term": "Endereço", "text": "{{address}}" },
            { "term": "E-mail de contato", "text": "{{email}}" }
          ]
        }
      ]
    },
    {
      "id": "encarregado",
      "title": "2. Encarregado de dados (DPO)",
      "blocks": [
        { "type": "p", "text": "O encarregado é a pessoa que recebe as suas solicitações e as comunicações da Autoridade Nacional de Proteção de Dados (ANPD)." },
        {
          "type": "defs",
          "items": [
            { "term": "Nome", "text": "{{dpoName}}" },
            { "term": "Contato", "text": "{{dpoEmail}}" }
          ]
        },
        { "type": "note", "text": "Agentes de tratamento de pequeno porte, como microempresas, podem ser dispensados de indicar um encarregado pela Resolução CD/ANPD nº 2/2022 (art. 11). A mesma resolução exige que eles mantenham um canal de comunicação com o titular. Mesmo podendo usar essa dispensa, a {{brand}} indica um encarregado e mantém o canal acima." }
      ]
    },
    {
      "id": "dados-coletados",
      "title": "3. Quais dados coletamos",
      "blocks": [
        {
          "type": "defs",
          "items": [
            { "term": "Quando você compra uma conta", "text": "Nome completo, WhatsApp, CPF ou CNPJ, como você conheceu a loja e, se for indicação, quem indicou. Também guardamos a conta escolhida, o valor, a forma de pagamento escolhida (Pix ou cartão) e a situação do pedido." },
            { "term": "Prova do seu aceite", "text": "Quando você aceita estes documentos no checkout, registramos a versão aceita, a impressão digital do texto (hash SHA-256), a data e a hora, o endereço IP e o navegador usado." },
            { "term": "Quando você fala com a gente", "text": "Se você nos chama no WhatsApp ou no Instagram, podemos anotar o seu nome, WhatsApp, @ do Instagram, o tipo de conta que procura, o orçamento informado, observações da conversa e a data combinada para retorno." },
            { "term": "Parceiros e fornecedores", "text": "De quem fornece contas para a loja, guardamos nome, WhatsApp, @ do Instagram, percentual de comissão e observações." },
            { "term": "Quando você exerce os seus direitos", "text": "WhatsApp ou e-mail, código do pedido, o tipo de pedido feito em Meus dados, a mensagem que você escrever, o protocolo e a resposta dada." },
            { "term": "Navegação", "text": "Os servidores que hospedam o site registram automaticamente o endereço IP, a data e a hora do acesso, a página aberta e informações técnicas do navegador e do aparelho. Não usamos geolocalização." },
            { "term": "Pagamento", "text": "Não recebemos nem guardamos número de cartão ou senha bancária. Esses dados são digitados direto no ambiente da empresa de pagamento ({{paymentProvider}}), que nos informa apenas se o pagamento foi aprovado." },
            { "term": "Dados sensíveis", "text": "Não coletamos dados sensíveis, como origem racial ou étnica, religião, opinião política, saúde, vida sexual, dado genético ou biométrico (art. 5º, II, da LGPD). Pedimos que você não os envie nas mensagens." },
            { "term": "Menores de idade", "text": "Não vendemos para menores de 18 anos e não coletamos de propósito dados de crianças ou adolescentes. Veja a seção 13." },
            { "term": "Conteúdo publicado", "text": "Prints de resultados e de entregas que clientes autorizaram publicar, e os dados públicos dos perfis das contas à venda (nome, @, foto, biografia e números de seguidores)." }
          ]
        }
      ]
    },
    {
      "id": "finalidades",
      "title": "4. Para que usamos os dados",
      "blocks": [
        {
          "type": "defs",
          "items": [
            { "term": "Vender e entregar a conta", "text": "Nome e WhatsApp servem para registrar o pedido, reservar a conta, confirmar o pagamento, enviar o login e a senha e prestar suporte." },
            { "term": "Emitir nota fiscal", "text": "CPF ou CNPJ e nome são usados na nota fiscal de serviço." },
            { "term": "Confirmar a maioridade", "text": "No checkout você declara ter 18 anos ou mais, condição para assinar o contrato." },
            { "term": "Evitar fraude", "text": "O CPF e o WhatsApp ajudam a barrar pedidos falsos que travam o estoque. O sistema não deixa o mesmo WhatsApp ou CPF segurar mais de dois pedidos sem pagamento." },
            { "term": "Cumprir a garantia", "text": "O pedido e a data de entrega mostram se a garantia está valendo e permitem trocar a conta ou devolver o dinheiro." },
            { "term": "Responder e acompanhar contatos", "text": "Os dados de quem conversa com a gente servem para dar retorno no dia combinado. O lembrete pode ir para a agenda do Google de quem atende." },
            { "term": "Provar o seu aceite", "text": "O registro do aceite mostra qual versão destes documentos valia na sua compra." },
            { "term": "Segurança e lei", "text": "Os registros de acesso servem para manter o site seguro, investigar abusos e cumprir o Marco Civil da Internet (Lei nº 12.965/2014, art. 15)." },
            { "term": "Divulgar resultados", "text": "Prints de clientes só são publicados com autorização de quem aparece neles." }
          ]
        },
        { "type": "p", "text": "Não vendemos os seus dados, não fazemos perfil de comportamento para publicidade e não tomamos decisões só por meio de máquina que afetem os seus interesses." }
      ]
    },
    {
      "id": "bases-legais",
      "title": "5. Base legal de cada tratamento",
      "blocks": [
        { "type": "p", "text": "A LGPD só permite tratar dados com uma das hipóteses do art. 7º. Usamos estas:" },
        {
          "type": "defs",
          "items": [
            { "term": "Execução de contrato (art. 7º, V)", "text": "Registro do pedido, reserva, pagamento, entrega, suporte, garantia e confirmação da maioridade." },
            { "term": "Cumprimento de obrigação legal (art. 7º, II)", "text": "Nota fiscal e guarda de documentos fiscais, guarda dos registros de acesso por 6 meses (Marco Civil, art. 15) e atendimento a ordens de autoridades." },
            { "term": "Exercício regular de direitos (art. 7º, VI)", "text": "Guarda do pedido e do registro de aceite depois da garantia, para nos defender em reclamações, processos ou disputas de pagamento." },
            { "term": "Legítimo interesse (art. 7º, IX)", "text": "Prevenção de fraude, anotações de quem nos procurou para dar retorno, lembretes na agenda, cadastro de parceiros e leitura dos dados públicos dos perfis à venda. Avaliamos que esses usos são esperados por você, usam o mínimo de dados e não se sobrepõem aos seus direitos. Você pode se opor a qualquer um deles em Meus dados." },
            { "term": "Consentimento (art. 7º, I)", "text": "Publicação de print com o seu nome ou imagem e, se um dia forem usados, cookies analíticos ou de marketing. Você pode retirar o consentimento quando quiser." }
          ]
        }
      ]
    },
    {
      "id": "compartilhamento",
      "title": "6. Com quem compartilhamos",
      "blocks": [
        { "type": "p", "text": "Só compartilhamos o necessário com empresas que operam serviços para nós (operadores) e que têm o dever de proteger os dados:" },
        {
          "type": "defs",
          "items": [
            { "term": "Supabase (banco de dados, login do painel e arquivos)", "text": "Guarda todos os dados do sistema. [Política de privacidade](https://supabase.com/privacy)" },
            { "term": "Netlify (hospedagem do site)", "text": "Recebe os dados técnicos de navegação de quem acessa o site. [Política de privacidade](https://www.netlify.com/privacy/)" },
            { "term": "Google (Gmail e Google Agenda)", "text": "Os lembretes de retorno de contatos (nome, WhatsApp, @, orçamento e anotações) vão para a agenda de quem atende. [Política de privacidade](https://policies.google.com/privacy)" },
            { "term": "WhatsApp e Instagram (Meta)", "text": "Quando você clica para conversar, a conversa acontece na plataforma da Meta, que trata os dados como controladora. [WhatsApp](https://www.whatsapp.com/legal/privacy-policy) e [Instagram](https://privacycenter.instagram.com/policy)" },
            { "term": "TikTok, Instagram e YouTube", "text": "Para cadastrar uma conta à venda, o sistema consulta a página pública do perfil. Nenhum dado de cliente é enviado nessa consulta. [TikTok](https://www.tiktok.com/legal/page/row/privacy-policy/pt-BR) e [YouTube](https://policies.google.com/privacy)" },
            { "term": "Empresa de pagamento", "text": "{{paymentProvider}} recebe nome, WhatsApp, CPF ou CNPJ e valor para processar o Pix ou o cartão." },
            { "term": "Emissor de nota fiscal", "text": "{{invoiceProvider}} recebe nome, CPF ou CNPJ e valor para emitir a nota." },
            { "term": "Autoridades", "text": "Órgãos públicos e a Justiça, quando houver ordem legal ou para defender os nossos direitos." }
          ]
        }
      ]
    },
    {
      "id": "transferencia-internacional",
      "title": "7. Transferência internacional",
      "blocks": [
        { "type": "p", "text": "Supabase, Netlify e Google guardam ou processam dados em servidores nos Estados Unidos. O banco de dados da {{brand}} fica na região us-east-2 (Ohio, EUA). A ANPD ainda não reconheceu os Estados Unidos como país com nível de proteção adequado." },
        { "type": "p", "text": "Por isso, essas transferências se apoiam no art. 33 da LGPD:" },
        {
          "type": "list",
          "items": [
            "art. 33, IX: a transferência é necessária para executar o contrato com você, cumprir obrigação legal e exercer os nossos direitos (art. 7º, II, V e VI);",
            "art. 33, II: os operadores oferecem garantias contratuais de proteção de dados. Seguimos a Resolução CD/ANPD nº 19/2024, que aprovou as cláusulas-padrão contratuais para transferência internacional, e só usamos fornecedores com acordo de tratamento de dados (DPA) e medidas de segurança reconhecidas, como criptografia e certificação SOC 2."
          ]
        }
      ]
    },
    {
      "id": "retencao",
      "title": "8. Por quanto tempo guardamos",
      "blocks": [
        {
          "type": "defs",
          "items": [
            { "term": "Pedidos pagos ou entregues", "text": "5 anos depois da venda, por causa dos prazos fiscais (Código Tributário Nacional, art. 173) e do prazo para reclamações do consumidor (Código de Defesa do Consumidor, art. 27)." },
            { "term": "Pedidos cancelados ou não pagos", "text": "6 meses. Depois disso, os dados pessoais do pedido são anonimizados." },
            { "term": "Registro do aceite", "text": "Pelo mesmo prazo do pedido a que ele pertence." },
            { "term": "Cadastro de cliente feito pelo atendimento", "text": "Enquanto houver relação com você e por mais 5 anos após a última compra." },
            { "term": "Contatos que não viraram compra", "text": "Até 12 meses depois do último contato. Depois disso, a ficha é apagada." },
            { "term": "Parceiros", "text": "Enquanto durar a parceria e por mais 5 anos, pelos registros financeiros." },
            { "term": "Registros de acesso ao site", "text": "6 meses, como exige o Marco Civil da Internet (art. 15), guardados pelos provedores de hospedagem." },
            { "term": "Avisos internos do painel com o seu nome", "text": "90 dias." },
            { "term": "Solicitações feitas em Meus dados", "text": "5 anos, para provar que atendemos o seu pedido." },
            { "term": "Tentativas de acesso a Meus dados", "text": "30 dias, só para limitar abusos." }
          ]
        },
        { "type": "p", "text": "Ao fim de cada prazo, os dados são apagados de vez ou anonimizados, ou seja, deixam de identificar você. Cópias de segurança seguem os mesmos prazos e são substituídas periodicamente. Podemos guardar por mais tempo apenas quando a lei exigir ou houver processo em andamento." }
      ]
    },
    {
      "id": "direitos",
      "title": "9. Os seus direitos",
      "blocks": [
        { "type": "p", "text": "A LGPD (art. 18) garante a você, a qualquer momento e sem custo:" },
        {
          "type": "defs",
          "items": [
            { "term": "Confirmação", "text": "Saber se tratamos algum dado seu." },
            { "term": "Acesso", "text": "Receber uma cópia de todos os dados que temos sobre você." },
            { "term": "Correção", "text": "Corrigir dados incompletos, errados ou desatualizados." },
            { "term": "Anonimização, bloqueio ou eliminação", "text": "Pedir que dados desnecessários, excessivos ou tratados fora da lei sejam anonimizados, bloqueados ou apagados." },
            { "term": "Portabilidade", "text": "Receber os seus dados em formato aberto (JSON) para levar a outro fornecedor." },
            { "term": "Eliminação do que depende de consentimento", "text": "Apagar os dados tratados com base no seu consentimento, salvo quando a lei exigir a guarda." },
            { "term": "Informação sobre compartilhamento", "text": "Saber com quais empresas e órgãos dividimos os seus dados (veja a seção 6)." },
            { "term": "Informação sobre não consentir", "text": "Saber o que acontece se você não der o consentimento. Exemplo: sem autorização, o seu print não é publicado, e isso não muda nada na sua compra." },
            { "term": "Revogação do consentimento", "text": "Retirar um consentimento dado antes. O que foi feito até ali continua válido." },
            { "term": "Revisão de decisão automatizada (art. 20)", "text": "Pedir que uma pessoa revise uma decisão tomada só por máquina, como o bloqueio da compra por idade." }
          ]
        },
        { "type": "p", "text": "Você também pode se opor a um tratamento feito com base no legítimo interesse, quando achar que ele não respeita a LGPD (art. 18, § 2º)." }
      ]
    },
    {
      "id": "canal",
      "title": "10. Como exercer os seus direitos",
      "blocks": [
        { "type": "p", "text": "Use a página [Meus dados](/meus-dados) ou escreva para {{privacyEmail}}. Em Meus dados, você informa o WhatsApp (ou o e-mail, em pedidos antigos) e o código de um pedido (JD-XXXXXX) para provar que os dados são seus, vê tudo o que temos, baixa uma cópia e abre o pedido que quiser." },
        { "type": "p", "text": "Respondemos em até 15 dias, contados do pedido. Cada solicitação gera um protocolo. Se não puder atender alguma parte, por exemplo porque a lei manda guardar a nota fiscal, explicamos o motivo." },
        { "type": "p", "text": "Se você nunca comprou, mas conversou com a gente, escreva para o e-mail acima e confirmaremos a sua identidade pelo mesmo canal em que falamos com você." }
      ]
    },
    {
      "id": "seguranca",
      "title": "11. Como protegemos os dados",
      "blocks": [
        { "type": "p", "text": "Adotamos medidas técnicas e administrativas para proteger os dados contra acesso indevido, perda ou vazamento (art. 46 da LGPD):" },
        {
          "type": "list",
          "items": [
            "conexão sempre criptografada (HTTPS) e dados criptografados no banco;",
            "regras de acesso por linha no banco (RLS): visitante não lê dado de cliente, e só pessoas autorizadas entram no painel;",
            "senhas do painel guardadas só como hash pelo serviço de login, com recuperação por e-mail;",
            "acesso ao painel restrito a quem precisa, com o mínimo de permissões;",
            "página pública do pedido sem e-mail completo, sem documento e sem telefone;",
            "limite de tentativas em Meus dados e no checkout para barrar robôs e abusos;",
            "cabeçalhos de segurança no site (proteção contra clique sequestrado e conteúdo trocado);",
            "fornecedores com acordo de proteção de dados e revisão destas medidas sempre que o sistema muda."
          ]
        }
      ]
    },
    {
      "id": "cookies",
      "title": "12. Cookies e armazenamento no navegador",
      "blocks": [
        { "type": "p", "text": "Cookies e o armazenamento local são pequenos registros que o site guarda no seu navegador. Classificamos assim:" },
        {
          "type": "defs",
          "items": [
            { "term": "Necessários (sempre ativos)", "text": "Guardam a sua escolha sobre cookies, lembram que o convite do WhatsApp já apareceu nesta visita e mantêm a sessão de quem entra no painel. Sem eles o site não funciona direito, por isso não dependem de consentimento." },
            { "term": "Analíticos (desligados)", "text": "Mediriam visitas e cliques de forma agregada. Hoje o site não usa nenhum." },
            { "term": "Marketing (desligados)", "text": "Mediriam anúncios e criariam públicos em redes sociais. Hoje o site não usa nenhum." }
          ]
        },
        { "type": "p", "text": "Se um dia adotarmos ferramentas analíticas ou de marketing, elas só serão ativadas com o seu consentimento no aviso de cookies, e esta política será atualizada antes." },
        { "type": "p", "text": "Você muda a sua escolha a qualquer momento pelo link Preferências de cookies, no rodapé de todas as páginas. Também pode apagar ou bloquear cookies nas configurações do navegador; ao apagar, o aviso aparece de novo." }
      ]
    },
    {
      "id": "menores",
      "title": "13. Crianças e adolescentes",
      "blocks": [
        { "type": "p", "text": "A loja é só para maiores de 18 anos. No checkout, quem compra declara ter 18 anos ou mais. Se descobrirmos uma compra feita por menor, o pedido é cancelado e o valor devolvido." },
        { "type": "p", "text": "Não coletamos de propósito dados de menores. Se descobrirmos que recebemos dados de uma criança (até 12 anos incompletos) sem o consentimento específico de um dos pais ou responsável, ou de um adolescente fora do que a lei permite, apagamos esses dados, sempre no melhor interesse da criança ou do adolescente (art. 14 da LGPD e Estatuto da Criança e do Adolescente). Pais ou responsáveis podem pedir isso pelo canal da seção 10." }
      ]
    },
    {
      "id": "incidentes",
      "title": "14. Se acontecer um incidente de segurança",
      "blocks": [
        { "type": "p", "text": "Se houver um incidente que possa causar risco ou dano relevante a você, como um vazamento, nós:" },
        {
          "type": "list",
          "items": [
            "contemos o incidente e investigamos a causa assim que tomarmos conhecimento;",
            "comunicamos a ANPD e as pessoas afetadas em até 3 dias úteis, como manda a Resolução CD/ANPD nº 15/2024, buscando fazer isso em até 72 horas (art. 48 da LGPD);",
            "informamos o que aconteceu, quais dados foram afetados, os riscos, o que fizemos e o que você pode fazer para se proteger;",
            "registramos o incidente e guardamos esse registro por pelo menos 5 anos."
          ]
        }
      ]
    },
    {
      "id": "anpd",
      "title": "15. Reclamação à ANPD",
      "blocks": [
        { "type": "p", "text": "Se achar que não atendemos o seu pedido ou que tratamos os seus dados de forma errada, você pode reclamar à Autoridade Nacional de Proteção de Dados pelo site oficial [gov.br/anpd](https://www.gov.br/anpd). Pedimos que fale com a gente antes, pelo canal da seção 10, para resolvermos mais rápido." }
      ]
    },
    {
      "id": "vigencia",
      "title": "16. Vigência e alterações",
      "blocks": [
        { "type": "p", "text": "Esta versão vale a partir da data indicada no topo da página. Quando houver mudança relevante, como um novo uso dos dados ou um novo fornecedor, avisaremos no site e, se você tiver comprado, pelo WhatsApp do pedido, antes de a mudança valer. O histórico de versões fica no fim desta página." }
      ]
    },
    {
      "id": "lei-e-foro",
      "title": "17. Lei aplicável e foro",
      "blocks": [
        { "type": "p", "text": "Esta política segue a legislação brasileira, em especial a LGPD (Lei nº 13.709/2018), o Marco Civil da Internet (Lei nº 12.965/2014) e o Código de Defesa do Consumidor (Lei nº 8.078/1990). Fica eleito o foro do domicílio do titular para resolver qualquer questão sobre ela." }
      ]
    }
  ],
  "history": [
    { "version": "1.1.0", "date": "2026-10-28", "summary": "Checkout mais curto: sem e-mail, data de nascimento, cidade, estado e Instagram. O WhatsApp identifica o pedido e recebe o acesso, e a maioridade é declarada no aceite." },
    { "version": "1.0.0", "date": "2026-10-21", "summary": "Primeira versão." }
  ]
}$legal$::jsonb,
      controller = $legal${
  "brand": "Jota Digitais",
  "legalName": null,
  "document": null,
  "address": null,
  "email": null,
  "privacyEmail": null,
  "dpoName": null,
  "dpoEmail": null,
  "paymentProvider": null,
  "invoiceProvider": null
}$legal$::jsonb
  where slug = 'privacy' and version = '1.1.0' and content is null;

create or replace function public.current_legal_documents()
returns table (slug text, version text, sha256 text, published_at timestamptz, content jsonb, controller jsonb)
language sql
stable
set search_path = ''
as $$
  select distinct on (d.slug) d.slug, d.version, d.sha256, d.published_at, d.content, d.controller
  from public.legal_documents d
  order by d.slug, d.published_at desc, d.version desc;
$$;

revoke all on function public.current_legal_documents() from public;
grant execute on function public.current_legal_documents() to anon, authenticated;

/** Texto obrigatório com limite de tamanho. */
create or replace function public.legal_text_ok(p_value jsonb, p_max integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_typeof(p_value) = 'string' and char_length(btrim(p_value #>> '{}')) between 1 and p_max, false);
$$;

revoke all on function public.legal_text_ok(jsonb, integer) from public, anon, authenticated;

/** Mesmas regras do legalPublishSchema do painel: título, resumo e seções com blocos p, note, list e defs. */
create or replace function public.legal_content_ok(p_content jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  section jsonb;
  block jsonb;
  item jsonb;
begin
  if coalesce(jsonb_typeof(p_content), '') <> 'object'
     or not public.legal_text_ok(p_content -> 'title', 200)
     or not public.legal_text_ok(p_content -> 'summary', 2000)
     or coalesce(jsonb_typeof(p_content -> 'sections'), '') <> 'array'
     or jsonb_array_length(p_content -> 'sections') not between 1 and 40 then
    return false;
  end if;
  for section in select value from jsonb_array_elements(p_content -> 'sections') loop
    if jsonb_typeof(section) <> 'object'
       or coalesce(section ->> 'id', '') !~ '^[a-z0-9-]{1,60}$'
       or not public.legal_text_ok(section -> 'title', 200)
       or coalesce(jsonb_typeof(section -> 'blocks'), '') <> 'array'
       or jsonb_array_length(section -> 'blocks') not between 1 and 60 then
      return false;
    end if;
    for block in select value from jsonb_array_elements(section -> 'blocks') loop
      if jsonb_typeof(block) <> 'object' then
        return false;
      end if;
      if block ->> 'type' in ('p', 'note') then
        if not public.legal_text_ok(block -> 'text', 5000) then
          return false;
        end if;
      elsif block ->> 'type' in ('list', 'defs') then
        if coalesce(jsonb_typeof(block -> 'items'), '') <> 'array' or jsonb_array_length(block -> 'items') not between 1 and 60 then
          return false;
        end if;
        for item in select value from jsonb_array_elements(block -> 'items') loop
          if block ->> 'type' = 'list' and not public.legal_text_ok(item, 2000) then
            return false;
          end if;
          if block ->> 'type' = 'defs'
             and (jsonb_typeof(item) <> 'object' or not public.legal_text_ok(item -> 'term', 200) or not public.legal_text_ok(item -> 'text', 2000)) then
            return false;
          end if;
        end loop;
      else
        return false;
      end if;
    end loop;
  end loop;
  return true;
end;
$$;

revoke all on function public.legal_content_ok(jsonb) from public, anon, authenticated;

create or replace function public.publish_legal_documents(p_documents jsonb, p_controller jsonb, p_note text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  fields constant text[] := array['brand', 'legalName', 'document', 'address', 'email', 'privacyEmail', 'dpoName', 'dpoEmail', 'paymentProvider', 'invoiceProvider'];
  note text := btrim(coalesce(p_note, ''));
  today text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD');
  next_controller jsonb := '{}'::jsonb;
  field text;
  field_value jsonb;
  doc_slug text;
  next_content jsonb;
  current_version text;
  current_content jsonb;
  current_controller jsonb;
  next_version text;
  next_document jsonb;
  published integer := 0;
begin
  if not public.has_permission('site') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if char_length(note) not between 3 and 240
     or coalesce(jsonb_typeof(p_documents), '') <> 'object'
     or coalesce(jsonb_typeof(p_controller), '') <> 'object'
     or octet_length(p_documents::text) > 500000 then
    raise exception 'invalid_legal_document' using errcode = '22023';
  end if;

  -- Só os campos conhecidos; vazio vira nulo (o site mostra "preencher").
  foreach field in array fields loop
    field_value := p_controller -> field;
    if field_value is null or jsonb_typeof(field_value) = 'null' or btrim(field_value #>> '{}') = '' then
      next_controller := next_controller || jsonb_build_object(field, null);
    elsif jsonb_typeof(field_value) = 'string' and char_length(btrim(field_value #>> '{}')) <= 300 then
      next_controller := next_controller || jsonb_build_object(field, btrim(field_value #>> '{}'));
    else
      raise exception 'invalid_legal_document' using errcode = '22023';
    end if;
  end loop;

  foreach doc_slug in array array['terms', 'privacy'] loop
    if not public.legal_content_ok(p_documents -> doc_slug) then
      raise exception 'invalid_legal_document' using errcode = '22023';
    end if;
  end loop;

  foreach doc_slug in array array['terms', 'privacy'] loop
    next_content := jsonb_build_object(
      'title', btrim(p_documents -> doc_slug ->> 'title'),
      'summary', btrim(p_documents -> doc_slug ->> 'summary'),
      'sections', p_documents -> doc_slug -> 'sections'
    );
    current_version := null;
    current_content := null;
    current_controller := null;
    select d.version, d.content, d.controller into current_version, current_content, current_controller
      from public.legal_documents d
      where d.slug = doc_slug
      order by d.published_at desc, d.version desc
      limit 1;
    if current_content is not null
       and jsonb_build_object('title', current_content -> 'title', 'summary', current_content -> 'summary', 'sections', current_content -> 'sections') = next_content
       and current_controller = next_controller then
      continue;
    end if;
    next_version := case
      when current_version is null then '1.0.0'
      else split_part(current_version, '.', 1) || '.' || (split_part(current_version, '.', 2)::integer + 1) || '.0'
    end;
    next_document := jsonb_build_object('slug', doc_slug, 'version', next_version, 'effectiveDate', today)
      || next_content
      || jsonb_build_object('history',
           jsonb_build_array(jsonb_build_object('version', next_version, 'date', today, 'summary', note))
           || coalesce(current_content -> 'history', '[]'::jsonb));
    insert into public.legal_documents (slug, version, sha256, content, controller, published_by)
    values (
      doc_slug,
      next_version,
      encode(sha256(convert_to(jsonb_build_object('document', next_document, 'controller', next_controller)::text, 'UTF8')), 'hex'),
      next_document,
      next_controller,
      auth.uid()
    );
    perform public.record_audit('legal_published', 'legal_documents', doc_slug || '@' || next_version, jsonb_build_object('note', note));
    published := published + 1;
  end loop;
  return published;
end;
$$;

revoke all on function public.publish_legal_documents(jsonb, jsonb, text) from public, anon;
grant execute on function public.publish_legal_documents(jsonb, jsonb, text) to authenticated;
