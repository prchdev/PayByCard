const SESSION_KEY = 'client_ip';

export async function getClientIp(): Promise<string | null> {
  const cached = sessionStorage.getItem(SESSION_KEY);
  if (cached) return cached;

  try {
    const res = await fetch('https://api.ipify.org?format=json');
    if (!res.ok) return null;
    const { ip } = await res.json();
    if (ip) sessionStorage.setItem(SESSION_KEY, ip);
    return ip || null;
  } catch {
    return null;
  }
}
