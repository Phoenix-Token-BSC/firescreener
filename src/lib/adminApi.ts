/**
 * Helper function to make authenticated API calls as an admin
 * Automatically includes the admin email from localStorage
 */
export async function adminFetch(
  url: string,
  options: RequestInit = {}
) {
  const adminEmail = localStorage.getItem('adminEmail');

  if (!adminEmail) {
    throw new Error('Admin email not found in session');
  }

  const headers = new Headers(options.headers || {});
  headers.set('x-user-email', adminEmail);

  return fetch(url, {
    ...options,
    headers,
  });
}
