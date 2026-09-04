const NTFY_TOPIC = 'cgv-imax-odyssey';

export async function sendNtfy(
  title: string,
  message: string,
  priority: number = 4,
  topic: string = NTFY_TOPIC,
): Promise<boolean> {
  try {
    const res = await fetch(`https://ntfy.sh/${topic}`, {
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
