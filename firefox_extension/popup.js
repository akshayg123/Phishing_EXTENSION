const analyzeButton = document.getElementById('analyzeButton');
const statusDiv = document.getElementById('status');
const resultDiv = document.getElementById('result');

analyzeButton.addEventListener('click', () => {
    statusDiv.textContent = 'Analyzing...';
    resultDiv.innerHTML = ''; // Clear previous results
    analyzeButton.disabled = true;

    // Send message to background script to start the process
    chrome.runtime.sendMessage({ action: "analyzePage" })
        .catch(error => {
            console.error("Error sending message to background:", error);
            statusDiv.textContent = '';
            resultDiv.innerHTML = `<p class="error">Error: Could not communicate with background script. ${error.message || ''}</p>`;
            analyzeButton.disabled = false;
        });
});

// Listen for results from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "displayResult") {
        statusDiv.textContent = ''; // Clear status
        analyzeButton.disabled = false; // Re-enable button

        if (message.error) {
            console.error("Error received from background:", message.error);
            resultDiv.innerHTML = `<p class="error">Error: ${message.error}</p>`;
        } else if (message.data) {
            const data = message.data;
            console.log("Result received:", data);
            let resultHTML = `
                <p><strong>Prediction:</strong> <span class="${data.is_phishing ? 'phishing' : 'legitimate'}">
                    ${data.is_phishing ? 'Phishing' : 'Legitimate'}
                </span></p>
                <p><strong>Confidence:</strong> <span class="math-inline">\{data\.confidence \!\=\= null ? data\.confidence\.toFixed\(2\) \+ '%' \: 'N/A'\}</p\>
                <p><strong>Risk Level:</strong> <span class="risk-${data.risk_level ? data.risk_level.replace(' ', '.') : 'N/A'}">
                    ${data.risk_level || 'N/A'}
                </span></p>
                ; if (data.is_phishing && (data.risk_level === 'High' || data.risk_level === 'Very High')) { resultHTML +=<p class="phishing"><strong>Warning:</strong> High risk detected. Avoid clicking links or downloading attachments.</p>`;
            resultDiv.innerHTML = resultHTML;
        }
    }
    // Return true to indicate you wish to send a response asynchronously (optional here, but good practice)
    // return true;
});
