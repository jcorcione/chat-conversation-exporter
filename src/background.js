class ChatGPTExportBackground {
  constructor() {
      // Initialize the background service
      this.setupMessageListeners();
      this.retryAttempts = 3; // Number of retry attempts for failed operations
      this.retryDelay = 2000; // Delay between retries in milliseconds
  }

  setupMessageListeners() {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
          if (request.action === 'saveToGDrive') {
              this.handleGDriveSave(request.data)
                  .then(result => sendResponse(result))
                  .catch(error => {
                      console.error('Save to Drive Error:', error);
                      sendResponse({ error: error.message });
                      this.showError('Failed to save to Google Drive: ' + error.message);
                  });
              return true; // Will respond asynchronously
          }
      });
  }

  async handleGDriveSave(data) {
      try {
          // Get auth token with retry logic
          const token = await this.getGoogleAuthTokenWithRetry();
          
          // Prepare file metadata
          const metadata = {
              name: `ChatGPT Conversation - ${new Date().toLocaleDateString()}.md`,
              mimeType: 'text/markdown',
          };
          
          // Generate markdown content
          const markdown = this.generateMarkdown(data);
          const file = new Blob([markdown], { type: 'text/markdown' });
          
          // Prepare form data for upload
          const form = new FormData();
          form.append('metadata', new Blob(
              [JSON.stringify(metadata)], 
              { type: 'application/json' }
          ));
          form.append('file', file);

          // Upload to Google Drive
          const response = await this.uploadToDriveWithRetry(token, form);

          if (!response.ok) {
              throw new Error(`Upload failed with status: ${response.status}`);
          }

          const result = await response.json();
          
          // Show success message
          chrome.runtime.sendMessage({ 
              action: 'showSuccess', 
              message: 'Successfully saved to Google Drive!' 
          });
          
          return result;

      } catch (error) {
          console.error('Google Drive Save Error:', error);
          chrome.runtime.sendMessage({ 
              action: 'showError', 
              message: 'Failed to save to Google Drive: ' + error.message 
          });
          throw error;
      }
  }

  async getGoogleAuthTokenWithRetry() {
      for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
          try {
              const auth = await chrome.identity.getAuthToken({ interactive: true });
              return auth.token;
          } catch (error) {
              if (attempt === this.retryAttempts) {
                  throw new Error('Failed to authenticate with Google');
              }
              await this.delay(this.retryDelay);
          }
      }
  }

  async uploadToDriveWithRetry(token, form) {
      for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
          try {
              return await fetch(
                  'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
                  {
                      method: 'POST',
                      headers: {
                          'Authorization': `Bearer ${token}`,
                      },
                      body: form
                  }
              );
          } catch (error) {
              if (attempt === this.retryAttempts) {
                  throw error;
              }
              await this.delay(this.retryDelay);
          }
      }
  }

  // Helper method to create delays for retry logic
  delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateMarkdown(data) {
      try {
          // Basic markdown formatting
          let markdown = `# ChatGPT Conversation\n\n`;
          markdown += `Date: ${new Date().toLocaleString()}\n\n`;
          
          // Add each message to the markdown
          data.messages.forEach(msg => {
              const role = msg.role === 'user' ? '👤 User' : '🤖 Assistant';
              markdown += `### ${role}\n\n${msg.content}\n\n`;
          });
          
          return markdown;
      } catch (error) {
          console.error('Markdown Generation Error:', error);
          throw new Error('Failed to generate markdown content');
      }
  }

  showError(message) {
      chrome.runtime.sendMessage({ 
          action: 'showError', 
          message: message 
      });
  }
}

// Initialize the background service
const background = new ChatGPTExportBackground();
