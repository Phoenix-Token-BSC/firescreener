/**
 * Authenticated admin API call.
 *
 * Auth travels in the HttpOnly `admin_session` cookie set by /api/admin/login, which the
 * browser attaches automatically on same-origin requests. There is deliberately nothing
 * to attach here: this used to send an `x-user-email` header read from localStorage, and
 * because the server trusted that header, anyone who knew an admin's email address had
 * full admin API access without a password.
 */
export async function adminFetch(url: string, options: RequestInit = {}) {
  return fetch(url, {
    ...options,
    credentials: 'same-origin',
  });
}

/** Ends the admin session server-side (clears the cookie). */
export async function adminLogout() {
  try {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
  } finally {
    localStorage.removeItem('adminEmail');
  }
}
