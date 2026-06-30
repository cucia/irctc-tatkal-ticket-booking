import { REVIEW_SELECTORS } from './domSelectors';
import { delay, simulateTyping, waitForElementToAppear } from './utils';
import { scrollToElement } from './elementUtils';
import extractTextFromImage from './ocr-reader';
import Logger from './logger';

async function handleCaptchaWithRetry(maxAttempts = 5) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const captchaImage = document.querySelector(REVIEW_SELECTORS.REVIEW_CAPTCHA_IMAGE);
    if (!captchaImage) break;

    const currentUri = captchaImage.src;
    let captchaText = await extractTextFromImage(currentUri);

    // Validate: 4-6 alphanumeric chars
    if (!captchaText || !/^[a-zA-Z0-9]{4,6}$/.test(captchaText)) {
      Logger.warn(`Attempt ${attempt}: Invalid format`);
      attempt < maxAttempts && await delay(300);
      continue;
    }

    // Clear input before filling
    const input = document.getElementById(REVIEW_SELECTORS.REVIEW_CAPTCHA_INPUT);
    if (input) {
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Fill and submit
    if (input) {
      input.value = captchaText;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
      Logger.info(`Filled: ${captchaText}`);
    }

    const button = document.querySelector(REVIEW_SELECTORS.REVIEW_SUBMIT_BUTTON);
    if (button) {
      await button.click();
    }

    // Check if captcha changed
    await delay(300);
    const newImage = document.querySelector(REVIEW_SELECTORS.REVIEW_CAPTCHA_IMAGE);

    if (!newImage) {
      Logger.info("Captcha success");
      return true;
    }

    const newUri = newImage.src;

    if (newUri !== currentUri) {
      Logger.warn(`Attempt ${attempt}: New captcha loaded`);
      continue;
    }

    // Same URI - wait for page load
    await delay(800);
    if (!document.querySelector(REVIEW_SELECTORS.REVIEW_CAPTCHA_IMAGE)) {
      Logger.info("Captcha accepted");
      return true;
    }
  }

  Logger.error("Captcha failed after 5 attempts");
  return false;
}

async function handleCaptchaAndContinue() {
  await waitForElementToAppear(REVIEW_SELECTORS.REVIEW_CAPTCHA_IMAGE);

  const input = document.getElementById(REVIEW_SELECTORS.REVIEW_CAPTCHA_INPUT);
  const image = document.querySelector(REVIEW_SELECTORS.REVIEW_CAPTCHA_IMAGE);

  if (!image || !input) {
    Logger.warn("Captcha elements not found");
    return;
  }

  await scrollToElement(input);
  await delay(100);

  const success = await handleCaptchaWithRetry(5);

  if (!success) {
    const header = document.querySelector(REVIEW_SELECTORS.REVIEW_TRAIN_HEADER);
    const available = header?.querySelector(REVIEW_SELECTORS.REVIEW_AVAILABLE);
    const waiting = header?.querySelector(REVIEW_SELECTORS.REVIEW_WAITING);
    const seats = (available || waiting)?.textContent;

    const value = prompt(`Current Seats: ${seats}\nEnter Captcha:`, "");
    if (value) {
      await simulateTyping(input, value);
      await delay(50);
      document.querySelector(REVIEW_SELECTORS.REVIEW_SUBMIT_BUTTON)?.click();
    }
  }
}

export { handleCaptchaAndContinue };
