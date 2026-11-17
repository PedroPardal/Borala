/** Utilidades de formatos brasileiros: CPF, celular, data e CEP. */

export const onlyDigits = (v: string) => v.replace(/\D/g, '');

/** CPF válido (confere os dois dígitos verificadores). */
export function isValidCPF(value: string) {
  const d = onlyDigits(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const check = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return check(9) === Number(d[9]) && check(10) === Number(d[10]);
}

/** 12345678909 → 123.456.789-09 (formata enquanto digita) */
export function maskCPF(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

/** 11988887777 → (11) 98888-7777 */
export function maskPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export const isValidPhone = (v: string) => {
  const d = onlyDigits(v);
  return d.length === 11 || d.length === 10;
};

/** 31121990 → 31/12/1990 */
export function maskDate(v: string) {
  const d = onlyDigits(v).slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('/');
}

/** "31/12/1990" → "1990-12-31", ou null se a data não existir. */
export function parseDateBR(v: string): string | null {
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (date.getFullYear() !== Number(yyyy) || date.getMonth() !== Number(mm) - 1 || date.getDate() !== Number(dd)) return null;
  return `${yyyy}-${mm}-${dd}`;
}

/** Idade completa em anos a partir de "yyyy-mm-dd". */
export function ageFrom(iso: string, today = new Date()) {
  const [y, m, d] = iso.split('-').map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
}

/** 01001000 → 01001-000 */
export function maskCEP(v: string) {
  const d = onlyDigits(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export interface CepAddress {
  street: string;
  district: string;
  city: string;
  uf: string;
}

/** Endereço de um CEP pela ViaCEP (gratuita, sem chave). Devolve null se não achar ou sem internet. */
export async function lookupCEP(cep: string): Promise<CepAddress | null> {
  const d = onlyDigits(cep);
  if (d.length !== 8) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal: ctrl.signal });
    const data = await res.json();
    if (!res.ok || data.erro) return null;
    return { street: data.logradouro ?? '', district: data.bairro ?? '', city: data.localidade ?? '', uf: data.uf ?? '' };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Nome e sobrenome, com pelo menos 2 letras cada. */
export const isFullName = (v: string) => v.trim().split(/\s+/).filter((p) => p.length >= 2).length >= 2;

/** Preço digitado ("45,50" ou "1.200") em número. */
export const parsePriceBR = (v: string) => Number(v.replace(/\./g, '').replace(',', '.'));
