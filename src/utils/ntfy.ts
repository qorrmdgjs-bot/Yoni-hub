const NTFY_TOPIC = 'cgv-imax-odyssey';
const NTFY_URL = `https://ntfy.sh/${NTFY_TOPIC}`;

export async function sendNtfy(title: string, message: string, priority: number = 4): Promise<boolean> {
  try {
    const res = await fetch(NTFY_URL, {
      method: 'POST',
      headers: {
        'Title': title,
        'Priority': String(priority),
        'Tags': 'movie_camera,ticket',
      },
      body: message,
    });
    return res.ok;
  } catch {
    return false;
  }
}
