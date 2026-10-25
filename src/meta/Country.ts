/**
 * Player country: auto-detected once (IP geolocation, falling back to the device time zone /
 * language), editable in the profile. Shown as a flag on leaderboards. Pure helpers + one fetch.
 */
export const COUNTRIES = [
  'VN', 'TH', 'ID', 'PH', 'MY', 'SG', 'KH', 'LA', 'MM', 'BN', 'JP', 'KR', 'CN', 'TW', 'HK', 'IN', 'PK', 'BD', 'LK', 'NP',
  'AU', 'NZ', 'US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'GB', 'IE', 'FR', 'DE', 'ES', 'PT', 'IT', 'NL', 'BE', 'CH',
  'AT', 'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'HU', 'RO', 'UA', 'RU', 'TR', 'GR', 'IL', 'AE', 'SA', 'QA', 'EG', 'MA', 'NG',
  'KE', 'ZA',
] as const;

/** 🇻🇳 from 'VN' (regional indicator letters) */
export function flagOf(code: string | undefined | null) {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return '🏁';
  const c = code.toUpperCase();
  return String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65, 0x1f1e6 + c.charCodeAt(1) - 65);
}

let names: Intl.DisplayNames | null = null;
export function countryName(code: string) {
  try {
    names ??= new Intl.DisplayNames(['en'], { type: 'region' });
    return names.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

const TZ: Record<string, string> = {
  'Asia/Ho_Chi_Minh': 'VN', 'Asia/Saigon': 'VN', 'Asia/Bangkok': 'TH', 'Asia/Jakarta': 'ID', 'Asia/Manila': 'PH', 'Asia/Kuala_Lumpur': 'MY',
  'Asia/Singapore': 'SG', 'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Shanghai': 'CN', 'Asia/Taipei': 'TW', 'Asia/Hong_Kong': 'HK',
  'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Australia/Sydney': 'AU', 'Europe/London': 'GB', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE',
  'Europe/Madrid': 'ES', 'Europe/Rome': 'IT', 'America/Sao_Paulo': 'BR', 'America/Mexico_City': 'MX',
};

/** offline guess: time zone first (Asia/Bangkok is shared by VN/TH, so language breaks the tie), then language region */
export function guessCountry(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const lang = navigator.language || '';
    if (tz === 'Asia/Bangkok' && /^vi/i.test(lang)) return 'VN';
    if (TZ[tz]) return TZ[tz];
    const m = /-([A-Z]{2})$/i.exec(lang);
    if (m) return m[1].toUpperCase();
  } catch {
    /* ignore */
  }
  return 'US';
}

/** IP geolocation (country code only). Resolves null when offline / blocked. */
export async function detectCountry(timeoutMs = 3500): Promise<string | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetch('https://ipapi.co/country/', { signal: ctl.signal, cache: 'no-store' });
    clearTimeout(t);
    if (!res.ok) return null;
    const code = (await res.text()).trim().toUpperCase();
    return /^[A-Z]{2}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}
