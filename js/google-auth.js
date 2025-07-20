export const CLIENT_ID = '1098842283612-nt0sjvouc260q6sf0n2274urliiilik5.apps.googleusercontent.com';
export const API_KEY = 'AIzaSyDbGitr-4FXBWf4QhMFYgAjgGr4w1Wjl0o';
export const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest"];
export const SCOPES = "https://www.googleapis.com/auth/gmail.readonly";


let tokenClient;
let accessToken = null;

export function getAccessToken() {
  return accessToken;
}
export function setAccessToken(token) {
  accessToken = token;
}

export function getTokenClient() {
  return tokenClient;
}
export function setTokenClient(tc) {
  tokenClient = tc;
}

import { initializeGapiClient, loadEmails } from './mail-service.js';
import { initializeTokenClient, handleAuthClick } from './script.js';
window.start = function() {
  gapi.load('client', initializeGapiClient);
  initializeTokenClient();
  document.getElementById('login').onclick = handleAuthClick;
  document.getElementById('sync').onclick = loadEmails;
};

window.addEventListener("load", () => {
  if (window.gapi) {
    start();
  } else {
    const checkGapi = setInterval(() => {
      if (window.gapi) {
        clearInterval(checkGapi);
        start();
      }
    }, 100);
  }
});