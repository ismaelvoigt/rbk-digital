import type { RbkRole } from '../auth/rbac';

export type SearchPage = {
  href: string;
  title: string;
  category: string;
  description: string;
  roles: readonly RbkRole[];
};

const ALL_ROLES: readonly RbkRole[] = [
  'gerente_farmacia',
  'operador',
  'administrador_farmacia',
  'gestor_rbk',
  'superadmin_rbk',
];
const RBK_ROLES: readonly RbkRole[] = ['gestor_rbk', 'superadmin_rbk'];
const PHARMACY_ROLES: readonly RbkRole[] = [
  'gerente_farmacia',
  'operador',
  'administrador_farmacia',
];
const ADMINISTRATION_ROLES: readonly RbkRole[] = [
  'gerente_farmacia',
  'administrador_farmacia',
  'gestor_rbk',
  'superadmin_rbk',
];

export const searchPages: readonly SearchPage[] = [
  {
    href: '/dashboard',
    title: 'Dashboard',
    category: 'Gestão RBK',
    description: 'Painel de gestão e atalhos de processos',
    roles: RBK_ROLES,
  },
  {
    href: '/farmacia',
    title: 'Painel da farmácia',
    category: 'Operação',
    description: 'Acessar as funcionalidades da farmácia',
    roles: PHARMACY_ROLES,
  },
  {
    href: '/usuarios/novo',
    title: 'Cadastrar farmácia',
    category: 'Cadastros',
    description: 'Novo cadastro e convite de acesso',
    roles: ['superadmin_rbk'],
  },
  {
    href: '/usuarios',
    title: 'Farmácias e usuários',
    category: 'Cadastros',
    description: 'Consultar e gerenciar acessos',
    roles: ['superadmin_rbk'],
  },
  {
    href: '/equipe',
    title: 'Equipe',
    category: 'Cadastros',
    description: 'Convidar funcionários e gerenciar acessos',
    roles: ['administrador_farmacia'],
  },
  {
    href: '/nova-autorizacao',
    title: 'Nova autorização',
    category: 'Operação',
    description: 'Cadastrar uma nova autorização',
    roles: PHARMACY_ROLES,
  },
  {
    href: '/autorizacoes',
    title: 'Autorizações',
    category: 'Operação',
    description: 'Consultar autorizações e documentos',
    roles: ALL_ROLES,
  },
  {
    href: '/pendencias',
    title: 'Pendências documentais',
    category: 'Operação',
    description: 'Conferir documentos ausentes ou que requerem atenção',
    roles: PHARMACY_ROLES,
  },
  {
    href: '/proximas-dispensacoes',
    title: 'Próximas dispensações',
    category: 'Relacionamento',
    description: 'Acompanhar retiradas previstas e avisos',
    roles: ALL_ROLES,
  },
  {
    href: '/administracao',
    title: 'Administração',
    category: 'Gestão da farmácia',
    description: 'Vendas, compras, relatórios e indicadores',
    roles: ADMINISTRATION_ROLES,
  },
  {
    href: '/compras',
    title: 'Compras',
    category: 'Gestão da farmácia',
    description: 'Planejar e acompanhar compras',
    roles: ADMINISTRATION_ROLES,
  },
  {
    href: '/vendas',
    title: 'Vendas',
    category: 'Gestão da farmácia',
    description: 'Consultar vendas e indicadores',
    roles: ADMINISTRATION_ROLES,
  },
  {
    href: '/relatorios',
    title: 'Relatórios',
    category: 'Gestão da farmácia',
    description: 'Consultar relatórios da operação',
    roles: ADMINISTRATION_ROLES,
  },
  {
    href: '/monitoramento',
    title: 'Monitoramento',
    category: 'Gestão RBK',
    description: 'Acompanhar a operação das farmácias',
    roles: RBK_ROLES,
  },
  {
    href: '/processos/auditorias',
    title: 'Auditorias PFPB',
    category: 'Processos',
    description: 'Consultar auditorias e receber documentos',
    roles: RBK_ROLES,
  },
  {
    href: '/processos/credenciamento/convites',
    title: 'Credenciamento',
    category: 'Processos',
    description: 'Gerar convites e acompanhar cadastros',
    roles: RBK_ROLES,
  },
  {
    href: '/financeiro',
    title: 'Financeiro',
    category: 'Gestão RBK',
    description: 'Acompanhar contratos e mensalidades',
    roles: RBK_ROLES,
  },
  {
    href: '/crm',
    title: 'CRM',
    category: 'Gestão RBK',
    description: 'Gerenciar relacionamento comercial',
    roles: RBK_ROLES,
  },
];

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

export function filterSearchPages(
  query: string,
  role: RbkRole | null,
  pages: readonly SearchPage[] = searchPages,
): SearchPage[] {
  if (!role) return [];
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  return pages.filter((page) => {
    if (!page.roles.includes(role)) return false;
    if (!terms.length) return true;
    const searchableText = normalizeSearchText(
      `${page.title} ${page.category} ${page.description}`,
    );
    return terms.every((term) => searchableText.includes(term));
  });
}
