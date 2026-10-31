/** Keep complete counts without an unbounded URL or relying on the server row cap. */
export async function listarPaginas<T>(buscar:(inicio:number,fim:number)=>PromiseLike<{data:T[] | null;error:{message:string} | null}>) {
  const linhas:T[] = [];
  for (let inicio=0;;inicio+=500) {
    const {data,error} = await buscar(inicio,inicio+499);
    if (error || !data) throw new Error(error?.message || 'Consulta indisponível.');
    linhas.push(...data);
    if (data.length < 500) return linhas;
  }
}
