/**
 * Look up state (and optionally district) from an Indian pincode
 * using the public India Post PIN code API.
 * Returns { state, district } or nulls if the lookup fails.
 */
export async function lookupStateFromPincode(
  pincode: string,
): Promise<{ state: string; district: string }> {
  const pin = (pincode || '').trim();
  if (!/^\d{6}$/.test(pin)) return { state: '', district: '' };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return { state: '', district: '' };

    const data = await res.json();
    const first: any = Array.isArray(data) ? data[0] : null;
    const postOffice: any = first?.PostOffice?.[0];
    if (!postOffice) return { state: '', district: '' };

    return {
      state: (postOffice.State || '').trim(),
      district: (postOffice.District || '').trim(),
    };
  } catch {
    return { state: '', district: '' };
  }
}
