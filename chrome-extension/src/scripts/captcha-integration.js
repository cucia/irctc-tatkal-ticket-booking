/**
 * Captcha Integration Module
 * Integrates auto-captcha solver with the main autofill flow
 * This module handles the captcha page when it appears during booking
 */

import { autoSolveCaptchaBypass, startCaptchaMonitoring } from './auto-captcha-solver.js';
import Logger from './logger.js';

/**
 * Handle captcha automatically when detected
 * Can be called from autoFillContent.js when captcha page appears
 */
export async function handleCaptchaAutomatically(options = {}) {
  const {
    retries = 3,
    timeout = 30000,
    updateStatus = null,
    autoSubmit = true
  } = options;

  Logger.info("Handling captcha automatically...");
  
  try {
    // Try to solve captcha
    for (let attempt = 1; attempt <= retries; attempt++) {
      Logger.info(`Captcha solve attempt ${attempt}/${retries}`);
      
      if (updateStatus) {
        updateStatus(`Auto-solving captcha (attempt ${attempt}/${retries})...`);
      }

      const result = await Promise.race([
        autoSolveCaptchaBypass(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Captcha solve timeout')), timeout)
        )
      ]);

      if (result) {
        Logger.info("Captcha solved successfully!");
        if (updateStatus) {
          updateStatus('Captcha solved successfully!');
        }
        return true;
      }

      if (attempt < retries) {
        // Wait before retry
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    Logger.warn("Failed to auto-solve captcha after all retries");
    if (updateStatus) {
      updateStatus('Failed to auto-solve captcha. Please solve manually.');
    }
    return false;

  } catch (error) {
    Logger.error("Error handling captcha:", error.message);
    if (updateStatus) {
      updateStatus('Error solving captcha: ' + error.message);
    }
    return false;
  }
}

/**
 * Monitor for captcha page and handle automatically
 * Can be started at the beginning of autofill to continuously monitor
 */
export function startAutoCaptchaMonitoring(autoFillStatusCallback) {
  Logger.info("Starting automatic captcha monitoring...");

  const stopMonitoring = startCaptchaMonitoring({
    pollInterval: 1000,
    maxWaitTime: 600000, // 10 minutes
    autoSubmit: true
  });

  // Return stop function for cleanup
  return stopMonitoring;
}

/**
 * Enhanced captcha handling for premium_captcha mode
 * This replaces the manual prompt with automatic solving
 */
export async function enhancedPremiumCaptchaMode(updateStatus) {
  Logger.info("Enhanced captcha mode activated");

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      Logger.warn("Captcha handling timeout");
      reject(new Error('Captcha handling timeout'));
    }, 120000); // 2 minutes timeout

    handleCaptchaAutomatically({
      retries: 3,
      timeout: 30000,
      updateStatus: updateStatus,
      autoSubmit: true
    }).then(success => {
      clearTimeout(timeout);
      resolve(success);
    }).catch(error => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

export default {
  handleCaptchaAutomatically,
  startAutoCaptchaMonitoring,
  enhancedPremiumCaptchaMode
};
