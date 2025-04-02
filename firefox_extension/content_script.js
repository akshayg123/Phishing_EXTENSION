// firefox_extension/content_script.js

(function() {
    // Use an IIFE (Immediately Invoked Function Expression) to avoid polluting global scope

    console.log("Content Script: Activated for Gmail.");

    /**
     * Tries to find the Gmail email subject and body elements in the DOM.
     * !!! --- WARNING --- !!!
     * These selectors are specific to GMAIL'S WEB INTERFACE and are based on
     * observations that can CHANGE FREQUENTLY WITHOUT NOTICE. They MIGHT break.
     *
     * If this script stops working, you MUST use "Inspect Element" in your
     * browser's Developer Tools to find the new correct selectors for the
     * subject line and the main email body container and update them below.
     */
    function extractEmailContent() {
        let subject = null;
        let body = null;
        let error = null;
        let subjectElement = null;
        let bodyElement = null;

        // --- !!! GMAIL SELECTORS (Likely to need updates over time) !!! ---

        // Selector for the Subject line in Gmail:
        // Often an h2 element with a specific, sometimes changing, class. 'hP' is common.
        const subjectSelector = 'h2.hP';

        // Selector for the main Email Body container in Gmail:
        // Often a div with specific classes. 'a3s aiL' is common for formatted content.
        // Sometimes might include quoted text, handled partly by text extraction logic.
        // Might need refinement if it picks up signatures incorrectly.
        const bodySelector = 'div.a3s.aiL';
        // Alternative body selector if the above fails (might grab more, like quoted text):
        // const bodySelector = 'div.gs'; // This is a higher-level container

        // --- END OF GMAIL SELECTOR AREA ---

        try {
            console.log(`Content Script: Attempting to find Gmail subject with selector: "${subjectSelector}"`);
            subjectElement = document.querySelector(subjectSelector);
            if (subjectElement) {
                subject = subjectElement.textContent?.trim() || '';
                console.log("Content Script: Found Gmail subject:", subject.substring(0, 100) + '...');
            } else {
                console.warn("Content Script: Could not find Gmail subject element using selector:", subjectSelector);
                error = (error ? error + "; " : "") + `Could not find Gmail subject element (tried '${subjectSelector}').`;
            }

            console.log(`Content Script: Attempting to find Gmail body with selector: "${bodySelector}"`);
            bodyElement = document.querySelector(bodySelector);
            if (bodyElement) {
                 body = extractTextWithLineBreaks(bodyElement);
                console.log("Content Script: Found Gmail body (first 100 chars):", body.substring(0, 100) + '...');
            } else {
                console.warn("Content Script: Could not find Gmail body element using selector:", bodySelector);
                error = (error ? error + "; " : "") + `Could not find Gmail body element (tried '${bodySelector}').`;
                 // Try alternative selector? Add more complex logic here if needed.
            }

            // If both failed significantly, report a clearer error
             if (!subjectElement && !bodyElement) {
                error = `Could not find subject or body using current Gmail selectors ('${subjectSelector}', '${bodySelector}'). Gmail's structure might have changed. Please update content_script.js.`;
             } else if (!body && bodyElement) {
                 // Body element found, but no text extracted? Could be an empty email or issue with text extraction.
                 console.warn("Content Script: Found body element but extracted no text content.");
                 // Allow sending null body, backend handles it.
             } else if (!subject && subjectElement) {
                 console.warn("Content Script: Found subject element but extracted no text content.");
                 // Allow sending null subject
             }


        } catch (e) {
             console.error("Content Script: Error during DOM extraction:", e);
             error = `Error extracting content: ${e.message}`;
        }

        // Send the extracted data (or error) back to the background script
         console.log("Content Script: Sending message to background script.");
         chrome.runtime.sendMessage({
            action: "emailData",
            data: { subject: subject, body: body }, // Send even if null
            error: error // Send error message if any occurred
         }).catch(e => console.error("Content Script: Error sending message to background:", e));
    }

    /**
     * Helper function to extract text content while trying to preserve line breaks
     * from common elements like <p>, <div>, <br>.
     */
    function extractTextWithLineBreaks(element) {
        let text = '';
        if (!element) return text;

        // Iterate through child nodes
        element.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                text += node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                 // Ignore elements that typically don't contain visible user content in Gmail context
                 if (node.tagName.toLowerCase() === 'style' || node.tagName.toLowerCase() === 'script') {
                     return;
                 }

                const displayStyle = window.getComputedStyle(node).display;
                const tagName = node.tagName.toLowerCase();

                // Add line break before block elements or <br> if text isn't already ending with newline
                 // Consider display style as well as tag name
                if (displayStyle === 'block' || ['p', 'div', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'hr', 'blockquote', 'table', 'tr'].includes(tagName)) {
                    if (text.length > 0 && !/\s\n$/.test(text) && !text.endsWith('\n')) { // Avoid double newlines if space already exists
                         text += '\n';
                    }
                }

                 // Recursively get text from child elements
                 text += extractTextWithLineBreaks(node);

                 // Add line break after block elements or <br> if text isn't already ending with newline
                 if (displayStyle === 'block' || ['p', 'div', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'hr', 'blockquote', 'table', 'tr'].includes(tagName)) {
                    if (!text.endsWith('\n')) {
                         text += '\n';
                    }
                } else if (displayStyle === 'inline') {
                     // Add space after inline elements if needed (prevents words running together)
                     if (node.nextSibling && node.nextSibling.nodeType === Node.TEXT_NODE && !/^\s/.test(node.nextSibling.textContent)) {
                          if (!/\s$/.test(text)) {
                            text += ' ';
                          }
                     } else if (node.nextSibling && node.nextSibling.nodeType === Node.ELEMENT_NODE && window.getComputedStyle(node.nextSibling).display.startsWith('inline')) {
                          if (!/\s$/.test(text)) {
                            text += ' ';
                          }
                     }
                }
            }
        });
        // Clean up multiple newlines and leading/trailing whitespace
        return text.replace(/\n{3,}/g, '\n\n').trim();
    }

    // Run the extraction function
    extractEmailContent();

})(); // End of IIFE