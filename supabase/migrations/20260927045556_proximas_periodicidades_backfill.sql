begin;
do $$declare i uuid;begin
if (select count(*) from public.pfpb_periodicidades)<>42 or (select count(*) from public.pfpb_produtos_periodicidade)<>2035 then raise exception 'Carga incompleta; não inicializar previsões.';end if;
for i in select id from public.dispensacao_itens where status='confirmado' loop perform rbk_private.proximas_sincronizar(i);end loop;
end $$;
commit;
