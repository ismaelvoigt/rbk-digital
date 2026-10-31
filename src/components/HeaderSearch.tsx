'use client';

import Link from 'next/link';
import {useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent} from 'react';
import {resolveRole, type RbkRole} from '../lib/auth/rbac';
import {filterSearchPages} from '../lib/navigation/search';
import {createClient} from '../lib/supabase/client';

function ResultIcon({category}: {category: string}) {
  let icon = <><path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8l-5-5H8z"/><path d="M14 3v6h6M8 13h8M8 17h8"/></>;
  if (category === 'Cadastros') {
    icon = <><path d="M3 10h18l-2-7H5l-2 7z"/><path d="M5 10v10h14V10M9 20v-6h6v6"/><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/></>;
  } else if (category.includes('Gestão')) {
    icon = <><path d="M3 3v18h18"/><path d="m7 14 4-4 4 3 5-7"/></>;
  } else if (category === 'Relacionamento') {
    icon = <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2"/></>;
  } else if (category === 'Processos') {
    icon = <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z"/><path d="m9 12 2 2 4-4"/></>;
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>;
}

export default function HeaderSearch() {
  const [role, setRole] = useState<RbkRole | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const results = useMemo(() => filterSearchPages(query, role), [query, role]);

  useEffect(() => {
    let active = true;
    async function loadRole() {
      const client = createClient();
      const {data: {user}} = await client.auth.getUser();
      if (!user) return;
      const [profile, admin] = await Promise.all([
        client.from('users').select('perfil,status').eq('id', user.id).maybeSingle(),
        client.from('rbk_admins').select('user_id').eq('user_id', user.id).eq('ativo', true).maybeSingle(),
      ]);
      if (!active || admin.error) return;
      if (admin.data) {
        setRole(resolveRole(profile.data?.perfil ?? null, true));
        return;
      }
      if (profile.error || profile.data?.status !== 'active') return;
      setRole(resolveRole(profile.data.perfil, false));
    }
    void loadRole().catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
      if (event.key === 'Escape') setOpen(false);
    }
    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!results.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      resultRefs.current[activeIndex]?.click();
    }
  }

  return (
    <div className="rbk-header-search" ref={wrapperRef}>
      <div className="rbk-header-search-input-wrap">
        <svg aria-hidden="true" className="rbk-header-search-glass" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>
        </svg>
        <label className="sr-only" htmlFor="rbk-page-search">Pesquisar páginas do sistema</label>
        <input
          ref={inputRef}
          id="rbk-page-search"
          type="search"
          role="combobox"
          value={query}
          placeholder="Pesquisar páginas do sistema"
          autoComplete="off"
          aria-label="Pesquisar páginas do sistema"
          aria-expanded={open}
          aria-controls={open && results.length ? 'rbk-page-search-results' : undefined}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-activedescendant={open && results.length ? `rbk-page-search-result-${activeIndex}` : undefined}
          onFocus={() => setOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); setOpen(true); }}
          onKeyDown={handleInputKeyDown}
        />
        <kbd className="rbk-header-search-shortcut"><span>Ctrl</span><span>K</span></kbd>
      </div>
      {open && (
        <div className="rbk-header-search-menu" role="region" aria-label="Resultados da pesquisa">
          <p className="rbk-header-search-heading">Páginas e funcionalidades</p>
          {results.length ? (
            <ul id="rbk-page-search-results" className="rbk-header-search-list" role="listbox">
              {results.map((result, index) => (
                <li key={result.href}>
                  <Link
                    ref={(element) => { resultRefs.current[index] = element; }}
                    id={`rbk-page-search-result-${index}`}
                    href={result.href}
                    role="option"
                    aria-selected={index === activeIndex}
                    className={`rbk-header-search-result${index === activeIndex ? ' is-active' : ''}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => setOpen(false)}
                  >
                    <span className="rbk-header-search-icon"><ResultIcon category={result.category}/></span>
                    <span className="rbk-header-search-copy">
                      <strong>{result.title}</strong>
                      <span>{result.category} · {result.description}</span>
                    </span>
                    <span className="rbk-header-search-arrow" aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rbk-header-search-empty" role="status">
              {role ? 'Nenhuma página encontrada.' : 'Carregando páginas disponíveis…'}
            </p>
          )}
          <div className="rbk-header-search-footer">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
            Pesquisar páginas do sistema
          </div>
        </div>
      )}
    </div>
  );
}