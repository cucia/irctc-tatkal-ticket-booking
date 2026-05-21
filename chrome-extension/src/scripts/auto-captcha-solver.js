/**
 * Auto Captcha Solver - Enhanced with Copyfish OCR Integration
 * Automatically extracts and solves IRCTC captcha using OCR without user prompts
 * Based on Copyfish OCR best practices: https://github.com/A9T9/Copyfish
 */

import Logger from './logger';

/**
 * Main function to handle captcha extraction and auto-solve
 * Returns the extracted captcha text for manual filling or auto-fill
 */
export async function autoSolveCaptchaBypass() {
  try {
    Logger.info("[OCR INFO] Starting automatic captcha solver...");
    
    // Find captcha image with multiple selector attempts (like Copyfish does)
    const captchaImage = findCaptchaImage();
    const captchaInput = findCaptchaInput();

    if (!captchaImage) {
      Logger.warn("[OCR INFO] Captcha image not found!");
      return "";
    }

    if (!captchaInput) {
      Logger.warn("[OCR INFO] Captcha input field not found!");
    }

    Logger.info("[OCR INFO] Found captcha image, extracting text...");

    // Extract text from captcha using OCR (Copyfish approach)
    let captchaText = await extractCaptchaTextWithRetry(captchaImage, 3);
    
    if (!captchaText || captchaText.trim().length === 0) {
      Logger.warn("[OCR INFO] Failed to extract captcha text via OCR");
      return "";
    }

    Logger.info(`[OCR INFO] Extracted captcha text: ${captchaText}`);
    return captchaText;

  } catch (error) {
    Logger.error("[OCR INFO] Error in auto-solve captcha:", error.message);
    return "";
  }
}

/**
 * Find captcha image with multiple selector strategies
 */
function findCaptchaImage() {
  // Strategy 1: Look for common captcha image selectors
  const selectors = [
    'img.captcha-img',           // IRCTC specific
    'img[src*="captcha"]',
    'img[alt*="captcha" i]',
    'img[id*="captcha" i]',
    'img[class*="captcha" i]',
    'canvas[id*="captcha" i]',
    'canvas[class*="captcha" i]'
  ];

  for (const selector of selectors) {
    const img = document.querySelector(selector);
    if (img && img.offsetParent !== null) {
      Logger.info(`Found captcha image using selector: ${selector}`);
      return img;
    }
  }

  // Strategy 2: Look for image near "captcha" text label
  const captchaLabel = Array.from(document.querySelectorAll('label, span, div'))
    .find(el => el.textContent.toLowerCase().includes('captcha'));
  
  if (captchaLabel) {
    const img = captchaLabel.querySelector('img') || captchaLabel.parentElement?.querySelector('img');
    if (img) {
      Logger.info("Found captcha image near captcha label");
      return img;
    }
  }

  return null;
}

/**
 * Find captcha input field with multiple selector strategies
 */
function findCaptchaInput() {
  const selectors = [
    'input[placeholder="Enter Captcha"]',
    'input[placeholder*="captcha" i]',
    'input[id*="captcha" i]',
    'input[name*="captcha" i]',
    'input[type="text"][placeholder*="verification" i]'
  ];

  for (const selector of selectors) {
    const input = document.querySelector(selector);
    if (input && input.offsetParent !== null) {
      Logger.info(`Found captcha input using selector: ${selector}`);
      return input;
    }
  }

  return null;
}

/**
 * Extract text from captcha image with retry logic (Copyfish approach)
 */
async function extractCaptchaTextWithRetry(captchaImage, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const imageData = await getImageAsBase64(captchaImage);
      
      if (!imageData) {
        Logger.warn(`Attempt ${attempt}: Failed to get image data`);
        continue;
      }

      // Call OCR API
      const ocrResult = await callOCRAPIWithFallback(imageData, attempt);
      
      if (ocrResult && ocrResult.trim()) {
        return cleanOCRText(ocrResult);
      }

    } catch (error) {
      Logger.warn(`Attempt ${attempt} failed:`, error.message);
    }

    // Wait before retry
    if (attempt < maxRetries) {
      await delay(500);
    }
  }

  return "";
}

/**
 * Get image as base64 from various sources
 * Handles: data URLs, blob URLs, regular URLs, and canvas elements
 */
async function getImageAsBase64(imageElement) {
  try {
    // Handle canvas elements
    if (imageElement.tagName === 'CANVAS') {
      return imageElement.toDataURL('image/png');
    }

    // Handle img elements
    const src = imageElement.src || imageElement.getAttribute('data-src');
    
    if (!src) {
      Logger.warn("Image source not found");
      return null;
    }

    // If already base64
    if (src.startsWith('data:image')) {
      return src;
    }

    // If it's a blob URL
    if (src.startsWith('blob:')) {
      return await blobUrlToBase64(src);
    }

    // If it's a regular URL, fetch and convert
    return await urlToBase64(src);

  } catch (error) {
    Logger.error("Error getting image as base64:", error.message);
    return null;
  }
}

/**
 * Convert URL to base64 (with CORS handling)
 */
async function urlToBase64(imageUrl) {
  try {
    const response = await fetch(imageUrl, {
      mode: 'cors',
      credentials: 'include'
    });
    const blob = await response.blob();
    return blobToBase64(blob);
  } catch (error) {
    Logger.error("Error converting URL to base64:", error.message);
    return null;
  }
}

/**
 * Convert blob URL to base64
 */
async function blobUrlToBase64(blobUrl) {
  try {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return blobToBase64(blob);
  } catch (error) {
    Logger.error("Error converting blob URL to base64:", error.message);
    return null;
  }
}

/**
 * Convert blob to base64 string
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Call OCR.space API with fallback to different servers
 * Based on Copyfish's server failover logic
 */
async function callOCRAPIWithFallback(base64Image, attempt = 1) {
  const servers = [
    'https://api.ocr.space/parse/image',
    'https://ocr.space/parse/image',
    'https://apiv2.ocr.space/parse/image'
  ];

  // Try different servers if one fails
  for (let i = 0; i < servers.length; i++) {
    try {
      const result = await callOCRAPI(base64Image, servers[i]);
      if (result && result.trim()) {
        return result;
      }
    } catch (error) {
      Logger.warn(`OCR server ${i + 1} failed:`, error.message);
      continue;
    }
  }

  return "";
}

/**
 * Call OCR.space API to extract text from image
 * This mimics Copyfish's _postToOCR approach
 */
async function callOCRAPI(base64Image, apiUrl = 'https://api.ocr.space/parse/image') {
  try {
    const formData = new FormData();
    
    // Build form data similar to Copyfish
    formData.append("apikey", "helloworld"); // Free tier API key
    formData.append("language", "eng");
    formData.append("isOverlayRequired", false);
    formData.append("OCREngine", "1"); // Engine 1 (Tesseract)
    
    // Convert base64 to blob
    const blob = base64ToBlob(base64Image);
    formData.append("filename", "captcha.png");
    formData.append("file", blob, "captcha.png");

    const response = await Promise.race([
      fetch(apiUrl, {
        method: "POST",
        body: formData,
        timeout: 30000
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OCR request timeout')), 30000)
      )
    ]);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    Logger.info("OCR API Response:", result);

    // Handle Copyfish-style error checking
    if (result.IsErroredOnProcessing) {
      Logger.warn(`OCR Error: ${result.ErrorMessage}`);
      return "";
    }

    if (result.OCRExitCode !== 1) {
      Logger.warn(`OCR Exit Code: ${result.OCRExitCode}`);
      return "";
    }

    if (result.ParsedResults && result.ParsedResults.length > 0) {
      const parsedText = result.ParsedResults[0].ParsedText;
      return parsedText.trim();
    }

    return "";
  } catch (error) {
    Logger.error("OCR API call failed:", error.message);
    throw error;
  }
}

/**
 * Convert base64 string to Blob
 */
function base64ToBlob(base64String) {
  const arr = base64String.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  
  return new Blob([u8arr], { type: mime });
}

/**
 * Clean OCR extracted text to match IRCTC captcha format
 * IRCTC captcha is typically 4-6 alphanumeric characters
 */
function cleanOCRText(text) {
  if (!text) return "";
  
  // Remove extra whitespace
  let cleaned = text.replace(/\s+/g, '').trim();
  
  // Remove common OCR errors and special characters
  cleaned = cleaned.replace(/[^a-zA-Z0-9]/g, '');
  
  // IRCTC captcha is usually 4-6 characters
  // Take what we have if < 4, otherwise take first 6
  if (cleaned.length < 4) {
    Logger.warn(`Cleaned text too short: "${cleaned}" (${cleaned.length} chars)`);
  }
  
  cleaned = cleaned.substring(0, 6);
  
  Logger.info(`Cleaned OCR text: "${cleaned}"`);
  return cleaned;
}

/**
 * Fill the captcha input field with extracted text
 * Mimics real user typing for bot detection evasion
 */
async function fillCaptchaField(captchaInput, text) {
  try {
    // Focus and clear
    captchaInput.click();
    captchaInput.focus();
    captchaInput.value = '';
    
    // Dispatch focus event
    captchaInput.dispatchEvent(new FocusEvent('focus', { bubbles: true }));

    // Simulate typing with realistic delays
    for (let i = 0; i < text.length; i++) {
      captchaInput.value += text[i];
      
      // Trigger input events
      captchaInput.dispatchEvent(new Event('input', { bubbles: true }));
      captchaInput.dispatchEvent(new Event('change', { bubbles: true }));
      captchaInput.dispatchEvent(new KeyboardEvent('keydown', {
        key: text[i],
        code: `Key${text[i].toUpperCase()}`,
        bubbles: true
      }));
      captchaInput.dispatchEvent(new KeyboardEvent('keyup', {
        key: text[i],
        code: `Key${text[i].toUpperCase()}`,
        bubbles: true
      }));
      
      // Realistic typing delay: 50-150ms between characters
      await delay(50 + Math.random() * 100);
    }

    Logger.info("Captcha field filled successfully");
  } catch (error) {
    Logger.error("Error filling captcha field:", error.message);
  }
}

/**
 * Submit the captcha form
 * Looks for submit button with multiple strategies
 */
async function submitCaptchaForm() {
  try {
    const submitButton = findSubmitButton();

    if (!submitButton) {
      Logger.warn("Submit button not found");
      return false;
    }

    // Scroll button into view if needed
    if (submitButton.offsetParent === null) {
      submitButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await delay(300);
    }

    // Small delay before clicking
    await delay(100);

    // Click the submit button
    submitButton.click();
    Logger.info("Captcha form submitted");
    
    return true;
  } catch (error) {
    Logger.error("Error submitting captcha form:", error.message);
    return false;
  }
}

/**
 * Find the captcha submit button with multiple strategies
 */
function findSubmitButton() {
  const buttonTexts = ['Continue', 'Submit', 'Verify', 'OK', 'Proceed', 'Next'];
  
  const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'));
  
  // First, try to find by text content
  for (const text of buttonTexts) {
    const button = buttons.find(btn => {
      const btnText = btn.textContent || btn.value;
      return btnText.trim().toLowerCase().includes(text.toLowerCase()) &&
             btn.offsetParent !== null;
    });
    
    if (button) {
      Logger.info(`Found submit button: ${text}`);
      return button;
    }
  }

  // Fallback: look for button near captcha input
  const captchaInput = findCaptchaInput();
  if (captchaInput) {
    const form = captchaInput.closest('form');
    if (form) {
      const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
      if (submitBtn) {
        Logger.info("Found submit button in form");
        return submitBtn;
      }
    }
  }

  return null;
}

/**
 * Monitor for captcha and auto-solve when detected
 * Useful for continuous monitoring during the booking flow
 */
export function startCaptchaMonitoring(options = {}) {
  const {
    pollInterval = 1000,
    maxWaitTime = 300000, // 5 minutes
    autoSubmit = true
  } = options;

  let startTime = Date.now();
  let monitoring = true;

  Logger.info("Starting captcha monitoring with interval:", pollInterval);

  const monitor = setInterval(async () => {
    if (!monitoring) {
      clearInterval(monitor);
      return;
    }

    if (Date.now() - startTime > maxWaitTime) {
      Logger.warn("Captcha monitoring timeout reached");
      clearInterval(monitor);
      monitoring = false;
      return;
    }

    const captchaInput = findCaptchaInput();
    
    if (captchaInput && captchaInput.offsetParent !== null) {
      // Captcha is visible, try to solve
      Logger.info("Captcha detected, starting auto-solve...");
      monitoring = false;
      clearInterval(monitor);

      const result = await autoSolveCaptchaBypass();
      if (!result) {
        Logger.warn("Auto-solve failed, stopping monitoring");
      }
    }
  }, pollInterval);

  // Return function to stop monitoring
  return () => {
    monitoring = false;
    clearInterval(monitor);
    Logger.info("Captcha monitoring stopped");
  };
}

/**
 * Utility delay function
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
  autoSolveCaptchaBypass,
  startCaptchaMonitoring,
  findCaptchaImage,
  findCaptchaInput,
  extractCaptchaTextWithRetry
};
