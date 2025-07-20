import {
  CLIENT_ID, SCOPES,
  getAccessToken, setAccessToken,
  getTokenClient, setTokenClient
} from './google-auth.js';
import { loadEmails } from './mail-service.js';


let syncInterval = null;

window.start = function () {
  gapi.load('client', async () => {
    await initializeGapiClient();
    initializeTokenClient();
    document.getElementById('login').onclick = handleAuthClick;
    document.getElementById('sync').onclick = loadEmails;

    // 🔁 Синхронізація кожні 5 хвилин (300 000 мс)
    syncInterval = setInterval(() => {
      if (getAccessToken()) {
        console.log("⏱ Синхронізація...");
        loadEmails();
      }
    }, 300000);
  });
};


window.addEventListener("DOMContentLoaded", () => {
  if (window.gapi) {
    start();
  } else {
    const check = setInterval(() => {
      if (window.gapi) {
        clearInterval(check);
        start();
      }
    }, 100);
  }
});


export function initializeTokenClient() {
  setTokenClient(
    google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: async (tokenResponse) => {
        if (tokenResponse.error) {
          console.error('Помилка авторизації:', tokenResponse);
          document.getElementById('status').textContent = 'Помилка авторизації';
          return;
        }

        setAccessToken(tokenResponse.access_token);

        try {
          const userInfo = await gapi.client.gmail.users.getProfile({ userId: 'me' });
          const email = userInfo.result.emailAddress;

          document.getElementById('status').textContent = `Авторизовано як ${email}`;
          document.getElementById('login').style.display = "none";
          document.getElementById('logout').style.display = "block";
          document.getElementById('main-content').style.display = "block";

          loadEmails();
        } catch (err) {
          console.error("Помилка отримання профілю:", err);
          document.getElementById('status').textContent = 'Помилка отримання даних користувача';
        }
      }
    })
  );
}


export function handleAuthClick() {
  getTokenClient().requestAccessToken(); 
}

export function updateSigninStatus() {
  if (getAccessToken()) {
    document.getElementById('status').textContent = 'Авторизовано';
    loadEmails();
  } else {
    document.getElementById('status').textContent = 'Будь ласка, увійдіть';
    clearEmails();
  }
}

export function clearEmails() {
  document.getElementById('email').innerHTML = '';
}


export function renderEmailCard(message) {
  const headers = message.payload.headers;
  const from = headers.find(h => h.name === 'From')?.value || 'Невідомий відправник';
  const subject = headers.find(h => h.name === 'Subject')?.value || '(Без теми)';
  const date = headers.find(h => h.name === 'Date')?.value || '';

  const card = document.createElement('div');
  card.classList.add('email-cards');
  card.id = `email-card-${message.id}`;

  card.innerHTML = `
    <h3>${subject}</h3>
    <p><b>Від:</b> ${from}</p>
    <p><small>${date}</small></p>
  `;

  card.onclick = async function (event) {
    // Зняти розгортання з усіх карток
    document.querySelectorAll('.email-cards.expanded').forEach(el => {
      el.classList.remove('expanded');
      const iframe = el.querySelector('iframe.email-body');
      if (iframe) iframe.remove();
    });

    // Додати розгортання цій картці
    card.classList.add('expanded');

    // Показати "Завантаження..." у iframe
    const iframe = document.createElement('iframe');
    iframe.className = 'email-body';
    iframe.style.width = '100%';
    iframe.style.minHeight = '400px';
    iframe.style.border = 'none';
    setTimeout(() => {
        card.appendChild(iframe);
    }, 50);
    setTimeout(() => {
        card.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
        });
    }, 100);


    // Підвантажити повний текст листа
    try {
      const messageResponse = await gapi.client.gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'full',
      });
      const { decoded, isHtml } = getBody(messageResponse.result);

    iframe.contentDocument.open();
    if (isHtml) {
        iframe.contentDocument.write(decoded);
    } else {
        // Для plain text — обгортаємо у <pre> для збереження форматування
        iframe.contentDocument.write('<pre style="font-family:inherit;white-space:pre-wrap;">' + 
        decoded.replace(/</g, "&lt;").replace(/>/g, "&gt;") + 
        '</pre>');
    }
    iframe.contentDocument.close();
    } catch (e) {
      iframe.contentDocument.open();
      iframe.contentDocument.write('<p>Не вдалося завантажити текст листа</p>');
      iframe.contentDocument.close();
    }

    function handleOutsideClick(e) {
        if (!card.contains(e.target)) {
            card.classList.remove('expanded');
            setTimeout(() => {
                const iframe = card.querySelector('iframe.email-body');
                if (iframe) iframe.remove();
                }, 500); 
            document.removeEventListener('mousedown', handleOutsideClick);
        }
    }
    // Спочатку видаляємо попередній обробник, якщо він був
    document.removeEventListener('mousedown', handleOutsideClick);
    // Додаємо новий
    setTimeout(() => {
      document.addEventListener('mousedown', handleOutsideClick);
    }, 0);
    // Зупиняємо подальше спливання, щоб клік по самій картці не спрацював як "зовнішній"
    event.stopPropagation();
  };

  document.getElementById('email').appendChild(card);
}

function decodeBase64UrlUnicode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const decoded = atob(str);
  try {
    return decodeURIComponent(escape(decoded));
  } catch {
    return new TextDecoder('utf-8').decode(Uint8Array.from(decoded, c => c.charCodeAt(0)));
  }
}

// Функція для отримання тексту листа
function getBody(message) {
  let encodedBody = '';
  let isHtml = false;
  if (message.payload.parts) {
    for (const part of message.payload.parts) {
      if (part.mimeType === 'text/html' && part.body.data) {
        encodedBody = part.body.data;
        isHtml = true;
        break;
      }
      if (part.mimeType === 'text/plain' && part.body.data) {
        encodedBody = part.body.data;
        // не break, щоб html мав пріоритет
      }
    }
  } else if (message.payload.body && message.payload.body.data) {
    encodedBody = message.payload.body.data;
    isHtml = message.payload.mimeType === 'text/html';
  }
  const decoded = decodeBase64UrlUnicode(encodedBody);
  return { decoded, isHtml };
}


document.getElementById('account-selector').addEventListener('change', function () {
  const selectedIndex = this.value;

  if (selectedIndex === "") {
    setAccessToken(null);
    clearEmails();
    document.getElementById('status').textContent = 'Будь ласка, оберіть акаунт';
    return;
  }

  const accounts = getAccounts();
  setAccessToken(accounts[selectedIndex].token);
  localStorage.setItem("selectedAccountIndex", selectedIndex);
  gapi.client.setToken({ access_token: getAccessToken() });

  document.getElementById('status').textContent = `Обрано: ${accounts[selectedIndex].email}`;

  loadEmails();
});

const login = document.getElementById("login");
const logout = document.getElementById("logout");
const main = document.getElementById("main-content");

logout.onclick = handleLogout;

export function handleLogout() {
  if (!getAccessToken()) return;

  fetch(`https://oauth2.googleapis.com/revoke?token=${getAccessToken()}`, {
    method: 'POST',
    headers: {
      'Content-type': 'application/x-www-form-urlencoded'
    }
  }).then(() => {
    setAccessToken(null);
    document.getElementById('status').textContent = 'Ви вийшли';
    login.style.display= "block";
    logout.style.display= "none";
    main.style.display = "none";

    clearEmails();
  }).catch(err => {
    console.error('Помилка відклику токена:', err);
  });
  loadedMessageIds.clear();
}




