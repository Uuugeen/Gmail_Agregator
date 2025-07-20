import { API_KEY, DISCOVERY_DOCS, getAccessToken } from './google-auth.js';
import { updateSigninStatus, clearEmails, renderEmailCard } from './script.js';

export async function initializeGapiClient() {
  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: DISCOVERY_DOCS,
  });
  updateSigninStatus();
}

let loadedMessageIds = new Set(); 


export async function loadEmails() {
  if (!getAccessToken()) {
    document.getElementById('status').textContent = 'Спочатку увійдіть';
    return;
  }

  gapi.client.setToken({ access_token: getAccessToken() });

  try {
    const response = await gapi.client.gmail.users.messages.list({
      userId: 'me',
      maxResults: 10,
    });

    const messages = response.result.messages;

    if (!messages || messages.length === 0) {
      document.getElementById('status').textContent = 'Листів не знайдено';
      return;
    }

    // Визначаємо нові повідомлення
    const newMessages = messages.filter(msg => !loadedMessageIds.has(msg.id));
    if (newMessages.length === 0) {
      console.log("Нових листів немає");
      return;
    } else {
        eel.show_notification();
    }

    for (const msg of newMessages) {
      const messageResponse = await gapi.client.gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      });
      renderEmailCard(messageResponse.result);
      loadedMessageIds.add(msg.id); // додаємо в кеш
    }

    document.getElementById('status').textContent = `Оновлено (${newMessages.length} нових)`;

  } catch (error) {
    document.getElementById('status').textContent = 'Помилка завантаження листів';
    console.error(error);
  }
}
