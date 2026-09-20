-- ============================================================================
-- Simulador de preço — esquema do banco (Supabase / Postgres)
-- ----------------------------------------------------------------------------
-- Cole tudo isto no SQL Editor do Supabase e clique em "Run".
-- É IDEMPOTENTE: pode rodar de novo sem quebrar nada (recria políticas,
-- views, funções e triggers; não apaga seus dados).
--
-- O que este arquivo cria:
--   Tabelas:  produtos, compras, vendas, triagens, configuracoes
--   Views:    estoque, vendas_detalhe
--   Regras:   trigger que IMPEDE vender mais do que há em estoque
--   Segurança: Row Level Security ligado em TODAS as tabelas
--             (só usuários logados acessam; os 3 da família enxergam
--              os mesmos dados, que é o desejado aqui).
--
-- Padrões: valores em numeric(12,2); datas em `date`; fuso America/Sao_Paulo.
-- ============================================================================

create extension if not exists pgcrypto; -- gen_random_uuid()

-- Função auxiliar: data de "hoje" no fuso de São Paulo.
create or replace function hoje_sp()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

-- ----------------------------------------------------------------------------
-- TABELAS
-- ----------------------------------------------------------------------------

-- Produtos: lista única para todos escolherem o mesmo item (evita grafias
-- diferentes para o mesmo produto).
create table if not exists produtos (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique,
  link       text,                      -- link do anúncio ou ASIN da Amazon
  catalogo   boolean not null default true,
  criado_em  timestamptz not null default now()
);

-- Compras (entrada de estoque).
create table if not exists compras (
  id                 uuid primary key default gen_random_uuid(),
  data               date not null default hoje_sp(),
  produto_id         uuid not null references produtos(id) on delete restrict,
  marketplace_compra text,                                   -- ex.: 'Amazon'
  qtd                integer not null check (qtd > 0),
  custo_unit         numeric(12,2) not null check (custo_unit >= 0),
  frete              numeric(12,2) not null default 0 check (frete >= 0),
  preco_pretendido   numeric(12,2),
  obs                text,
  criado_por         uuid default auth.uid() references auth.users(id) on delete set null,
  criado_em          timestamptz not null default now()
);
create index if not exists idx_compras_produto on compras(produto_id);

-- Vendas (saída de estoque). "liquido_recebido" é o total que o ML repassou.
create table if not exists vendas (
  id                uuid primary key default gen_random_uuid(),
  data              date not null default hoje_sp(),
  produto_id        uuid not null references produtos(id) on delete restrict,
  qtd               integer not null check (qtd > 0),
  preco_unit        numeric(12,2) not null check (preco_unit >= 0),
  liquido_recebido  numeric(12,2) not null check (liquido_recebido >= 0),
  obs               text,
  criado_por        uuid default auth.uid() references auth.users(id) on delete set null,
  criado_em         timestamptz not null default now()
);
create index if not exists idx_vendas_produto on vendas(produto_id);

-- Triagens: guarda o Buy Box do dia e o veredito, para comparar depois com o
-- que realmente aconteceu.
create table if not exists triagens (
  id            uuid primary key default gen_random_uuid(),
  data          date not null default hoje_sp(),
  produto_id    uuid references produtos(id) on delete set null, -- opcional
  produto_nome  text,                                            -- texto livre
  catalogo      boolean,
  n_vendas      integer,
  preco_buybox  numeric(12,2),
  custo         numeric(12,2),
  comissao_pct  numeric(12,2),
  tarifa_fixa   numeric(12,2),
  entrega       numeric(12,2),
  margem_min    numeric(12,2),
  veredito      text,
  criado_por    uuid default auth.uid() references auth.users(id) on delete set null,
  criado_em     timestamptz not null default now()
);

-- Configurações: uma linha só, com os parâmetros editáveis do negócio.
create table if not exists configuracoes (
  id                    integer primary key default 1 check (id = 1),
  limite_evitar         integer not null default 500,
  limite_1              integer not null default 1000,
  limite_5              integer not null default 5000,
  limite_10             integer not null default 10000,
  margem_min_pct        numeric(12,2) not null default 20,
  teto_mei              numeric(12,2) not null default 81000,
  dias_estoque_parado   integer not null default 30,
  atualizado_em         timestamptz not null default now()
);

-- Garante a linha única de configuração (não sobrescreve se já existir).
insert into configuracoes (id) values (1)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- VIEWS (cálculos automáticos — nunca digitados)
-- ----------------------------------------------------------------------------

-- Custo médio ponderado por produto:
--   custo total de uma compra = qtd*custo_unit + frete
--   custo médio = soma(custos totais) / soma(qtd)
create or replace view produto_custo as
select
  p.id as produto_id,
  coalesce(sum(c.qtd * c.custo_unit + c.frete), 0)::numeric(12,2) as custo_total,
  coalesce(sum(c.qtd), 0)                                         as qtd_comprada,
  case when coalesce(sum(c.qtd), 0) > 0
       then (sum(c.qtd * c.custo_unit + c.frete) / sum(c.qtd))::numeric(12,2)
       else 0::numeric(12,2)
  end as custo_medio
from produtos p
left join compras c on c.produto_id = p.id
group by p.id;

-- Estoque (somente leitura): comprado, vendido, disponível, custo médio,
-- valor parado, dias sem vender.
create or replace view estoque as
with comprado as (
  select produto_id, sum(qtd) as qtd, min(data) as primeira_compra
  from compras group by produto_id
),
vendido as (
  select produto_id, sum(qtd) as qtd, max(data) as ultima_venda
  from vendas group by produto_id
)
select
  p.id                                             as produto_id,
  p.nome,
  p.catalogo,
  coalesce(cp.qtd, 0)                              as comprado,
  coalesce(vd.qtd, 0)                              as vendido,
  coalesce(cp.qtd, 0) - coalesce(vd.qtd, 0)        as disponivel,
  pc.custo_medio,
  ((coalesce(cp.qtd, 0) - coalesce(vd.qtd, 0)) * pc.custo_medio)::numeric(12,2)
                                                   as valor_estoque,
  vd.ultima_venda,
  (hoje_sp() - coalesce(vd.ultima_venda, cp.primeira_compra)) as dias_sem_vender
from produtos p
left join comprado    cp on cp.produto_id = p.id
left join vendido     vd on vd.produto_id = p.id
left join produto_custo pc on pc.produto_id = p.id;

-- Detalhe de cada venda: taxas do ML por diferença, custo, lucro e margem.
--   bruto        = qtd * preco_unit
--   taxas_ml     = bruto - liquido_recebido           (custo efetivo do ML)
--   taxa_efetiva = taxas_ml / bruto
--   custo_produto= qtd * custo_medio_atual_do_produto
--   lucro        = liquido_recebido - custo_produto
--   margem       = liquido_recebido / custo_produto - 1
create or replace view vendas_detalhe as
select
  v.id,
  v.data,
  v.produto_id,
  p.nome as produto_nome,
  v.qtd,
  v.preco_unit,
  (v.qtd * v.preco_unit)::numeric(12,2)                     as bruto,
  v.liquido_recebido,
  (v.qtd * v.preco_unit - v.liquido_recebido)::numeric(12,2) as taxas_ml,
  case when (v.qtd * v.preco_unit) > 0
       then ((v.qtd * v.preco_unit - v.liquido_recebido) / (v.qtd * v.preco_unit))::numeric(12,4)
       else 0 end                                            as taxa_efetiva,
  (v.qtd * pc.custo_medio)::numeric(12,2)                    as custo_produto,
  (v.liquido_recebido - v.qtd * pc.custo_medio)::numeric(12,2) as lucro,
  case when (v.qtd * pc.custo_medio) > 0
       then (v.liquido_recebido / (v.qtd * pc.custo_medio) - 1)::numeric(12,4)
       else null end                                         as margem,
  v.obs,
  v.criado_por,
  v.criado_em
from vendas v
join produtos p       on p.id = v.produto_id
join produto_custo pc on pc.produto_id = v.produto_id;

-- ----------------------------------------------------------------------------
-- REGRA NO BANCO: impedir venda maior que o estoque disponível
-- (não só na tela — aqui ninguém consegue furar, nem por engano nem por API).
-- ----------------------------------------------------------------------------
create or replace function checa_estoque_venda()
returns trigger
language plpgsql
as $$
declare
  total_comprado integer;
  total_vendido  integer;
  disponivel     integer;
begin
  select coalesce(sum(qtd), 0) into total_comprado
  from compras where produto_id = new.produto_id;

  -- Soma as outras vendas do mesmo produto (ignora a linha atual em edições).
  select coalesce(sum(qtd), 0) into total_vendido
  from vendas
  where produto_id = new.produto_id
    and id is distinct from new.id;

  disponivel := total_comprado - total_vendido;

  if new.qtd > disponivel then
    raise exception
      'Estoque insuficiente: disponível %, tentativa de vender %.',
      disponivel, new.qtd
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_checa_estoque on vendas;
create trigger trg_checa_estoque
  before insert or update on vendas
  for each row execute function checa_estoque_venda();

-- ----------------------------------------------------------------------------
-- SEGURANÇA: Row Level Security em TODAS as tabelas.
-- Regra simples: qualquer usuário AUTENTICADO pode ler e escrever
-- (os 3 da família compartilham os mesmos dados). Anônimo não acessa nada.
-- ----------------------------------------------------------------------------
alter table produtos      enable row level security;
alter table compras       enable row level security;
alter table vendas        enable row level security;
alter table triagens      enable row level security;
alter table configuracoes enable row level security;

-- Recria as políticas de forma idempotente.
do $$
declare
  t text;
begin
  foreach t in array array['produtos','compras','vendas','triagens','configuracoes']
  loop
    execute format('drop policy if exists "acesso_logado" on %I;', t);
    execute format(
      'create policy "acesso_logado" on %I
         for all
         to authenticated
         using (true)
         with check (true);', t);
  end loop;
end $$;

-- ============================================================================
-- Fim do schema. Depois de rodar isto com sucesso, rode o arquivo `seed`
-- (histórico) — que fica SÓ no seu computador, nunca no GitHub.
-- ============================================================================
