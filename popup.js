const defaults = { quickLinks: true, completedStyle: true };

async function loadSettings() {
  const settings = await chrome.storage.sync.get(defaults);
  document.querySelector('#quickLinks').checked = settings.quickLinks;
  document.querySelector('#completedStyle').checked = settings.completedStyle;
}

for (const input of document.querySelectorAll('input[type="checkbox"]')) {
  input.addEventListener('change', async () => {
    await chrome.storage.sync.set({ [input.id]: input.checked });
  });
}

loadSettings();
