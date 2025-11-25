// Error handling utilities

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
};

export const handleApiError = (error: unknown): string => {
  const message = getErrorMessage(error);
  
  // Map common error messages to user-friendly ones
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Unable to connect to the server. Please check your connection.';
  }
  
  if (message.includes('404')) {
    return 'The requested resource was not found.';
  }
  
  if (message.includes('429')) {
    return 'Too many requests. Please wait a moment and try again.';
  }
  
  if (message.includes('500') || message.includes('503')) {
    return 'Server error. Please try again later.';
  }
  
  return message || 'An error occurred. Please try again.';
};

