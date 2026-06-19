/**
 * Sanitizes an input string by removing dangerous characters and converting them
 * to their safe HTML entity equivalents. This prevents XSS and breaks SQL injection patterns.
 */
export const sanitizeInput = (input: string | null | undefined): string => {
  if (!input) return "";
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
};

/**
 * Validates an email address using a strict regular expression.
 */
export const isValidEmail = (email: string): boolean => {
  if (!email) return false;
  // Standard strict email regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};
