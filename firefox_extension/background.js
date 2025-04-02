const BACKEND_URL = 'http://127.0.0.1:5000/analyze';

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "analyzePage") {
        console.log("Background: Received analyzePage request from popup.");
        // Get the currently active tab
        chrome.tabs.query({ active: true, currentWindow: true })
            .then(tabs => {
                if (tabs.length === 0) {
                    console.error("Background: No active tab found.");
                    sendResultToPopup({ error: "No active tab identified." });
                    return;
                }
                const activeTabId = tabs[0].id;
                console.log(`Background: Injecting content script into tab ${activeTabId}`);

                // Inject the content script into the active tab
                chrome.scripting.executeScript({
                    target: { tabId: activeTabId },
                    files: ['content_script.js']
                })
                .then(() => {
                    console.log("Background: Content script injected successfully.");
                    // The content script will now run and send back the email data
                    // We wait for the 'emailData' message from content_script.js
                })
                .catch(err => {
                     console.error(`Background: Failed to inject content script: ${err}`);
                     sendResultToPopup({ error: `Failed to access page content: ${err.message}` });
                });
            })
            .catch(err => {
                 console.error(`Background: Failed to query tabs: ${err}`);
                 sendResultToPopup({ error: `Failed to get active tab: ${err.message}` });
            });

        // Indicate that the response will be sent asynchronously
        return true;
    }

     // Listen for data coming FROM the content script
     if (message.action === "emailData") {
        console.log("Background: Received email data from content script:", message.data);
        if (message.error) {
             console.error("Background: Error reported by content script:", message.error);
             sendResultToPopup({ error: message.error });
        } else if (message.data && message.data.subject !== null && message.data.body !== null) {
             // Send data to Python backend
             callBackend(message.data);
        } else {
             console.warn("Background: Incomplete or missing data from content script.");
             sendResultToPopup({ error: "Could not extract sufficient email content from the page." });
        }
         // Indicate that the response will be sent asynchronously
         return true;
     }
});

// Function to call the Flask backend
async function callBackend(emailData) {
    console.log("Background: Sending data to backend:", emailData);
    try {
        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(emailData),
        });

        if (!response.ok) {
            // Try to get error message from backend response body
            let errorMsg = `Backend Error: ${response.status} ${response.statusText}`;
             try {
                const errorData = await response.json();
                if (errorData && errorData.error) {
                    errorMsg += ` - ${errorData.error}`;
                }
             } catch (e) { /* Ignore if response body isn't JSON */ }
            console.error("Background:", errorMsg);
            sendResultToPopup({ error: errorMsg });
            return; // Stop processing on error
        }

        const result = await response.json();
        console.log("Background: Received result from backend:", result);
        sendResultToPopup({ data: result });

    } catch (error) {
        console.error(`Background: Network or fetch error calling backend: ${error}`);
        sendResultToPopup({ error: `Cannot connect to the local analysis server (${BACKEND_URL}). Is it running?` });
    }
}

// Function to send results back to the popup
function sendResultToPopup(result) {
     console.log("Background: Sending result back to popup:", result);
     // We don't have a specific tab ID here easily, so send to any listening runtime (the popup)
     chrome.runtime.sendMessage({ action: "displayResult", ...result })
        .catch(error => {
            // This might fail if the popup was closed before the result came back
            console.warn("Background: Could not send result to popup (it might be closed).", error);
        });
}

console.log("Background service worker started.");