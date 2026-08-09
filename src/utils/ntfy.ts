const NTFY_TOPIC = 'cgv-imax-odyssey';
const NTFY_URL = `https://ntfy.sh/${NTFY_TOPIC}`;

export async function sendNtfy(title: string, message: string, priority: number = 4): Promise<boolean> {
  try {
    const res = await fetch(NTFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
      body: `${title}\n\n${message}`,
    });
    return res.ok;
  } catch {
    return false;
  }
}
