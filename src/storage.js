// Chrome Storage API wrapper
const Storage = {
  async get(key) {
    return new Promise((resolve) => {
      chrome.storage.sync.get(key, (result) => resolve(result[key]));
    });
  },
  
  async set(key, value) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [key]: value }, resolve);
    });
  }
};